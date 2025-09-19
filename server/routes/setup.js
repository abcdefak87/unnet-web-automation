const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

// Password validation function
const validatePassword = (password) => {
  const minLength = parseInt(process.env.MIN_PASSWORD_LENGTH) || 8;
  const requireComplexity = process.env.REQUIRE_PASSWORD_COMPLEXITY === 'true';
  
  if (password.length < minLength) {
    return `Password must be at least ${minLength} characters long`;
  }
  
  if (requireComplexity) {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      return 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character';
    }
  }
  
  return null;
};

// Check if setup is needed
router.get('/check', async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({ 
      setupNeeded: userCount === 0,
      userCount 
    });
  } catch (error) {
    logger.error('Setup check error:', { error: error.message });
    res.status(500).json({ error: 'Failed to check setup status' });
  }
});

// Create initial user
router.post('/user', [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(['superadmin', 'admin', 'gudang', 'user']).withMessage('Invalid role'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, username, password, role } = req.body;

    // Validate password complexity
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: username }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Set permissions based on role
    const rolePermissions = {
      'superadmin': 'ALL',
      'admin': 'LIMITED',
      'gudang': 'INVENTORY_ONLY',
      'user': 'VIEW_ONLY'
    };

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email: username, // Using username as email for login
        password: hashedPassword,
        role,
        permissions: rolePermissions[role],
        isActive: true
      }
    });

    logger.info('Initial user created', { 
      userId: user.id, 
      username: user.email,
      name: user.name,
      role: user.role
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        name: user.name,
        username: user.email,
        role: user.role
      }
    });

  } catch (error) {
    logger.error('Setup user creation error:', { 
      error: error.message, 
      stack: error.stack 
    });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Health check endpoint for BAT script
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'ISP Management System API'
  });
});

module.exports = router;
