const express = require('express');
const { body, validationResult } = require('express-validator');
// PrismaClient imported from utils/database
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();
const prisma = require('../utils/database');

// Get all technicians
router.get('/', authenticateToken, requirePermission('technicians:view'), async (req, res) => {
  try {
    const technicians = await prisma.technician.findMany({
      include: {
        jobAssignments: {
          include: {
            job: {
              select: { id: true, jobNumber: true, status: true, type: true }
            }
          },
          where: {
            job: {
              status: {
                in: ['ASSIGNED', 'IN_PROGRESS']
              }
            }
          }
        },
        _count: {
          select: {
            jobAssignments: {
              where: {
                job: {
                  status: 'COMPLETED'
                }
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      data: {
        technicians
      }
    });
  } catch (error) {
    console.error('Get technicians error:', error);
    res.status(500).json({ error: 'Failed to fetch technicians' });
  }
});

// Get single technician
router.get('/:id', authenticateToken, requirePermission('technicians:view'), async (req, res) => {
  try {
    const technician = await prisma.technician.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: {
            jobAssignments: {
              where: {
                job: {
                  status: 'COMPLETED'
                }
              }
            }
          }
        }
      }
    });

    if (!technician) {
      return res.status(404).json({ error: 'Technician not found' });
    }

    res.json(technician);
  } catch (error) {
    console.error('Get technician error:', error);
    res.status(500).json({ error: 'Failed to fetch technician' });
  }
});

// Create new technician
router.post('/', authenticateToken, requirePermission('technicians:create'), [
  body('name').isLength({ min: 2 }).trim(),
  body('phone').isMobilePhone('id-ID').trim(),
  body('whatsappJid').optional().trim(),
  body('isActive').optional().isBoolean(),
  body('isAvailable').optional().isBoolean(),
  body('isAdmin').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone, whatsappJid, isActive = true, isAvailable = true, isAdmin = false } = req.body;

    const technician = await prisma.technician.create({
      data: {
        name,
        phone,
        whatsappJid,
        isActive,
        isAvailable,
        isAdmin
      }
    });

    res.status(201).json({ 
      success: true,
      message: 'Technician created successfully', 
      data: { technician }
    });
  } catch (error) {
    console.error('Create technician error:', error);
    res.status(500).json({ error: 'Failed to create technician' });
  }
});

// Toggle technician admin role
router.patch('/:id/admin-role', authenticateToken, requirePermission('technicians:edit'), async (req, res) => {
  try {
    const { isAdmin } = req.body;
    
    const technician = await prisma.technician.update({
      where: { id: req.params.id },
      data: { isAdmin }
    });

    res.json({ 
      success: true,
      message: 'Admin role updated successfully', 
      data: { technician }
    });
  } catch (error) {
    console.error('Toggle admin role error:', error);
    res.status(500).json({ error: 'Failed to update admin role' });
  }
});

// Update technician
router.put('/:id', authenticateToken, requirePermission('technicians:edit'), [
  body('name').isLength({ min: 2 }).trim().optional(),
  body('phone').isMobilePhone('id-ID').optional(),
  body('whatsappJid').optional().trim(),
  body('isActive').isBoolean().optional(),
  body('isAvailable').isBoolean().optional(),
  body('isAdmin').isBoolean().optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone, whatsappJid, isActive, isAvailable, isAdmin } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (whatsappJid !== undefined) updateData.whatsappJid = whatsappJid;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isAvailable !== undefined) updateData.isAvailable = isAvailable;
    if (isAdmin !== undefined) updateData.isAdmin = isAdmin;

    const technician = await prisma.technician.update({
      where: { id: req.params.id },
      data: updateData
    });

    res.json({ 
      success: true,
      message: 'Technician updated successfully', 
      data: { technician }
    });
  } catch (error) {
    console.error('Update technician error:', error);
    res.status(500).json({ error: 'Failed to update technician' });
  }
});

// Get technician job assignments
router.get('/:id/jobs', authenticateToken, requirePermission('technicians:view'), async (req, res) => {
  try {
    const jobAssignments = await prisma.jobTechnician.findMany({
      where: { technicianId: req.params.id },
      include: {
        job: {
          include: {
            customer: {
              select: { name: true, address: true }
            }
          }
        }
      },
      orderBy: { assignedAt: 'desc' }
    });

    // Transform the data to match frontend expectations
    const transformedAssignments = jobAssignments.map(assignment => ({
      id: assignment.id,
      assignedAt: assignment.assignedAt,
      completedAt: assignment.completedAt,
      job: {
        id: assignment.job.id,
        customerName: assignment.job.customer?.name || assignment.job.customerName,
        customerAddress: assignment.job.customer?.address || assignment.job.customerAddress,
        type: assignment.job.type,
        status: assignment.job.status,
        createdAt: assignment.job.createdAt
      }
    }));

    res.json(transformedAssignments);
  } catch (error) {
    console.error('Get technician jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch technician job assignments' });
  }
});

// Get available technicians for job assignment
router.get('/available/for-job', authenticateToken, async (req, res) => {
  try {
    const technicians = await prisma.technician.findMany({
      where: {
        isActive: true,
        isAvailable: true
      },
      include: {
        jobAssignments: {
          where: {
            job: {
              status: {
                in: ['ASSIGNED', 'IN_PROGRESS']
              }
            }
          },
          include: {
            job: {
              select: { id: true, jobNumber: true, status: true }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({ technicians });
  } catch (error) {
    console.error('Get available technicians error:', error);
    res.status(500).json({ error: 'Failed to fetch available technicians' });
  }
});

// Delete technician
router.delete('/:id', authenticateToken, requirePermission('technicians:delete'), async (req, res) => {
  try {
    // Check if technician has active jobs
    const activeJobs = await prisma.jobTechnician.count({
      where: {
        technicianId: req.params.id,
        job: {
          status: {
            in: ['ASSIGNED', 'IN_PROGRESS']
          }
        }
      }
    });

    if (activeJobs > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete technician with active jobs. Please reassign or complete jobs first.' 
      });
    }

    await prisma.technician.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Technician deleted successfully' });
  } catch (error) {
    console.error('Delete technician error:', error);
    res.status(500).json({ error: 'Failed to delete technician' });
  }
});

module.exports = router;
