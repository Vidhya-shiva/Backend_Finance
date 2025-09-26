import express from 'express';
import {
  // Original functions (keeping for backward compatibility)
  getStockSummary,
  getVoucherById,
  updateVoucherStatus,
  getDashboardStats,
  updateOverdueStatus,
  createOrUpdateStockSummary,
  deleteStockSummary,
  
  // New functions for frontend support
  getCustomersForStock,
  getVouchersForStock,
  getCustomerLoans,
  getCustomerById,
  searchCustomers,
  generateStockReport
} from '../controllers/stockSummaryController.js';

const router = express.Router();

// ========== NEW ROUTES FOR FRONTEND SUPPORT ==========

// GET /api/stock-summary/customers - Get all customers for stock management
router.get('/customers', getCustomersForStock);

// GET /api/stock-summary/customers/search - Search customers with query parameters
router.get('/customers/search', searchCustomers);

// GET /api/stock-summary/customers/:customerId - Get specific customer details
router.get('/customers/:customerId', getCustomerById);

// GET /api/stock-summary/customers/:customerId/loans - Get loans for specific customer
router.get('/customers/:customerId/loans', getCustomerLoans);

// GET /api/stock-summary/vouchers - Get all vouchers for stock management (active & overdue only)
router.get('/vouchers', getVouchersForStock);

// GET /api/stock-summary/customers/:customerId/report - Generate stock report for printing
router.get('/customers/:customerId/report', generateStockReport);

// ========== ORIGINAL ROUTES (backward compatibility) ==========

// GET /api/stock-summary - Get all loans with filtering and pagination from stock summary
router.get('/', getStockSummary);

// POST /api/stock-summary/sync - Create or update stock summary with latest data from daybooks/vouchers
router.post('/sync', createOrUpdateStockSummary);

// GET /api/stock-summary/dashboard - Get dashboard statistics
router.get('/dashboard', getDashboardStats);

// POST /api/stock-summary/update-overdue - Update overdue status for all loans
router.post('/update-overdue', updateOverdueStatus);

// DELETE /api/stock-summary/reset - Delete all stock summary data (for cleanup/reset)
router.delete('/reset', deleteStockSummary);

// GET /api/stock-summary/:id - Get specific loan details
router.get('/:id', getVoucherById);

// PUT /api/stock-summary/:id/status - Update loan status
router.put('/:id/status', updateVoucherStatus);

export default router;