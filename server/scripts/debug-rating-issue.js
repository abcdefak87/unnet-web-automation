#!/usr/bin/env node

/**
 * Debug rating notification issue
 */

const prisma = require('../utils/database');

async function debugRatingIssue() {
  console.log('🔍 Debugging rating notification issue...\n');

  try {
    // Check latest notifications
    const latestNotifications = await prisma.notification.findMany({
      where: {
        message: {
          contains: 'RATING DITERIMA'
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log('📨 Latest rating notifications:', latestNotifications.length);

    if (latestNotifications.length > 0) {
      latestNotifications.forEach((notif, i) => {
        console.log(`${i+1}. ID: ${notif.id}`);
        console.log(`   Recipient: ${notif.recipient}`);
        console.log(`   Status: ${notif.status}`);
        console.log(`   Created: ${notif.createdAt}`);
        console.log(`   Sent: ${notif.sentAt || 'Not sent yet'}`);
        console.log(`   Job ID: ${notif.jobId || 'NULL'}`);
        console.log();
      });
    } else {
      console.log('❌ No rating notifications found');
    }

    // Check if WhatsApp bot is running
    console.log('🤖 Checking WhatsApp bot status...');
    const { getWhatsAppBot } = require('../utils/whatsappBot');
    const bot = getWhatsAppBot();

    if (bot) {
      console.log('✅ WhatsApp bot instance found');
      console.log('Bot has sendMessage:', typeof bot.sendMessage);
    } else {
      console.log('❌ WhatsApp bot instance not found');
      console.log('💡 Bot might not be running or not properly initialized');
    }

    // Check pending notifications
    console.log('\n⏳ Checking pending notifications...');
    const pendingNotifications = await prisma.notification.findMany({
      where: {
        status: 'PENDING',
        message: {
          contains: 'RATING DITERIMA'
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('📋 Pending rating notifications:', pendingNotifications.length);
    
    if (pendingNotifications.length > 0) {
      pendingNotifications.forEach((notif, i) => {
        console.log(`${i+1}. ID: ${notif.id}`);
        console.log(`   Recipient: ${notif.recipient}`);
        console.log(`   Created: ${notif.createdAt}`);
        console.log(`   Message preview: ${notif.message.substring(0, 50)}...`);
        console.log();
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  debugRatingIssue();
}

module.exports = { debugRatingIssue };

