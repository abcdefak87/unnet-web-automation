# 🚀 GitHub Actions Workflows

Dokumentasi lengkap untuk semua workflow CI/CD yang digunakan dalam proyek ini.

## 📋 Daftar Workflows

### 1. 🚀 CI/CD Pipeline (`ci.yml`)
**Trigger:** Push ke `main`/`develop`, Pull Request ke `main`

**Jobs:**
- **🧪 Test & Lint** - Testing dan linting code
- **🏗️ Build Application** - Build client dan server
- **🔒 Security Scan** - Security audit dependencies
- **🗄️ Database Migration** - Migrasi database (main branch)
- **🚀 Deploy to Production** - Deploy ke production (main branch)

**Fitur:**
- ✅ Auto test saat push/PR
- ✅ Auto build aplikasi
- ✅ Security scanning
- ✅ Database migration otomatis
- ✅ Deploy otomatis ke production

### 2. 🤖 WhatsApp Bot Deployment (`whatsapp-bot.yml`)
**Trigger:** Push ke `main` dengan perubahan file bot, Manual trigger

**Jobs:**
- **🧪 Test WhatsApp Bot** - Test syntax dan linting bot
- **💾 Backup WhatsApp Sessions** - Backup session files
- **🚀 Deploy WhatsApp Bot** - Deploy bot ke server
- **📊 Monitor Bot Health** - Monitor kesehatan bot

**Fitur:**
- ✅ Test bot syntax
- ✅ Backup session files
- ✅ Deploy bot otomatis
- ✅ Health monitoring

### 3. 🗄️ Database Management (`database.yml`)
**Trigger:** Push dengan perubahan schema, Manual trigger

**Jobs:**
- **🔄 Database Migration** - Migrasi database
- **🔧 Generate Prisma Client** - Generate Prisma client
- **🌱 Database Seeding** - Seed database
- **⚠️ Database Reset** - Reset database (dengan approval)
- **💾 Database Backup** - Backup database

**Fitur:**
- ✅ Auto migration saat schema berubah
- ✅ Generate Prisma client
- ✅ Database seeding
- ✅ Backup otomatis
- ✅ Manual operations dengan approval

### 4. 🔒 Security & Quality Checks (`security.yml`)
**Trigger:** Push/PR ke `main`, Weekly schedule

**Jobs:**
- **🔍 Security Audit** - Audit dependencies
- **📊 Code Quality** - Linting dan quality checks
- **🔐 Secret Scanning** - Scan untuk secrets
- **🛡️ Vulnerability Scan** - Scan vulnerabilities
- **📄 License Compliance** - Check license compliance
- **📋 Security Report** - Generate security report

**Fitur:**
- ✅ Dependency security audit
- ✅ Code quality checks
- ✅ Secret scanning
- ✅ Vulnerability scanning
- ✅ License compliance
- ✅ Weekly security reports

### 5. 🚀 Release & Deployment (`release.yml`)
**Trigger:** Push tag dengan format `v*.*.*`, Manual trigger

**Jobs:**
- **🏗️ Build Release** - Build release artifacts
- **🏷️ Create Release** - Create GitHub release
- **🚀 Deploy to Staging** - Deploy ke staging (beta/alpha)
- **🚀 Deploy to Production** - Deploy ke production
- **📢 Send Notifications** - Kirim notifikasi

**Fitur:**
- ✅ Auto release saat push tag
- ✅ Create GitHub release dengan notes
- ✅ Deploy ke staging/production
- ✅ Post-deployment health checks
- ✅ Notification system

## 🔧 Setup & Konfigurasi

### 1. Environment Variables
Tambahkan secrets berikut di GitHub repository settings:

```bash
# Database
DATABASE_URL=your_database_url

# Security
SNYK_TOKEN=your_snyk_token

# Deployment (opsional)
DEPLOY_HOST=your_server_host
DEPLOY_USER=your_server_user
DEPLOY_KEY=your_server_ssh_key
```

### 2. Environment Protection
Setup environment protection untuk:
- **production** - Memerlukan approval manual
- **staging** - Auto deploy untuk beta/alpha tags

### 3. Branch Protection
Aktifkan branch protection untuk `main`:
- ✅ Require pull request reviews
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Restrict pushes to matching branches

## 📊 Monitoring & Alerts

### 1. Workflow Status
Monitor workflow status di:
- GitHub Actions tab
- Repository insights
- Email notifications

### 2. Security Alerts
- Dependency vulnerabilities
- Secret leaks
- Code quality issues
- License compliance

### 3. Deployment Status
- Staging deployments
- Production deployments
- Health checks
- Rollback procedures

## 🛠️ Customization

### 1. Menambah Job Baru
```yaml
new-job:
  name: 🆕 New Job
  runs-on: ubuntu-latest
  steps:
    - name: 📥 Checkout code
      uses: actions/checkout@v4
    # ... steps lainnya
```

### 2. Menambah Environment
```yaml
environment: your-environment-name
```

### 3. Menambah Schedule
```yaml
schedule:
  - cron: '0 2 * * 1' # Weekly
```

## 📚 Best Practices

### 1. Security
- ✅ Gunakan secrets untuk sensitive data
- ✅ Enable dependency scanning
- ✅ Regular security audits
- ✅ Secret scanning

### 2. Performance
- ✅ Cache dependencies
- ✅ Parallel jobs
- ✅ Optimize build times
- ✅ Clean up artifacts

### 3. Reliability
- ✅ Error handling
- ✅ Retry mechanisms
- ✅ Health checks
- ✅ Rollback procedures

## 🆘 Troubleshooting

### 1. Common Issues
- **Build failures** - Check dependencies dan syntax
- **Deployment failures** - Check environment variables
- **Security failures** - Update dependencies
- **Database failures** - Check migration scripts

### 2. Debug Steps
1. Check workflow logs
2. Verify environment variables
3. Test locally
4. Check permissions
5. Review error messages

### 3. Support
- GitHub Actions documentation
- Repository issues
- Team communication
- External services support

---

**📝 Last Updated:** $(date)
**👥 Maintained by:** Development Team
**🔄 Version:** 1.0.0

