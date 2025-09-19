#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Process tracking
const processes = [];
let isShuttingDown = false;

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to log with colors
function log(message, color = 'white') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

// Function to show banner
function showBanner() {
  console.clear();
  log('╔══════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                    UNNET WEB APP LAUNCHER                    ║', 'cyan');
  log('║                                                              ║', 'cyan');
  log('║  🚀 Starting Next.js Client + Express Server + WhatsApp     ║', 'cyan');
  log('║                                                              ║', 'cyan');
  log('║  Client:  http://localhost:3000                             ║', 'cyan');
  log('║  Server:  http://localhost:3001                             ║', 'cyan');
  log('║  QR Code: http://localhost:3001/qr/whatsapp-qr.png          ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════════╝', 'cyan');
  console.log();
}

// Function to check if directory exists
function checkDirectory(dir) {
  if (!fs.existsSync(dir)) {
    log(`❌ Directory not found: ${dir}`, 'red');
    return false;
  }
  return true;
}

// Function to check if package.json exists
function checkPackageJson(dir) {
  const packagePath = path.join(dir, 'package.json');
  if (!fs.existsSync(packagePath)) {
    log(`❌ package.json not found in: ${dir}`, 'red');
    return false;
  }
  return true;
}

// Function to install dependencies if needed
async function installDependencies(dir, name) {
  const nodeModulesPath = path.join(dir, 'node_modules');
  
  if (!fs.existsSync(nodeModulesPath)) {
    log(`📦 Installing dependencies for ${name}...`, 'yellow');
    
    return new Promise((resolve, reject) => {
      const npm = spawn('npm', ['install'], {
        cwd: dir,
        stdio: 'inherit',
        shell: true
      });

      npm.on('close', (code) => {
        if (code === 0) {
          log(`✅ Dependencies installed for ${name}`, 'green');
          resolve();
        } else {
          log(`❌ Failed to install dependencies for ${name}`, 'red');
          reject(new Error(`npm install failed with code ${code}`));
        }
      });
    });
  } else {
    log(`✅ Dependencies already installed for ${name}`, 'green');
    return Promise.resolve();
  }
}

// Function to start a process
function startProcess(command, args, cwd, name, color) {
  log(`🚀 Starting ${name}...`, color);
  
  const process = spawn(command, args, {
    cwd: cwd,
    stdio: 'pipe',
    shell: true
  });

  // Store process info
  const processInfo = {
    process: process,
    name: name,
    color: color
  };
  processes.push(processInfo);

  // Handle process output
  process.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      const lines = output.split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          log(`[${name}] ${line}`, color);
        }
      });
    }
  });

  process.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      const lines = output.split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          log(`[${name}] ${line}`, 'red');
        }
      });
    }
  });

  process.on('close', (code) => {
    if (!isShuttingDown) {
      log(`⚠️  ${name} exited with code ${code}`, 'yellow');
    }
  });

  process.on('error', (error) => {
    log(`❌ Error starting ${name}: ${error.message}`, 'red');
  });

  return process;
}

// Function to ask for QR scan option
function askQRScanOption() {
  return new Promise((resolve) => {
    console.log();
    log('🔐 WhatsApp QR Scan Options:', 'yellow');
    log('1. Scan QR baru (hapus session lama)', 'white');
    log('2. Gunakan session lama (jika ada)', 'white');
    console.log();
    
    rl.question('Pilih opsi (1/2): ', (answer) => {
      const choice = answer.trim();
      if (choice === '1') {
        log('✅ Menggunakan QR scan baru', 'green');
        resolve('new');
      } else if (choice === '2') {
        log('✅ Menggunakan session lama', 'green');
        resolve('old');
      } else {
        log('⚠️  Pilihan tidak valid, menggunakan session lama', 'yellow');
        resolve('old');
      }
    });
  });
}

// Function to setup WhatsApp session
async function setupWhatsAppSession(qrOption) {
  const authDir = path.join(__dirname, 'server', 'auth_info_baileys');
  
  if (qrOption === 'new') {
    log('🗑️  Menghapus session WhatsApp lama...', 'yellow');
    
    if (fs.existsSync(authDir)) {
      try {
        const files = fs.readdirSync(authDir);
        files.forEach(file => {
          const filePath = path.join(authDir, file);
          if (fs.statSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
            log(`   Deleted: ${file}`, 'yellow');
          }
        });
        log('✅ Session lama berhasil dihapus', 'green');
      } catch (error) {
        log(`⚠️  Error deleting session files: ${error.message}`, 'yellow');
      }
    }
  } else {
    log('📱 Menggunakan session WhatsApp yang ada', 'green');
  }
}

