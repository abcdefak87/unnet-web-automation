const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Define the users that should exist based on seed files
const usersToRestore = [
  {
    name: 'Super Administrator',
    username: 'superadmin',
    email: 'superadmin@system.local',
    password: 'super123',
    role: 'superadmin',
    phone: '6282291921583',
    whatsappNumber: '6282291921583',
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
  },
  {
    name: 'Administrator',
    username: 'admin',
    email: 'admin@system.local',
    password: 'admin123',
    role: 'admin',
    phone: '6282291921584',
    whatsappNumber: '6282291921584',
    isActive: true,
    isVerified: true,
    permissions: JSON.stringify({
      users: ['view', 'create', 'edit'],
      technicians: ['view', 'create', 'edit'],
      jobs: ['view', 'create', 'edit', 'approve'],
      inventory: ['view', 'create', 'edit'],
      customers: ['view', 'create', 'edit'],
      reports: ['view']
    })
  },
  {
    name: 'Inventory Administrator',
    username: 'gudang',
    email: 'gudang@system.local',
    password: 'gudang123',
    role: 'gudang',
    phone: '6282291921585',
    whatsappNumber: '6282291921585',
    isActive: true,
    isVerified: true,
    permissions: JSON.stringify({
      inventory: ['view', 'create', 'edit', 'delete'],
      reports: ['view', 'export'],
      jobs: ['view']
    })
  },
  {
    name: 'Regular User',
    username: 'userbiasa',
    email: 'user@system.local',
    password: 'user123',
    role: 'user',
    phone: '6282291921586',
    whatsappNumber: '6282291921586',
    isActive: true,
    isVerified: true,
    permissions: JSON.stringify({
      jobs: ['view'],
      customers: ['view'],
      reports: ['view']
    })
  }
];

async function restoreUsers() {
  console.log('🔄 Starting user restoration process...');
  
  try {
    // Check current users
    const existingUsers = await prisma.user.findMany({
      select: { username: true, email: true }
    });
    
    console.log(`📊 Found ${existingUsers.length} existing users in database`);
    
    if (existingUsers.length > 0) {
      console.log('Existing users:', existingUsers.map(u => u.username).join(', '));
    }
    
    let restoredCount = 0;
    let skippedCount = 0;
    const errors = [];
    
    for (const userData of usersToRestore) {
      try {
        // Check if user already exists
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [
              { username: userData.username },
              { email: userData.email }
            ]
          }
        });
        
        if (existingUser) {
          console.log(`⏭️  Skipping ${userData.username} - already exists`);
          skippedCount++;
          continue;
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        
        // Create user
        const user = await prisma.user.create({
          data: {
            ...userData,
            password: hashedPassword
          }
        });
        
        console.log(`✅ Restored user: ${user.username} (${user.role})`);
        restoredCount++;
        
      } catch (error) {
        console.error(`❌ Error restoring user ${userData.username}:`, error.message);
        errors.push({
          username: userData.username,
          error: error.message
        });
      }
    }
    
    // Summary
    console.log('\n📋 Restoration Summary:');
    console.log(`✅ Users restored: ${restoredCount}`);
    console.log(`⏭️  Users skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach(err => {
        console.log(`   - ${err.username}: ${err.error}`);
      });
    }
    
    // Verify restoration
    console.log('\n🔍 Verifying restored users...');
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isVerified: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });
    
    console.log(`📊 Total users in database: ${allUsers.length}`);
    allUsers.forEach(user => {
      console.log(`   - ${user.username} (${user.role}) - ${user.isActive ? 'Active' : 'Inactive'}`);
    });
    
    console.log('\n🎉 User restoration completed!');
    console.log('\n📋 Login credentials for restored users:');
    usersToRestore.forEach(user => {
      console.log(`   ${user.username}/${user.password} (${user.role})`);
    });
    
  } catch (error) {
    console.error('❌ Fatal error during restoration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run restoration
restoreUsers()
  .catch(error => {
    console.error('❌ Restoration failed:', error);
    process.exit(1);
  });
