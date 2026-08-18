const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
puppeteer.use(StealthPlugin());

/**
 * Mencari path Google Chrome / Chromium di server Linux/VPS
 */
function findChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const possiblePaths = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/chromium/chrome'
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

/**
 * Ekstraksi estimasi waktu tunggu dari teks error
 */
function parseWaitSeconds(text, defaultSeconds = 10) {
  return defaultSeconds;
}

/**
 * Melakukan proses voting untuk Mobil Hias Pawai Nusantara.
 * @param {Object} options
 * @param {string} options.name - Nama lengkap pemilih
 * @param {string} options.phone - Nomor handphone / WhatsApp (contoh: 081234567890)
 * @param {string} [options.carSlug='mobil-22'] - Slug mobil (contoh: mobil-22)
 * @param {boolean} [options.headless] - Mode headless (otomatis true di server CLI tanpa DISPLAY)
 * @param {function} [options.onLog] - Callback untuk streaming status log
 * @returns {Promise<{success: boolean, isRateLimited?: boolean, retryAfterSeconds?: number, message: string}>}
 */
async function executeVote({
  name,
  phone,
  carSlug = 'mobil-22',
  headless,
  onLog = console.log
}) {
  const log = (msg) => {
    const timestamp = new Date().toLocaleTimeString('id-ID');
    const formatted = `[${timestamp}] ${msg}`;
    onLog(formatted);
  };

  log(`Memulai proses vote untuk: ${carSlug}`);
  log(`Data Pemilih: Nama="${name}", No. HP="${phone}"`);

  let browser;
  let rateLimitDetected = false;
  let retrySeconds = 10; // Default 10 detik

  // Otomatis headless jika dijalankan di server CLI tanpa display
  const runHeadless = (typeof headless === 'boolean') 
    ? (headless ? 'new' : false) 
    : (!process.env.DISPLAY || process.env.HEADLESS === 'true' ? 'new' : false);

  const chromePath = findChromePath();

  try {
    const launchOptions = {
      headless: runHeadless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,900'
      ]
    };

    if (chromePath) {
      launchOptions.executablePath = chromePath;
    }

    browser = await puppeteer.launch(launchOptions);

    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // Set User Agent realistis
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    // Pantau response POST /api/votes secara langsung dari network
    page.on('response', async res => {
      if (res.url().includes('/api/votes') && res.request().method() === 'POST') {
        const status = res.status();
        try {
          const body = await res.json();
          if (status === 429 || body.code === 'rate_limited') {
            rateLimitDetected = true;
            const headerRetry = res.headers()['retry-after'];
            retrySeconds = body.retryAfterSeconds || (headerRetry ? parseInt(headerRetry, 10) : 10);
            log(`⚠️ Server mengembalikan Rate Limit (429). Waktu tunggu: ${retrySeconds} detik.`);
          }
        } catch (e) {}
      }
    });

    const targetUrl = `https://pawainusantara.vercel.app/${carSlug}`;
    log(`Membuka halaman target: ${targetUrl}`);

    await page.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: 45000
    });

    log('Menunggu form voting dimuat...');
    await page.waitForSelector('input[name="voter_name"]', { timeout: 15000 });
    await page.waitForSelector('input[name="voter_phone"]', { timeout: 15000 });

    // Bersihkan nilai input jika ada
    await page.click('input[name="voter_name"]', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    log('Mengisi Nama Lengkap...');
    await page.type('input[name="voter_name"]', name, { delay: 40 });

    await page.click('input[name="voter_phone"]', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    log('Mengisi Nomor Handphone...');
    await page.type('input[name="voter_phone"]', phone, { delay: 40 });

    log('Data form terisi. Menunggu verifikasi Cloudflare Turnstile...');

    // Polling status tombol dan token Turnstile
    const maxWaitSeconds = 45;
    let isReady = false;

    for (let i = 0; i < maxWaitSeconds; i++) {
      const state = await page.evaluate(() => {
        const turnstileInput = document.querySelector('[name="cf-turnstile-response"]');
        const submitBtn = document.querySelector('button[type="submit"], form button.primary');
        const errorNotice = document.querySelector('.notice.error');
        const retryBtn = errorNotice ? errorNotice.querySelector('button') : null;
        const successNotice = document.querySelector('.vote-success');

        return {
          hasTurnstileToken: !!(turnstileInput && turnstileInput.value),
          btnText: submitBtn ? submitBtn.innerText.trim() : '',
          btnDisabled: submitBtn ? submitBtn.disabled : true,
          errorText: errorNotice ? errorNotice.innerText.trim() : '',
          hasRetry: !!retryBtn,
          hasSuccess: !!successNotice,
          successText: successNotice ? successNotice.innerText.trim() : ''
        };
      });

      if (state.hasSuccess) {
        log(`🎉 Berhasil! ${state.successText}`);
        return { success: true, message: state.successText };
      }

      // Cek apakah tombol menunjukkan "Mohon tunggu" (sedang dalam masa cooldown)
      if (state.btnText.includes('Mohon tunggu') || state.errorText.toLowerCase().includes('terlalu banyak percobaan')) {
        rateLimitDetected = true;
        const parsed = parseWaitSeconds(state.errorText || state.btnText, 10);
        log(`⚠️ Terkena jeda tunggu server: ${state.errorText || state.btnText}`);
        return {
          success: false,
          isRateLimited: true,
          retryAfterSeconds: parsed,
          message: state.errorText || 'Terlalu banyak percobaan.'
        };
      }

      // Jika tombol sudah aktif (ready)
      if (!state.btnDisabled && state.btnText.toLowerCase().includes('vote')) {
        log(`Tombol vote sudah aktif: "${state.btnText}". Mengirim suara otomatis...`);
        isReady = true;
        break;
      }

      // Jika ada tombol 'Coba lagi' karena Turnstile idle
      if (state.hasRetry && i % 8 === 0 && i > 0) {
        await page.evaluate(() => {
          const retry = document.querySelector('.notice.error button');
          if (retry) retry.click();
        });
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    if (!isReady) {
      throw new Error(`Timeout ${maxWaitSeconds} detik: Verifikasi Turnstile belum selesai.`);
    }

    // Klik tombol submit secara otomatis
    log('Mengklik tombol Submit Vote...');
    await page.evaluate(() => {
      const submitBtn = document.querySelector('button[type="submit"], form button.primary');
      if (submitBtn) submitBtn.click();
    });

    log('Menunggu respons konfirmasi dari server...');
    // Tunggu notifikasi sukses, error, atau rate-limit
    let voteResult = null;
    for (let j = 0; j < 15; j++) {
      await new Promise(r => setTimeout(r, 1000));
      const res = await page.evaluate(() => {
        const success = document.querySelector('.vote-success');
        const errorNotice = document.querySelector('.notice.error');
        const submitBtn = document.querySelector('button[type="submit"], form button.primary');

        if (success) {
          return { status: 'success', text: success.innerText.trim() };
        }
        if (submitBtn && submitBtn.innerText.includes('Mohon tunggu')) {
          return { status: 'rate_limited', text: submitBtn.innerText.trim() };
        }
        if (errorNotice && errorNotice.innerText.trim().length > 0) {
          const text = errorNotice.innerText.trim();
          if (text.toLowerCase().includes('tunggu') || text.toLowerCase().includes('percobaan') || text.toLowerCase().includes('banyak')) {
            return { status: 'rate_limited', text };
          }
          return { status: 'error', text };
        }
        if (submitBtn && submitBtn.innerText.includes('Sudah memberikan')) {
          return { status: 'already_voted', text: submitBtn.innerText.trim() };
        }
        return null;
      });

      if (res || rateLimitDetected) {
        voteResult = res || { status: 'rate_limited', text: 'Terlalu banyak percobaan' };
        break;
      }
    }

    if (rateLimitDetected || (voteResult && voteResult.status === 'rate_limited')) {
      const msg = voteResult ? voteResult.text : 'Terlalu banyak percobaan, jeda 10 detik.';
      const calculatedWait = parseWaitSeconds(msg, retrySeconds || 10);
      log(`⚠️ RATE LIMIT: ${msg}`);
      return {
        success: false,
        isRateLimited: true,
        retryAfterSeconds: calculatedWait,
        message: msg
      };
    }

    if (voteResult && voteResult.status === 'success') {
      log(`✅ SUKSES: Suara untuk ${name} (${phone}) berhasil tercatat!`);
      return { success: true, message: voteResult.text };
    } else if (voteResult && voteResult.status === 'already_voted') {
      log(`⚠️ PERINGATAN: ${voteResult.text}`);
      return { success: false, message: voteResult.text };
    } else if (voteResult && voteResult.status === 'error') {
      log(`❌ GAGAL: ${voteResult.text}`);
      return { success: false, message: voteResult.text };
    } else {
      log('Selesai dikirim. Memeriksa status halaman...');
      return { success: true, message: 'Formulir telah disubmit.' };
    }

  } catch (err) {
    log(`❌ Error: ${err.message}`);
    return { success: false, message: err.message };
  } finally {
    if (browser) {
      await new Promise(r => setTimeout(r, 1000));
      await browser.close();
    }
  }
}

module.exports = { executeVote };
