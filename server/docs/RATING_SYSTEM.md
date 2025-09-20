# 📊 Sistem Rating Pelanggan - UNNET WIFI

## 🎯 Overview

Sistem rating pelanggan yang terintegrasi dengan WhatsApp bot untuk mengumpulkan feedback langsung dari pelanggan setelah job selesai.

## 🚀 Fitur Utama

### ✅ **Instant Rating Request**
- Notifikasi rating dikirim **langsung** setelah job selesai (tidak tunggu 1 jam)
- Terintegrasi dengan WhatsApp bot yang ada

### ✅ **WhatsApp-Only Rating**
- Pelanggan hanya bisa memberikan rating via WhatsApp
- Format: `RATING [1-5] [feedback opsional]`

### ✅ **Real-time Processing**
- Rating diproses langsung saat pelanggan mengirim pesan
- Statistik teknisi terupdate otomatis

## 📱 Format Rating WhatsApp

### **Contoh Pesan Rating:**
```
RATING 5 Teknisi sangat ramah dan pekerjaan rapi
RATING 4 Bagus, tapi agak lama
RATING 5
RATING 3 Biasa saja
RATING 2 Kurang memuaskan
RATING 1 Sangat buruk
```

### **Validasi:**
- Rating harus 1-5
- Feedback opsional (maksimal 500 karakter)
- Case insensitive (`rating` atau `RATING`)

## 🔄 Alur Kerja

### **1. Job Completion**
```
Teknisi selesai job → Status COMPLETED → Instant rating request
```

### **2. Rating Request**
```
Sistem kirim WhatsApp ke pelanggan:
"📱 UNNET WIFI - Rating Layanan
Halo [Nama]! 👋
Mohon berikan rating dengan format:
RATING [1-5] [feedback opsional]"
```

### **3. Customer Response**
```
Pelanggan balas: "RATING 5 Teknisi sangat baik"
Bot proses rating → Update database → Kirim konfirmasi
```

### **4. Statistics Update**
```
Rating tersimpan → Update statistik teknisi → Terhitung dalam /statistik
```

## 🏗️ Komponen Sistem

### **1. CustomerRatingService**
- **File**: `server/services/CustomerRatingService.js`
- **Fungsi**: Mengelola proses rating dari awal sampai selesai
- **Method**:
  - `requestCustomerRating()` - Kirim rating request
  - `processWhatsAppRating()` - Proses rating dari WhatsApp
  - `submitRating()` - Simpan rating ke database

### **2. WhatsAppNotificationService**
- **File**: `server/services/WhatsAppNotificationService.js`
- **Fungsi**: Mengelola notifikasi WhatsApp
- **Method**:
  - `sendMessage()` - Kirim pesan WhatsApp
  - `sendRatingRequest()` - Kirim rating request khusus
  - `processPendingNotifications()` - Proses notifikasi pending

### **3. WhatsApp Integration**
- **File**: `server/utils/whatsappIntegration.js`
- **Fungsi**: Integrasi dengan WhatsApp bot yang ada
- **Method**:
  - `sendMessage()` - Kirim pesan via bot
  - `processRatingMessage()` - Proses pesan rating
  - `processOutboundNotifications()` - Proses notifikasi keluar

### **4. Rating API**
- **File**: `server/routes/rating.js`
- **Endpoint**: `/api/rating/jobs/rating`
- **Fungsi**: API untuk submit rating (backup jika WhatsApp gagal)

## 📊 Database Schema

### **JobTechnician Table:**
```sql
customerRating        INT     -- Rating 1-5
customerSatisfaction  INT     -- Skor kepuasan 1-5
qualityScore          INT     -- Skor kualitas 1-10
```

### **Technician Table:**
```sql
totalRating           FLOAT   -- Total rating
ratingCount           INT     -- Jumlah rating
performanceScore      FLOAT   -- Skor performa
lastPerformanceUpdate DATETIME
```

### **Notification Table:**
```sql
type: 'RATING_REQUEST' | 'WHATSAPP_MESSAGE' | 'WHATSAPP_OUTBOUND'
status: 'PENDING' | 'SENT' | 'FAILED' | 'PROCESSING'
```

