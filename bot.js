const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
puppeteer.use(StealthPlugin());

/**
 * Mencari path Google Chrome / Chromium / Edge di Windows, Linux, dan Mac
 */
async function findChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    try {
      const customPath = String(process.env.PUPPETEER_EXECUTABLE_PATH);
      if (fs.existsSync(customPath)) {
        return customPath;
      }
    } catch (e) {}
  }

  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  // 1. Cek path Windows langsung
  if (isWin) {
    const localAppData = process.env.LOCALAPPDATA || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Local') : '');
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';

    const winPaths = [
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      localAppData ? path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      localAppData ? path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null
    ].filter(Boolean);

    for (const p of winPaths) {
      try {
        if (typeof p === 'string' && fs.existsSync(p)) return p;
      } catch (e) {}
    }

    try {
      const whereChrome = execSync('where chrome 2>nul').toString().split('\r\n')[0].trim();
      if (whereChrome && typeof whereChrome === 'string' && fs.existsSync(whereChrome)) return whereChrome;
    } catch (e) {}

    try {
      const whereEdge = execSync('where msedge 2>nul').toString().split('\r\n')[0].trim();
      if (whereEdge && typeof whereEdge === 'string' && fs.existsSync(whereEdge)) return whereEdge;
    } catch (e) {}
  }

  // 2. Cek path Mac langsung
  if (isMac) {
    const macPaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    ];
    for (const p of macPaths) {
      try {
        if (typeof p === 'string' && fs.existsSync(p)) return p;
      } catch (e) {}
    }
  }

  // 3. Cek path Linux langsung
  const linuxPaths = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/chromium/chrome'
  ];
  for (const p of linuxPaths) {
    try {
      if (typeof p === 'string' && fs.existsSync(p)) return p;
    } catch (e) {}
  }

  try {
    const whichChrome = execSync('which google-chrome || which google-chrome-stable || which chromium || which chromium-browser 2>/dev/null')
      .toString()
      .trim();
    if (whichChrome && typeof whichChrome === 'string' && fs.existsSync(whichChrome)) return whichChrome;
  } catch (e) {}

  // 4. Cek Puppeteer Bundled Chrome (Async Await)
  try {
    const pptr = require('puppeteer');
    if (typeof pptr.executablePath === 'function') {
      const p = await pptr.executablePath();
      if (p && typeof p === 'string' && fs.existsSync(p)) return p;
    }
  } catch (e) {}

  return undefined;
}

/**
 * Meluncurkan browser dengan strategi fallback otomatis
 */
async function launchBrowser(runHeadless, log) {
  const isWin = process.platform === 'win32';
  const chromePath = await findChromePath();

  const commonArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1280,900'
  ];

  if (!isWin) {
    commonArgs.push('--disable-dev-shm-usage', '--disable-gpu');
  }

  const strategies = [];

  // 1. Coba path yang terdeteksi
  if (chromePath) {
    strategies.push({
      name: `Chrome (${chromePath})`,
      options: {
        executablePath: chromePath,
        headless: runHeadless,
        args: commonArgs
      }
    });
  }

  // 2. Coba default Puppeteer bundled browser
  strategies.push({
    name: 'Puppeteer Bundled Browser',
    options: {
      headless: runHeadless,
      args: commonArgs
    }
  });

  // 3. Coba system channels di Windows/Mac
  if (isWin || process.platform === 'darwin') {
    strategies.push({
      name: 'System Google Chrome',
      options: {
        channel: 'chrome',
        headless: runHeadless,
        args: commonArgs
      }
    });

    if (isWin) {
      strategies.push({
        name: 'System Microsoft Edge',
        options: {
          channel: 'msedge',
          headless: runHeadless,
          args: commonArgs
        }
      });
    }
  }

  let lastError = null;
  for (const strategy of strategies) {
    try {
      log(`Membuka browser via [${strategy.name}] (Headless: ${runHeadless})...`);
      const browser = await puppeteer.launch(strategy.options);
      log(`✅ Browser berhasil dibuka: ${strategy.name}`);
      return browser;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Gagal meluncurkan browser Google Chrome / Chromium.');
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
 * @param {boolean} [options.headless] - Mode headless
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
  let retrySeconds = 10;

  // Penentuan mode Headless:
  // Di Windows / Mac / Desktop: DEFAULT FALSE (pasti muncul di layar!)
  // Di Linux Server tanpa DISPLAY: DEFAULT TRUE
  let runHeadless = false;
  if (typeof headless === 'boolean') {
    runHeadless = headless ? 'new' : false;
  } else if (process.env.HEADLESS === 'true') {
    runHeadless = 'new';
  } else if (process.platform === 'linux' && !process.env.DISPLAY) {
    runHeadless = 'new';
  } else {
    runHeadless = false;
  }

  try {
    browser = await launchBrowser(runHeadless, log);

    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    try {
      await page.bringToFront();
    } catch (e) {}

    // Hapus total semua cookies, cache, dan localStorage sebelum membuka halaman
    try {
      const client = await page.target().createCDPSession();
      await client.send('Network.clearBrowserCookies');
      await client.send('Network.clearBrowserCache');
      await client.send('Storage.clearDataForOrigin', {
        origin: 'https://pawainusantara.vercel.app',
        storageTypes: 'all'
      });
    } catch (e) {}

    // Set User Agent realistis
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

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

    // Cek awal jika halaman sudah terkunci "Sudah memberikan suara"
    const initialCheck = await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"], form button.primary');
      const text = btn ? btn.innerText.trim() : '';
      if (text.includes('Sudah memberikan suara') || text.includes('Voting Ditutup')) {
        return text;
      }
      return null;
    });

    if (initialCheck) {
      log(`⏭️ [SKIP INSTAN] Halaman terdeteksi "${initialCheck}". Langsung melewati pemilih ini...`);
      return {
        success: false,
        alreadyVoted: true,
        message: initialCheck
      };
    }

    // Bersihkan nilai input jika ada
    await page.click('input[name="voter_name"]', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    log('Mengisi Nama Lengkap...');
    await page.type('input[name="voter_name"]', name, { delay: 40 });

    await page.click('input[name="voter_phone"]', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    log('Mengisi Nomor Handphone...');
    await page.type('input[name="voter_phone"]', phone, { delay: 40 });

    log('Jendela browser aktif di layar.');
    log('💡 Silakan klik centang "Verify you are human" di layar browser...');

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

      // Cek apakah tombol atau halaman menunjukkan "Sudah memberikan suara" (langsung skip instan)
      if (
        state.btnText.includes('Sudah memberikan suara') || 
        state.btnText.includes('Nomor sudah pernah') ||
        state.errorText.includes('sudah pernah') ||
        state.errorText.includes('Sudah memberikan')
      ) {
        const msg = state.btnText || state.errorText || 'Sudah memberikan suara';
        log(`⏭️ [SKIP INSTAN] Terdeteksi status "${msg}". Langsung melewati pemilih ini...`);
        return {
          success: false,
          alreadyVoted: true,
          message: msg
        };
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
