import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import models with error handling
let BackupLog, Customer, Jewel, Voucher, Employee;

const importModel = async (modelPath, modelName) => {
  try {
    const module = await import(modelPath);
    if (module.default) {
      console.log(`✅ ${modelName} loaded`);
      return module.default;
    }
    return null;
  } catch (error) {
    console.warn(`⚠️ ${modelName} not found:`, error.message);
    return null;
  }
};

const loadModels = async () => {
  try {
    BackupLog = await importModel('../models/backuprestore.js', 'BackupLog');
    Customer = await importModel('../models/Customer.js', 'Customer');
    Jewel = await importModel('../models/Jewel.js', 'Jewel');
    Voucher = await importModel('../models/Voucher.js', 'Voucher');
    Employee = await importModel('../models/Employee.js', 'Employee');
    
    if (BackupLog) {
      try {
        await BackupLog.countDocuments();
        console.log('✅ BackupLog verified');
      } catch (testError) {
        console.warn('BackupLog test failed');
      }
    }
  } catch (error) {
    console.error('Error loading models:', error);
  }
};

await loadModels();

// Model mapping
const modelMapping = {
  customers: Customer,
  jewels: Jewel,
  vouchers: Voucher,
  employees: Employee,
  'personal-loans': null,
  'interest-payments': null,
  'closed-loans': null,
  'auction-transfers': null
};

// Data source mapping
const getDataSource = (dataType) => {
  const sourceMap = {
    'customers': 'database',
    'vouchers': 'database', 
    'employees': 'database',
    'jewels': 'database',
    'personal-loans': 'api',
    'interest-payments': 'computed',
    'closed-loans': 'api',
    'auction-transfers': 'localStorage'
  };
  return sourceMap[dataType] || 'database';
};

// Backup log helpers
const createBackupLog = async (logData) => {
  if (!BackupLog) return null;
  
  try {
    const log = new BackupLog({
      type: logData.type || 'export',
      dataType: logData.dataType || 'unknown',
      filename: logData.filename || 'unknown.xlsx',
      userId: logData.userId || null,
      status: 'pending',
      recordCount: 0,
      metadata: {
        dataSource: getDataSource(logData.dataType),
        ...logData.metadata
      }
    });
    return await log.save();
  } catch (error) {
    console.error('Error creating backup log:', error);
    return null;
  }
};

const updateBackupLog = async (log, updates) => {
  if (!log || !BackupLog) return null;
  
  try {
    Object.assign(log, updates);
    return await log.save();
  } catch (error) {
    console.error('Error updating backup log:', error);
    return null;
  }
};

// Data handlers
const getComputedData = async (dataType, limit = null) => {
  if (dataType === 'interest-payments' && Voucher) {
    try {
      let query = Voucher.find({ paymentHistory: { $exists: true, $ne: [] } })
        .populate('customer', 'customerId fullName phoneNumber');
      
      if (limit) query = query.limit(limit);
      
      const vouchers = await query.lean();
      const interestPayments = [];
      
      vouchers.forEach(voucher => {
        if (voucher.paymentHistory) {
          voucher.paymentHistory.forEach(payment => {
            interestPayments.push({
              voucherId: voucher.billNo,
              customerId: voucher.customer?.customerId,
              customerName: voucher.customer?.fullName,
              paymentDate: payment.date,
              interestAmount: payment.interestPaid || 0,
              principalAmount: payment.principalPaid || 0,
              totalAmount: payment.amount,
              paymentMethod: payment.method,
              remarks: payment.remarks
            });
          });
        }
      });
      
      return interestPayments;
    } catch (error) {
      console.error('Error fetching computed data:', error);
      return [];
    }
  }
  return [];
};

const getDatabaseData = async (model, dataType, limit = null) => {
  if (!model) return [];
  
  try {
    let query = model.find({});
    
    if (dataType === 'vouchers' && Voucher) {
      query = query.populate('customer', 'customerId fullName phoneNumber fatherSpouse altPhoneNumber govIdType govIdNumber address');
    }
    
    if (limit) query = query.limit(limit);
    return await query.lean();
  } catch (error) {
    console.error('Database fetch error:', error);
    return [];
  }
};

// Get summary
export const getSummary = async (req, res) => {
  try {
    const summary = {};
    
    for (const [dataType, model] of Object.entries(modelMapping)) {
      const dataSource = getDataSource(dataType);
      let count = 0;
      
      try {
        if (dataSource === 'database' && model) {
          count = await model.countDocuments();
        } else if (dataSource === 'computed' && dataType === 'interest-payments' && Voucher) {
          count = await Voucher.countDocuments({ paymentHistory: { $exists: true, $ne: [] } });
        }
        
        summary[dataType] = count;
      } catch (error) {
        summary[dataType] = 0;
      }
    }
    
    res.status(200).json(summary);
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch data summary' });
  }
};

