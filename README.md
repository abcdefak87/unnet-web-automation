# Unnet Web App

Aplikasi web manajemen jaringan internet dengan integrasi WhatsApp untuk komunikasi otomatis dengan pelanggan.

## 🚀 Fitur Utama

- **Dashboard Monitoring**: Monitoring real-time status jaringan dan pelanggan
- **Manajemen Pelanggan**: CRUD lengkap untuk data pelanggan
- **Sistem Job/Tugas**: Manajemen tugas teknisi dan gangguan
- **Inventory Management**: Pengelolaan stok modem dan peralatan
- **WhatsApp Integration**: Bot otomatis untuk komunikasi dengan pelanggan
- **Realtime Updates**: Notifikasi real-time menggunakan Socket.IO
- **Authentication**: Sistem login dengan JWT dan OTP
- **Reports**: Laporan dan analisis data

## 🏗️ Arsitektur

### Frontend (Client)
- **Framework**: Next.js 14 dengan TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context + Hooks
- **Real-time**: Socket.IO Client
- **HTTP Client**: Axios

### Backend (Server)
- **Runtime**: Node.js dengan Express.js
- **Database**: SQLite dengan Prisma ORM
- **Authentication**: JWT + OTP
- **Real-time**: Socket.IO Server
- **WhatsApp**: Baileys WhatsApp Web API
- **File Upload**: Multer

## 📁 Struktur Proyek

```
unnetwebapp/
├── client/                 # Next.js Frontend
│   ├── components/         # React Components
│   ├── pages/             # Next.js Pages
│   ├── lib/               # Utilities & API
│   ├── contexts/          # React Contexts
│   └── hooks/             # Custom Hooks
├── server/                # Express Backend
│   ├── routes/            # API Routes
│   ├── services/          # Business Logic
│   ├── middleware/        # Express Middleware
│   ├── prisma/            # Database Schema & Migrations
│   └── utils/             # Utility Functions
├── scripts/               # Utility Scripts
└── config/                # Configuration Files
```

## 🛠️ Instalasi & Setup

### Prerequisites
- Node.js 18+ 
- npm atau yarn
- Git

### 1. Clone Repository
```bash
git clone https://github.com/abcdefak87/unnetwebapp.git
cd unnetwebapp
```

### 2. Install Dependencies

**Client (Frontend):**
```bash
cd client
npm install
```

**Server (Backend):**
```bash
cd server
npm install
```

### 3. Database Setup

```bash
cd server
npm run db:migrate    # Jalankan migrasi database
npm run db:generate   # Generate Prisma client
npm run db:seed       # Seed data awal (opsional)
```

### 4. Environment Variables

**Client (.env.local):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

**Server (.env):**
```env
PORT=3001
DATABASE_URL="file:./dev.db"
JWT_SECRET=your_jwt_secret_here
NODE_ENV=development
```

### 5. Menjalankan Aplikasi

**Terminal 1 - Server:**
```bash
cd server
npm run dev
```

**Terminal 2 - Client:**
```bash
cd client
npm run dev
```

Aplikasi akan tersedia di:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## 📱 WhatsApp Integration

Aplikasi menggunakan Baileys untuk integrasi WhatsApp Web:

### Setup WhatsApp Bot
1. Pastikan server berjalan
2. Akses endpoint `/api/whatsapp/status` untuk melihat status
3. Scan QR code yang muncul untuk koneksi WhatsApp
4. Bot akan otomatis terhubung dan siap menerima pesan

### Fitur WhatsApp Bot
- **Auto Reply**: Balasan otomatis untuk pesan tertentu
- **Status Update**: Notifikasi status jaringan ke pelanggan
- **Job Notification**: Notifikasi tugas ke teknisi
- **Customer Support**: Interaksi otomatis dengan pelanggan

## 🗄️ Database Schema

### Tabel Utama
- **Users**: Data pengguna sistem
- **Customers**: Data pelanggan
- **Jobs**: Tugas dan gangguan
- **Inventory**: Stok peralatan
- **Technicians**: Data teknisi
- **Notifications**: Notifikasi sistem

### Migrasi Database
```bash
cd server
npm run db:migrate    # Jalankan migrasi
npm run db:push       # Push schema (dev only)
npm run db:studio     # Buka Prisma Studio
```

## 🔧 Scripts NPM

### Client Scripts
```bash
npm run dev          # Development server
npm run build        # Build production
npm run start        # Start production
npm run lint         # ESLint check
```

### Server Scripts
```bash
npm run dev          # Development server
npm run start        # Production server
npm run db:migrate   # Database migration
npm run db:generate  # Generate Prisma client
npm run db:seed      # Seed database
npm run db:studio    # Open Prisma Studio
```

## 🔐 Authentication

Sistem autentikasi menggunakan JWT dengan fitur:
- **Login/Logout**: Autentikasi pengguna
- **OTP Verification**: Verifikasi kode OTP
- **Role-based Access**: Akses berdasarkan role
- **Session Management**: Manajemen sesi pengguna

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - Login pengguna
- `POST /api/auth/register` - Registrasi pengguna
- `POST /api/auth/otp/verify` - Verifikasi OTP

### Customers
- `GET /api/customers` - Daftar pelanggan
- `POST /api/customers` - Tambah pelanggan
- `PUT /api/customers/:id` - Update pelanggan
- `DELETE /api/customers/:id` - Hapus pelanggan

### Jobs
- `GET /api/jobs` - Daftar tugas
- `POST /api/jobs` - Buat tugas baru
- `PUT /api/jobs/:id` - Update tugas
- `DELETE /api/jobs/:id` - Hapus tugas

### WhatsApp
- `GET /api/whatsapp/status` - Status bot WhatsApp
- `POST /api/whatsapp/send` - Kirim pesan WhatsApp

## 🚀 Deployment

### Production Build
```bash
# Client
cd client
npm run build

# Server
cd server
npm run build
```

### Environment Production
Pastikan environment variables sudah diset untuk production:
- Database URL production
- JWT Secret yang aman
- WhatsApp session yang valid

## 🤝 Contributing

1. Fork repository
2. Buat feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit perubahan (`git commit -m 'tambah: fitur baru'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

## 📝 Commit Convention

Gunakan format commit dalam bahasa Indonesia:
- `tambah: fitur baru untuk [deskripsi]`
- `perbaiki: bug pada [area yang bermasalah]`
- `perbarui: konfigurasi [nama komponen]`
- `hapus: kode yang tidak digunakan`
- `refactor: struktur kode [nama modul]`

## 🐛 Troubleshooting

### Common Issues

**Database Connection Error:**
```bash
cd server
npm run db:generate
npm run db:migrate
```

**WhatsApp Bot Tidak Terhubung:**
- Pastikan session files ada di `server/auth_info_baileys/`
- Restart server dan scan QR code ulang

**Port Already in Use:**
- Ubah PORT di file `.env`
- Atau kill process yang menggunakan port tersebut

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 📞 Support

Untuk pertanyaan atau dukungan, silakan buat issue di repository ini.

---

**Dibuat dengan ❤️ untuk manajemen jaringan internet yang lebih efisien**
# Updated Fri, Sep 19, 2025 12:38:16 PM