// Function to show help
function showHelp() {
  console.log();
  log('📖 Usage:', 'cyan');
  log('  node start-all.js [options]', 'white');
  console.log();
  log('🔧 Options:', 'cyan');
  log('  --new-qr     Force new QR scan (delete old session)', 'white');
  log('  --old-qr     Use existing session', 'white');
  log('  --help       Show this help message', 'white');
  console.log();
  log('⌨️  Controls:', 'cyan');
  log('  Ctrl+C       Stop all services', 'white');
  log('  q + Enter    Quit gracefully', 'white');
  console.log();
}

// Function to handle graceful shutdown
function gracefulShutdown() {
  if (isShuttingDown) return;
  
  isShuttingDown = true;
  log('\n🛑 Shutting down all services...', 'yellow');
  
  processes.forEach(({ process, name }) => {
    if (process && !process.killed) {
      log(`   Stopping ${name}...`, 'yellow');
      process.kill('SIGTERM');
    }
  });
  
  setTimeout(() => {
    processes.forEach(({ process, name }) => {
      if (process && !process.killed) {
        log(`   Force killing ${name}...`, 'red');
        process.kill('SIGKILL');
      }
    });
    
    log('✅ All services stopped', 'green');
    rl.close();
    process.exit(0);
  }, 5000);
}

// Main function
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    showHelp();
    return;
  }
  
  let qrOption = 'old'; // default
  
  if (args.includes('--new-qr')) {
    qrOption = 'new';
  } else if (args.includes('--old-qr')) {
    qrOption = 'old';
  } else {
    qrOption = await askQRScanOption();
  }
  
  showBanner();
  
  // Check directories
  log('🔍 Checking project structure...', 'blue');
  
  if (!checkDirectory('client') || !checkDirectory('server')) {
    log('❌ Required directories not found. Please run from project root.', 'red');
    process.exit(1);
  }
  
  if (!checkPackageJson('client') || !checkPackageJson('server')) {
    log('❌ Required package.json files not found.', 'red');
    process.exit(1);
  }
  
  log('✅ Project structure verified', 'green');
  
  // Install dependencies
  try {
    await installDependencies('client', 'Client');
    await installDependencies('server', 'Server');
  } catch (error) {
    log(`❌ Failed to install dependencies: ${error.message}`, 'red');
    process.exit(1);
  }
  
  // Setup WhatsApp session
  await setupWhatsAppSession(qrOption);
  
  // Start services
  log('🚀 Starting all services...', 'blue');
  console.log();
  
  // Start server first
  startProcess('npm', ['run', 'dev'], 'server', 'Server', 'green');
  
  // Wait a bit for server to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Start client
  startProcess('npm', ['run', 'dev'], 'client', 'Client', 'blue');
  
  // Wait a bit for client to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Start WhatsApp bot
  startProcess('node', ['scripts/whatsapp-bot-integrated.js'], '.', 'WhatsApp Bot', 'magenta');
  
  // Setup signal handlers
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
  
  // Setup keyboard input handler
  rl.on('line', (input) => {
    if (input.trim().toLowerCase() === 'q') {
      gracefulShutdown();
    }
  });
  
  log('✅ All services started successfully!', 'green');
  log('🌐 Client: http://localhost:3000', 'cyan');
  log('🔧 Server: http://localhost:3001', 'cyan');
  log('📱 QR Code: http://localhost:3001/qr/whatsapp-qr.png', 'cyan');
  log('🤖 WhatsApp Bot: Running in background', 'cyan');
  console.log();
  log('💡 Press Ctrl+C or type "q" + Enter to stop all services', 'yellow');
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`❌ Uncaught Exception: ${error.message}`, 'red');
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  log(`❌ Unhandled Rejection at: ${promise}, reason: ${reason}`, 'red');
  gracefulShutdown();
});

// Run main function
main().catch((error) => {
  log(`❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});

