const express = require('express');
const router = express.Router();
// PrismaClient imported from utils/database
const { authenticateToken } = require('../middleware/auth');

const prisma = require('../utils/database');

// Get all team members (technicians)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const technicians = await prisma.technician.findMany({
      orderBy: { name: 'asc' },
      include: {
        jobs: {
          where: {
            status: { in: ['pending', 'in_progress'] }
          },
          select: { id: true }
        }
      }
    });

    const teamMembers = technicians.map(tech => ({
      ...tech,
      activeJobs: tech.jobs.length
    }));

    res.json(teamMembers);
  } catch (error) {
    console.error('Team fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Get team performance metrics
router.get('/performance', authenticateToken, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
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

    const technicians = await prisma.technician.findMany({
      include: {
        jobs: {
          where: {
            completedAt: {
              gte: startDate,
              lte: now
            },
            status: 'completed'
          }
        }
      }
    });

    const performance = technicians.map(tech => ({
      id: tech.id,
      name: tech.name,
      completedJobs: tech.jobs.length,
      totalRevenue: tech.jobs.reduce((sum, job) => sum + (job.cost || 0), 0)
    }));

    res.json(performance);
  } catch (error) {
    console.error('Team performance error:', error);
    res.status(500).json({ error: 'Failed to fetch team performance' });
  }
});

module.exports = router;
