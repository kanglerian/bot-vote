const readline = require('readline');
const fs = require('fs');
const { executeVote } = require('./bot');

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function sleepCountdown(seconds) {
  for (let s = seconds; s > 0; s--) {
    process.stdout.write(`\r⏳ Jeda antar vote: ${s} detik tersisa... `);
    await new Promise(r => setTimeout(r, 1000));
  }
  process.stdout.write('\r\n');
}

async function runBatch(voters, carSlug = 'mobil-22') {
  console.log(`\n📋 Memproses ${voters.length} pemilih secara otomatis di server CLI...\n`);
  
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < voters.length; i++) {
    const voter = voters[i];
    console.log(`----------------------------------------------------`);
    console.log(`[${i + 1}/${voters.length}] Memproses: ${voter.name} (${voter.phone})`);
    
    const result = await executeVote({
      name: voter.name,
      phone: voter.phone,
      carSlug: voter.carSlug || carSlug,
      onLog: (msg) => console.log(msg)
    });

    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }

    // Jeda 5-8 detik antar vote
    if (i < voters.length - 1) {
      const wait = Math.floor(Math.random() * 4) + 5; // 5-8s
      await sleepCountdown(wait);
    }
  }

  console.log(`\n====================================================`);
  console.log(`🎉 BATCH SELESAI!`);
  console.log(`✅ Berhasil: ${successCount}`);
  console.log(`❌ Gagal / Lewat: ${failCount}`);
  console.log(`====================================================\n`);
}

async function main() {
  console.log('====================================================');
  console.log('       🤖 BOT VOTE SERVER CLI - PAWAI NUSANTARA     ');
  console.log('====================================================\n');

  const args = process.argv.slice(2);
  let name = '';
  let phone = '';
  let carSlug = 'mobil-22';
  let filePath = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) name = args[i + 1];
    if (args[i] === '--phone' && args[i + 1]) phone = args[i + 1];
    if (args[i] === '--car' && args[i + 1]) carSlug = args[i + 1];
    if (args[i] === '--file' && args[i + 1]) filePath = args[i + 1];
  }

  // Jika membaca dari file batch (JSON atau TXT)
  if (filePath) {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File tidak ditemukan: ${filePath}`);
      process.exit(1);
    }

    let voters = [];
    const content = fs.readFileSync(filePath, 'utf-8').trim();

    if (filePath.endsWith('.json')) {
      voters = JSON.parse(content);
    } else {
      // Baris per baris teks: Nama, NoHP
      const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        const parts = line.split(/[,;\t]/);
        if (parts.length >= 2) {
          voters.push({ name: parts[0].trim(), phone: parts[1].trim(), carSlug });
        }
      }
    }

    if (voters.length === 0) {
      console.log('❌ Tidak ada data pemilih yang valid di file.');
      process.exit(1);
    }

    await runBatch(voters, carSlug);
    return;
  }

  // Single vote
  if (!name) {
    name = await prompt('👤 Masukkan Nama Lengkap: ');
  }
  if (!phone) {
    phone = await prompt('📱 Masukkan Nomor HP: ');
  }

  if (!name || !phone) {
    console.log('❌ Nama dan Nomor HP wajib diisi.');
    process.exit(1);
  }

  console.log('\n🚀 Menjalankan vote...');
  const result = await executeVote({
    name,
    phone,
    carSlug,
    onLog: (msg) => console.log(msg)
  });

  console.log('\n====================================================');
  if (result.success) {
    console.log('🎉 HASIL: VOTE BERHASIL!');
    console.log(`Pesan: ${result.message}`);
  } else {
    console.log('⚠️ HASIL: VOTE GAGAL / SUDAH DIGUNAKAN');
    console.log(`Pesan: ${result.message}`);
  }
  console.log('====================================================\n');
}

main().catch(console.error);
