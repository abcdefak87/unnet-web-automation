const express = require('express');
const router = express.Router();
// PrismaClient imported from utils/database
const { authenticateToken } = require('../middleware/auth');

const prisma = require('../utils/database');

// Get dashboard statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const [
      totalCustomers,
      totalJobs,
      pendingJobs,
      completedJobs,
      totalTechnicians,
      activeTechnicians,
      totalInventoryItems,
      lowStockItems,
      psbPending,
      psbCompleted,
      gangguanPending,
      gangguanCompleted
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.job.count(),
      // Match actual status enums used across the app
      prisma.job.count({ where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } } }),
      prisma.job.count({ where: { status: 'COMPLETED' } }),
      prisma.technician.count(),
      prisma.technician.count({ where: { isActive: true } }),
      prisma.item.count(),
      prisma.item.count({ where: { currentStock: { lte: 10 } } }),
      prisma.job.count({ where: { category: 'PSB', status: { in: ['OPEN','ASSIGNED','IN_PROGRESS'] } } }),
      prisma.job.count({ where: { category: 'PSB', status: 'COMPLETED' } }),
      prisma.job.count({ where: { category: 'GANGGUAN', status: { in: ['OPEN','ASSIGNED','IN_PROGRESS'] } } }),
      prisma.job.count({ where: { category: 'GANGGUAN', status: 'COMPLETED' } })
    ]);

    res.json({
      customers: {
        total: totalCustomers
      },
      jobs: {
        total: totalJobs,
        pending: pendingJobs,
        completed: completedJobs
      },
      technicians: {
        total: totalTechnicians,
        active: activeTechnicians
      },
      inventory: {
        total: totalInventoryItems,
        lowStock: lowStockItems
      },
      psb: { pending: psbPending, completed: psbCompleted },
      gangguan: { pending: gangguanPending, completed: gangguanCompleted }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Gagal mengambil statistik dashboard' });
  }
});

// Get recent activities
router.get('/activities', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const recentJobs = await prisma.job.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: { name: true }
        },
        technician: {
          select: { name: true }
        }
      }
    });

    const activities = recentJobs.map(job => ({
      id: job.id,
      type: 'job',
      title: `Job ${job.type} - ${job.customer?.name}`,
      description: job.description,
      status: job.status,
      technician: job.technician?.name,
      createdAt: job.createdAt
    }));

    res.json(activities);
  } catch (error) {
    console.error('Dashboard activities error:', error);
    res.status(500).json({ error: 'Gagal mengambil aktivitas terbaru' });
  }
});

// Get revenue data (if applicable)
router.get('/revenue', authenticateToken, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    // Calculate date range based on period
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const completedJobs = await prisma.job.findMany({
      where: {
        status: 'completed',
        completedAt: {
          gte: startDate,
          lte: now
        }
      },
      select: {
        cost: true,
        completedAt: true
      }
    });

    const totalRevenue = completedJobs.reduce((sum, job) => sum + (job.cost || 0), 0);
    const jobCount = completedJobs.length;

    res.json({
      period,
      totalRevenue,
      jobCount,
      averageJobValue: jobCount > 0 ? totalRevenue / jobCount : 0
    });
  } catch (error) {
    console.error('Dashboard revenue error:', error);
    res.status(500).json({ error: 'Gagal mengambil data pendapatan' });
  }
});

module.exports = router;
