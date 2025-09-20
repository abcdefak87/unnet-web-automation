/**
 * Integrated WhatsApp Bot with Persistent Session
 * Auto-connects with server and maintains session
 */

const { 
  default: makeWASocket, 
  DisconnectReason, 
  useMultiFileAuthState,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const db = require('../server/whatsapp/consolidated/BotDatabaseService');
const { broadcastWhatsAppStatusUpdate } = require('../server/services/websocketService');
const { setWhatsAppBot } = require('../server/utils/whatsappBot');

const sessionPath = path.join(__dirname, '..', 'server', 'auth_info_baileys');
const statusFilePath = path.join(__dirname, 'whatsapp-status.json');
let commandCount = 0;
let sock = null;

// Session management untuk menyimpan job yang sedang ditampilkan per user
const userSessions = new Map();

// Function to get current job for user
function getCurrentJobForUser(userJid) {
  return userSessions.get(userJid);
}

// Function to set current job for user
function setCurrentJobForUser(userJid, job) {
  userSessions.set(userJid, job);
}

// Function to clear current job for user
function clearCurrentJobForUser(userJid) {
  userSessions.delete(userJid);
}

// Function to update status file for server communication
function updateStatusFile() {
  try {
    const status = {
      connected: sock && sock.user ? true : false,
      user: sock && sock.user ? {
        id: sock.user.id,
        name: sock.user.name || 'Not set',
        phone: sock.user.id ? sock.user.id.split(':')[0] || sock.user.id.split('@')[0] : 'Unknown'
      } : null,
      status: sock && sock.user ? 'connected' : 'disconnected',
      lastUpdate: new Date().toISOString(),
      uptime: process.uptime(),
      commandCount: commandCount
    };
    
    fs.writeFileSync(statusFilePath, JSON.stringify(status, null, 2));
    
    // Broadcast status update via WebSocket
    try {
      broadcastWhatsAppStatusUpdate(status);
    } catch (wsError) {
      console.error('Error broadcasting status update:', wsError.message);
    }
  } catch (error) {
    console.error('Error updating status file:', error.message);
  }
}

// Function to send admin notifications
async function sendAdminNotification(message, type = 'info') {
  try {
    // Admin phone number from environment variable
    const adminNumber = process.env.WHATSAPP_ADMIN_NUMBER || '6282229261247';
    const adminJid = adminNumber + '@s.whatsapp.net';
    
    if (sock && sock.user) {
      // Add emoji based on type
      const emojiMap = {
        'test': '🧪',
        'success': '✅',
        'error': '❌',
        'info': 'ℹ️',
        'warning': '⚠️'
      };
      
      const emoji = emojiMap[type] || 'ℹ️';
      const formattedMessage = `${emoji} *Notifikasi Admin*\n\n${message}\n\n⏰ ${new Date().toLocaleString()}`;
      
      await sock.sendMessage(adminJid, { text: formattedMessage });
      console.log('📢 Admin notification sent:', type);
    }
  } catch (error) {
    console.error('Error sending admin notification:', error.message);
  }
}

// Monitor test messages from web interface
function monitorTestMessages() {
  const testFile = path.join(__dirname, 'test-message.json');
  const processedMessages = new Set(); // Track processed messages to prevent duplicates
  
  setInterval(async () => {
    
    if (sock && sock.user && fs.existsSync(testFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(testFile, 'utf8'));
        
        // Handle both 'phone' and 'to' fields for backward compatibility
        const phoneField = data.phone || data.to;
        const timestamp = typeof data.timestamp === 'string' ? new Date(data.timestamp).getTime() : data.timestamp;
        
        // Create unique message ID to prevent duplicates
        const messageId = `${phoneField}_${timestamp}_${data.message}`;
        
        // Check if message is not too old (within 30 seconds) and not already processed
        if (Date.now() - timestamp < 30000 && !processedMessages.has(messageId)) {
          console.log('📨 Memproses pesan test dari antarmuka web...');
          
          // Mark as processed immediately to prevent duplicates
          processedMessages.add(messageId);
          
          // Format phone number to WhatsApp JID
          let phoneNumber = phoneField.replace(/\D/g, '');
          if (!phoneNumber.startsWith('62')) {
            phoneNumber = '62' + phoneNumber.replace(/^0+/, '');
          }
          const jid = phoneNumber + '@s.whatsapp.net';
          
          // Send the test message
          await sock.sendMessage(jid, { text: data.message });
          console.log(`✅ Pesan test terkirim ke ${jid}`);
          

          // Send notification to admin bot (only if different from recipient)
          const adminNumber = process.env.WHATSAPP_ADMIN_NUMBER || '6282229261247';
          if (phoneNumber !== adminNumber) {
            await sendAdminNotification(
              `*Pesan Test Terkirim*\n\n` +
              `📱 Kepada: ${phoneNumber}\n` +
              `💬 Pesan: ${data.message}\n` +
              `✅ Status: Berhasil`,
              'test'
            );
          }
          
          // Delete the file after processing
          fs.unlinkSync(testFile);
          
          // Clean up old processed messages (keep only last 100)
          if (processedMessages.size > 100) {
            const messagesArray = Array.from(processedMessages);
            processedMessages.clear();
            messagesArray.slice(-50).forEach(msg => processedMessages.add(msg));
          }
        } else if (Date.now() - data.timestamp >= 30000) {
          // Delete old messages
          fs.unlinkSync(testFile);
        }
      } catch (error) {
        console.error('Error processing test message:', error.message);
        // Delete corrupted file
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
      }
    }
  }, 2000); // Check every 2 seconds
}