## 🔧 Integrasi dengan WhatsApp Bot

### **1. Handler Rating Message**
```javascript
// Di scripts/whatsapp-bot-integrated.js
if (messageText && messageText.toUpperCase().startsWith('RATING')) {
  const CustomerRatingService = require('../server/services/CustomerRatingService');
  const result = await CustomerRatingService.processWhatsAppRating(phoneNum, messageText);
  await sock.sendMessage(from, { text: result.message });
}
```

### **2. Send Rating Request**
```javascript
// Otomatis dipanggil saat job selesai
const CustomerRatingService = require('../services/CustomerRatingService');
await CustomerRatingService.requestCustomerRating(job, technician);
```

## 📈 Statistik Rating

### **Perhitungan Rating:**
- **Average Rating**: Total rating ÷ Jumlah rating
- **Rating Distribution**: Jumlah per rating (1-5)
- **Performance Score**: (Completion Rate × 60%) + (Rating × 20% × 40%)

### **Contoh Output /statistik:**
```
📊 STATISTIK ANDA
👤 Admin UNNET WIFI

🎯 Ringkasan:
📋 Total Pekerjaan: 25
✅ Selesai: 23
⏳ Aktif: 2
📈 Completion Rate: 92%
⭐ Rating: 4.6/5 (18 review)
⚡ Efisiensi: 88%
```

## 🎯 Response Messages

### **Success Messages:**
```
✅ Terima kasih! Rating 5/5 telah berhasil dikirim untuk job PSB-1234567890.
```

### **Error Messages:**
```
❌ Format tidak valid. Gunakan: RATING [1-5] [feedback opsional]
❌ Rating harus antara 1-5
❌ Tidak ada job yang bisa diberi rating. Pastikan job sudah selesai dalam 7 hari terakhir.
❌ Job ini sudah pernah diberi rating.
```

## 🔍 Monitoring & Debugging

### **Log Messages:**
```
Rating request sent instantly to customer 6281234567890 for job PSB-1234567890
✅ Rating response processed
WhatsApp message queued: 123 -> 6281234567890
```

### **Database Queries:**
```sql
-- Cek rating terbaru
SELECT * FROM job_technicians WHERE customerRating IS NOT NULL ORDER BY completedAt DESC LIMIT 10;

-- Cek statistik teknisi
SELECT name, totalRating, ratingCount, (totalRating/ratingCount) as avgRating 
FROM technicians WHERE ratingCount > 0;

-- Cek notifikasi pending
SELECT * FROM notifications WHERE status = 'PENDING' AND type LIKE '%RATING%';
```

## 🚀 Deployment Checklist

### **1. Database Migration:**
```bash
cd server
npx prisma db push
```

### **2. Restart Services:**
```bash
# Restart server
npm run dev

# Restart WhatsApp bot
node scripts/whatsapp-bot-integrated.js
```

### **3. Test Rating Flow:**
1. Selesaikan job sebagai teknisi
2. Cek notifikasi WhatsApp ke pelanggan
3. Balas dengan format `RATING 5`
4. Cek statistik dengan `/statistik`

## 🔧 Troubleshooting

### **Rating Tidak Terkirim:**
1. Cek log: `Rating request sent instantly to customer...`
2. Cek database: `SELECT * FROM notifications WHERE type = 'RATING_REQUEST'`
3. Cek WhatsApp bot connection

### **Rating Tidak Terproses:**
1. Cek format pesan: harus dimulai dengan `RATING`
2. Cek log: `✅ Rating response processed`
3. Cek database: `SELECT * FROM job_technicians WHERE customerRating IS NOT NULL`

### **Statistik Tidak Update:**
1. Cek `totalRating` dan `ratingCount` di tabel technicians
2. Jalankan manual update: `CustomerRatingService.updateTechnicianRatingStats()`

## 📞 Support

Jika ada masalah dengan sistem rating, cek:
1. Log aplikasi di `server/logs/`
2. Database notifications table
3. WhatsApp bot connection status
4. Format pesan rating yang dikirim pelanggan
