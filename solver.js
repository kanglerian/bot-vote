/**
 * Modul Solver Cloudflare Turnstile menggunakan layanan API pihak ketiga (2Captcha / CapSolver)
 */

/**
 * Menyelesaikan Cloudflare Turnstile menggunakan 2Captcha
 * @param {string} apiKey - API Key 2Captcha Anda
 * @param {string} websiteUrl - URL halaman target (https://pawainusantara.vercel.app/mobil-22)
 * @param {string} siteKey - Sitekey Turnstile (0x4AAAAAAEQG3hb7XG-CUqRR)
 * @param {function} log - Fungsi logger
 * @returns {Promise<string>} Token Turnstile
 */
async function solveWith2Captcha(apiKey, websiteUrl, siteKey, log = console.log) {
  log('Mengirim permintaan Turnstile ke 2Captcha...');

  // 1. Buat Task
  const createRes = await fetch('https://api.2captcha.com/createTask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientKey: apiKey,
      task: {
        type: 'TurnstileTaskProxyless',
        websiteURL: websiteUrl,
        websiteKey: siteKey,
        action: 'vote'
      }
    })
  });

  const createData = await createRes.json();
  if (createData.errorId !== 0) {
    throw new Error(`2Captcha CreateTask Error: ${createData.errorDescription || JSON.stringify(createData)}`);
  }

  const taskId = createData.taskId;
  log(`Task 2Captcha dibuat (ID: ${taskId}). Menunggu hasil pemecahan...`);

  // 2. Polling hasil task
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise(r => setTimeout(r, 3000)); // Cek setiap 3 detik

    const resultRes = await fetch('https://api.2captcha.com/getTaskResult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientKey: apiKey,
        taskId: taskId
      })
    });

    const resultData = await resultRes.json();
    if (resultData.errorId !== 0) {
      throw new Error(`2Captcha Result Error: ${resultData.errorDescription || JSON.stringify(resultData)}`);
    }

    if (resultData.status === 'ready') {
      log('✅ 2Captcha berhasil mendapatkan token Turnstile!');
      return resultData.solution.token;
    }

    log(`Sedang memproses Turnstile (${attempt + 1}/30)...`);
  }

  throw new Error('2Captcha Timeout: Gagal mendapatkan token dalam waktu 90 detik.');
}

/**
 * Menyelesaikan Cloudflare Turnstile menggunakan CapSolver
 * @param {string} apiKey - API Key CapSolver Anda
 * @param {string} websiteUrl - URL halaman target
 * @param {string} siteKey - Sitekey Turnstile
 * @param {function} log - Fungsi logger
 * @returns {Promise<string>} Token Turnstile
 */
async function solveWithCapSolver(apiKey, websiteUrl, siteKey, log = console.log) {
  log('Mengirim permintaan Turnstile ke CapSolver...');

  // 1. Buat Task
  const createRes = await fetch('https://api.capsolver.com/createTask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientKey: apiKey,
      task: {
        type: 'AntiTurnstileTaskProxyless',
        websiteURL: websiteUrl,
        websiteKey: siteKey,
        metadata: {
          action: 'vote'
        }
      }
    })
  });

  const createData = await createRes.json();
  if (createData.errorId !== 0) {
    throw new Error(`CapSolver CreateTask Error: ${createData.errorDescription || JSON.stringify(createData)}`);
  }

  // Jika langsung instan ready
  if (createData.status === 'ready' && createData.solution) {
    log('✅ CapSolver instan mendapatkan token Turnstile!');
    return createData.solution.token;
  }

  const taskId = createData.taskId;
  log(`Task CapSolver dibuat (ID: ${taskId}). Menunggu hasil pemecahan...`);

  // 2. Polling hasil task
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise(r => setTimeout(r, 2000)); // Cek setiap 2 detik

    const resultRes = await fetch('https://api.capsolver.com/getTaskResult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientKey: apiKey,
        taskId: taskId
      })
    });

    const resultData = await resultRes.json();
    if (resultData.errorId !== 0) {
      throw new Error(`CapSolver Result Error: ${resultData.errorDescription || JSON.stringify(resultData)}`);
    }

    if (resultData.status === 'ready') {
      log('✅ CapSolver berhasil mendapatkan token Turnstile!');
      return resultData.solution.token;
    }

    log(`Sedang memproses Turnstile (${attempt + 1}/30)...`);
  }

  throw new Error('CapSolver Timeout: Gagal mendapatkan token dalam waktu 60 detik.');
}

/**
 * Helper router untuk menyelesaikan Turnstile berdasarkan provider
 */
async function solveTurnstile({
  provider = process.env.CAPTCHA_PROVIDER || '2captcha',
  apiKey = process.env.CAPTCHA_API_KEY,
  websiteUrl = 'https://pawainusantara.vercel.app/mobil-22',
  siteKey = '0x4AAAAAAEQG3hb7XG-CUqRR',
  log = console.log
}) {
  if (!apiKey) {
    throw new Error('CAPTCHA_API_KEY belum disetel. Harap masukkan API key di file .env atau pengaturan.');
  }

  const prov = provider.toLowerCase();
  if (prov === 'capsolver') {
    return await solveWithCapSolver(apiKey, websiteUrl, siteKey, log);
  } else {
    return await solveWith2Captcha(apiKey, websiteUrl, siteKey, log);
  }
}

module.exports = {
  solveTurnstile,
  solveWith2Captcha,
  solveWithCapSolver
};
