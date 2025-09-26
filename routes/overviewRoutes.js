// routes/overviewRoutes.js
import express from 'express';
const router = express.Router();
import { 
  getOverviewData, 
  getFilteredLoans, 
  getReceivedPayments, 
  getLoansOverview 
} from '../controllers/overviewController.js';

// NEW ROUTE: Get all loans with optional date filtering
router.get('/loans', getLoansOverview);

// EXISTING ROUTES (keep for backward compatibility)
router.get('/data', getOverviewData);
router.get('/filtered', getFilteredLoans);
router.get('/payments', getReceivedPayments);

export default router;