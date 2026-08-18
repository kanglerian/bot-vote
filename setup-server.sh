#!/usr/bin/env bash
# ==============================================================================
# Script Setup Server CLI (Ubuntu / Debian VPS)
# ==============================================================================

set -e

echo "===================================================="
echo "🚀 Mempersiapkan Server untuk Bot Vote Pawai Nusantara"
echo "===================================================="

# 1. Update sistem
echo "📦 Update package manager..."
sudo apt-get update -y

# 2. Install dependencies & Google Chrome / Chromium
echo "🌐 Menginstal Google Chrome dan dependensi headless browser..."
sudo apt-get install -y wget curl gnupg ca-certificates \
  libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 \
  libcairo2 xvfb

# Install Google Chrome Stable
if ! command -v google-chrome &> /dev/null; then
  echo "📥 Mengunduh dan menginstal Google Chrome..."
  wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg --yes
  echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
  sudo apt-get update -y
  sudo apt-get install -y google-chrome-stable
fi

# 3. Install Node.js jika belum ada
if ! command -v node &> /dev/null; then
  echo "🟢 Menginstal Node.js v20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# 4. Install dependensi Node.js
echo "📦 Menginstal dependensi project..."
npm install

# 5. Install PM2 (Process Manager) agar bot bisa jalan 24/7 di background
if ! command -v pm2 &> /dev/null; then
  echo "⚙️ Menginstal PM2..."
  sudo npm install -g pm2
fi

echo "===================================================="
echo "✅ Server siap digunakan!"
echo ""
echo "Cara Menjalankan di Server:"
echo "1. Web Dashboard (Akses dari IP server: http://IP_SERVER:3000):"
echo "   pm2 start index.js --name bot-vote"
echo ""
echo "2. Eksekusi CLI Satu Data:"
echo "   node cli.js --name \"Nama Lengkap\" --phone \"081234567890\""
echo ""
echo "3. Eksekusi CLI Batch File (Otomatis Banyak):"
echo "   node cli.js --file voters.example.json"
echo "===================================================="
