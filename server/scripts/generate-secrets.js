#!/usr/bin/env node

/**
 * Generate Secure Secrets Script
 * Menghasilkan secret keys yang aman untuk environment variables
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateSecureSecret(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

function generateSecrets() {
  const secrets = {
    JWT_SECRET: generateSecureSecret(64),
    JWT_REFRESH_SECRET: generateSecureSecret(64),
    CSRF_SECRET: generateSecureSecret(64)
  };

  return secrets;
}

function main() {
  console.log('🔐 Generating secure secrets for ISP Management System...\n');

  const secrets = generateSecrets();

  console.log('Generated secrets:');
  console.log('==================');
  console.log(`JWT_SECRET="${secrets.JWT_SECRET}"`);
  console.log(`JWT_REFRESH_SECRET="${secrets.JWT_REFRESH_SECRET}"`);
  console.log(`CSRF_SECRET="${secrets.CSRF_SECRET}"`);

  console.log('\n📝 Copy these values to your .env file');
  console.log('⚠️  Keep these secrets secure and never commit them to version control');

  // Optionally write to .env file if it doesn't exist
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.log('\n💡 Creating .env file with generated secrets...');
    
    const envContent = `# ISP Management System Environment Variables
# Generated on ${new Date().toISOString()}

# Database
DATABASE_URL="file:./prisma/dev.db"

# JWT Secrets (Generated)
JWT_SECRET="${secrets.JWT_SECRET}"
JWT_REFRESH_SECRET="${secrets.JWT_REFRESH_SECRET}"

# CSRF Secret (Generated)
CSRF_SECRET="${secrets.CSRF_SECRET}"

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001"
CLIENT_URL="http://localhost:3000"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# File Upload
MAX_FILE_SIZE=5242880

# WhatsApp Bot Configuration
WHATSAPP_ENABLED="true"
WHATSAPP_ADMIN_NUMBER="628123456789"
WHATSAPP_SESSION_NAME="isp-management-bot"
WHATSAPP_AUTO_REPLY="true"
`;

    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file created successfully');
  } else {
    console.log('\n⚠️  .env file already exists. Please manually update it with the generated secrets.');
  }

  console.log('\n🚀 You can now start the application with: npm run dev');
}

if (require.main === module) {
  main();
}

module.exports = { generateSecrets, generateSecureSecret };
