const express = require('express');
const { body, query, validationResult } = require('express-validator');
// PrismaClient imported from utils/database
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');
const { broadcastInventoryUpdate } = require('../services/websocketService');
const { cacheConfigs, invalidateCache } = require('../middleware/cache');

const router = express.Router();
const prisma = require('../utils/database');

// Get all items with stock info (with caching)
router.get('/items', 
  authenticateToken, 
  requirePermission('inventory:view'),
  cacheConfigs.inventory,
  [
    query('page').isInt({ min: 1 }).optional(),
    query('limit').isInt({ min: 1, max: 100 }).optional(),
    query('search').optional().trim()
  ], 
  async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (page - 1) * limit;

    const where = { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (req.query.category && req.query.category !== '') {
      where.category = req.query.category;
    }

    const [items, total] = await Promise.all([
      prisma.item.findMany({
        where,
        include: {
          inventoryLogs: {
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        },
        orderBy: { name: 'asc' },
        skip: parseInt(skip),
        take: parseInt(limit)
      }),
      prisma.item.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get items error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    res.status(500).json({ error: 'Failed to fetch items', details: error.message });
  }
});

// Get inventory logs
router.get('/logs', authenticateToken, requirePermission('inventory:view'), [
  query('page').isInt({ min: 1 }).optional(),
  query('limit').isInt({ min: 1, max: 100 }).optional(),
  query('type').isIn(['IN', 'OUT', 'RETURN', 'DAMAGED', 'LOST']).optional(),
  query('category').isIn(['TEKNISI', 'KEPERLUAN_BERSAMA', 'MODEM']).optional(),
  query('itemId').optional(),
  query('technicianId').optional()
], async (req, res) => {
  try {
    const { page = 1, limit = 20, type, category, itemId, technicianId } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (type) where.type = type;
    if (itemId) where.itemId = itemId;
    if (technicianId) where.technicianId = technicianId;
    
    // Filter by item category if specified
    if (category) {
      where.item = {
        category: category
      };
    }

    const [logs, total] = await Promise.all([
      prisma.inventoryLog.findMany({
        where,
        include: {
          item: {
            select: { id: true, name: true, unit: true, category: true, subcategory: true }
          },
          technician: {
            select: { id: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: parseInt(skip),
        take: parseInt(limit)
      }),
      prisma.inventoryLog.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        logs,
        totalPages: Math.ceil(total / limit),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get inventory logs error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory logs' });
  }
});

// Get single item
router.get('/:id', authenticateToken, requirePermission('inventory:view'), async (req, res) => {
  try {
    const item = await prisma.item.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: {
            inventoryLogs: true
          }
        }
      }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// Get item inventory logs
router.get('/:id/logs', authenticateToken, requirePermission('inventory:view'), async (req, res) => {
  try {
    const logs = await prisma.inventoryLog.findMany({
      where: { itemId: req.params.id },
      include: {
        user: {
          select: { name: true }
        },
        technician: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform the data to match frontend expectations
    const transformedLogs = logs.map(log => ({
      id: log.id,
      type: log.type,
      quantity: log.quantity,
      previousQuantity: log.previousStock,
      newQuantity: log.newStock,
      notes: log.notes,
      createdAt: log.createdAt,
      user: {
        name: log.user?.name || log.technician?.name || 'Unknown'
      },
      job: log.jobId ? {
        id: log.jobId,
        jobNumber: `JOB-${log.jobId.slice(-8)}`,
        customerName: 'Customer'
      } : null
    }));

    res.json(transformedLogs);
  } catch (error) {
    console.error('Get item logs error:', error);
    res.status(500).json({ error: 'Failed to fetch item logs' });
  }
});

// Create new item
router.post('/items', authenticateToken, requirePermission('inventory:create'), [
  body('name').isLength({ min: 2 }).trim(),
  body('code').isLength({ min: 1 }).trim(),
  body('category').isIn(['TEKNISI', 'KEPERLUAN_BERSAMA', 'MODEM']),
  body('subcategory').optional().isIn(['ZTE_V3', 'ZTE_5G', 'HUAWEI_5H5', 'HUAWEI_5V5', 'VIBERHOME']),
  body('description').optional().trim(),
  body('unit').isLength({ min: 1 }).trim(),
  body('quantity').isInt({ min: 0 }),
  body('minStock').isInt({ min: 0 }),
  body('price').optional().isFloat({ min: 0 }),
  body('location').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, code, category, subcategory, description, unit, quantity, minStock, price, location } = req.body;

    // Validate subcategory is required for MODEM category
    if (category === 'MODEM' && !subcategory) {
      return res.status(400).json({ 
        error: 'Subcategory is required for MODEM items' 
      });
    }

    // Validate subcategory is only for MODEM category
    if (category !== 'MODEM' && subcategory) {
      return res.status(400).json({ 
        error: 'Subcategory can only be set for MODEM items' 
      });
    }

    const item = await prisma.item.create({
      data: {
        name,
        code,
        category,
        subcategory: category === 'MODEM' ? subcategory : null,
        description,
        unit,
        currentStock: parseInt(quantity),
        minStock: parseInt(minStock),
        price: price ? parseFloat(price) : 0,
        location
      }
    });

    res.status(201).json({ 
      success: true,
      message: 'Item created successfully', 
      data: { item }
    });
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// Update item
router.put('/items/:id', authenticateToken, requirePermission('inventory:edit'), [
  body('name').isLength({ min: 2 }).trim().optional(),
  body('description').optional().trim(),
  body('unit').isLength({ min: 1 }).trim().optional(),
  body('minStock').isInt({ min: 0 }).optional(),
  body('isActive').isBoolean().optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, unit, minStock, isActive } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (unit) updateData.unit = unit;
    if (minStock !== undefined) updateData.minStock = parseInt(minStock);
    if (isActive !== undefined) updateData.isActive = isActive;

    const item = await prisma.item.update({
      where: { id: req.params.id },
      data: updateData
    });

    res.json({ 
      success: true,
      message: 'Item updated successfully', 
      data: { item }
    });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Add stock (IN)
router.post('/items/:id/stock/add', authenticateToken, [
  body('quantity').isInt({ min: 1 }),
  body('notes').optional().trim(),
  body('technicianId').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { quantity, notes, technicianId } = req.body;
    const itemId = req.params.id;

    await prisma.$transaction(async (tx) => {
      // Update item stock
      await tx.item.update({
        where: { id: itemId },
        data: {
          currentStock: {
            increment: parseInt(quantity)
          }
        }
      });

      // Log the transaction
      await tx.inventoryLog.create({
        data: {
          itemId,
          technicianId,
          type: 'IN',
          quantity: parseInt(quantity),
          notes
        }
      });
    });

    const updatedItem = await prisma.item.findUnique({
      where: { id: itemId }
    });

    // Broadcast inventory update via WebSocket
    try {
      broadcastInventoryUpdate(updatedItem, 'STOCK_ADDED');
      
      // Invalidate cache
      invalidateCache('inventory:');
    } catch (wsError) {
      console.error('WebSocket broadcast error:', wsError);
    }

    res.json({ message: 'Stock added successfully', item: updatedItem });
  } catch (error) {
    console.error('Add stock error:', error);
    res.status(500).json({ error: 'Gagal mencatat barang masuk' });
  }
});

// Mark stock as damaged (Barang Rusak)
router.post('/stock/damage', authenticateToken, requireRole(['ADMIN']), [
  body('itemId').notEmpty().withMessage('Item ID is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('notes').optional().trim(),
  body('damageReason').optional().trim(),
  body('damageDate').optional().isISO8601().withMessage('Invalid date format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { itemId, quantity, notes, damageReason, damageDate } = req.body;

    // Check if item exists and has enough stock
    const item = await prisma.item.findUnique({
      where: { id: itemId }
    });

    if (!item) {
      return res.status(404).json({ error: 'Barang tidak ditemukan' });
    }

    if (item.currentStock < quantity) {
      return res.status(400).json({ 
        error: `Stok tidak mencukupi. Stok tersedia: ${item.currentStock} ${item.unit}` 
      });
    }

    // Update stock and create log
    const result = await prisma.$transaction(async (tx) => {
      // Update item stock
      const updatedItem = await tx.item.update({
        where: { id: itemId },
        data: {
          currentStock: {
            decrement: quantity
          }
        }
      });

      // Create inventory log
      const log = await tx.inventoryLog.create({
        data: {
          itemId,
          type: 'RUSAK',
          quantity,
          previousStock: item.currentStock,
          newStock: updatedItem.currentStock,
          notes: notes || `Barang rusak dilaporkan oleh ${req.user.name}`,
          userId: req.user.id,
          damageReason,
          damageDate: damageDate ? new Date(damageDate) : new Date()
        }
      });

      return { item: updatedItem, log };
    });

    res.json({
      success: true,
      message: 'Barang rusak berhasil dicatat',
      data: result
    });
  } catch (error) {
    console.error('Damage stock error:', error);
    res.status(500).json({ error: 'Gagal mencatat barang rusak' });
  }
});

// Remove stock (OUT)
router.post('/items/:id/stock/remove', authenticateToken, [
  body('quantity').isInt({ min: 1 }),
  body('notes').optional().trim(),
  body('technicianId').optional(),
  body('jobId').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { quantity, notes, technicianId, jobId } = req.body;
    const itemId = req.params.id;

    // Check if sufficient stock
    const item = await prisma.item.findUnique({
      where: { id: itemId }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.currentStock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    await prisma.$transaction(async (tx) => {
      // Update item stock
      await tx.item.update({
        where: { id: itemId },
        data: {
          currentStock: {
            decrement: parseInt(quantity)
          }
        }
      });

      // Log the transaction
      await tx.inventoryLog.create({
        data: {
          itemId,
          technicianId,
          type: 'OUT',
          quantity: parseInt(quantity),
          notes,
          jobId
        }
      });
    });

    const updatedItem = await prisma.item.findUnique({
      where: { id: itemId }
    });

    // Broadcast inventory update via WebSocket
    try {
      broadcastInventoryUpdate(updatedItem, 'STOCK_REMOVED');
      
      // Invalidate cache
      invalidateCache('inventory:');
    } catch (wsError) {
      console.error('WebSocket broadcast error:', wsError);
    }

    res.json({ message: 'Stock removed successfully', item: updatedItem });
  } catch (error) {
    console.error('Remove stock error:', error);
    res.status(500).json({ error: 'Failed to remove stock' });
  }
});

// Return stock
router.post('/items/:id/stock/return', authenticateToken, [
  body('quantity').isInt({ min: 1 }),
  body('notes').optional().trim(),
  body('technicianId').optional(),
  body('jobId').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { quantity, notes, technicianId, jobId } = req.body;
    const itemId = req.params.id;

    await prisma.$transaction(async (tx) => {
      // Update item stock
      await tx.item.update({
        where: { id: itemId },
        data: {
          currentStock: {
            increment: parseInt(quantity)
          }
        }
      });

      // Log the transaction
      await tx.inventoryLog.create({
        data: {
          itemId,
          technicianId,
          type: 'RETURN',
          quantity: parseInt(quantity),
          notes,
          jobId
        }
      });

      // Update inventory usage if jobId provided
      if (jobId) {
        const usage = await tx.inventoryUsage.findUnique({
          where: {
            jobId_itemId: {
              jobId,
              itemId
            }
          }
        });

        if (usage) {
          await tx.inventoryUsage.update({
            where: {
              jobId_itemId: {
                jobId,
                itemId
              }
            },
            data: {
              quantityReturned: {
                increment: parseInt(quantity)
              },
              status: usage.quantityUsed === (usage.quantityReturned + parseInt(quantity)) 
                ? 'RETURNED' 
                : 'PARTIAL_RETURN'
            }
          });
        }
      }
    });

    const updatedItem = await prisma.item.findUnique({
      where: { id: itemId }
    });

    // Broadcast inventory update via WebSocket
    try {
      broadcastInventoryUpdate(updatedItem, 'STOCK_RETURNED');
    } catch (wsError) {
      console.error('WebSocket broadcast error:', wsError);
    }

    res.json({ message: 'Stock returned successfully', item: updatedItem });
  } catch (error) {
    console.error('Return stock error:', error);
    res.status(500).json({ error: 'Failed to return stock' });
  }
});

// Mark stock as damaged/lost
router.post('/items/:id/stock/damage', authenticateToken, [
  body('quantity').isInt({ min: 1 }),
  body('type').isIn(['DAMAGED', 'LOST']),
  body('notes').isLength({ min: 5 }).trim(),
  body('technicianId').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { quantity, type, notes, technicianId } = req.body;
    const itemId = req.params.id;

    // Check if sufficient stock
    const item = await prisma.item.findUnique({
      where: { id: itemId }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.currentStock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    await prisma.$transaction(async (tx) => {
      // Update item stock
      await tx.item.update({
        where: { id: itemId },
        data: {
          currentStock: {
            decrement: parseInt(quantity)
          }
        }
      });

      // Log the transaction
      await tx.inventoryLog.create({
        data: {
          itemId,
          technicianId,
          type,
          quantity: parseInt(quantity),
          notes
        }
      });
    });

    const updatedItem = await prisma.item.findUnique({
      where: { id: itemId }
    });

    // Broadcast inventory update via WebSocket
    try {
      broadcastInventoryUpdate(updatedItem, `STOCK_${type}`);
    } catch (wsError) {
      console.error('WebSocket broadcast error:', wsError);
    }

    res.json({ message: `Stock marked as ${type.toLowerCase()} successfully`, item: updatedItem });
  } catch (error) {
    console.error('Damage stock error:', error);
    res.status(500).json({ error: 'Failed to mark stock as damaged/lost' });
  }
});

// Delete item
router.delete('/items/:id', authenticateToken, requirePermission('inventory:delete'), async (req, res) => {
  try {
    const itemId = req.params.id;

    // Check if item exists
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        inventoryLogs: true
      }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Simplified deletion - no job usage check

    // Delete item and related logs
    await prisma.$transaction(async (tx) => {
      // Delete inventory logs first
      await tx.inventoryLog.deleteMany({
        where: { itemId }
      });

      // Delete the item
      await tx.item.delete({
        where: { id: itemId }
      });
    });

    res.json({ 
      success: true,
      message: 'Item deleted successfully' 
    });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Get inventory summary by categories
router.get('/summary', authenticateToken, requirePermission('inventory:view'), async (req, res) => {
  try {
    // Get summary by main categories
    const categorySummary = await prisma.item.groupBy({
      by: ['category'],
      where: { isActive: true },
      _sum: {
        currentStock: true,
        price: true
      },
      _count: {
        id: true
      }
    });

    // Get modem subcategory breakdown
    const modemSubcategories = await prisma.item.groupBy({
      by: ['subcategory'],
      where: { 
        isActive: true,
        category: 'MODEM',
        subcategory: { not: null }
      },
      _sum: {
        currentStock: true,
        price: true
      },
      _count: {
        id: true
      }
    });

    // Get low stock items by category
    const lowStockItems = await prisma.item.findMany({
      where: {
        isActive: true,
        OR: [
          { currentStock: { lte: 0 } },
          { 
            AND: [
              { currentStock: { not: null } },
              { minStock: { not: null } }
            ]
          }
        ]
      },
      select: {
        category: true,
        currentStock: true,
        minStock: true
      }
    });

    // Filter and group low stock items
    const lowStockByCategory = lowStockItems
      .filter(item => item.currentStock <= item.minStock)
      .reduce((acc, item) => {
        const existing = acc.find(cat => cat.category === item.category);
        if (existing) {
          existing._count++;
        } else {
          acc.push({ category: item.category, _count: 1 });
        }
        return acc;
      }, []);

    res.json({
      success: true,
      data: {
        categorySummary,
        modemSubcategories,
        lowStockByCategory
      }
    });
  } catch (error) {
    console.error('Get inventory summary error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory summary' });
  }
});

// Get low stock items
router.get('/low-stock', authenticateToken, async (req, res) => {
  try {
    const allItems = await prisma.item.findMany({
      where: { isActive: true },
      orderBy: { currentStock: 'asc' }
    });

    // Filter items where currentStock <= minStock
    const lowStockItems = allItems.filter(item => item.currentStock <= item.minStock);

    res.json({ items: lowStockItems });
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({ error: 'Failed to fetch low stock items' });
  }
});

// Create modem batch
router.post('/modem-batch', authenticateToken, requirePermission('inventory:create'), [
  body('name').isLength({ min: 2 }).trim(),
  body('code').isLength({ min: 1 }).trim(),
  body('batchType').isIn(['MIXED_MODEM', 'SINGLE_TYPE']),
  body('items').isArray({ min: 1 }),
  body('items.*.itemId').notEmpty(),
  body('items.*.quantity').isInt({ min: 1 }),
  body('items.*.serialNumbers').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, code, batchType, items, description, location } = req.body;

    // Calculate total stock from items
    const totalStock = items.reduce((sum, item) => sum + item.quantity, 0);

    const result = await prisma.$transaction(async (tx) => {
      // Create batch item
      const batch = await tx.item.create({
        data: {
          name,
          code,
          category: 'MODEM',
          subcategory: batchType === 'SINGLE_TYPE' ? items[0].subcategory : null,
          description: description || `Batch modem ${batchType}`,
          unit: 'batch',
          currentStock: totalStock,
          minStock: 0,
          location,
          isBatch: true,
          batchType,
          serialNumbers: JSON.stringify(items.flatMap(item => item.serialNumbers || []))
        }
      });

      // Create batch items
      const batchItems = await Promise.all(
        items.map(item => 
          tx.modemBatchItem.create({
            data: {
              batchId: batch.id,
              itemId: item.itemId,
              quantity: item.quantity,
              serialNumber: item.serialNumbers ? JSON.stringify(item.serialNumbers) : null
            }
          })
        )
      );

      // Log batch creation
      await tx.inventoryLog.create({
        data: {
          itemId: batch.id,
          type: 'IN',
          quantity: totalStock,
          notes: `Batch modem dibuat dengan ${items.length} jenis item`
        }
      });

      return { batch, batchItems };
    });

    res.status(201).json({
      success: true,
      message: 'Batch modem berhasil dibuat',
      data: result
    });
  } catch (error) {
    console.error('Create modem batch error:', error);
    res.status(500).json({ error: 'Gagal membuat batch modem' });
  }
});

// Get batch details with items
router.get('/modem-batch/:id', authenticateToken, requirePermission('inventory:view'), async (req, res) => {
  try {
    const batch = await prisma.item.findUnique({
      where: { 
        id: req.params.id,
        isBatch: true 
      },
      include: {
        batchItems: {
          include: {
            item: true
          }
        }
      }
    });

    if (!batch) {
      return res.status(404).json({ error: 'Batch tidak ditemukan' });
    }

    res.json({
      success: true,
      data: batch
    });
  } catch (error) {
    console.error('Get batch error:', error);
    res.status(500).json({ error: 'Gagal mengambil data batch' });
  }
});

// Remove item from batch
router.post('/modem-batch/:batchId/remove', authenticateToken, requirePermission('inventory:edit'), [
  body('itemId').notEmpty(),
  body('quantity').isInt({ min: 1 }),
  body('serialNumbers').optional().isArray()
], async (req, res) => {
  try {
    const { batchId } = req.params;
    const { itemId, quantity, serialNumbers } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      // Get batch item
      const batchItem = await tx.modemBatchItem.findUnique({
        where: {
          batchId_itemId: {
            batchId,
            itemId
          }
        }
      });

      if (!batchItem) {
        throw new Error('Item tidak ditemukan dalam batch');
      }

      if (quantity > batchItem.quantity) {
        throw new Error('Jumlah melebihi stok dalam batch');
      }

      // Update or delete batch item
      if (quantity === batchItem.quantity) {
        await tx.modemBatchItem.delete({
          where: {
            batchId_itemId: {
              batchId,
              itemId
            }
          }
        });
      } else {
        await tx.modemBatchItem.update({
          where: {
            batchId_itemId: {
              batchId,
              itemId
            }
          },
          data: {
            quantity: batchItem.quantity - quantity
          }
        });
      }

      // Update batch stock
      await tx.item.update({
        where: { id: batchId },
        data: {
          currentStock: {
            decrement: quantity
          }
        }
      });

      // Add stock to individual item
      await tx.item.update({
        where: { id: itemId },
        data: {
          currentStock: {
            increment: quantity
          }
        }
      });

      // Log the transaction
      await tx.inventoryLog.create({
        data: {
          itemId: batchId,
          type: 'OUT',
          quantity,
          notes: `Item dikeluarkan dari batch ke stok individual`
        }
      });

      return { success: true };
    });

    res.json({
      success: true,
      message: 'Item berhasil dikeluarkan dari batch'
    });
  } catch (error) {
    console.error('Remove from batch error:', error);
    res.status(500).json({ error: error.message || 'Gagal mengeluarkan item dari batch' });
  }
});

// Get serial number status for validation
router.get('/modem/serial-status', authenticateToken, requirePermission('inventory:view'), async (req, res) => {
  try {
    // Get all serial numbers from inventory logs
    const logs = await prisma.inventoryLog.findMany({
      where: {
        item: {
          category: 'MODEM'
        },
        notes: {
          contains: 'Serial:'
        }
      },
      include: {
        item: {
          select: { category: true, subcategory: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const serialStatus = new Map();

    logs.forEach(log => {
      if (log.notes && log.notes.includes('Serial:')) {
        const serialMatch = log.notes.match(/Serial:\s*([^|]+)/i);
        if (serialMatch) {
          const serials = serialMatch[1].split(',').map(s => s.trim().toUpperCase());
          serials.forEach(serial => {
            if (!serialStatus.has(serial)) {
              serialStatus.set(serial, {
                serial,
                status: log.type, // IN, OUT, RETURN
                lastAction: log.createdAt,
                subcategory: log.item?.subcategory
              });
            } else {
              const existing = serialStatus.get(serial);
              if (new Date(log.createdAt) > new Date(existing.lastAction)) {
                existing.status = log.type;
                existing.lastAction = log.createdAt;
              }
            }
          });
        }
      }
    });

    // Separate serials by status for better tracking
    const availableSerials = Array.from(serialStatus.values()).filter(s => s.status === 'IN');
    const outSerials = Array.from(serialStatus.values()).filter(s => s.status === 'OUT');
    const returnedSerials = Array.from(serialStatus.values()).filter(s => s.status === 'RETURN');

    res.json({
      success: true,
      data: {
        available: availableSerials.map(s => s.serial),
        unavailable: outSerials.map(s => s.serial), // Only OUT serials can be returned
        detailed: Object.fromEntries(serialStatus),
        breakdown: {
          in: availableSerials.map(s => s.serial),
          out: outSerials.map(s => s.serial),
          returned: returnedSerials.map(s => s.serial)
        }
      }
    });
  } catch (error) {
    console.error('Get serial status error:', error);
    res.status(500).json({ error: 'Failed to get serial status' });
  }
});

// Smart modem consolidation - merge same category modems on same day
router.post('/modem/smart-add', authenticateToken, requirePermission('inventory:create'), [
  body('subcategory').isIn(['ZTE_V3', 'ZTE_5G', 'HUAWEI_5H5', 'HUAWEI_5V5', 'VIBERHOME']),
  body('serialNumbers').isArray({ min: 1 }),
  body('categoryName').isLength({ min: 2 }).trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { subcategory, serialNumbers, categoryName } = req.body;
    
    // Check for duplicate serials in existing inventory
    const existingLogs = await prisma.inventoryLog.findMany({
      where: {
        item: { category: 'MODEM' },
        notes: { contains: 'Serial:' }
      },
      orderBy: { createdAt: 'desc' }
    });

    const existingSerials = new Set();
    existingLogs.forEach(log => {
      if (log.notes && log.notes.includes('Serial:')) {
        const serialMatch = log.notes.match(/Serial:\s*([^|]+)/i);
        if (serialMatch) {
          const serials = serialMatch[1].split(',').map(s => s.trim().toUpperCase());
          serials.forEach(serial => {
            // Only consider serials that are currently IN (not OUT)
            if (log.type === 'IN') {
              existingSerials.add(serial);
            } else if (log.type === 'OUT') {
              existingSerials.delete(serial);
            }
          });
        }
      }
    });

    // Check for duplicates
    const duplicateSerials = serialNumbers.filter(serial => 
      existingSerials.has(serial.toUpperCase())
    );

    if (duplicateSerials.length > 0) {
      return res.status(400).json({
        error: `Serial number sudah ada di inventory: ${duplicateSerials.join(', ')}`
      });
    }

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const result = await prisma.$transaction(async (tx) => {
      // Check if there's already an item for this subcategory created today
      const existingItem = await tx.item.findFirst({
        where: {
          category: 'MODEM',
          subcategory: subcategory,
          createdAt: {
            gte: todayStart,
            lt: todayEnd
          },
          name: {
            contains: categoryName
          }
        }
      });

      let updatedItem;

      if (existingItem) {
        // Merge with existing item
        let existingSerials = [];
        try {
          existingSerials = existingItem.serialNumbers ? JSON.parse(existingItem.serialNumbers) : [];
        } catch (e) {
          existingSerials = [];
        }

        // Combine serial numbers (avoid duplicates)
        const allSerials = [...new Set([...existingSerials, ...serialNumbers])];
        const newQuantity = allSerials.length - existingSerials.length;

        updatedItem = await tx.item.update({
          where: { id: existingItem.id },
          data: {
            currentStock: {
              increment: newQuantity
            },
            serialNumbers: JSON.stringify(allSerials),
            description: `Batch ${categoryName} dengan ${allSerials.length} unit (Updated: ${new Date().toLocaleString('id-ID')})`
          }
        });

        // Log the addition
        await tx.inventoryLog.create({
          data: {
            itemId: existingItem.id,
            type: 'IN',
            quantity: newQuantity,
            notes: `MODEM MASUK (Consolidated) - Serial: ${serialNumbers.join(', ')}`
          }
        });

        return { item: updatedItem, action: 'merged', newQuantity };
      } else {
        // Create new item for today
        const newItem = await tx.item.create({
          data: {
            name: `${categoryName} - Batch ${today.toLocaleDateString('id-ID')}`,
            code: `${subcategory}-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`,
            category: 'MODEM',
            subcategory: subcategory,
            description: `Batch ${categoryName} dengan ${serialNumbers.length} unit`,
            unit: 'pcs',
            currentStock: serialNumbers.length,
            minStock: 1,
            price: 0,
            serialNumbers: JSON.stringify(serialNumbers)
          }
        });

        // Log the creation
        await tx.inventoryLog.create({
          data: {
            itemId: newItem.id,
            type: 'IN',
            quantity: serialNumbers.length,
            notes: `MODEM MASUK (New Batch) - Serial: ${serialNumbers.join(', ')}`
          }
        });

        return { item: newItem, action: 'created', newQuantity: serialNumbers.length };
      }
    });

    // Broadcast inventory update via WebSocket
    try {
      broadcastInventoryUpdate(result.item, 'STOCK_ADDED');
    } catch (wsError) {
      console.error('WebSocket broadcast error:', wsError);
    }

    res.json({
      success: true,
      message: result.action === 'merged' 
        ? `${result.newQuantity} modem berhasil ditambahkan ke batch yang sudah ada`
        : `Batch baru berhasil dibuat dengan ${result.newQuantity} modem`,
      data: {
        item: result.item,
        action: result.action,
        addedQuantity: result.newQuantity
      }
    });
  } catch (error) {
    console.error('Smart modem add error:', error);
    res.status(500).json({ error: 'Gagal menambahkan modem ke inventory' });
  }
});

module.exports = router;
