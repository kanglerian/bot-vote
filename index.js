const express = require('express');
const path = require('path');
const { executeVote } = require('./bot');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Server Sent Events (SSE) subscribers
const clients = [];

function broadcast(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch (e) {}
  }
}

// Normalisasi Nomor HP
function normalizePhone(phone) {
  let s = String(phone).replace(/\D/g, '');
  if (s.startsWith('0')) return '62' + s.slice(1);
  if (s.startsWith('62')) return s;
  if (s.startsWith('8')) return '62' + s;
  return s;
}

// Anti-Bentrok & Deduplikasi Data
const successfulPhones = new Set();
const queuedPhones = new Set();

// Queue management
const queue = [];
let isProcessing = false;
let customDelaySeconds = 6; // Default 5-8 detik (otomatis)
let currentCountdown = 0;
let skipCurrentDelay = false;

async function sleepWithCountdown(seconds, reason = 'Jeda terjadwal antar vote') {
  currentCountdown = seconds;
  skipCurrentDelay = false;

  while (currentCountdown > 0) {
    if (skipCurrentDelay) {
      broadcast({ type: 'log', message: '⏩ Jeda dilewati secara manual.', logType: 'warning' });
      break;
    }

    const minutes = Math.floor(currentCountdown / 60);
    const secs = currentCountdown % 60;
    const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    broadcast({
      type: 'countdown',
      secondsRemaining: currentCountdown,
      timeFormatted,
      reason
    });

    await new Promise(r => setTimeout(r, 1000));
    currentCountdown--;
  }

  currentCountdown = 0;
  broadcast({ type: 'countdown_end' });
}

async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  while (queue.length > 0) {
    const item = queue.shift();
    const normPhone = normalizePhone(item.phone);

    broadcast({
      type: 'queue_update',
      remaining: queue.length
    });

    broadcast({
      type: 'log',
      message: `[Antrean] Memproses: ${item.name} (${item.phone}) - Tersisa di antrean: ${queue.length}`,
      logType: 'warning'
    });

    const result = await executeVote({
      name: item.name,
      phone: item.phone,
      carSlug: item.carSlug || 'mobil-22',
      headless: false,
      onLog: (msg) => {
        let logType = '';
        if (msg.includes('SUKSES') || msg.includes('🎉')) logType = 'success';
        if (msg.includes('Error') || msg.includes('GAGAL') || msg.includes('❌')) logType = 'error';
        if (msg.includes('PERINGATAN') || msg.includes('⚠️') || msg.includes('RATE LIMIT')) logType = 'warning';
        broadcast({ type: 'log', message: msg, logType });
      }
    });

    if (result.success || result.alreadyVoted) {
      successfulPhones.add(normPhone);
    }
    queuedPhones.delete(normPhone);

    broadcast({
      type: 'result',
      name: item.name,
      phone: item.phone,
      success: result.success,
      alreadyVoted: result.alreadyVoted || false,
      isRateLimited: result.isRateLimited || false,
      message: result.message
    });

    if (result.alreadyVoted) {
      broadcast({
        type: 'log',
        message: `⏭️ [SKIP] ${item.name} (${item.phone}) dilewati karena status: "${result.message}". Langsung lanjut...`,
        logType: 'warning'
      });
    }

    // Jika terjadi rate limit dari server, kembalikan pemilih ke antrean awal jika gagal
    if (result.isRateLimited) {
      const waitTime = Math.floor(Math.random() * 4) + 5; // 5-8 detik otomatis
      broadcast({
        type: 'log',
        message: `⏳ Terkena limit sistem! Memasukkan kembali ${item.name} ke antrean dan otomatis jeda ${waitTime} detik...`,
        logType: 'warning'
      });
      // Masukkan kembali ke urutan pertama
      queue.unshift(item);
      queuedPhones.add(normPhone);
      broadcast({ type: 'queue_update', remaining: queue.length });

      // Hitung mundur jeda tunggu otomatis (5-8 detik)
      await sleepWithCountdown(waitTime, `Jeda otomatis (${waitTime} detik)`);
      continue;
    }

    // Jika masih ada sisa di antrean, terapkan jeda otomatis 5-8 detik
    if (queue.length > 0) {
      const waitTime = Math.floor(Math.random() * 4) + 5; // 5-8 detik otomatis
      broadcast({
        type: 'log',
        message: `[Jeda Otomatis] Menunggu ${waitTime} detik sebelum memproses pemilih berikutnya...`
      });
      await sleepWithCountdown(waitTime, `Jeda otomatis (${waitTime} detik)`);
    }
  }

  isProcessing = false;
  broadcast({ type: 'log', message: '🏁 Semua data dalam antrean telah selesai diproses!', logType: 'success' });
}

