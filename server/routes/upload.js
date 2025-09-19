const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads/ktp');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for KTP photo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: KTP_timestamp_originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'KTP_' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Only allow image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Upload KTP photo endpoint
router.post('/ktp', upload.single('ktpPhoto'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/ktp/${req.file.filename}`;
    
    res.json({
      success: true,
      message: 'KTP photo uploaded successfully',
      fileUrl: fileUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('KTP upload error:', error);
    res.status(500).json({ error: 'Failed to upload KTP photo' });
  }
});

// Serve uploaded files
router.use('/ktp', express.static(uploadsDir));

module.exports = router;
