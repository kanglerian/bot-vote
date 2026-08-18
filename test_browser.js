const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
puppeteer.use(StealthPlugin());

console.log('==================================================');
console.log('🔍 DIAGNOSTIK BROWSER PUPPETEER (WINDOWS / MAC / LINUX)');
console.log('==================================================\n');
console.log('OS Platform:', process.platform);
console.log('Node Version:', process.version);

async function testAll() {
  const isWin = process.platform === 'win32';

  // 1. Cek Path Chrome
  console.log('\n[1] Mencari executable Chrome / Edge di sistem...');
  
  const possiblePaths = [];
  if (isWin) {
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';

    possiblePaths.push(
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    );
  }

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`  ✅ Ditemukan: ${p}`);
    }
  }

  // 2. Cek Bundled Puppeteer
  try {
    const pptr = require('puppeteer');
    if (typeof pptr.executablePath === 'function') {
      const bp = await pptr.executablePath();
      console.log(`  📦 Puppeteer Bundled Chrome: ${bp} (Exists: ${fs.existsSync(bp)})`);
    }
  } catch (e) {
    console.log(`  ⚠️ Puppeteer Bundled Check: ${e.message}`);
  }

  // 3. Test Membuka Jendela Browser
  console.log('\n[2] Mencoba membuka jendela browser (Visible Window)...');

  const attempts = [
    { name: 'Default Puppeteer', options: { headless: false } },
    { name: 'Channel Chrome', options: { channel: 'chrome', headless: false } },
    { name: 'Channel Edge', options: { channel: 'msedge', headless: false } }
  ];

  for (const att of attempts) {
    try {
      console.log(`  🚀 Mencoba: ${att.name}...`);
      const browser = await puppeteer.launch({
        ...att.options,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      console.log(`  🎉 BERHASIL! Jendela browser (${att.name}) terbuka!`);
      const page = await browser.newPage();
      await page.goto('https://pawainusantara.vercel.app/mobil-22', { waitUntil: 'domcontentloaded' });
      console.log('  🌐 Halaman berhasil dibuka di browser!');
      console.log('  ⏱️ Menutup browser dalam 5 detik...');
      await new Promise(r => setTimeout(r, 5000));
      await browser.close();
      console.log('\n✅ KESIMPULAN: Konfigurasi berhasil dan siap digunakan!');
      return;
    } catch (err) {
      console.log(`  ❌ Gagal pada ${att.name}: ${err.message}`);
    }
  }

  console.log('\n❌ Semua metode gagal. Silakan lihat pesan error di atas.');
}

testAll();
