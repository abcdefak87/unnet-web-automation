const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixTechnicianPhone(phoneNumber) {
  try {
    console.log(`\n🔧 Fixing technician phone: ${phoneNumber}`);
    
    // Normalize phone number
    function normalizePhone(phone) {
      if (!phone) return null;
      let p = phone.toString().replace(/\D/g, '');
      if (p.startsWith('0')) p = '62' + p.substring(1);
      if (!p.startsWith('62')) p = '62' + p;
      return p;
    }
    
    const normalized = normalizePhone(phoneNumber);
    console.log(`📱 Normalized phone: ${normalized}`);
    
    // Find technician by any phone format
    let technician = await prisma.technician.findFirst({
      where: {
        OR: [
          { phone: phoneNumber },
          { phone: phoneNumber.replace(/\D/g, '') },
          { phone: '0' + phoneNumber.replace(/\D/g, '') },
          { phone: '62' + phoneNumber.replace(/\D/g, '') },
          { phone: normalized },
          { whatsappJid: phoneNumber },
          { whatsappJid: phoneNumber + '@s.whatsapp.net' },
          { whatsappJid: normalized + '@s.whatsapp.net' }
        ]
      }
    });
    
    if (!technician) {
      console.log(`❌ No technician found with phone: ${phoneNumber}`);
      return;
    }
    
    console.log(`✅ Found technician: ${technician.name}`);
    console.log(`   Current phone: ${technician.phone}`);
    console.log(`   Current whatsappJid: ${technician.whatsappJid}`);
    
    // Update phone and whatsappJid to normalized format
    const updatedTechnician = await prisma.technician.update({
      where: { id: technician.id },
      data: {
        phone: normalized,
        whatsappJid: normalized + '@s.whatsapp.net'
      }
    });
    
    console.log(`✅ Updated technician phone data:`);
    console.log(`   New phone: ${updatedTechnician.phone}`);
    console.log(`   New whatsappJid: ${updatedTechnician.whatsappJid}`);
    
    // Also update user table if exists
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: phoneNumber },
          { phone: phoneNumber.replace(/\D/g, '') },
          { phone: '0' + phoneNumber.replace(/\D/g, '') },
          { phone: '62' + phoneNumber.replace(/\D/g, '') },
          { phone: normalized },
          { whatsappNumber: phoneNumber },
          { whatsappNumber: phoneNumber.replace(/\D/g, '') },
          { whatsappNumber: '0' + phoneNumber.replace(/\D/g, '') },
          { whatsappNumber: '62' + phoneNumber.replace(/\D/g, '') },
          { whatsappNumber: normalized }
        ]
      }
    });
    
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          phone: normalized,
          whatsappNumber: normalized
        }
      });
      
      console.log(`✅ Updated user phone data: ${user.username}`);
    }
    
    console.log(`\n🎉 Technician phone data fixed successfully!`);
    
  } catch (error) {
    console.error('❌ Error fixing technician phone:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get phone number from command line argument
const phoneNumber = process.argv[2];

if (!phoneNumber) {
  console.log('Usage: node fix-technician-phone.js <phone-number>');
  console.log('Example: node fix-technician-phone.js 6281234567890');
  process.exit(1);
}

fixTechnicianPhone(phoneNumber);
