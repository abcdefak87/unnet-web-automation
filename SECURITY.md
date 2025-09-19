# 🔒 Security Guidelines

## ⚠️ File Sensitif yang TIDAK BOLEH di-commit

Repository ini menggunakan WhatsApp Bot dengan Baileys yang menghasilkan file sensitif. **JANGAN PERNAH** commit file-file berikut:

### 🚫 File yang Dilarang di-commit:
- `server/auth_info_baileys/` - Session WhatsApp (credentials, keys, dll)
- `server/public/qr/` - QR code files
- `config/whatsapp-status.json` - Status dengan nomor WhatsApp
- `scripts/whatsapp-status.json` - Status file
- `scripts/test-message.json` - Test messages
- `scripts/message-queue.json` - Message queue
- `*.env` - Environment variables
- `*.db` - Database files
- `server/uploads/` - Uploaded files

### ✅ File yang Aman di-commit:
- Source code (`.js`, `.ts`, `.tsx`, `.jsx`)
- Configuration templates (`.json` tanpa data sensitif)
- Documentation (`.md`)
- Package files (`package.json`, `package-lock.json`)
- Build configurations

## 🛡️ Keamanan WhatsApp Bot

### Session Management:
1. **Session files** (`auth_info_baileys/`) berisi kredensial WhatsApp
2. **QR codes** berisi token autentikasi sementara
3. **Status files** berisi nomor WhatsApp dan informasi sensitif

### Best Practices:
- ✅ Gunakan `.gitignore` untuk mencegah commit file sensitif
- ✅ Generate session baru untuk setiap environment
- ✅ Jangan share session files antar developer
- ✅ Hapus session files jika ada di repository

## 🔧 Setup Aman

### 1. Clone Repository:
```bash
git clone <repository-url>
cd unnetwebapp
```

### 2. Setup Environment:
```bash
# Copy environment template
cp server/.env.example server/.env
# Edit dengan nilai yang sesuai
```

### 3. Generate Session Baru:
```bash
# Jalankan dengan opsi --new-qr untuk session baru
node start-all.js --new-qr
```

### 4. Scan QR Code:
- Akses: http://localhost:3001/qr/whatsapp-qr.png
- Scan dengan WhatsApp di ponsel
- Session akan tersimpan otomatis

## 🚨 Jika File Sensitif Ter-commit

### Langkah Darurat:
1. **Hapus dari tracking:**
   ```bash
   git rm --cached -r server/auth_info_baileys/
   git rm --cached config/whatsapp-status.json
   git rm --cached scripts/whatsapp-status.json
   ```

2. **Update .gitignore:**
   ```bash
   # Tambahkan aturan untuk file sensitif
   echo "server/auth_info_baileys/" >> .gitignore
   echo "config/whatsapp-status.json" >> .gitignore
   ```

3. **Commit perubahan:**
   ```bash
   git add .gitignore
   git commit -m "security: hapus file sensitif dari repository"
   git push origin main
   ```

4. **Generate session baru:**
   ```bash
   # Hapus session lama
   rm -rf server/auth_info_baileys/
   # Generate session baru
   node start-all.js --new-qr
   ```

## 📞 Kontak

Jika menemukan file sensitif di repository, segera:
1. Hapus file tersebut
2. Generate session baru
3. Laporkan ke maintainer

---

**⚠️ PENTING: File session WhatsApp berisi kredensial yang bisa digunakan untuk mengakses akun WhatsApp. Jangan pernah commit atau share file-file tersebut!**

