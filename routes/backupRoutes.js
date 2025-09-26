import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  getSummary,
  getPreviewData,
  exportToExcel,
  restoreFromExcel,
  getBackupHistory,
  deleteBackupLog
} from '../controllers/backuprestorecontroller.js';

const router = express.Router();

// Fix __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'backups');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('Created backup upload directory:', uploadDir);
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${originalName}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    console.log('File upload - Name:', file.originalname, 'Type:', file.mimetype);
    
    // Check file extension and mimetype
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      console.log('File accepted:', file.originalname);
      cb(null, true);
    } else {
      console.log('File rejected:', file.originalname, 'Type:', file.mimetype);
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for larger datasets
  }
});

// Error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
    }
    return res.status(400).json({ error: error.message });
  } else if (error.message.includes('Only Excel')) {
    return res.status(400).json({ error: error.message });
  }
  next(error);
};

// Add CORS middleware specifically for backup routes
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Routes

// Enhanced health check endpoint with system info
router.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({
    status: 'OK',
    backupSystem: 'Enhanced Active',
    timestamp: new Date().toISOString(),
    supportedFormats: ['xlsx', 'xls', 'csv'],
    availableDataTypes: [
      // Original data types
      { type: 'customers', source: 'database', restoreSupported: true },
      { type: 'vouchers', source: 'database', restoreSupported: true },
      { type: 'employees', source: 'database', restoreSupported: true },
      { type: 'jewels', source: 'database', restoreSupported: true },
      // New data types
      { type: 'personal-loans', source: 'api', restoreSupported: false },
      { type: 'interest-payments', source: 'computed', restoreSupported: false },
      { type: 'closed-loans', source: 'api', restoreSupported: false },
      { type: 'auction-transfers', source: 'localStorage', restoreSupported: false }
    ],
    features: [
      'Multi-source data export',
      'Enhanced preview functionality', 
      'Comprehensive logging',
      'Backup history tracking',
      'File cleanup automation'
    ]
  });
});

// Get enhanced summary of all data types
router.get('/summary', async (req, res) => {
  try {
    console.log('Enhanced summary requested');
    await getSummary(req, res);
  } catch (error) {
    console.error('Enhanced summary error:', error);
    res.status(500).json({ error: 'Failed to get enhanced summary' });
  }
});

// Get preview data for specific data type (enhanced)
router.get('/data/:dataType', async (req, res) => {
  try {
    console.log('Enhanced preview data requested for:', req.params.dataType);
    
    // Validate enhanced data types
    const validTypes = [
      'customers', 'vouchers', 'employees', 'jewels',
      'personal-loans', 'interest-payments', 'closed-loans', 'auction-transfers'
    ];
    
    if (!validTypes.includes(req.params.dataType)) {
      return res.status(400).json({ 
        error: `Invalid data type: ${req.params.dataType}`,
        supportedTypes: validTypes
      });
    }
    
    await getPreviewData(req, res);
  } catch (error) {
    console.error('Enhanced preview data error:', error);
    res.status(500).json({ error: 'Failed to get preview data' });
  }
});

// Get enhanced backup history with filtering
router.get('/history', async (req, res) => {
  try {
    console.log('Enhanced backup history requested with filters:', req.query);
    await getBackupHistory(req, res);
  } catch (error) {
    console.error('Enhanced history error:', error);
    res.status(500).json({ error: 'Failed to get backup history' });
  }
});

// Get backup statistics
router.get('/statistics', async (req, res) => {
  try {
    console.log('Backup statistics requested');
    
    // This would require the BackupLog model to be properly loaded
    // For now, return basic stats structure
    res.json({
      totalBackups: 0,
      successfulBackups: 0,
      failedBackups: 0,
      dataTypes: {},
      recentActivity: [],
      storageUsed: '0 MB',
      message: 'Statistics feature requires BackupLog model'
    });
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ error: 'Failed to get backup statistics' });
  }
});

// Enhanced export data to Excel/CSV
router.get('/export/:dataType', async (req, res) => {
  try {
    console.log('Enhanced export requested for:', req.params.dataType);
    console.log('Request headers:', req.headers);
    
    // Enhanced validation for all supported data types
    const validTypes = [
      'customers', 'vouchers', 'employees', 'jewels',
      'personal-loans', 'interest-payments', 'closed-loans', 'auction-transfers'
    ];
    
    if (!validTypes.includes(req.params.dataType)) {
      return res.status(400).json({ 
        error: `Invalid data type: ${req.params.dataType}`,
        supportedTypes: validTypes
      });
    }
    
    // Add processing start time for performance tracking
    req.startTime = Date.now();
    
    await exportToExcel(req, res);
  } catch (error) {
    console.error('Enhanced export error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to export data: ' + error.message });
    }
  }
});

