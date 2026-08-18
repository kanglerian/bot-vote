# 🤖 Bot Vote Pawai Nusantara 2026 (Server CLI & Web Ready)

Bot otomatisasi voting untuk **Mobil Hias #22 (Kementerian Pertanian)** dan mobil hias lainnya di [Pawai Nusantara](https://pawainusantara.vercel.app/mobil-22).

---

## 🌟 Fitur Utama
- **Server CLI & Headless Support**: Berjalan lancar di VPS / Server Linux tanpa GUI / X-Server.
- **Auto Delay 5–8 Detik**: Jeda acak natural otomatis antar vote tanpa perlu klik manual.
- **Auto-Recovery Rate Limit**: Deteksi otomatis pesan cooldown dari server.
- **Batch Processing dari File**: Eksekusi daftar pemilih dari file `.json` atau `.txt`.
- **Web Dashboard & REST API**: Monitoring real-time via browser di port `3000`.

---

## 🖥️ Panduan Deploy di Server CLI (VPS Linux)

### Langkah 1: Setup Server Otomatis
Di server VPS Anda (Ubuntu / Debian), jalankan:
```bash
chmod +x setup-server.sh
./setup-server.sh
```
*(Script ini akan menginstal Google Chrome, Node.js, PM2, dan library yang dibutuhkan)*.

---

### Langkah 2: Cara Menjalankan di Server

#### A. Eksekusi Batch dari File (Langsung di Terminal CLI)
Buat file data pemilih `voters.txt`:
```text
Budi Santoso, 081234567890
Siti Rahma, 085712345678
Agus Pratama, 082198765432
```
Lalu jalankan di server:
```bash
node cli.js --file voters.txt
```
*(Atau gunakan file JSON: `node cli.js --file voters.example.json`)*.

---

#### B. Menjalankan Web Dashboard 24/7 di Background (PM2)
```bash
# Jalankan service di background
pm2 start index.js --name bot-vote

# Cek logs real-time
pm2 logs bot-vote

# Buka Web Dashboard di browser:
# http://IP_SERVER_ANDA:3000
```

---

#### C. Deploy dengan Docker (Opsional)
```bash
docker compose up -d --build
```

---

## 📁 Struktur File
- [`bot.js`](file:///home/kanglerian/Projects/bot-vote/bot.js): Core engine automasi browser Puppeteer (Auto Headless di Server).
- [`cli.js`](file:///home/kanglerian/Projects/bot-vote/cli.js): Interface CLI untuk eksekusi single & batch file.
- [`index.js`](file:///home/kanglerian/Projects/bot-vote/index.js): Backend server dengan sistem antrean & SSE streaming log.
- [`public/index.html`](file:///home/kanglerian/Projects/bot-vote/public/index.html): Web Dashboard monitoring antrean.
- [`setup-server.sh`](file:///home/kanglerian/Projects/bot-vote/setup-server.sh): Script setup otomatis VPS Linux.
- [`Dockerfile`](file:///home/kanglerian/Projects/bot-vote/Dockerfile) & [`docker-compose.yml`](file:///home/kanglerian/Projects/bot-vote/docker-compose.yml): Deployment container.
