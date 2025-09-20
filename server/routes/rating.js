const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const prisma = require('../utils/database');

const router = express.Router();

// Submit customer rating for completed job
router.post('/jobs/rating', [
  body('jobId').isString().notEmpty().withMessage('Job ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1-5'),
  body('feedback').optional().isString().isLength({ max: 500 }).withMessage('Feedback too long'),
  body('customerSatisfaction').optional().isInt({ min: 1, max: 5 }).withMessage('Satisfaction must be 1-5')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { jobId, rating, feedback, customerSatisfaction } = req.body;

    // Check if job exists and is completed
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        technicians: {
          include: {
            technician: true
          }
        },
        customer: true
      }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    if (job.status !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        error: 'Rating can only be submitted for completed jobs'
      });
    }

    // Check if rating already exists
    const existingRating = await prisma.jobTechnician.findFirst({
      where: {
        jobId,
        customerRating: { not: null }
      }
    });

    if (existingRating) {
      return res.status(400).json({
        success: false,
        error: 'Rating already submitted for this job'
      });
    }

    // Update job technician record with rating
    const updatedJobTechnician = await prisma.jobTechnician.updateMany({
      where: { jobId },
      data: {
        customerRating: rating,
        customerSatisfaction: customerSatisfaction || rating,
        completionNotes: feedback ? 
          (await prisma.jobTechnician.findFirst({ where: { jobId } })).completionNotes + 
          `\n\nCustomer Feedback: ${feedback}` : 
          undefined
      }
    });

    // Update technician's rating statistics
    const technicianIds = job.technicians.map(t => t.technicianId);
    
    for (const technicianId of technicianIds) {
      const technician = await prisma.technician.findUnique({
        where: { id: technicianId },
        include: {
          jobAssignments: {
            where: {
              customerRating: { not: null }
            }
          }
        }
      });

      if (technician) {
        const totalRating = technician.jobAssignments.reduce((sum, assignment) => 
          sum + (assignment.customerRating || 0), 0
        ) + rating;
        
        const ratingCount = technician.jobAssignments.length + 1;
        const avgRating = totalRating / ratingCount;

        await prisma.technician.update({
          where: { id: technicianId },
          data: {
            totalRating,
            ratingCount,
            lastPerformanceUpdate: new Date()
          }
        });

        // Update performance score
        await updateTechnicianPerformanceScore(technicianId);
      }
    }

    // Create notification for technicians
    for (const technicianId of technicianIds) {
      await prisma.notification.create({
        data: {
          type: 'RATING_RECEIVED',
          recipient: technicianId,
          message: `Anda mendapat rating ${rating}/5 dari pelanggan untuk job ${job.jobNumber}`,
          jobId,
          status: 'PENDING'
        }
      });
    }

    res.json({
      success: true,
      message: 'Rating submitted successfully',
      data: {
        rating,
        feedback,
        jobNumber: job.jobNumber
      }
    });

  } catch (error) {
    console.error('Rating submission error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit rating'
    });
  }
});

// Get rating statistics for a technician
router.get('/technician/:id/ratings', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { period = 'all' } = req.query;

    let dateFilter = {};
    if (period !== 'all') {
      const now = new Date();
      const startDate = new Date();
      
      switch (period) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(now.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      dateFilter = {
        gte: startDate
      };
    }

    const technician = await prisma.technician.findUnique({
      where: { id },
      include: {
        jobAssignments: {
          where: {
            customerRating: { not: null },
            completedAt: dateFilter
          },
          include: {
            job: {
              select: {
                jobNumber: true,
                category: true,
                completedAt: true
              }
            }
          },
          orderBy: { completedAt: 'desc' }
        }
      }
    });

    if (!technician) {
      return res.status(404).json({
        success: false,
        error: 'Technician not found'
      });
    }

    const ratings = technician.jobAssignments.map(assignment => ({
      jobNumber: assignment.job.jobNumber,
      category: assignment.job.category,
      rating: assignment.customerRating,
      satisfaction: assignment.customerSatisfaction,
      completedAt: assignment.job.completedAt,
      feedback: assignment.completionNotes
    }));

    // Calculate statistics
    const ratingValues = ratings.map(r => r.rating);
    const avgRating = ratingValues.length > 0 ? 
      ratingValues.reduce((sum, rating) => sum + rating, 0) / ratingValues.length : 0;

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratingValues.forEach(rating => {
      ratingDistribution[rating]++;
    });

    res.json({
      success: true,
      data: {
        technician: {
          id: technician.id,
          name: technician.name,
          phone: technician.phone
        },
        statistics: {
          totalRatings: ratings.length,
          averageRating: Math.round(avgRating * 10) / 10,
          ratingDistribution,
          period
        },
        recentRatings: ratings.slice(0, 10)
      }
    });

  } catch (error) {
    console.error('Get technician ratings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get technician ratings'
    });
  }
});

// Get pending rating requests
router.get('/pending', authenticateToken, async (req, res) => {
  try {
    const pendingJobs = await prisma.job.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        },
        technicians: {
          none: {
            customerRating: { not: null }
          }
        }
      },
      include: {
        customer: true,
        technicians: {
          include: {
            technician: true
          }
        }
      },
      orderBy: { completedAt: 'desc' },
      take: 50
    });

    res.json({
      success: true,
      data: pendingJobs.map(job => ({
        id: job.id,
        jobNumber: job.jobNumber,
        category: job.category,
        customer: {
          name: job.customer.name,
          phone: job.customer.phone
        },
        technician: job.technicians[0]?.technician?.name || 'Unknown',
        completedAt: job.completedAt
      }))
    });

  } catch (error) {
    console.error('Get pending ratings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pending ratings'
    });
  }
});

// Helper function to update technician performance score
async function updateTechnicianPerformanceScore(technicianId) {
  try {
    const technician = await prisma.technician.findUnique({
      where: { id: technicianId },
      include: {
        jobAssignments: {
          include: { job: true }
        }
      }
    });

    if (!technician) return;

    const assignments = technician.jobAssignments;
    const completedJobs = assignments.filter(a => a.job.status === 'COMPLETED');
    const ratedJobs = assignments.filter(a => a.customerRating);
    
    if (completedJobs.length === 0) return;

    const completionRate = (completedJobs.length / assignments.length) * 100;
    const avgRating = ratedJobs.length > 0 ? 
      ratedJobs.reduce((sum, job) => sum + job.customerRating, 0) / ratedJobs.length : 0;
    
    // Weighted performance score: 60% completion rate, 40% rating
    const performanceScore = (completionRate * 0.6) + (avgRating * 20 * 0.4);
    
    await prisma.technician.update({
      where: { id: technicianId },
      data: {
        performanceScore: Math.min(Math.round(performanceScore), 100),
        lastPerformanceUpdate: new Date()
      }
    });

  } catch (error) {
    console.error('Error updating performance score:', error);
  }
}

module.exports = router;
