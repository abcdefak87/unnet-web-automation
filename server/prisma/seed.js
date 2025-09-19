const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  try {
    // Try to clear existing data (skip if tables don't exist)
    try {
      await prisma.user.deleteMany({});
      await prisma.technician.deleteMany({});
      await prisma.customer.deleteMany({});
      await prisma.item.deleteMany({});
      console.log('🗑️ Cleared existing data');
    } catch (error) {
      console.log('ℹ️ Tables don\'t exist yet, creating fresh database');
    }

    // Create superadmin user
    const superAdminPassword = await bcrypt.hash('super123', 10);
    const superAdmin = await prisma.user.create({
      data: {
        username: 'superadmin',
        email: 'superadmin@example.com',
        password: superAdminPassword,
        name: 'Super Administrator',
        role: 'superadmin',
        permissions: 'ALL',
        isActive: true
      }
    });

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@example.com',
        password: adminPassword,
        name: 'Administrator',
        role: 'admin',
        permissions: 'LIMITED',
        isActive: true
      }
    });

    // Create inventory admin user
    const inventoryPassword = await bcrypt.hash('gudang123', 10);
    const inventoryAdmin = await prisma.user.create({
      data: {
        username: 'gudang',
        email: 'gudang@example.com',
        password: inventoryPassword,
        name: 'Inventory Administrator',
        role: 'gudang',
        permissions: 'INVENTORY_ONLY',
        isActive: true
      }
    });

    // Create regular user
    const userPassword = await bcrypt.hash('user123', 10);
    const regularUser = await prisma.user.create({
      data: {
        username: 'userbiasa',
        email: 'userbiasa@example.com',
        password: userPassword,
        name: 'Regular User',
        role: 'user',
        permissions: 'VIEW_ONLY',
        isActive: true
      }
    });

    console.log('✅ Users created:');
    console.log('- Super Admin:', superAdmin.email);
    console.log('- Admin:', admin.email);
    console.log('- Inventory Admin:', inventoryAdmin.email);
    console.log('- Regular User:', regularUser.email);

    // Create sample technicians
    const technician1 = await prisma.technician.create({
      data: {
        name: 'John Doe',
        phone: '081234567890',
        isActive: true,
        isAvailable: true,
        isAdmin: true  // Admin technician
      }
    });

    const technician2 = await prisma.technician.create({
      data: {
        name: 'Jane Smith',
        phone: '081234567891',
        isActive: true,
        isAvailable: true,
        isAdmin: false  // Regular technician
      }
    });

    console.log('✅ Sample technicians created');

    // Create sample customer
    const customer = await prisma.customer.create({
      data: {
        name: 'PT. Example Company',
        phone: '081234567892',
        address: 'Jl. Contoh No. 123, Jakarta',
        email: 'customer@example.com'
      }
    });

    console.log('✅ Sample customer created');

    // Create sample inventory items
    const item1 = await prisma.item.create({
      data: {
        name: 'Kabel UTP Cat6',
        code: 'CBL-UTP-CAT6',
        category: 'CABLE',
        description: 'Kabel UTP Cat6 untuk instalasi jaringan',
        unit: 'meter',
        currentStock: 1000,
        minStock: 100,
        price: 5000,
        location: 'Gudang A - Rak 1'
      }
    });

    const item2 = await prisma.item.create({
      data: {
        name: 'TP-Link AC1200 Router',
        code: 'RTR-TPLINK-AC1200',
        category: 'ROUTER',
        description: 'Router wireless AC1200 dual band',
        unit: 'pcs',
        currentStock: 50,
        minStock: 10,
        price: 350000,
        location: 'Gudang A - Rak 2'
      }
    });

    console.log('✅ Sample inventory items created');

    console.log('🎉 Database seeded successfully!');
    console.log('');
    console.log('📋 Login credentials:');
    console.log('superadmin/super123 (full system access)');
    console.log('admin/admin123 (limited access)');
    console.log('gudang/gudang123 (inventory + reports only)');
    console.log('userbiasa/user123 (view-only access)');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