// Import/restore data from Excel (limited support)
router.post('/restore/:dataType', 
  upload.single('file'), 
  handleMulterError,
  async (req, res) => {
    try {
      console.log('Enhanced restore requested for:', req.params.dataType);
      console.log('File received:', req.file ? req.file.originalname : 'No file');
      
      // Enhanced validation - only certain types support restore
      const restoreSupportedTypes = ['customers', 'vouchers', 'employees', 'jewels'];
      const allValidTypes = [
        'customers', 'vouchers', 'employees', 'jewels',
        'personal-loans', 'interest-payments', 'closed-loans', 'auction-transfers'
      ];
      
      if (!allValidTypes.includes(req.params.dataType)) {
        return res.status(400).json({ 
          error: `Invalid data type: ${req.params.dataType}`,
          supportedTypes: allValidTypes
        });
      }
      
      if (!restoreSupportedTypes.includes(req.params.dataType)) {
        return res.status(400).json({ 
          error: `Restore not supported for ${req.params.dataType}`,
          restoreSupportedTypes,
          message: 'Restore is currently supported only for database-backed data types'
        });
      }
      
      // Add processing start time
      req.startTime = Date.now();
      
      await restoreFromExcel(req, res);
    } catch (error) {
      console.error('Enhanced restore error:', error);
      res.status(500).json({ error: 'Failed to restore data: ' + error.message });
    }
  }
);

// Bulk export endpoint - export multiple data types at once
router.post('/bulk-export', async (req, res) => {
  try {
    const { dataTypes, format = 'xlsx' } = req.body;
    
    console.log('Bulk export requested for:', dataTypes);
    
    if (!Array.isArray(dataTypes) || dataTypes.length === 0) {
      return res.status(400).json({ error: 'dataTypes array is required' });
    }
    
    const validTypes = [
      'customers', 'vouchers', 'employees', 'jewels',
      'personal-loans', 'interest-payments', 'closed-loans', 'auction-transfers'
    ];
    
    const invalidTypes = dataTypes.filter(type => !validTypes.includes(type));
    if (invalidTypes.length > 0) {
      return res.status(400).json({ 
        error: `Invalid data types: ${invalidTypes.join(', ')}`,
        validTypes 
      });
    }
    
    res.json({
      message: 'Bulk export initiated',
      dataTypes,
      format,
      note: 'Bulk export feature is under development. Please export data types individually for now.'
    });
    
  } catch (error) {
    console.error('Bulk export error:', error);
    res.status(500).json({ error: 'Failed to initiate bulk export' });
  }
});

// Data validation endpoint - validate data before backup/restore
router.post('/validate/:dataType', async (req, res) => {
  try {
    const { dataType } = req.params;
    const { sampleData } = req.body;
    
    console.log('Data validation requested for:', dataType);
    
    // Basic validation logic (can be enhanced)
    const validationResult = {
      dataType,
      isValid: true,
      errors: [],
      warnings: [],
      recordCount: Array.isArray(sampleData) ? sampleData.length : 0
    };
    
    // Add specific validation rules based on data type
    if (dataType === 'customers' && Array.isArray(sampleData)) {
      sampleData.forEach((record, index) => {
        if (!record.customerId) {
          validationResult.errors.push(`Record ${index + 1}: Missing customerId`);
        }
        if (!record.fullName) {
          validationResult.errors.push(`Record ${index + 1}: Missing fullName`);
        }
      });
    }
    
    validationResult.isValid = validationResult.errors.length === 0;
    
    res.json(validationResult);
    
  } catch (error) {
    console.error('Data validation error:', error);
    res.status(500).json({ error: 'Failed to validate data' });
  }
});

// Delete backup log entry (enhanced)
router.delete('/history/:id', async (req, res) => {
  try {
    console.log('Delete backup log requested for:', req.params.id);
    await deleteBackupLog(req, res);
  } catch (error) {
    console.error('Enhanced delete error:', error);
    res.status(500).json({ error: 'Failed to delete backup log' });
  }
});

// Cleanup old backup files endpoint
router.post('/cleanup', async (req, res) => {
  try {
    const { daysToKeep = 30 } = req.body;
    
    console.log(`Cleanup requested for files older than ${daysToKeep} days`);
    
    // This would require proper implementation with file system scanning
    res.json({
      message: `Cleanup initiated for files older than ${daysToKeep} days`,
      note: 'Cleanup feature requires proper file system integration'
    });
    
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup old backups' });
  }
});

// Test upload endpoint (enhanced)
router.post('/test-upload',
  upload.single('file'),
  handleMulterError,
  (req, res) => {
    console.log('Enhanced test upload:', req.file);
    res.json({
      success: true,
      message: 'File uploaded successfully',
      file: req.file ? {
        originalname: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path
      } : null,
      supportedFormats: ['xlsx', 'xls', 'csv'],
      maxFileSize: '50MB'
    });
  }
);

// Enhanced error handling middleware
router.use((error, req, res, next) => {
  console.error('Enhanced backup route error:', error);
  
  // Determine error type and provide appropriate response
  let statusCode = 500;
  let errorMessage = 'Internal server error';
  
  if (error.message.includes('Invalid data type')) {
    statusCode = 400;
    errorMessage = error.message;
  } else if (error.message.includes('File too large')) {
    statusCode = 400;
    errorMessage = error.message;
  } else if (error.message.includes('No file uploaded')) {
    statusCode = 400;
    errorMessage = 'Please select a file to upload';
  }
  
  if (!res.headersSent) {
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }
});

export default router;