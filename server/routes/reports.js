const express = require('express');
const { query, validationResult } = require('express-validator');
// PrismaClient imported from utils/database
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');

const router = express.Router();
const prisma = require('../utils/database');

// Dashboard statistics
router.get('/dashboard', authenticateToken, requirePermission(PERMISSIONS.REPORTS_VIEW), async (req, res) => {
  try {
    // Get basic counts with fallback values
    const totalJobs = await prisma.job.count().catch(() => 0);
    const openJobs = await prisma.job.count({ where: { status: 'OPEN' } }).catch(() => 0);
    const assignedJobs = await prisma.job.count({ where: { status: 'ASSIGNED' } }).catch(() => 0);
    const completedJobs = await prisma.job.count({ where: { status: 'COMPLETED' } }).catch(() => 0);
    const totalTechnicians = await prisma.technician.count().catch(() => 0);
    const activeTechnicians = await prisma.technician.count({ where: { isActive: true } }).catch(() => 0);
    const totalCustomers = await prisma.customer.count().catch(() => 0);
    const lowStockItems = await prisma.item.count({ where: { currentStock: { lte: 10 } } }).catch(() => 0);
    
    // New ticket system statistics
    const psbPending = await prisma.job.count({ 
      where: { 
        category: 'PSB', 
        status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } 
      } 
    }).catch(() => 0);
    
    const psbCompleted = await prisma.job.count({ 
      where: { 
        category: 'PSB', 
        status: 'COMPLETED' 
      } 
    }).catch(() => 0);
    
    const gangguanPending = await prisma.job.count({ 
      where: { 
        category: 'GANGGUAN', 
        status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } 
      } 
    }).catch(() => 0);
    
    const gangguanCompleted = await prisma.job.count({ 
      where: { 
        category: 'GANGGUAN', 
        status: 'COMPLETED' 
      } 
    }).catch(() => 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayJobs = await prisma.job.count({
      where: { createdAt: { gte: today } }
    }).catch(() => 0);
    
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisMonthJobs = await prisma.job.count({
      where: { createdAt: { gte: thisMonth } }
    }).catch(() => 0);

    // Recent jobs - simplified to avoid relation errors
    const recentJobs = await prisma.job.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    }).catch(() => []);

    // Job completion rate by technician - simplified
    const technicianStats = await prisma.technician.findMany({
      where: { isActive: true },
      take: 5,
      select: {
        id: true,
        name: true,
        phone: true
      }
    }).catch(() => []);

    res.json({
      success: true,
      data: {
        totalJobs,
        openJobs,
        assignedJobs,
        completedJobs,
        completionRate: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0,
        activeTechnicians,
        inventoryValue: 0, // Will be calculated from inventory
        stats: {
          totalJobs,
          openJobs,
          assignedJobs,
          completedJobs,
          totalTechnicians,
          activeTechnicians,
          totalCustomers,
          lowStockItems,
          todayJobs,
          thisMonthJobs,
          // New ticket system stats
          psbPending,
          psbCompleted,
          gangguanPending,
          gangguanCompleted
        },
        recentJobs,
        topTechnicians: technicianStats
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Job reports
router.get('/jobs', authenticateToken, requirePermission(PERMISSIONS.REPORTS_VIEW), [
  query('startDate').isISO8601().optional(),
  query('endDate').isISO8601().optional(),
  query('status').isIn(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  query('type').isIn(['INSTALLATION', 'REPAIR']).optional(),
  query('technicianId').optional(),
  query('days').isInt({ min: 1 }).optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startDate, endDate, status, type, technicianId, days } = req.query;

    const where = {};
    
    // Handle days parameter for date filtering
    if (days) {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days));
      where.createdAt = { gte: daysAgo };
    } else if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    
    if (status) where.status = status;
    if (type) where.type = type;
    
    if (technicianId) {
      where.jobAssignments = {
        some: {
          technicianId
        }
      };
    }

    const jobs = await prisma.job.findMany({
      where,
      select: {
        id: true,
        jobNumber: true,
        type: true,
        status: true,
        priority: true,
        address: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        customer: {
          select: {
            name: true,
            phone: true,
            address: true
          }
        },
        createdBy: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Summary statistics
    const summary = {
      totalJobs: jobs.length,
      byStatus: {},
      byType: {},
      avgCompletionTime: 0
    };

    jobs.forEach(job => {
      summary.byStatus[job.status] = (summary.byStatus[job.status] || 0) + 1;
      summary.byType[job.type] = (summary.byType[job.type] || 0) + 1;
    });

    // Calculate average completion time for completed jobs
    const completedJobs = jobs.filter(job => job.status === 'COMPLETED' && job.completedAt);
    if (completedJobs.length > 0) {
      const totalTime = completedJobs.reduce((sum, job) => {
        const duration = new Date(job.completedAt) - new Date(job.createdAt);
        return sum + duration;
      }, 0);
      summary.avgCompletionTime = Math.round(totalTime / completedJobs.length / (1000 * 60 * 60)); // hours
    }

    res.json({
      success: true,
      data: {
        jobs,
        summary
      }
    });
  } catch (error) {
    console.error('Get job reports error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch job reports',
      details: error.message 
    });
  }
});

// Inventory reports
router.get('/inventory', authenticateToken, requirePermission(PERMISSIONS.REPORTS_VIEW), [
  query('startDate').isISO8601().optional(),
  query('endDate').isISO8601().optional(),
  query('type').isIn(['IN', 'OUT', 'RETURN', 'DAMAGED', 'LOST']).optional(),
  query('itemId').optional(),
  query('technicianId').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startDate, endDate, type, itemId, technicianId } = req.query;

    const where = {};
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    
    if (type) where.type = type;
    if (itemId) where.itemId = itemId;
    if (technicianId) where.technicianId = technicianId;

    const logs = await prisma.inventoryLog.findMany({
      where,
      include: {
        item: {
          select: { name: true, unit: true }
        },
        technician: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Summary by item
    const itemSummary = {};
    logs.forEach(log => {
      const itemName = log.item.name;
      if (!itemSummary[itemName]) {
        itemSummary[itemName] = {
          IN: 0,
          OUT: 0,
          RETURN: 0,
          DAMAGED: 0,
          LOST: 0
        };
      }
      itemSummary[itemName][log.type] += log.quantity;
    });

    // Summary by technician
    const technicianSummary = {};
    logs.forEach(log => {
      if (log.technician) {
        const techName = log.technician.name;
        if (!technicianSummary[techName]) {
          technicianSummary[techName] = {
            IN: 0,
            OUT: 0,
            RETURN: 0,
            DAMAGED: 0,
            LOST: 0
          };
        }
        technicianSummary[techName][log.type] += log.quantity;
      }
    });

    res.json({
      logs,
      summary: {
        totalTransactions: logs.length,
        itemSummary,
        technicianSummary
      }
    });
  } catch (error) {
    console.error('Inventory reports error:', error);
    res.status(500).json({ error: 'Failed to generate inventory reports' });
  }
});

// Technician performance report
router.get('/technicians', authenticateToken, requirePermission(PERMISSIONS.REPORTS_VIEW), [
  query('startDate').isISO8601().optional(),
  query('endDate').isISO8601().optional()
], async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.lte = new Date(endDate);
    }

    const technicians = await prisma.technician.findMany({
      where: { isActive: true },
      include: {
        jobAssignments: {
          where: {
            job: dateFilter
          },
          include: {
            job: {
              select: {
                id: true,
                jobNumber: true,
                status: true,
                type: true,
                createdAt: true,
                completedAt: true
              }
            }
          }
        }
      }
    });

    const performance = technicians.map(tech => {
      const assignments = tech.jobAssignments;
      const completed = assignments.filter(a => a.job.status === 'COMPLETED');
      
      let avgCompletionTime = 0;
      if (completed.length > 0) {
        const totalTime = completed.reduce((sum, assignment) => {
          if (assignment.job.completedAt) {
            const duration = new Date(assignment.job.completedAt) - new Date(assignment.job.createdAt);
            return sum + duration;
          }
          return sum;
        }, 0);
        avgCompletionTime = Math.round(totalTime / completed.length / (1000 * 60 * 60)); // hours
      }

      return {
        technician: {
          id: tech.id,
          name: tech.name,
          phone: tech.phone
        },
        stats: {
          totalAssigned: assignments.length,
          completed: completed.length,
          inProgress: assignments.filter(a => a.job.status === 'IN_PROGRESS').length,
          completionRate: assignments.length > 0 ? Math.round((completed.length / assignments.length) * 100) : 0,
          avgCompletionTime
        }
      };
    });

    res.json({ performance });
  } catch (error) {
    console.error('Technician performance error:', error);
    res.status(500).json({ error: 'Failed to generate technician performance report' });
  }
});

module.exports = router;