// Get preview data
export const getPreviewData = async (req, res) => {
  try {
    const { dataType } = req.params;
    const limit = parseInt(req.query.limit) || 3;
    
    if (!Object.keys(modelMapping).includes(dataType)) {
      return res.status(400).json({ error: `Invalid data type: ${dataType}` });
    }
    
    const dataSource = getDataSource(dataType);
    let data = [];
    
    try {
      if (dataSource === 'database') {
        data = await getDatabaseData(modelMapping[dataType], dataType, limit);
      } else if (dataSource === 'computed') {
        data = await getComputedData(dataType, limit);
      }
    } catch (error) {
      console.error(`Error fetching ${dataType} data:`, error);
      return res.status(500).json({ error: `Failed to fetch ${dataType} data` });
    }
    
    res.status(200).json({ 
      dataType,
      dataSource,
      count: data.length,
      data: data.slice(0, limit)
    });
  } catch (error) {
    console.error('Error fetching preview data:', error);
    res.status(500).json({ error: 'Failed to fetch preview data' });
  }
};

// Export to Excel
export const exportToExcel = async (req, res) => {
  let backupLog = null;
  
  try {
    const { dataType } = req.params;
    
    if (!Object.keys(modelMapping).includes(dataType)) {
      return res.status(400).json({ error: `Invalid data type: ${dataType}` });
    }

    const dataSource = getDataSource(dataType);
    
    // Create backup log
    backupLog = await createBackupLog({
      type: 'export',
      dataType,
      filename: '',
      userId: req.user?.id || null,
      metadata: { dataSource, exportFormat: 'xlsx' }
    });

    let data = [];
    
    try {
      if (dataSource === 'database') {
        data = await getDatabaseData(modelMapping[dataType], dataType);
      } else if (dataSource === 'computed') {
        data = await getComputedData(dataType);
      } else if (dataSource === 'api') {
        throw new Error(`Export for ${dataType} requires API integration`);
      } else if (dataSource === 'localStorage') {
        throw new Error(`${dataType} data should be exported from frontend`);
      }
    } catch (error) {
      if (backupLog) {
        await updateBackupLog(backupLog, {
          status: 'failed',
          errorMessage: error.message
        });
      }
      return res.status(500).json({ error: error.message });
    }
    
    if (data.length === 0) {
      if (backupLog) {
        await updateBackupLog(backupLog, {
          status: 'failed',
          errorMessage: 'No data found to export'
        });
      }
      return res.status(404).json({ error: 'No data found to export' });
    }

    // Clean data for Excel
    const cleanData = data.map(item => {
      const { _id, __v, ...cleanItem } = item;
      
      Object.keys(cleanItem).forEach(key => {
        if (cleanItem[key] instanceof Date) {
          cleanItem[key] = cleanItem[key].toLocaleDateString('en-IN') + ' ' + 
                          cleanItem[key].toLocaleTimeString('en-IN');
        }
        if (key === 'customer' && cleanItem[key] && typeof cleanItem[key] === 'object') {
          cleanItem['customerId'] = cleanItem[key].customerId || '';
          cleanItem['customerName'] = cleanItem[key].fullName || '';
          cleanItem['customerPhone'] = cleanItem[key].phoneNumber || '';
          cleanItem['customerAddress'] = cleanItem[key].address || '';
          delete cleanItem[key];
        }
        if (cleanItem[key] && typeof cleanItem[key] === 'object' && cleanItem[key]._id) {
          cleanItem[key] = cleanItem[key]._id.toString();
        }
      });
      
      return cleanItem;
    });

    // Create Excel workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(cleanData);
    
    // Auto-adjust columns
    if (cleanData.length > 0) {
      const colWidths = Object.keys(cleanData[0]).map(key => ({
        wch: Math.min(Math.max(key.length, ...cleanData.map(row => String(row[key] || '').length)) + 2, 50)
      }));
      ws['!cols'] = colWidths;
    }
    
    XLSX.utils.book_append_sheet(wb, ws, dataType);

    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 10) + '_' + 
      new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '');
    const filename = `${dataType}_backup_${timestamp}.xlsx`;
    
    // Create temp directory
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const filepath = path.join(tempDir, filename);
    
    try {
      XLSX.writeFile(wb, filepath);
    } catch (writeError) {
      throw new Error('Failed to create Excel file: ' + writeError.message);
    }
    
    if (!fs.existsSync(filepath)) {
      throw new Error('Failed to create Excel file');
    }
    
    const fileStats = fs.statSync(filepath);
    
    // Update backup log
    if (backupLog) {
      await updateBackupLog(backupLog, {
        filename,
        recordCount: data.length,
        status: 'success',
        metadata: {
          ...backupLog.metadata,
          fileSize: fileStats.size,
          originalName: filename,
          exportedAt: new Date(),
          recordsProcessed: data.length,
          processingTime: Date.now() - (req.startTime || Date.now())
        }
      });
    }

    // Set headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fileStats.size);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    // Send file and cleanup
    res.sendFile(filepath, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to download file' });
        }
      }
      
      // Cleanup after delay
      setTimeout(() => {
        try {
          if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError);
        }
      }, 30000);
    });

  } catch (error) {
    console.error('Export error:', error);
    
    if (backupLog) {
      await updateBackupLog(backupLog, {
        status: 'failed',
        errorMessage: error.message
      });
    }
    
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to export data: ' + error.message });
    }
  }
};

