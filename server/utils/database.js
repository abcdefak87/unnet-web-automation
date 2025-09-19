/**
 * Prisma Client Singleton Pattern
 * Fixes: Multiple Prisma Client instances causing memory leaks
 */

const { PrismaClient } = require('@prisma/client');

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  errorFormat: process.env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
