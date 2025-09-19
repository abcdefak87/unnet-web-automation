const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const uploadDirs = ['uploads/jobs', 'uploads/customers', 'uploads/reports'];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'uploads/';

    const base = (req.baseUrl || '').toLowerCase();
    if (base.startsWith('/api/jobs')) {
      uploadPath += 'jobs/';
    } else if (base.startsWith('/api/customers')) {
      uploadPath += 'customers/';
    } else if (base.startsWith('/api/reports')) {
      uploadPath += 'reports/';
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Enhanced file filter with security checks
const fileFilter = (req, file, cb) => {
  // Allowed file types with MIME types
  const allowedTypes = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'application/pdf': ['.pdf']
  };

  // Check MIME type
  const mimeType = file.mimetype;
  if (!allowedTypes[mimeType]) {
    return cb(new Error(`File type ${mimeType} is not allowed`));
  }

  // Check file extension
  const extname = path.extname(file.originalname).toLowerCase();
  if (!allowedTypes[mimeType].includes(extname)) {
    return cb(new Error(`File extension ${extname} does not match MIME type ${mimeType}`));
  }

  // Check for suspicious file names
  const suspiciousPatterns = [
    /\.(exe|bat|cmd|com|scr|pif|vbs|js|jar|php|asp|aspx|jsp)$/i,
    /\.(sh|bash|zsh|fish|ps1|psm1)$/i,
    /\.(sql|db|sqlite|sqlite3)$/i
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(file.originalname))) {
    return cb(new Error('Suspicious file type detected'));
  }

  // Check for path traversal attempts
  if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes(path.sep)) {
    return cb(new Error('Invalid file name'));
  }

  cb(null, true);
};

// Upload configuration with enhanced security
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
    files: 5, // Maximum 5 files per request
    fieldSize: 1024 * 1024, // 1MB for field values
  },
  fileFilter: fileFilter
});

// Additional security middleware
const validateUploadedFiles = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next();
  }

  // Check total file size
  const totalSize = req.files.reduce((total, file) => total + file.size, 0);
  const maxTotalSize = 20 * 1024 * 1024; // 20MB total

  if (totalSize > maxTotalSize) {
    return res.status(400).json({
      error: 'Total file size exceeds limit',
      maxSize: '20MB',
      currentSize: `${(totalSize / 1024 / 1024).toFixed(2)}MB`
    });
  }

  // Additional file validation
  for (const file of req.files) {
    if (file.size === 0) {
      return res.status(400).json({ error: 'Empty files are not allowed' });
    }
  }

  next();
};

// Specific upload configurations - Allow any field to handle dynamic form fields
const uploadJobPhotos = upload.any();

const uploadSinglePhoto = upload.single('photo');

module.exports = {
  upload,
  uploadJobPhotos,
  uploadSinglePhoto,
  validateUploadedFiles
};