// Restore from Excel
export const restoreFromExcel = async (req, res) => {
  let backupLog = null;
  
  try {
    const { dataType } = req.params;
    
    const supportedTypes = ['customers', 'vouchers', 'employees', 'jewels'];
    if (!supportedTypes.includes(dataType)) {
      return res.status(400).json({ 
        error: `Restore not supported for ${dataType}`,
        supportedTypes
      });
    }
    
    const model = modelMapping[dataType];
    if (!model || !req.file) {
      return res.status(400).json({ error: !model ? `Invalid data type: ${dataType}` : 'No file uploaded' });
    }

    // Create backup log
    backupLog = await createBackupLog({
      type: 'import',
      dataType,
      filename: req.file.originalname,
      userId: req.user?.id || null,
      metadata: {
        fileSize: req.file.size,
        originalName: req.file.originalname,
        uploadedAt: new Date(),
        dataSource: getDataSource(dataType)
      }
    });

    // Read Excel file
    const workbook = XLSX.readFile(req.file.path);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
      if (backupLog) {
        await updateBackupLog(backupLog, {
          status: 'failed',
          errorMessage: 'No data found in Excel file'
        });
      }
      return res.status(400).json({ error: 'No data found in Excel file' });
    }

    let imported = 0;
    let updated = 0;
    const errors = [];

    // Process records
    for (let i = 0; i < jsonData.length; i++) {
      try {
        const record = jsonData[i];
        
        const cleanRecord = {};
        Object.keys(record).forEach(key => {
          if (record[key] !== null && record[key] !== undefined && record[key] !== '') {
            if (typeof record[key] === 'string' && record[key].includes('/') && record[key].includes(':')) {
              try {
                cleanRecord[key] = new Date(record[key]);
              } catch (e) {
                cleanRecord[key] = record[key];
              }
            } else {
              cleanRecord[key] = record[key];
            }
          }
        });

        // Find existing record
        let existingRecord = null;
        const identifiers = {
          customers: ['customerId', 'phoneNumber'],
          jewels: ['itemId'],
          vouchers: ['billNo'],
          employees: ['employeeId']
        };

        for (const identifier of identifiers[dataType] || []) {
          if (cleanRecord[identifier]) {
            existingRecord = await model.findOne({ [identifier]: cleanRecord[identifier] });
            if (existingRecord) break;
          }
        }

        if (existingRecord) {
          await model.findByIdAndUpdate(existingRecord._id, cleanRecord);
          updated++;
        } else {
          await model.create(cleanRecord);
          imported++;
        }
        
      } catch (error) {
        errors.push({
          row: i + 1,
          error: error.message,
          data: jsonData[i]
        });
      }
    }

    // Update backup log
    if (backupLog) {
      await updateBackupLog(backupLog, {
        recordCount: imported + updated,
        status: errors.length === jsonData.length ? 'failed' : 'success',
        metadata: {
          ...backupLog.metadata,
          imported,
          updated,
          errors: errors.slice(0, 10),
          processedAt: new Date(),
          totalRecords: jsonData.length,
          processingTime: Date.now() - (req.startTime || Date.now())
        },
        errorMessage: errors.length === jsonData.length ? 'All records failed to import' : null
      });
    }

    // Cleanup file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({
      success: true,
      result: {
        imported,
        updated,
        total: jsonData.length,
        errors
      }
    });

  } catch (error) {
    console.error('Restore error:', error);
    
    if (backupLog) {
      await updateBackupLog(backupLog, {
        status: 'failed',
        errorMessage: error.message
      });
    }
    
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Failed to restore data: ' + error.message });
  }
};

// Get backup history
export const getBackupHistory = async (req, res) => {
  try {
    if (!BackupLog) {
      return res.json({
        history: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 },
        message: 'BackupLog model not available'
      });
    }

    const { dataType, type, status } = req.query;
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const filter = {};
    if (dataType && Object.keys(modelMapping).includes(dataType)) {
      filter.dataType = dataType;
    }
    if (type && ['export', 'import'].includes(type)) {
      filter.type = type;
    }
    if (status && ['pending', 'success', 'failed'].includes(status)) {
      filter.status = status;
    }

    const history = await BackupLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .populate('userId', 'name email')
      .lean();

    const total = await BackupLog.countDocuments(filter);

    res.json({
      history,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching backup history:', error);
    res.status(500).json({ error: 'Failed to fetch backup history' });
  }
};

// Delete backup log
export const deleteBackupLog = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!BackupLog) {
      return res.json({ message: 'Backup log deleted successfully (simulated)' });
    }
    
    const backupLog = await BackupLog.findById(id);
    if (!backupLog) {
      return res.status(404).json({ error: 'Backup log not found' });
    }

    // Delete associated file
    if (backupLog.filename) {
      const filepath = path.join(__dirname, '..', 'temp', backupLog.filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }

    await BackupLog.findByIdAndDelete(id);
    res.json({ message: 'Backup log deleted successfully' });
  } catch (error) {
    console.error('Error deleting backup log:', error);
    res.status(500).json({ error: 'Failed to delete backup log' });
  }
};