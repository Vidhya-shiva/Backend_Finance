import mongoose from 'mongoose';

const backupLogSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['export', 'import']
  },
  dataType: {
    type: String,
    required: true,
    enum: [
      'customers', 
      'loans', 
      'transactions', 
      'vouchers', 
      'reports', 
      'employees', 
      'jewels',
      'personal-loans',
      'interest-payments',
      'closed-loans',
      'auction-transfers'
    ]
  },
  filename: {
    type: String,
    required: true
  },
  recordCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },
  errorMessage: {
    type: String
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  metadata: {
    imported: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    errors: { type: Array, default: [] },
    fileSize: { type: Number },
    originalName: { type: String },
    dataSource: { 
      type: String, 
      enum: ['database', 'api', 'computed', 'localStorage'], 
      default: 'database' 
    },
    apiEndpoint: { type: String },
    processingTime: { type: Number }, // in milliseconds
    exportFormat: { 
      type: String, 
      enum: ['xlsx', 'csv', 'json'], 
      default: 'xlsx' 
    }
  }
}, {
  timestamps: true
});

// Enhanced indexes for better performance
backupLogSchema.index({ dataType: 1, type: 1, createdAt: -1 });
backupLogSchema.index({ userId: 1, createdAt: -1 });
backupLogSchema.index({ status: 1, createdAt: -1 });
backupLogSchema.index({ 'metadata.dataSource': 1 });

// Virtual for formatted file size
backupLogSchema.virtual('formattedFileSize').get(function() {
  if (!this.metadata?.fileSize) return 'N/A';
  const size = this.metadata.fileSize;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
});

// Virtual for processing duration
backupLogSchema.virtual('processingDuration').get(function() {
  if (!this.metadata?.processingTime) return 'N/A';
  const time = this.metadata.processingTime;
  if (time < 1000) return `${time} ms`;
  return `${(time / 1000).toFixed(1)} s`;
});

// Instance method to update progress
backupLogSchema.methods.updateProgress = async function(updates) {
  Object.assign(this, updates);
  if (updates.metadata) {
    this.metadata = { ...this.metadata, ...updates.metadata };
  }
  return await this.save();
};

// Static method to get backup statistics
backupLogSchema.statics.getBackupStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$dataType',
        totalBackups: { $sum: 1 },
        successfulBackups: {
          $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
        },
        failedBackups: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        totalRecords: { $sum: '$recordCount' },
        avgFileSize: { $avg: '$metadata.fileSize' },
        lastBackup: { $max: '$createdAt' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
  
  return stats;
};

// Static method to cleanup old backups
backupLogSchema.statics.cleanupOldBackups = async function(daysToKeep = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const result = await this.deleteMany({
    createdAt: { $lt: cutoffDate },
    status: { $in: ['success', 'failed'] }
  });
  
  return result.deletedCount;
};

// Pre-save middleware to set data source based on data type
backupLogSchema.pre('save', function(next) {
  if (!this.metadata) {
    this.metadata = {};
  }
  
  // Set data source based on data type if not already set
  if (!this.metadata.dataSource) {
    const dataSourceMap = {
      'customers': 'database',
      'vouchers': 'database', 
      'employees': 'database',
      'jewels': 'database',
      'personal-loans': 'api',
      'interest-payments': 'computed',
      'closed-loans': 'api',
      'auction-transfers': 'localStorage'
    };
    
    this.metadata.dataSource = dataSourceMap[this.dataType] || 'database';
  }
  
  // Set API endpoint for API-based data types
  if (this.metadata.dataSource === 'api' && !this.metadata.apiEndpoint) {
    const endpointMap = {
      'personal-loans': '/api/saved-loans',
      'closed-loans': '/api/vouchers/closed'
    };
    
    this.metadata.apiEndpoint = endpointMap[this.dataType];
  }
  
  next();
});

// FIXED: Ensure the model is created with the correct collection name
const BackupLog = mongoose.model('BackupLog', backupLogSchema, 'backuplogs');

export default BackupLog;