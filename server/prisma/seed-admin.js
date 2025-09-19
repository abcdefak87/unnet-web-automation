const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createSuperAdmin() {
  try {
    // Check if superadmin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: {
        OR: [
          { username: 'superadmin' },
          { role: 'superadmin' }
        ]
      }
    });

    if (existingAdmin) {
      console.log('❌ SuperAdmin already exists:', existingAdmin.username);
      return;
    }

    // Create superadmin
    const hashedPassword = await bcrypt.hash('super123', 10);
    
    const superadmin = await prisma.user.create({
      data: {
        name: 'SuperAdmin',
        username: 'superadmin',
        password: hashedPassword,
        role: 'superadmin',
        whatsappNumber: '6282291921583', // Change this to your WhatsApp number
        phone: '6282291921583',
        isActive: true,
        isVerified: true,
        permissions: JSON.stringify({
          users: ['view', 'create', 'edit', 'delete'],
          technicians: ['view', 'create', 'edit', 'delete'],
          jobs: ['view', 'create', 'edit', 'delete', 'approve'],
          inventory: ['view', 'create', 'edit', 'delete'],
          customers: ['view', 'create', 'edit', 'delete'],
          reports: ['view', 'export']
        })
      }
    });

    console.log('✅ Superadmin created successfully:');
    console.log('   Username: superadmin');
    console.log('   Password: super123');
    console.log('   WhatsApp: ' + superadmin.whatsappNumber);
    
  } catch (error) {
    console.error('❌ Error creating superadmin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin();
