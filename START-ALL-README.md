# 🚀 UNNET Web App Launcher

Script untuk menjalankan semua server (Next.js Client + Express Server + WhatsApp) dengan satu perintah.

## 📁 File Script

- **`start-all.js`** - Script JavaScript (Cross-platform, Node.js)
- **`start-all.sh`** - Script Shell (Linux/macOS)
- **`start-all.bat`** - Script Batch (Windows)

## 🎯 Fitur

- ✅ **Auto-install dependencies** jika belum ada
- ✅ **Opsi QR Scan** - Baru atau gunakan session lama
- ✅ **Graceful shutdown** dengan Ctrl+C
- ✅ **Colored output** untuk kemudahan monitoring
- ✅ **Error handling** yang komprehensif
- ✅ **Cross-platform** support

## 🚀 Cara Penggunaan

### 1. JavaScript Script (Recommended - Cross Platform)

```bash
# Jalankan dengan opsi interaktif
node start-all.js

# Atau dengan parameter langsung
node start-all.js --new-qr    # Scan QR baru
node start-all.js --old-qr    # Gunakan session lama
node start-all.js --help      # Tampilkan help
```

### 2. Shell Script (Linux/macOS)

```bash
# Jalankan dengan opsi interaktif
./start-all.sh

# Atau dengan parameter langsung
./start-all.sh --new-qr    # Scan QR baru
./start-all.sh --old-qr    # Gunakan session lama
./start-all.sh --help      # Tampilkan help
```

### 3. Batch Script (Windows)

```cmd
REM Jalankan dengan opsi interaktif
start-all.bat

REM Atau dengan parameter langsung
start-all.bat --new-qr    # Scan QR baru
start-all.bat --old-qr    # Gunakan session lama
start-all.bat --help      # Tampilkan help
```

## 🔧 Opsi QR Scan

### **Scan QR Baru (`--new-qr`)**
- Menghapus semua file session WhatsApp lama
- Memaksa scan QR code baru
- Berguna jika ada masalah dengan session lama

### **Gunakan Session Lama (`--old-qr`)**
- Menggunakan session WhatsApp yang sudah ada
- Tidak perlu scan QR lagi jika session masih valid
- Opsi default jika tidak ada parameter

## 🌐 URL Akses

Setelah script berjalan, akses:

- **Client (Next.js):** http://localhost:3000
- **Server (Express):** http://localhost:3001
- **QR Code WhatsApp:** http://localhost:3001/qr/whatsapp-qr.png
- **WhatsApp Bot:** Running in background (auto-connects)

## ⌨️ Kontrol

- **Ctrl+C** - Stop semua service dengan graceful shutdown
- **q + Enter** - (JavaScript script) Quit gracefully

## 📋 Prerequisites

- **Node.js** (v14 atau lebih baru)
- **npm** (terinstall dengan Node.js)
- **Git** (untuk clone repository)

## 🔍 Troubleshooting

### Error: "npm is not installed"
```bash
# Install Node.js dari https://nodejs.org/
# npm akan terinstall otomatis dengan Node.js
```

### Error: "Required directories not found"
```bash
# Pastikan menjalankan script dari root project
# Struktur folder harus ada: client/, server/, package.json
```

### Error: "Failed to install dependencies"
```bash
# Cek koneksi internet
# Atau install manual:
cd client && npm install
cd ../server && npm install
```

### WhatsApp QR tidak muncul
```bash
# Coba dengan opsi --new-qr untuk reset session
node start-all.js --new-qr
```

### Port sudah digunakan
```bash
# Stop aplikasi lain yang menggunakan port 3000/3001
# Atau ubah port di konfigurasi Next.js/Express
```

## 🎨 Output Script

Script akan menampilkan:
- ✅ Banner dengan informasi URL
- 🔍 Pengecekan struktur project
- 📦 Install dependencies (jika diperlukan)
- 🚀 Status startup setiap service
- 🌐 URL akses aplikasi
- 💡 Instruksi kontrol

## 🔄 Workflow

1. **Check Structure** - Verifikasi folder client/ dan server/
2. **Install Dependencies** - npm install jika node_modules tidak ada
3. **Setup WhatsApp** - Hapus session lama (jika --new-qr)
4. **Start Server** - Express server di port 3001
5. **Start Client** - Next.js client di port 3000
6. **Start WhatsApp Bot** - Bot WhatsApp dengan QR code generation
7. **Monitor** - Tampilkan log dan status

## 🛡️ Security Notes

- File session WhatsApp (`server/auth_info_baileys/`) akan dihapus jika pilih --new-qr
- Script tidak akan mengubah file yang sudah di-commit
- Semua perubahan hanya pada file temporary dan session

## 📝 Log Output

Script menggunakan colored output untuk kemudahan monitoring:
- 🔵 **Blue** - Informasi umum
- 🟢 **Green** - Success/berhasil
- 🟡 **Yellow** - Warning/perhatian
- 🔴 **Red** - Error/gagal
- 🟣 **Cyan** - URL dan link penting

## 🚀 Quick Start

```bash
# Clone repository (jika belum)
git clone <repository-url>
cd unnet-webapp

# Jalankan script
node start-all.js

# Pilih opsi QR scan
# Tunggu hingga semua service running
# Akses http://localhost:3000
```

---

**💡 Tips:** Gunakan `node start-all.js` untuk pengalaman terbaik karena memiliki fitur paling lengkap dan cross-platform support.