// SSE stream endpoint
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.push(res);

  // Kirim initial state
  res.write(`data: ${JSON.stringify({
    type: 'init',
    delaySeconds: customDelaySeconds,
    queueRemaining: queue.length
  })}\n\n`);

  req.on('close', () => {
    const index = clients.indexOf(res);
    if (index !== -1) clients.splice(index, 1);
  });
});

// Single vote endpoint (Anti-Bentrok)
app.post('/api/vote', async (req, res) => {
  const { name, phone, carSlug, delaySeconds } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ success: false, message: 'Nama dan Nomor HP wajib diisi' });
  }

  const normPhone = normalizePhone(phone);
  if (successfulPhones.has(normPhone)) {
    return res.status(400).json({ success: false, message: `Nomor HP (${phone}) sudah pernah berhasil digunakan sebelumnya.` });
  }
  if (queuedPhones.has(normPhone)) {
    return res.status(400).json({ success: false, message: `Nomor HP (${phone}) saat ini sudah ada dalam antrean.` });
  }

  if (Number.isInteger(delaySeconds) && delaySeconds >= 0) {
    customDelaySeconds = delaySeconds;
  }

  queuedPhones.add(normPhone);
  queue.push({ name, phone, carSlug: carSlug || 'mobil-22' });
  broadcast({ type: 'queue_update', remaining: queue.length });
  processQueue();

  res.json({ success: true, message: `Vote untuk ${name} berhasil dimasukkan ke antrean posisi ke-${queue.length}.` });
});

// Batch vote endpoint (Anti-Bentrok)
app.post('/api/vote-batch', async (req, res) => {
  const { voters, delaySeconds } = req.body;
  if (!Array.isArray(voters) || voters.length === 0) {
    return res.status(400).json({ success: false, message: 'Daftar voters tidak valid' });
  }

  if (Number.isInteger(delaySeconds) && delaySeconds >= 0) {
    customDelaySeconds = delaySeconds;
  }

  let added = 0;
  let skipped = 0;

  for (const v of voters) {
    if (v.name && v.phone) {
      const normPhone = normalizePhone(v.phone);
      if (!successfulPhones.has(normPhone) && !queuedPhones.has(normPhone)) {
        queuedPhones.add(normPhone);
        queue.push({ name: v.name, phone: v.phone, carSlug: v.carSlug || 'mobil-22' });
        added++;
      } else {
        skipped++;
      }
    }
  }

  broadcast({ type: 'queue_update', remaining: queue.length });
  processQueue();

  res.json({
    success: true,
    addedCount: added,
    skippedDuplicates: skipped,
    message: `${added} data pemilih dimasukkan ke antrean${skipped > 0 ? ` (${skipped} duplikat diabaikan otomatis)` : ''}.`
  });
});

// Skip current delay countdown
app.post('/api/skip-delay', (req, res) => {
  skipCurrentDelay = true;
  res.json({ success: true, message: 'Jeda dilewati' });
});

// Reset total antrean, cache nomor HP, dan history
app.post('/api/reset', (req, res) => {
  queue.length = 0;
  successfulPhones.clear();
  queuedPhones.clear();
  skipCurrentDelay = true;
  currentCountdown = 0;

  broadcast({ type: 'reset_all' });
  broadcast({ type: 'queue_update', remaining: 0 });
  broadcast({
    type: 'log',
    message: '🧹 [RESET TOTAL] Semua antrean, data cache nomor HP, dan riwayat telah dibersihkan!',
    logType: 'warning'
  });

  res.json({ success: true, message: 'Semua cache dan antrean telah dibersihkan ulang dari awal.' });
});

// Update delay config
app.post('/api/config', (req, res) => {
  const { delaySeconds } = req.body;
  if (Number.isInteger(delaySeconds) && delaySeconds >= 0) {
    customDelaySeconds = delaySeconds;
    broadcast({ type: 'config_update', delaySeconds: customDelaySeconds });
    return res.json({ success: true, delaySeconds: customDelaySeconds });
  }
  res.status(400).json({ success: false, message: 'Invalid delay' });
});

app.listen(port, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Web Dashboard Bot Vote Aktif!`);
  console.log(`🌐 Akses di browser: http://localhost:${port}`);
  console.log(`⏱️ Jeda waktu default antar vote: 5-8 detik (otomatis)`);
  console.log(`🔒 Sistem Proteksi Duplikasi Nomor HP: Aktif`);
  console.log(`======================================================\n`);
});