// Monitor notifications from database
function monitorNotifications() {
  setInterval(async () => {
    if (!sock || !sock.user) return;
    
    try {
      const notifications = await db.getPendingNotifications();
      if (notifications.length > 0) {
        console.log(`🕒 Notifikasi tertunda: ${notifications.length}`);
      }
      
      for (const notif of notifications) {
        try {
          if (!notif.recipient) {
            console.warn('Melewati notifikasi tanpa penerima:', notif.id);
            await db.markNotificationSent(notif.id);
            continue;
          }
          
          // Extract job number from notification message and create session
          const jobNumberMatch = notif.message.match(/🎫 Tiket: ([A-Z0-9-]+)/);
          if (jobNumberMatch && notif.jobId) {
            const jobNumber = jobNumberMatch[1];
            console.log(`🔍 Notifikasi untuk job: ${jobNumber}, membuat session untuk ${notif.recipient}`);
            
            // Get job details and create session
            try {
              const job = await db.getJobByNumber(jobNumber);
              if (job) {
                setCurrentJobForUser(notif.recipient, job);
                console.log(`✅ Session dibuat untuk job ${jobNumber} ke ${notif.recipient}`);
              }
            } catch (sessionError) {
              console.warn(`Gagal membuat session untuk job ${jobNumber}:`, sessionError.message);
            }
          }
          
          // Ensure recipient is in proper JID format
          let recipientJid = notif.recipient;
          if (!recipientJid.includes('@')) {
            // Format phone number to JID
            let phoneNumber = recipientJid.replace(/\D/g, '');
            if (!phoneNumber.startsWith('62')) {
              phoneNumber = '62' + phoneNumber.replace(/^0+/, '');
            }
            recipientJid = phoneNumber + '@s.whatsapp.net';
          }
          
          await sock.sendMessage(recipientJid, { text: notif.message });
          console.log(`📤 Notifikasi terkirim ke ${recipientJid}`);
          await db.markNotificationSent(notif.id);
        } catch (error) {
          console.error(`Gagal mengirim notifikasi ${notif.id}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Error memeriksa notifikasi:', error.message);
    }
  }, 5000); // Check every 5 seconds
}

// Monitor message queue for regular messages
function monitorMessageQueue() {
  const queueFile = path.join(__dirname, 'message-queue.json');
  const processedQueueMessages = new Set();
  
  setInterval(async () => {
    if (sock && sock.user && fs.existsSync(queueFile)) {
      try {
        const messages = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
        
        if (Array.isArray(messages) && messages.length > 0) {
          console.log(`📬 Memproses ${messages.length} pesan antrian...`);
          
          for (const messageData of messages) {
            const messageId = `${messageData.to}_${messageData.timestamp}_${messageData.message}`;
            
            // Skip if already processed
            if (processedQueueMessages.has(messageId)) {
              continue;
            }
            
            // Check if message is not too old (within 5 minutes)
            if (Date.now() - messageData.timestamp < 300000) {
              try {
                // Format phone number to WhatsApp JID
                let phoneNumber = messageData.to.toString().replace(/\D/g, '');
                if (!phoneNumber.startsWith('62')) {
                  phoneNumber = '62' + phoneNumber.replace(/^0+/, '');
                }
                const jid = phoneNumber + '@s.whatsapp.net';
                
                // Send the message
                await sock.sendMessage(jid, { text: messageData.message });
                console.log(`✅ Pesan antrian terkirim ke ${jid}`);
                
                // Mark as processed
                processedQueueMessages.add(messageId);
                
                // Send admin notification
                const adminNumber = process.env.WHATSAPP_ADMIN_NUMBER || '6282229261247';
                if (phoneNumber !== adminNumber) {
                  await sendAdminNotification(
                    `*Pesan Terkirim*\n\n` +
                    `📱 Kepada: ${phoneNumber}\n` +
                    `💬 Pesan: ${messageData.message}\n` +
                    `✅ Status: Berhasil`,
                    'info'
                  );
                }
              } catch (error) {
                console.error(`Gagal mengirim pesan antrian ke ${messageData.to}:`, error.message);
              }
            }
          }
          
          // Clean up old messages and processed IDs
          const validMessages = messages.filter(msg => 
            Date.now() - msg.timestamp < 300000
          );
          
          if (validMessages.length !== messages.length) {
            fs.writeFileSync(queueFile, JSON.stringify(validMessages, null, 2));
          }
          
          // Clean up old processed IDs
          if (processedQueueMessages.size > 200) {
            const idsArray = Array.from(processedQueueMessages);
            processedQueueMessages.clear();
            idsArray.slice(-100).forEach(id => processedQueueMessages.add(id));
          }
        }
      } catch (error) {
        console.error('Error memproses antrian pesan:', error.message);
        // Delete corrupted file
        if (fs.existsSync(queueFile)) {
          fs.unlinkSync(queueFile);
        }
      }
    }
  }, 10000); // Check every 10 seconds
}

async function startWhatsAppBot() {
  console.log('========================================');
  console.log('   WHATSAPP BOT - INTEGRATED MODE');
  console.log('========================================\n');

  try {
    // Create session directory
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
      console.log('✅ Direktori sesi baru dibuat\n');
    }

    console.log('Memuat autentikasi...');
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    // Use hardcoded version
    const version = [2, 2413, 1];
    console.log(`Versi: ${version.join('.')}\n`);

    console.log('Membuat koneksi WhatsApp...');
    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
      },
      browser: ['Chrome (Windows)', 'Chrome', '120.0.0.0'],
      qrTimeout: 120000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 120000,
      keepAliveIntervalMs: 30000,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      getMessage: async () => undefined
    });

    console.log('✅ Koneksi dibuat\n');

    // Register bot instance for external access
    setWhatsAppBot(sock);

    // Handle credential updates - IMPORTANT for session persistence
    sock.ev.on('creds.update', saveCreds);

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.clear();
        console.log('========================================');
        console.log('   📱 SCAN QR CODE WITH WHATSAPP');
        console.log('========================================\n');
        console.log('PENTING: Setelah scan, sesi akan disimpan');
        console.log('Anda tidak perlu scan lagi!\n');
        console.log('Instruksi:');
        console.log('1. Buka WhatsApp di ponsel Anda');
        console.log('2. Pergi ke Pengaturan > Perangkat Tertaut');
        console.log('3. Ketuk "Tautkan Perangkat"');
        console.log('4. Scan QR code ini:\n');
        
        // Generate QR code di terminal
        qrcode.generate(qr, { small: true });
        
        // Save QR code as PNG file
        try {
          const qrDir = path.join(__dirname, '..', 'server', 'public', 'qr');
          if (!fs.existsSync(qrDir)) {
            fs.mkdirSync(qrDir, { recursive: true });
          }
          
          const qrFilePath = path.join(qrDir, 'whatsapp-qr.png');
          await QRCode.toFile(qrFilePath, qr, {
            type: 'png',
            width: 512,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          
          console.log(`\n📁 QR Code tersimpan di: ${qrFilePath}`);
          console.log(`🌐 Akses via web: http://localhost:3001/qr/whatsapp-qr.png`);
        } catch (error) {
          console.error('❌ Gagal menyimpan QR code:', error.message);
        }
        
        console.log('\n⏰ Anda memiliki 2 menit untuk scan QR code ini\n');
      }

      if (connection === 'connecting') {
        if (!qr) {
          console.log('🔄 Menghubungkan kembali menggunakan sesi tersimpan...');
        }
      } else if (connection === 'open') {
        console.clear();
        console.log('========================================');
        console.log('   ✅ BOT WHATSAPP TERHUBUNG!');
        console.log('========================================\n');
        
        const user = sock.user;
        if (user) {
          const phoneNumber = user.id.split(':')[0] || user.id.split('@')[0];
        console.log(`📱 Nomor Bot: ${phoneNumber}`);
        console.log(`👤 Nama Bot: ${user.name || 'Belum diset'}\n`);
          
          // Send connection notification to admin
          await sendAdminNotification(
            `*Bot WhatsApp Terhubung*\n\n` +
            `📱 Nomor Bot: ${phoneNumber}\n` +
            `👤 Nama Bot: ${user.name || 'Belum diset'}\n` +
            `🌐 Dashboard: http://localhost:3000\n` +
            `✅ Status: Online dan Siap`,
            'success'
          );
        }
        
        console.log('✅ Sesi tersimpan! Tidak perlu scan lagi.');
        console.log('✅ Bot terintegrasi dengan dashboard web.');
        console.log('✅ Pesan test dari web diaktifkan.');
        console.log('✅ Notifikasi admin diaktifkan.');
        console.log('');
        console.log('Perintah yang Tersedia:');
        console.log('  /menu - Tampilkan semua perintah');
        console.log('  /daftar - Daftar sebagai teknisi');
        console.log('  /jobs - Lihat pekerjaan tersedia');
        console.log('  /myjobs - Lihat pekerjaan yang ditugaskan');
        console.log('  /stats - Lihat statistik');
        console.log('');
        console.log('Akses Dashboard Web:');
        console.log('  Frontend: http://localhost:3000');
        console.log('  Backend API: http://localhost:3001');
        console.log('');
        console.log('✅ Sistem berjalan! Bot akan otomatis terhubung kembali jika terputus.');
        console.log('\n');
      
      // Export socket globally for API access
      global.whatsappSocket = sock;
      console.log('✅ Socket WhatsApp diekspor untuk integrasi API langsung');
      
      // Update status file
      updateStatusFile();
      } else if (connection === 'close') {
        const reason = lastDisconnect?.error;
        const statusCode = reason instanceof Boom ? reason.output?.statusCode : null;
        
        console.log('\n⚠️ Koneksi terputus');
        
        // Send disconnection notification to admin (with error handling)
        try {
          await sendAdminNotification(
            `*Bot WhatsApp Terputus*\n\n` +
            `⚠️ Alasan: ${reason?.message || 'Tidak diketahui'}\n` +
            `🔄 Status: Mencoba menghubungkan kembali...\n` +
            `⏰ Waktu: ${new Date().toLocaleString()}`,
            'warning'
          );
        } catch (error) {
          console.log('Error sending admin notification:', error.message);
        }
        
        // Update status file to show disconnected
        updateStatusFile();
        
        if (statusCode === DisconnectReason.loggedOut) {
          console.log('❌ Bot keluar. Membersihkan sesi...');
          // Clean session if logged out
          if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
          }
          console.log('Sesi dibersihkan. Memulai ulang...');
          setTimeout(() => startWhatsAppBot(), 3000);
        } else if (statusCode !== DisconnectReason.loggedOut) {
          console.log('🔄 Otomatis terhubung kembali dalam 5 detik...');
          setTimeout(() => startWhatsAppBot(), 5000);
        }
      }
    });

    // Handle messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      console.log('\n=== EVENT PESAN BARU ===');
      console.log('Tipe update:', type);
      console.log('Pesan diterima:', messages.length);
      
      if (type !== 'notify' && type !== 'append') {
        console.log('Melewati tipe pesan non-notify/append:', type);
        return;
      }
      
      const msg = messages[0];
      console.log('Kunci objek pesan:', Object.keys(msg || {}));
      console.log('Kunci pesan:', msg?.key);
      console.log('Dari saya?:', msg?.key?.fromMe);
      
      // Skip if no message content
      if (!msg.message) {
        console.log('Melewati: Tidak ada konten pesan');
        return;
      }
      
      // For fromMe messages, only process if it's a command
      if (msg.key.fromMe) {
        const tempText = msg.message.conversation || 
                        msg.message.extendedTextMessage?.text || '';
        if (!tempText.startsWith('/')) {
          console.log('Melewati: Pesan dari diri sendiri bukan perintah');
          return;
        }
        console.log('Memproses perintah admin dari akun bot');
      }

      console.log('Kunci konten pesan:', Object.keys(msg.message));
      console.log('Objek pesan lengkap:', JSON.stringify(msg.message, null, 2));
      
      // Extract text from various message types
      let text = '';
      if (msg.message.conversation) {
        text = msg.message.conversation;
        console.log('Teks dari percakapan:', text);
      } else if (msg.message.extendedTextMessage?.text) {
        text = msg.message.extendedTextMessage.text;
        console.log('Teks dari extendedTextMessage:', text);
      } else if (msg.message.imageMessage?.caption) {
        text = msg.message.imageMessage.caption;
        console.log('Teks dari caption imageMessage:', text);
      } else if (msg.message.videoMessage?.caption) {
        text = msg.message.videoMessage.caption;
        console.log('Teks dari caption videoMessage:', text);
      } else if (msg.message.documentMessage?.caption) {
        text = msg.message.documentMessage.caption;
        console.log('Teks dari caption documentMessage:', text);
      }
      
      const from = msg.key.remoteJid;
      const pushName = msg.pushName || 'User';

      console.log('Teks yang diekstrak:', text);
      console.log('Dari:', from);
      console.log('Nama push:', pushName);
      
      if (!text) {
        console.log('Tidak ada konten teks ditemukan');
        return;
      }

      // Handle tombol interaktif (angka 1-4) - diproses terlebih dahulu
      if (['1', '2', '3', '4'].includes(text.trim())) {
        console.log(`🔘 Tombol interaktif terdeteksi: ${text} dari ${pushName}`);
        const command = text.trim();
        const phoneNum = from.split('@')[0];
        
        try {
            
            switch(command) {
              case '1':
                // Context-aware: AMBIL JOB atau MULAI JOB
                let currentJob = getCurrentJobForUser(from);
                
                // Jika tidak ada session, coba ambil job terbaru dari database
                if (!currentJob) {
                  console.log(`📋 Tidak ada session untuk ${pushName}, mencari job tersedia...`);
                  const availableJobs = await db.getAvailableJobs();
                  console.log(`📋 Ditemukan ${availableJobs.length} job tersedia`);
                  if (availableJobs.length > 0) {
                    currentJob = availableJobs[0]; // Ambil job pertama yang tersedia
                    setCurrentJobForUser(from, currentJob);
                    console.log(`✅ Session dibuat untuk job: ${currentJob.jobNumber}`);
                  }
                } else {
                  console.log(`✅ Session ditemukan untuk job: ${currentJob.jobNumber}`);
                  
                  // Verifikasi ulang apakah job masih ada
                  const updatedJob = await db.getJobByNumber(currentJob.jobNumber);
                  if (!updatedJob) {
                    console.log(`❌ Job ${currentJob.jobNumber} tidak ditemukan, hapus session`);
                    clearCurrentJobForUser(from);
                    await sock.sendMessage(from, { 
                      text: '❌ Job yang dipilih tidak ditemukan.\n\nGunakan /jobs untuk melihat job tersedia.' 
                    });
                    break;
                  }
                  
                  // Update session dengan data job terbaru
                  setCurrentJobForUser(from, updatedJob);
                  currentJob = updatedJob;
                }
                
                if (!currentJob) {
                  await sock.sendMessage(from, { 
                    text: '❌ Tidak ada job yang tersedia saat ini.\n\nGunakan /jobs untuk melihat job tersedia.' 
                  });
                  break;
                }
                
                // Check if technician is already assigned to this job
                console.log(`🔍 Debug isAssigned check:`, {
                  phoneNum,
                  from,
                  technicians: currentJob.technicians,
                  techniciansLength: currentJob.technicians?.length
                });
                
                const isAssigned = currentJob.technicians && currentJob.technicians.some(jt => {
                  console.log(`🔍 Checking technician:`, {
                    jt,
                    technician: jt.technician,
                    phoneMatch: jt.technician?.phone === phoneNum,
                    jidMatch: jt.technician?.whatsappJid === from
                  });
                  return jt.technician && (jt.technician.phone === phoneNum || jt.technician.whatsappJid === from);
                });
                
                console.log(`🔍 isAssigned result:`, isAssigned);
                console.log(`🔍 currentJob status:`, currentJob.status);
                
                if (isAssigned) {
                  // Job sudah di-assign, cek status untuk menentukan aksi
                  console.log(`🔍 Job sudah di-assign, status: ${currentJob.status}`);
                  if (currentJob.status === 'ASSIGNED') {
                    // Job ASSIGNED, tombol "1" = MULAI JOB
                    console.log(`Memulai job: ${currentJob.jobNumber} oleh ${pushName}`);
                    const startResult = await db.startJob(currentJob.jobNumber, phoneNum);
                    
                    if (startResult.success) {
                      // Update session with the newly started job
                      const updatedJob = await db.getJobByNumber(currentJob.jobNumber);
                      if (updatedJob) {
                        setCurrentJobForUser(from, updatedJob);
                        console.log(`✅ Session di-update dengan job yang baru dimulai: ${currentJob.jobNumber}`);
                      }
                      
                      await sock.sendMessage(from, { 
                        text: `🚀 *Job Dimulai!*\n\n` +
                              `🎫 Tiket: ${currentJob.jobNumber}\n` +
                              `👤 Teknisi: ${pushName}\n` +
                              `📅 Dimulai: ${new Date().toLocaleString('id-ID')}\n\n` +
                              `🎯 *PILIH AKSI:*\n` +
                              `1️⃣ SELESAI JOB\n` +
                              `2️⃣ BATAL JOB\n\n` +
                              `💡 *Atau ketik: /selesai, /batal*`
                      });
                    } else {
                      await sock.sendMessage(from, { 
                        text: `❌ *Gagal Memulai Job*\n\n` +
                              `Alasan: ${startResult.message}\n\n` +
                              `💡 *Tips:*\n` +
                              `- Pastikan job sudah diambil\n` +
                              `- Anda terdaftar sebagai teknisi\n` +
                              `- Coba lagi dengan /mulai ${currentJob.jobNumber}`
                      });
                    }
                  } else if (currentJob.status === 'IN_PROGRESS') {
                    // Job IN_PROGRESS, tombol "1" = SELESAI JOB
                    console.log(`🔍 Job IN_PROGRESS, menjalankan SELESAI JOB`);
                    console.log(`Menyelesaikan job: ${currentJob.jobNumber} oleh ${pushName}`);
                    const completeResult = await db.completeJob(currentJob.jobNumber, phoneNum);
                    
                    if (completeResult.success) {
                      await sock.sendMessage(from, { 
                        text: `✅ *Job Selesai!*\n\n` +
                              `🎫 Tiket: ${currentJob.jobNumber}\n` +
                              `👤 Teknisi: ${pushName}\n` +
                              `📅 Selesai: ${new Date().toLocaleString('id-ID')}\n\n` +
                              `🎉 Terima kasih telah menyelesaikan pekerjaan!\n\n` +
                              `🎯 *Command Tersedia:*\n` +
                              `/pekerjaan - Lihat job tersedia\n` +
                              `/pekerjaanku - Lihat job yang diambil\n` +
                              `/statistik - Lihat statistik`
                      });
                      // Clear session setelah job selesai
                      clearCurrentJobForUser(from);
                    } else {
                      await sock.sendMessage(from, { 
                        text: `❌ *Gagal Menyelesaikan Job*\n\n` +
                              `Alasan: ${completeResult.message}\n\n` +
                              `💡 *Tips:*\n` +
                              `- Pastikan job sudah dimulai\n` +
                              `- Anda terdaftar sebagai teknisi\n` +
                              `- Coba lagi dengan /selesai ${currentJob.jobNumber}`
                      });
                    }
                  } else {
                    // Job status lain (COMPLETED, CANCELLED, dll)
                    await sock.sendMessage(from, { 
                      text: `❌ *Job Tidak Dapat Diproses*\n\n` +
                            `Status job: ${currentJob.status}\n` +
                            `Job ini sudah selesai atau dibatalkan.\n\n` +
                            `💡 *Command Tersedia:*\n` +
                            `/pekerjaan - Lihat job tersedia\n` +
                            `/pekerjaanku - Lihat job yang diambil\n` +
                            `/statistik - Lihat statistik`
                    });
                    // Clear session
                    clearCurrentJobForUser(from);
                  }
                } else {
                  // Job belum di-assign, tombol "1" = AMBIL JOB
                  console.log(`Mengambil job: ${currentJob.jobNumber} oleh ${pushName}`);
                  const result = await db.assignJobToTechnician(currentJob.jobNumber, phoneNum);
                
                if (result.success) {
                  // Update session with the newly assigned job
                  const updatedJob = await db.getJobByNumber(currentJob.jobNumber);
                  if (updatedJob) {
                    setCurrentJobForUser(from, updatedJob);
                    console.log(`✅ Session di-update dengan job yang baru di-assign: ${currentJob.jobNumber}`);
                  }
                  
                  await sock.sendMessage(from, { 
                    text: `✅ *Job Berhasil Diambil!*\n\n` +
                          `🎫 Tiket: ${currentJob.jobNumber}\n` +
                          `👤 Teknisi: ${pushName}\n` +
                          `📅 Waktu: ${new Date().toLocaleString('id-ID')}\n\n` +
                          `🎯 *PILIH AKSI:*\n` +
                          `1️⃣ MULAI JOB\n` +
                          `2️⃣ BATAL JOB\n\n` +
                          `💡 *Atau ketik: /mulai, /batal*`
                  });
                } else {
                  await sock.sendMessage(from, { 
                    text: `❌ *Gagal Mengambil Job*\n\n` +
                          `Alasan: ${result.message}\n\n` +
                          `💡 *Tips:*\n` +
                          `- Pastikan job belum diambil teknisi lain\n` +
                          `- Anda sudah terdaftar sebagai teknisi\n` +
                          `- Coba lagi dengan /jobs`
                  });
                }
                }
                break;
                
              case '2':
                // Batal melihat notifikasi
                let currentJobForCancel = getCurrentJobForUser(from);
                
                // Jika tidak ada session, coba ambil job terbaru dari database
                if (!currentJobForCancel) {
                  const availableJobs = await db.getAvailableJobs();
                  if (availableJobs.length > 0) {
                    currentJobForCancel = availableJobs[0]; // Ambil job pertama yang tersedia
                  }
                }
                
                if (!currentJobForCancel) {
                  await sock.sendMessage(from, { 
                    text: '❌ Tidak ada job yang tersedia saat ini.\n\nGunakan /jobs untuk melihat job tersedia.' 
                  });
                  break;
                }
                
                // Clear current job session
                clearCurrentJobForUser(from);
                
                await sock.sendMessage(from, { 
                  text: `✅ *Notifikasi Ditutup*\n\n` +
                        `Notifikasi job ${currentJobForCancel.jobNumber} telah ditutup.\n\n` +
                        `💡 *Tips:*\n` +
                        `- Job ini masih tersedia untuk teknisi lain\n` +
                        `- Gunakan /pekerjaan untuk melihat job tersedia lainnya\n\n` +
                        `🎯 *Command Tersedia:*\n` +
                        `/pekerjaan - Lihat job tersedia\n` +
                        `/pekerjaanku - Lihat job yang diambil\n` +
                        `/statistik - Lihat statistik`
                });
                break;
                
              case '3':
                // Mulai job (dari tombol interaktif setelah ambil job)
                let currentJobForStart = getCurrentJobForUser(from);
                
                if (!currentJobForStart) {
                  await sock.sendMessage(from, { 
                    text: '❌ Tidak ada job yang sedang aktif.\n\nGunakan /jobs untuk melihat job tersedia.' 
                  });
                  break;
                }
                
                console.log(`Memulai job: ${currentJobForStart.jobNumber} oleh ${pushName}`);
                const startResult = await db.startJob(currentJobForStart.jobNumber, phoneNum);
                
                if (startResult.success) {
                  await sock.sendMessage(from, { 
                    text: `🚀 *Job Dimulai!*\n\n` +
                          `🎫 Tiket: ${currentJobForStart.jobNumber}\n` +
                          `👤 Teknisi: ${pushName}\n` +
                          `📅 Waktu Mulai: ${new Date().toLocaleString('id-ID')}\n\n` +
                          `🎯 *Langkah Selanjutnya:*\n` +
                          `/selesai - Selesaikan job\n` +
                          `/myjobs - Lihat job aktif\n\n` +
                          `💡 *Gunakan /selesai setelah selesai mengerjakan!*`
                  });
                } else {
                  await sock.sendMessage(from, { 
                    text: `❌ *Gagal Memulai Job*\n\n` +
                          `Alasan: ${startResult.message}\n\n` +
                          `💡 *Tips:*\n` +
                          `- Pastikan job belum dimulai\n` +
                          `- Pastikan Anda adalah teknisi yang ditugaskan\n` +
                          `- Coba lagi dengan /mulai`
                  });
                }
                break;
                
              case '4':
                // Batal job (dari tombol interaktif setelah ambil job)
                let currentJobForCancel2 = getCurrentJobForUser(from);
                
                if (!currentJobForCancel2) {
                  await sock.sendMessage(from, { 
                    text: '❌ Tidak ada job yang sedang aktif.\n\nGunakan /jobs untuk melihat job tersedia.' 
                  });
                  break;
                }
                
                console.log(`Membatalkan job: ${currentJobForCancel2.jobNumber} oleh ${pushName}`);
                const cancelResult = await db.cancelJob(currentJobForCancel2.jobNumber, phoneNum);
                
                if (cancelResult.success) {
                  // Clear current job session
                  clearCurrentJobForUser(from);
                  
                  await sock.sendMessage(from, { 
                    text: `❌ *Job Dibatalkan*\n\n` +
                          `🎫 Tiket: ${currentJobForCancel2.jobNumber}\n` +
                          `👤 Teknisi: ${pushName}\n` +
                          `📅 Waktu Batal: ${new Date().toLocaleString('id-ID')}\n\n` +
                          `💡 *Job ini sekarang tersedia untuk teknisi lain.*\n\n` +
                          `🎯 *Command Tersedia:*\n` +
                          `/pekerjaan - Lihat job tersedia\n` +
                          `/pekerjaanku - Lihat job yang diambil\n` +
                          `/statistik - Lihat statistik`
                  });
                } else {
                  await sock.sendMessage(from, { 
                    text: `❌ *Gagal Membatalkan Job*\n\n` +
                          `Alasan: ${cancelResult.message}\n\n` +
                          `💡 *Tips:*\n` +
                          `- Pastikan job belum dimulai\n` +
                          `- Pastikan Anda adalah teknisi yang ditugaskan\n` +
                          `- Coba lagi dengan /batal`
                  });
                }
                break;
                
            }
            return; // Exit early untuk tombol interaktif
        } catch (error) {
          console.error('Error dalam tombol interaktif:', error);
          await sock.sendMessage(from, { 
            text: '❌ Terjadi kesalahan saat memproses tombol interaktif. Silakan coba lagi.' 
          });
        }
        return; // Exit early untuk tombol interaktif
      }
      
      // Check if message is a rating response FIRST (before command processing)
      if (text && text.toUpperCase().startsWith('RATING')) {
        console.log(`[RATING] Received from ${from}: "${text}"`);
        try {
          const CustomerRatingService = require('../server/services/CustomerRatingService');
          const phoneNum = from.split('@')[0];
          
          const result = await CustomerRatingService.processWhatsAppRating(phoneNum, text);
          
          // Send response immediately
          const responseMessage = result.success ? 
            `✅ ${result.message}` : 
            `❌ ${result.message}`;
          
          await sock.sendMessage(from, { 
            text: responseMessage 
          });
          console.log(`[RATING] ✅ Processed and sent response: ${responseMessage}`);
        } catch (error) {
          console.error('[RATING] ❌ Error:', error);
          await sock.sendMessage(from, { 
            text: '❌ Gagal memproses rating. Silakan coba lagi dengan format: RATING [1-5] [feedback]' 
          });
        }
        return; // Exit early, don't process as command
      }
      
      // Only log and process commands, not regular messages
      if (text.startsWith('/')) {
        console.log(`📩 Perintah terdeteksi dari ${pushName}: ${text}`);
        const command = text.split(' ')[0].toLowerCase();
        const args = text.split(' ').slice(1);
        console.log('Perintah yang diurai:', command);
        console.log('Argumen:', args);
        console.log('Command exact match check:', command === '/menu');
        
        try {
          console.log('Memasuki switch perintah untuk:', command);
          
          switch(command) {
            case '/ping':
              console.log('Memproses perintah /ping...');
              await sock.sendMessage(from, { text: '🏓 Pong! Bot aktif.' });
              console.log('✅ Respons /ping terkirim');
              break;
              
            case '/menu':
              console.log('Memproses perintah /menu...');
              const helpText = `📱 *Bot WhatsApp ISP*

⚡ *Aksi Cepat*
1️⃣ Ambil/Mulai/Selesaikan Job
2️⃣ Batal Notifikasi
3️⃣ Mulai Job
4️⃣ Batal Job

👷 *Perintah Teknisi*
/daftar [nama]     Daftar sebagai teknisi
/pekerjaan         Lihat pekerjaan tersedia
/pekerjaanku       Lihat pekerjaan saya
/berikutnya        Job selanjutnya
/sebelumnya        Job sebelumnya
/statistik         Lihat statistik

🔧 *Perintah Manual*
/ambil [id]        Ambil pekerjaan
/mulai [id]        Mulai pekerjaan
/batal [id]        Batalkan pekerjaan
/selesai [id]      Selesaikan pekerjaan

📱 *Perintah Sistem*
/ping              Test bot
/menu              Menu ini
/status            Status bot
/info              Info sistem

💡 *Tips:*
• Gunakan tombol angka untuk aksi cepat
• Job ID opsional jika ada session aktif
• Ketik /menu untuk melihat menu ini`;
              await sock.sendMessage(from, { text: helpText });
              console.log('✅ Respons /menu terkirim');
              break;
              
            case '/status':
              const uptime = process.uptime();
              const minutes = Math.floor(uptime / 60);
              const seconds = Math.floor(uptime % 60);
              const statusText = `🤖 *Status Bot:*
✅ Online
⏱ Waktu aktif: ${minutes}m ${seconds}s
📱 Terhubung ke: ${sock.user?.id || 'Tidak diketahui'}
💬 Perintah diproses: ${commandCount || 0}
🗄️ Database: Terhubung`;
              await sock.sendMessage(from, { text: statusText });
              break;
              
            case '/info':
              const infoText = `📱 *Bot Manajemen ISP*
Versi: 1.0.0 (Terintegrasi)
Node: ${process.version}
Memori: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB
Mode: Sesi Persisten

Ketik /menu untuk melihat perintah yang tersedia`;
              await sock.sendMessage(from, { text: infoText });
              break;
              
            case '/daftar':
              const phoneNumber = from.split('@')[0];
              const regName = (args.join(' ').trim() || pushName || 'Teknisi').trim();
              try {
                const existingTech = await db.checkExistingTechnician(phoneNumber);
                if (existingTech) {
                  await sock.sendMessage(from, { text: '❌ Anda sudah terdaftar sebagai teknisi!' });
                  break;
                }

                const pendingReg = await db.getTechnicianRegistrationStatus(phoneNumber);
                if (pendingReg) {
                  await sock.sendMessage(from, { text: '⏳ Pendaftaran Anda masih dalam proses review admin.' });
                  break;
                }

                await db.createTechnicianRegistration({ name: regName, phone: phoneNumber, whatsappJid: from });

                const daftarText = `📝 *Pendaftaran Teknisi*

👤 Nama: ${regName}
📱 WhatsApp: ${phoneNumber}

✅ Pendaftaran berhasil dikirim!
⏳ Menunggu approval admin...

Anda akan menerima notifikasi WhatsApp setelah pendaftaran disetujui.`;
                await sock.sendMessage(from, { text: daftarText });
              } catch (error) {
                console.error('Error in /daftar:', error);
                const msg = `❌ Gagal mendaftar.
${error?.message ? 'Alasan: ' + error.message : 'Silakan coba lagi.'}`;
                await sock.sendMessage(from, { text: msg });
              }
              break;
              
            case '/jobs':
            case '/pekerjaan':
              try {
                const jobs = await db.getAvailableJobs();
                
                if (jobs.length === 0) {
                  await sock.sendMessage(from, { 
                    text: '📋 *Tidak Ada Job Tersedia*\n\nSemua job sudah diambil atau selesai.' 
                  });
                  break;
                }
                
                // Set first job as current job for user
                const firstJob = jobs[0];
                setCurrentJobForUser(from, firstJob);
                
                // Format notification with interactive buttons
                const mapsLink = firstJob.latitude && firstJob.longitude
                  ? `https://www.google.com/maps?q=${firstJob.latitude},${firstJob.longitude}`
                  : (firstJob.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(firstJob.address)}` : null);
                
                const jobNotification = (
                  `🚨 *Tiket Baru GANGGUAN*\n\n` +
                  `🎫 Tiket: ${firstJob.jobNumber}\n` +
                  `👤 Pelanggan: ${firstJob.customer?.name || '-'}\n` +
                  `📞 Kontak: ${firstJob.customer?.phone || '-'}\n` +
                  `🔧 Masalah: ${firstJob.description || firstJob.symptoms || firstJob.notes || 'Tidak ada detail'}\n` +
                  `📍 Alamat: ${firstJob.address || '-'}\n` +
                  `${mapsLink ? '🗺️ Lokasi: ' + mapsLink + '\n' : ''}` +
                  `⏰ Status: ${firstJob.status}\n\n` +
                  
                  `🎯 *PILIH AKSI:*\n` +
                  `1️⃣ AMBIL JOB\n` +
                  `2️⃣ BATAL\n\n` +
                  
                  `💡 *Ketik angka untuk memilih aksi!*`
                );
                
                await sock.sendMessage(from, { text: jobNotification });
                
                // If there are more jobs, show navigation
                if (jobs.length > 1) {
                  await sock.sendMessage(from, { 
                    text: `📋 *Job Tersedia (${jobs.length}):*\n\n` +
                          `Menampilkan job 1 dari ${jobs.length}\n\n` +
                          `🎯 *NAVIGASI:*\n` +
                          `⬅️ Job sebelumnya: /prev\n` +
                          `➡️ Job berikutnya: /next\n` +
                          `🔄 Refresh: /jobs\n\n` +
                          `💡 *Ketik angka untuk memilih aksi!*`
                  });
                }
              } catch (error) {
                console.error('Error in /jobs:', error);
                await sock.sendMessage(from, { 
                  text: '❌ Gagal mengambil daftar pekerjaan. Silakan coba lagi.' 
                });
              }
              break;
              
            case '/myjobs':
            case '/pekerjaanku':
              try {
                const phoneNum = from.split('@')[0];
                const jobs = await db.getTechnicianJobs(phoneNum);
                
                if (jobs.length === 0) {
                  await sock.sendMessage(from, { 
                    text: '📋 Anda belum memiliki pekerjaan yang ditugaskan.' 
                  });
                  break;
                }
                
                let myJobsText = `📋 *PEKERJAAN ANDA*\n\n`;
                myJobsText += `👤 ${pushName}\n\n`;
                
                jobs.forEach(job => {
                  const status = job.status === 'ASSIGNED' ? '⏳ Ditugaskan' : '🔧 Sedang dikerjakan';
                  myJobsText += `${status} *${job.jobNumber}* - ${job.type}\n`;
                  myJobsText += `   📍 ${job.address}\n`;
                  myJobsText += `   👤 ${job.customer?.name || 'N/A'}\n`;
                  myJobsText += `   📞 ${job.customer?.phone || 'N/A'}\n\n`;
                });
                
                myJobsText += 'Ketik /mulai [job_number] untuk memulai pekerjaan\n';
                myJobsText += 'Ketik /selesai [job_number] untuk menyelesaikan pekerjaan';
                await sock.sendMessage(from, { text: myJobsText });
              } catch (error) {
                console.error('Error in /myjobs:', error);
                await sock.sendMessage(from, { 
                  text: '❌ Gagal mengambil daftar pekerjaan Anda.' 
                });
              }
              break;
              
            case '/next':
            case '/berikutnya':
              const currentJob = getCurrentJobForUser(from);
              if (!currentJob) {
                await sock.sendMessage(from, { 
                  text: '❌ Tidak ada job yang sedang ditampilkan!\n\nGunakan /jobs untuk melihat job tersedia.' 
                });
                break;
              }
              
              const allJobs = await db.getAvailableJobs();
              const currentIndex = allJobs.findIndex(job => job.jobNumber === currentJob.jobNumber);
              
              if (currentIndex < allJobs.length - 1) {
                const nextJob = allJobs[currentIndex + 1];
                setCurrentJobForUser(from, nextJob);
                
                const mapsLink = nextJob.latitude && nextJob.longitude
                  ? `https://www.google.com/maps?q=${nextJob.latitude},${nextJob.longitude}`
                  : (nextJob.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nextJob.address)}` : null);
                
                const jobNotification = (
                  `🚨 *Tiket Baru GANGGUAN*\n\n` +
                  `🎫 Tiket: ${nextJob.jobNumber}\n` +
                  `👤 Pelanggan: ${nextJob.customer?.name || '-'}\n` +
                  `📞 Kontak: ${nextJob.customer?.phone || '-'}\n` +
                  `🔧 Masalah: ${nextJob.description || nextJob.symptoms || nextJob.notes || 'Tidak ada detail'}\n` +
                  `📍 Alamat: ${nextJob.address || '-'}\n` +
                  `${mapsLink ? '🗺️ Lokasi: ' + mapsLink + '\n' : ''}` +
                  `⏰ Status: ${nextJob.status}\n\n` +
                  
                  `🎯 *PILIH AKSI:*\n` +
                  `1️⃣ AMBIL JOB\n` +
                  `2️⃣ BATAL\n\n` +
                  
                  `💡 *Ketik angka untuk memilih aksi!*`
                );
                
                await sock.sendMessage(from, { text: jobNotification });
                
                await sock.sendMessage(from, { 
                  text: `📋 *Job ${currentIndex + 2} dari ${allJobs.length}*\n\n` +
                        `🎯 *NAVIGASI:*\n` +
                        `⬅️ Job sebelumnya: /prev\n` +
                        `➡️ Job berikutnya: /next\n` +
                        `🔄 Refresh: /jobs\n\n` +
                        `💡 *Ketik angka untuk memilih aksi!*`
                });
              } else {
                await sock.sendMessage(from, { 
                  text: '📋 *Ini adalah job terakhir!*\n\nGunakan /prev untuk melihat job sebelumnya.' 
                });
              }
              break;

            case '/prev':
            case '/sebelumnya':
              const currentJobPrev = getCurrentJobForUser(from);
              if (!currentJobPrev) {
                await sock.sendMessage(from, { 
                  text: '❌ Tidak ada job yang sedang ditampilkan!\n\nGunakan /jobs untuk melihat job tersedia.' 
                });
                break;
              }
              
              const allJobsPrev = await db.getAvailableJobs();
              const currentIndexPrev = allJobsPrev.findIndex(job => job.jobNumber === currentJobPrev.jobNumber);
              
              if (currentIndexPrev > 0) {
                const prevJob = allJobsPrev[currentIndexPrev - 1];
                setCurrentJobForUser(from, prevJob);
                
                const mapsLink = prevJob.latitude && prevJob.longitude
                  ? `https://www.google.com/maps?q=${prevJob.latitude},${prevJob.longitude}`
                  : (prevJob.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prevJob.address)}` : null);
                
                const jobNotification = (
                  `🚨 *Tiket Baru GANGGUAN*\n\n` +
                  `🎫 Tiket: ${prevJob.jobNumber}\n` +
                  `👤 Pelanggan: ${prevJob.customer?.name || '-'}\n` +
                  `📞 Kontak: ${prevJob.customer?.phone || '-'}\n` +
                  `🔧 Masalah: ${prevJob.description || prevJob.symptoms || prevJob.notes || 'Tidak ada detail'}\n` +
                  `📍 Alamat: ${prevJob.address || '-'}\n` +
                  `${mapsLink ? '🗺️ Lokasi: ' + mapsLink + '\n' : ''}` +
                  `⏰ Status: ${prevJob.status}\n\n` +
                  
                  `🎯 *PILIH AKSI:*\n` +
                  `1️⃣ AMBIL JOB\n` +
                  `2️⃣ BATAL\n\n` +
                  
                  `💡 *Ketik angka untuk memilih aksi!*`
                );
                
                await sock.sendMessage(from, { text: jobNotification });
                
                await sock.sendMessage(from, { 
                  text: `📋 *Job ${currentIndexPrev} dari ${allJobsPrev.length}*\n\n` +
                        `🎯 *NAVIGASI:*\n` +
                        `⬅️ Job sebelumnya: /prev\n` +
                        `➡️ Job berikutnya: /next\n` +
                        `🔄 Refresh: /jobs\n\n` +
                        `💡 *Ketik angka untuk memilih aksi!*`
                });
              } else {
                await sock.sendMessage(from, { 
                  text: '📋 *Ini adalah job pertama!*\n\nGunakan /next untuk melihat job berikutnya.' 
                });
              }
              break;
              
            case '/ambil':
              if (!args[0]) {
                await sock.sendMessage(from, { 
                  text: '❌ Format: /ambil [job_number]\nContoh: /ambil JOB001' 
                });
              } else {
                try {
                  const jobNumber = args[0].toUpperCase();
                  const phoneNum = from.split('@')[0];
                  const result = await db.assignJobToTechnician(jobNumber, phoneNum);
                  
                  await sock.sendMessage(from, { 
                    text: result.success ? 
                      `✅ ${result.message}\n\nPekerjaan *${jobNumber}* telah ditambahkan ke daftar Anda.\nKetik /myjobs untuk melihat detail.` :
                      `❌ ${result.message}`
                  });
                } catch (error) {
                  console.error('Error in /ambil:', error);
                  await sock.sendMessage(from, { 
                    text: '❌ Gagal mengambil pekerjaan.' 
                  });
                }
              }
              break;
              
            case '/mulai':
              let jobNumberToStart;
              
              if (!args[0]) {
                // Coba gunakan currentJob dari session
                const currentJobForStart = getCurrentJobForUser(from);
                if (currentJobForStart) {
                  jobNumberToStart = currentJobForStart.jobNumber;
                  console.log(`Menggunakan currentJob untuk /mulai: ${jobNumberToStart}`);
                } else {
                  await sock.sendMessage(from, { 
                    text: '❌ Format: /mulai [job_number]\nContoh: /mulai JOB001\n\n💡 *Tips:* Ambil job dulu dengan /jobs atau tombol interaktif!' 
                  });
                  break;
                }
              } else {
                jobNumberToStart = args[0].toUpperCase();
              }
              
              if (jobNumberToStart) {
                try {
                  const phoneNum = from.split('@')[0];
                  const result = await db.startJob(jobNumberToStart, phoneNum);
                  
                  await sock.sendMessage(from, { 
                    text: result.success ? 
                      `🚀 ${result.message}!\n\nPekerjaan *${jobNumberToStart}* telah dimulai.\n⏱️ Timer berjalan...\nKetik /selesai ${jobNumberToStart} saat selesai.` :
                      `❌ ${result.message}`
                  });
                } catch (error) {
                  console.error('Error in /mulai:', error);
                  await sock.sendMessage(from, { 
                    text: '❌ Gagal memulai pekerjaan.' 
                  });
                }
              }
              break;
              
            case '/batal':
              let jobNumberToCancel;
              
              if (!args[0]) {
                // Coba gunakan currentJob dari session
                const currentJobForCancel = getCurrentJobForUser(from);
                if (currentJobForCancel) {
                  jobNumberToCancel = currentJobForCancel.jobNumber;
                  console.log(`Menggunakan currentJob untuk /batal: ${jobNumberToCancel}`);
                } else {
                  await sock.sendMessage(from, { 
                    text: '❌ Format: /batal [job_number]\nContoh: /batal JOB001\n\n💡 *Tips:* Ambil job dulu dengan /jobs atau tombol interaktif!' 
                  });
                  break;
                }
              } else {
                jobNumberToCancel = args[0].toUpperCase();
              }
              
              if (jobNumberToCancel) {
                try {
                  const phoneNum = from.split('@')[0];
                  const result = await db.cancelJob(jobNumberToCancel, phoneNum);
                  
                  if (result.success) {
                    // Clear current job session
                    clearCurrentJobForUser(from);
                    
                    await sock.sendMessage(from, { 
                      text: `❌ *Job Dibatalkan*\n\n` +
                            `🎫 Tiket: ${jobNumberToCancel}\n` +
                            `👤 Teknisi: ${pushName}\n` +
                            `📅 Waktu Batal: ${new Date().toLocaleString('id-ID')}\n\n` +
                            `💡 *Job ini sekarang tersedia untuk teknisi lain.*\n\n` +
                            `🎯 *Command Tersedia:*\n` +
                            `/pekerjaan - Lihat job tersedia\n` +
                            `/pekerjaanku - Lihat job yang diambil\n` +
                            `/statistik - Lihat statistik`
                    });
                  } else {
                    await sock.sendMessage(from, { 
                      text: `❌ *Gagal Membatalkan Job*\n\n` +
                            `Alasan: ${result.message}\n\n` +
                            `💡 *Tips:*\n` +
                            `- Pastikan job belum dimulai\n` +
                            `- Pastikan Anda adalah teknisi yang ditugaskan\n` +
                            `- Coba lagi dengan /batal`
                    });
                  }
                } catch (error) {
                  console.error('Error in /batal:', error);
                  await sock.sendMessage(from, { 
                    text: '❌ Gagal membatalkan pekerjaan.' 
                  });
                }
              }
              break;
              
            case '/selesai':
              if (!args[0]) {
                await sock.sendMessage(from, { 
                  text: '❌ Format: /selesai [job_number] [catatan]\nContoh: /selesai JOB001 Instalasi selesai dengan baik' 
                });
              } else {
                try {
                  const jobNumber = args[0].toUpperCase();
                  const notes = args.slice(1).join(' ') || '';
                  const phoneNum = from.split('@')[0];
                  const result = await db.completeJob(jobNumber, phoneNum, notes);
                  
                  await sock.sendMessage(from, { 
                    text: result.success ? 
                      `✅ ${result.message}!\n\nPekerjaan *${jobNumber}* telah diselesaikan.\n\nTerima kasih atas kerja keras Anda! 👏` :
                      `❌ ${result.message}`
                  });
                } catch (error) {
                  console.error('Error in /selesai:', error);
                  await sock.sendMessage(from, { 
                    text: '❌ Gagal menyelesaikan pekerjaan.' 
                  });
                }
              }
              break;
              
            case '/stats':
            case '/statistik':
              try {
                const phoneNum = from.split('@')[0];
                const showDetail = args.includes('detail');
                
                // Use EnhancedStatsCommand for better stats
                try {
                  const EnhancedStatsCommand = require('../server/services/whatsapp/commands/EnhancedStatsCommand');
                  const statsCommand = new EnhancedStatsCommand();
                  const result = await statsCommand.execute(from, args, { pushName });
                  
                  await sock.sendMessage(from, { text: result.message });
                } catch (enhancedError) {
                  console.error('Enhanced stats failed, falling back to basic stats:', enhancedError);
                  
                  // Fallback to basic stats
                  const stats = await db.getTechnicianStats(phoneNum);
                  
                  if (!stats) {
                    await sock.sendMessage(from, { 
                      text: '❌ Anda belum terdaftar sebagai teknisi. Ketik /daftar untuk mendaftar.' 
                    });
                    break;
                  }
                  
                  // Format basic stats message
                  let statsText = `📊 *STATISTIK ANDA*

👤 ${pushName || 'Teknisi'}

🎯 Ringkasan:
📋 Total Pekerjaan: ${stats.basic?.totalJobs || 0}
✅ Selesai: ${stats.basic?.completedJobs || 0}
⏳ Aktif: ${stats.basic?.activeJobs || 0}
📈 Completion Rate: ${stats.basic?.completionRate || 0}%
⭐ Rating: ${stats.rating?.averageRating || 0}/5 (${stats.rating?.ratingCount || 0} review)
⚡ Efisiensi: 85%

💪 Tetap semangat!`;
                  
                  await sock.sendMessage(from, { text: statsText });
                }
              } catch (error) {
                console.error('Error in /stats:', error);
                await sock.sendMessage(from, { 
                  text: '❌ Kesalahan: ' + error.message + '\n\nSilakan coba lagi atau hubungi admin.' 
                });
              }
              break;

            default:
              console.log('Perintah tidak dikenal:', command);
              console.log('Available commands: /ping, /menu, /status, /info, /daftar, /pekerjaan, /pekerjaanku, /statistik, /ambil, /mulai, /batal, /selesai');
              await sock.sendMessage(from, { 
                text: '❓ Perintah tidak dikenal. Ketik /menu untuk melihat daftar perintah.' 
              });
              console.log('✅ Respons perintah tidak dikenal terkirim');
          }
          
          commandCount++;
          console.log(`✅ Perintah berhasil diproses: ${command}`);
          console.log('Total perintah diproses:', commandCount);
        } catch (error) {
          console.error('❌ KESALAHAN dalam pemrosesan perintah:');
          console.error('Nama error:', error.name);
          console.error('Pesan error:', error.message);
          console.error('Stack error:', error.stack);
          
          await sock.sendMessage(from, { 
            text: `❌ Kesalahan: ${error.message}\n\nSilakan coba lagi atau hubungi admin.` 
          });
        }
      } else {
        // Just log regular messages without responding
        console.log(`💬 Pesan biasa dari ${pushName}: ${text}`);
        
        // Jika pesan bukan command dan bukan tombol interaktif, abaikan
        return;
      }
    });

    // Handle errors
    sock.ev.on('error', (error) => {
      console.error('Error socket:', error);
    });

    // Export the socket instance for API integration
    global.whatsappSocket = sock;
    console.log('✅ Socket WhatsApp diekspor secara global untuk integrasi API');
    
    // Write status to file for server to read
    updateStatusFile();
    
    // Start monitoring functions
    monitorTestMessages();
    monitorMessageQueue();
    monitorNotifications();
    
    // Start periodic status updates
    setInterval(() => {
      updateStatusFile();
    }, 5000); // Update every 5 seconds

  } catch (error) {
    console.error('❌ Error fatal:', error.message);
    
    if (error.message.includes('ENOENT')) {
      console.log('\nMembersihkan sesi yang rusak...');
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
      console.log('Sesi dibersihkan. Memulai ulang...');
      setTimeout(() => startWhatsAppBot(), 3000);
    } else {
      console.log('\nMemulai ulang dalam 10 detik...');
      setTimeout(() => startWhatsAppBot(), 10000);
    }
  }
}

// Handle process termination
// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('SIGINT', () => {
  console.log('\n\nMematikan bot WhatsApp...');
  if (sock) {
    sock.ws.close();
  }
  process.exit(0);
});

// Start the bot
startWhatsAppBot();
