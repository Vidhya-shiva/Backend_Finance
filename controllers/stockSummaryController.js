import StockSummary from '../models/StockSummary.js';
import DayBook from '../models/DayBook.js';
import Voucher from '../models/Voucher.js';
import Customer from '../models/Customer.js';

// Helper function to create DayBook model safely
const createDayBookModel = () => {
  try {
    return DayBook;
  } catch (error) {
    console.log('DayBook model not available:', error.message);
    return null;
  }
};

// Get customers for stock summary (support your frontend search)
export const getCustomersForStock = async (req, res) => {
  try {
    console.log('Getting customers for stock summary...');

    const customers = await Customer.find({}, {
      fullName: 1,
      customerId: 1,
      phoneNumber: 1,
      altPhoneNumber: 1,
      fatherSpouse: 1,
      address: 1,
      govIdType: 1,
      govIdNumber: 1,
      photo: 1,
      email: 1
    }).sort({ fullName: 1 });

    console.log(`Found ${customers.length} customers`);

    return res.json(customers);

  } catch (error) {
    console.error('Error getting customers for stock:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching customers',
      error: error.message
    });
  }
};

// Get vouchers for stock summary (support your frontend loan display)
export const getVouchersForStock = async (req, res) => {
  try {
    console.log('Getting vouchers for stock summary...');

    // Get only active and overdue vouchers as per your frontend requirement
    const vouchers = await Voucher.find({
      status: { $in: ['Active', 'Overdue'] }
    })
      .populate('customer', 'fullName phoneNumber address email customerId')
      .sort({ disbursementDate: -1 });

    console.log(`Found ${vouchers.length} active/overdue vouchers`);

    // Process vouchers to match your frontend expectations
    const processedVouchers = vouchers.map(voucher => {
      const dueDate = new Date(voucher.dueDate);
      const today = new Date();
      const isOverdue = dueDate < today;

      return {
        _id: voucher._id,
        billNo: voucher.billNo,
        customer: voucher.customer,
        jewelType: voucher.jewelType,
        grossWeight: voucher.grossWeight,
        deductionWeight: voucher.deductionWeight,
        netWeight: voucher.netWeight,
        loanAmount: voucher.loanAmount,
        finalLoanAmount: voucher.finalLoanAmount,
        interestRate: voucher.interestRate,
        interestAmount: voucher.interestAmount,
        overallLoanAmount: voucher.overallLoanAmount,
        disbursementDate: voucher.disbursementDate,
        dueDate: voucher.dueDate,
        status: voucher.status,
        jewelryItems: voucher.jewelryItems || [],
        // Add calculated fields for frontend
        isOverdue: isOverdue,
        daysOverdue: isOverdue ? Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24)) : 0
      };
    });

    return res.json(processedVouchers);

  } catch (error) {
    console.error('Error getting vouchers for stock:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching vouchers',
      error: error.message
    });
  }
};

// Get customer loans by customer ID (for your frontend customer selection)
// Get customer loans by customerId (not MongoDB _id)
export const getCustomerLoans = async (req, res) => {
  try {
    const { customerId } = req.params;
    console.log(`Getting loans for customerId: ${customerId}`);

    // First find the customer by customerId field (not _id)
    const customer = await Customer.findOne({ customerId: customerId });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID ${customerId} not found`
      });
    }

    console.log(`Found customer: ${customer.fullName} (MongoDB ID: ${customer._id})`);

    // Find vouchers for this customer using the MongoDB _id
    const vouchers = await Voucher.find({
      customer: customer._id, // Use MongoDB _id for the voucher query
      status: { $in: ['Active', 'Overdue'] }
    })
      .populate('customer', 'fullName phoneNumber address email customerId')
      .sort({ disbursementDate: -1 });

    console.log(`Found ${vouchers.length} loans for customer ${customerId}`);

    // Process vouchers for frontend
    const customerLoans = vouchers.map(voucher => {
      const dueDate = new Date(voucher.dueDate);
      const today = new Date();
      const isOverdue = dueDate < today;

      return {
        _id: voucher._id,
        billNo: voucher.billNo,
        customer: voucher.customer,
        jewelType: voucher.jewelType,
        grossWeight: voucher.grossWeight,
        deductionWeight: voucher.deductionWeight,
        netWeight: voucher.netWeight,
        loanAmount: voucher.loanAmount,
        finalLoanAmount: voucher.finalLoanAmount,
        interestRate: voucher.interestRate,
        interestAmount: voucher.interestAmount,
        overallLoanAmount: voucher.overallLoanAmount,
        disbursementDate: voucher.disbursementDate,
        dueDate: voucher.dueDate,
        status: voucher.status,
        jewelryItems: voucher.jewelryItems || [],
        isOverdue: isOverdue,
        daysOverdue: isOverdue ? Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24)) : 0
      };
    });

    return res.json({
      success: true,
      customerId: customerId,
      customerName: customer.fullName,
      customerDetails: {
        _id: customer._id,
        customerId: customer.customerId,
        fullName: customer.fullName,
        phoneNumber: customer.phoneNumber,
        address: customer.address
      },
      loans: customerLoans,
      totalLoans: customerLoans.length,
      totalAmount: customerLoans.reduce((sum, loan) => sum + (loan.finalLoanAmount || 0), 0),
      activeLoans: customerLoans.filter(loan => !loan.isOverdue).length,
      overdueLoans: customerLoans.filter(loan => loan.isOverdue).length
    });

  } catch (error) {
    console.error('Error getting customer loans:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching customer loans',
      error: error.message
    });
  }
};

// Get customer details by ID (for your frontend customer display)
export const getCustomerById = async (req, res) => {
  try {
    const { customerId } = req.params;
    console.log(`Getting customer details for: ${customerId}`);

    const customer = await Customer.findById(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    console.log(`Found customer: ${customer.fullName}`);

    return res.json({
      success: true,
      data: customer
    });

  } catch (error) {
    console.error('Error getting customer by ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching customer details',
      error: error.message
    });
  }
};

// Search customers (for your frontend dropdown search)
export const searchCustomers = async (req, res) => {
  try {
    const { q, field = 'all' } = req.query;
    console.log(`Searching customers: "${q}" in field: ${field}`);

    if (!q || q.length < 1) {
      return res.json([]);
    }

    let searchFilter = {};
    const searchTerm = q.toLowerCase();

    switch (field) {
      case 'name':
        searchFilter = { fullName: { $regex: searchTerm, $options: 'i' } };
        break;
      case 'id':
        searchFilter = { customerId: { $regex: searchTerm, $options: 'i' } };
        break;
      case 'phone':
        searchFilter = {
          $or: [
            { phoneNumber: { $regex: q } },
            { altPhoneNumber: { $regex: q } }
          ]
        };
        break;
      case 'father':
        searchFilter = { fatherSpouse: { $regex: searchTerm, $options: 'i' } };
        break;
      case 'address':
        searchFilter = { address: { $regex: searchTerm, $options: 'i' } };
        break;
      default:
        // All fields search
        searchFilter = {
          $or: [
            { fullName: { $regex: searchTerm, $options: 'i' } },
            { customerId: { $regex: searchTerm, $options: 'i' } },
            { phoneNumber: { $regex: q } },
            { altPhoneNumber: { $regex: q } },
            { fatherSpouse: { $regex: searchTerm, $options: 'i' } },
            { address: { $regex: searchTerm, $options: 'i' } }
          ]
        };
    }

    const customers = await Customer.find(searchFilter)
      .select('fullName customerId phoneNumber altPhoneNumber fatherSpouse address photo')
      .limit(10)
      .sort({ fullName: 1 });

    console.log(`Found ${customers.length} matching customers`);

    return res.json(customers);

  } catch (error) {
    console.error('Error searching customers:', error);
    return res.status(500).json({
      success: false,
      message: 'Error searching customers',
      error: error.message
    });
  }
};

// Generate stock report data (for your print functionality)
export const generateStockReport = async (req, res) => {
  try {
    const { customerId } = req.params;
    console.log(`Generating stock report for customer: ${customerId}`);

    // Get customer details
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Get customer loans
    const vouchers = await Voucher.find({
      customer: customerId,
      status: { $in: ['Active', 'Overdue'] }
    }).sort({ disbursementDate: -1 });

    // Process loans for report
    const loans = vouchers.map(voucher => {
      const dueDate = new Date(voucher.dueDate);
      const today = new Date();
      const isOverdue = dueDate < today;

      return {
        billNo: voucher.billNo,
        disbursementDate: voucher.disbursementDate,
        dueDate: voucher.dueDate,
        jewelType: voucher.jewelType,
        grossWeight: voucher.grossWeight,
        netWeight: voucher.netWeight,
        finalLoanAmount: voucher.finalLoanAmount,
        interestRate: voucher.interestRate,
        jewelryItems: voucher.jewelryItems || [],
        status: isOverdue ? 'Overdue' : 'Active',
        isOverdue: isOverdue,
        daysOverdue: isOverdue ? Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24)) : 0
      };
    });

    const reportData = {
      customer: {
        customerId: customer.customerId,
        fullName: customer.fullName,
        phoneNumber: customer.phoneNumber,
        altPhoneNumber: customer.altPhoneNumber,
        fatherSpouse: customer.fatherSpouse,
        address: customer.address,
        govIdType: customer.govIdType,
        govIdNumber: customer.govIdNumber,
        photo: customer.photo
      },
      loans: loans,
      summary: {
        totalLoans: loans.length,
        activeLoans: loans.filter(loan => !loan.isOverdue).length,
        overdueLoans: loans.filter(loan => loan.isOverdue).length,
        totalAmount: loans.reduce((sum, loan) => sum + (loan.finalLoanAmount || 0), 0),
        totalActiveAmount: loans.filter(loan => !loan.isOverdue).reduce((sum, loan) => sum + (loan.finalLoanAmount || 0), 0),
        totalOverdueAmount: loans.filter(loan => loan.isOverdue).reduce((sum, loan) => sum + (loan.finalLoanAmount || 0), 0)
      },
      generatedAt: new Date(),
      generatedBy: 'Stock Management System'
    };

    console.log(`Generated report with ${loans.length} loans for ${customer.fullName}`);

    return res.json({
      success: true,
      data: reportData
    });

  } catch (error) {
    console.error('Error generating stock report:', error);
    return res.status(500).json({
      success: false,
      message: 'Error generating stock report',
      error: error.message
    });
  }
};

// Helper function to extract loan data from daybooks
const extractLoanDataFromDayBooks = async () => {
  try {
    const DayBookModel = createDayBookModel();
    if (!DayBookModel) {
      console.log('DayBook model not available');
      return [];
    }

    const dayBooks = await DayBookModel.find({}).sort({ date: -1 });
    const loans = [];

    dayBooks.forEach(dayBook => {
      // Extract loans from loansDisbursed transactions
      if (dayBook.loansDisbursed && dayBook.loansDisbursed.transactions) {
        dayBook.loansDisbursed.transactions.forEach(transaction => {
          if (transaction.voucherId && transaction.billNo) {
            const disbursementDate = new Date(transaction.createdAt || dayBook.date);
            const dueDate = new Date(disbursementDate);
            dueDate.setMonth(dueDate.getMonth() + 12);

            const today = new Date();
            const isOverdue = dueDate < today;
            const daysOverdue = isOverdue ? Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24)) : 0;

            loans.push({
              billNo: transaction.billNo,
              customerId: transaction.customerId || 'unknown',
              customerName: transaction.customerName || 'Unknown Customer',
              customerPhone: 'N/A',
              customerAddress: 'N/A',
              jewelType: transaction.jewelType || 'gold',
              grossWeight: transaction.netWeight || 0,
              netWeight: transaction.netWeight || 0,
              loanAmount: transaction.amount || 0,
              finalLoanAmount: transaction.amount || 0,
              interestRate: transaction.interestRate || 0,
              interestAmount: 0,
              overallLoanAmount: transaction.amount || 0,
              disbursementDate: disbursementDate,
              dueDate: dueDate,
              status: isOverdue ? 'Overdue' : 'Active',
              loanStatus: isOverdue ? 'overdue' : 'active',
              repaidAmount: 0,
              balanceAmount: transaction.amount || 0,
              paymentProgress: 0,
              daysOverdue: daysOverdue,
              voucherId: transaction.voucherId,
              sourceType: 'daybook',
              sourceId: dayBook._id,
              jewelryItems: []
            });
          }
        });
      }
    });

    return loans;
  } catch (error) {
    console.error('Error extracting loans from daybooks:', error);
    return [];
  }
};

// Original functions (keeping for backward compatibility)
export const createOrUpdateStockSummary = async (req, res) => {
  try {
    let loans = [];

    console.log('Starting stock summary sync...');

    // Try to get data from Vouchers first, then fallback to DayBooks
    try {
      console.log('Checking Voucher collection...');
      const voucherCount = await Voucher.countDocuments();
      console.log(`Found ${voucherCount} vouchers in database`);

      if (voucherCount > 0) {
        console.log('Syncing from Voucher collection...');
        const vouchers = await Voucher.find({})
          .populate('customer', 'fullName phoneNumber address email customerId')
          .sort({ disbursementDate: -1 });

        console.log(`Processing ${vouchers.length} vouchers...`);

        loans = vouchers.map(voucher => {
          const dueDate = new Date(voucher.dueDate);
          const today = new Date();
          const isOverdue = dueDate < today && !['Closed'].includes(voucher.status);
          const daysOverdue = isOverdue ? Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24)) : 0;

          return {
            billNo: voucher.billNo,
            customerId: voucher.customer?._id?.toString() || voucher.customerId || 'unknown',
            customerName: voucher.customer?.fullName || voucher.customerName || 'Unknown Customer',
            customerPhone: voucher.customer?.phoneNumber || voucher.customerPhone || 'N/A',
            customerAddress: voucher.customer?.address || 'N/A',
            jewelType: voucher.jewelType || 'gold',
            grossWeight: voucher.grossWeight || 0,
            netWeight: voucher.netWeight || 0,
            loanAmount: voucher.loanAmount || 0,
            finalLoanAmount: voucher.finalLoanAmount || 0,
            interestRate: voucher.interestRate || 0,
            interestAmount: voucher.interestAmount || 0,
            overallLoanAmount: voucher.overallLoanAmount || 0,
            disbursementDate: voucher.disbursementDate,
            dueDate: voucher.dueDate,
            status: voucher.status,
            loanStatus: isOverdue ? 'overdue' :
              voucher.status === 'Closed' ? 'closed' :
                ['Active', 'Partial'].includes(voucher.status) ? 'active' : 'inactive',
            repaidAmount: voucher.repaidAmount || 0,
            balanceAmount: voucher.balanceAmount || voucher.overallLoanAmount,
            paymentProgress: voucher.paymentProgress || 0,
            daysOverdue: daysOverdue,
            lastPaymentDate: voucher.lastPaymentDate,
            monthsPaid: voucher.monthsPaid || 0,
            totalInterestPaid: voucher.totalInterestPaid || 0,
            closedDate: voucher.closedDate,
            voucherId: voucher._id,
            sourceType: 'voucher',
            sourceId: voucher._id,
            jewelryItems: voucher.jewelryItems || []
          };
        });

        console.log(`Successfully processed ${loans.length} vouchers`);
      }
    } catch (voucherError) {
      console.log('Voucher collection error:', voucherError.message);
      console.log('Trying DayBooks as fallback...');
    }

    // If no vouchers found, try DayBooks
    if (loans.length === 0) {
      console.log('No vouchers found, syncing from DayBook collection...');
      loans = await extractLoanDataFromDayBooks();
      console.log(`Extracted ${loans.length} loans from DayBooks`);
    }

    console.log(`Total loans to process: ${loans.length}`);

    // Delete existing stock summary and create new one
    console.log('Deleting existing stock summaries...');
    await StockSummary.deleteMany({});

    console.log('Creating new stock summary...');
    const stockSummary = new StockSummary({
      loans: loans,
      lastSyncedAt: new Date(),
      syncStatus: 'synced',
      dataVersion: '1.0'
    });

    await stockSummary.save();
    console.log('Stock summary saved successfully');

    return res.json({
      success: true,
      message: `Stock summary created/updated with ${loans.length} loans`,
      data: {
        totalLoans: stockSummary.totalLoans,
        activeLoans: stockSummary.activeLoans,
        overdueLoans: stockSummary.overdueLoans,
        closedLoans: stockSummary.closedLoans,
        totalLoanAmount: stockSummary.totalLoanAmount,
        lastUpdated: stockSummary.lastUpdated,
        recordCount: stockSummary.recordCount,
        dataSource: loans.length > 0 ? loans[0].sourceType : 'unknown'
      }
    });

  } catch (error) {
    console.error('Error creating/updating stock summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating/updating stock summary',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

export const getStockSummary = async (req, res) => {
  try {
    const {
      search,
      dateFilter,
      statusFilter,
      jewelTypeFilter,
      page = 1,
      limit = 100
    } = req.query;

    console.log('Getting stock summary with filters:', { search, dateFilter, statusFilter, jewelTypeFilter, page, limit });

    // Check if stock summary exists, if not create it
    let stockSummary = await StockSummary.findOne().sort({ lastUpdated: -1 });

    if (!stockSummary) {
      console.log('Stock summary not found, creating new one...');

      try {
        // Try to sync from vouchers
        let loans = [];

        try {
          const voucherCount = await Voucher.countDocuments();
          if (voucherCount > 0) {
            const vouchers = await Voucher.find({})
              .populate('customer', 'fullName phoneNumber address email customerId')
              .sort({ disbursementDate: -1 });

            loans = vouchers.map(voucher => {
              const dueDate = new Date(voucher.dueDate);
              const today = new Date();
              const isOverdue = dueDate < today && !['Closed'].includes(voucher.status);
              const daysOverdue = isOverdue ? Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24)) : 0;

              return {
                billNo: voucher.billNo,
                customerId: voucher.customer?._id?.toString() || voucher.customerId || 'unknown',
                customerName: voucher.customer?.fullName || voucher.customerName || 'Unknown Customer',
                customerPhone: voucher.customer?.phoneNumber || voucher.customerPhone || 'N/A',
                customerAddress: voucher.customer?.address || 'N/A',
                jewelType: voucher.jewelType || 'gold',
                grossWeight: voucher.grossWeight || 0,
                netWeight: voucher.netWeight || 0,
                loanAmount: voucher.loanAmount || 0,
                finalLoanAmount: voucher.finalLoanAmount || 0,
                interestRate: voucher.interestRate || 0,
                interestAmount: voucher.interestAmount || 0,
                overallLoanAmount: voucher.overallLoanAmount || 0,
                disbursementDate: voucher.disbursementDate,
                dueDate: voucher.dueDate,
                status: voucher.status,
                loanStatus: isOverdue ? 'overdue' :
                  voucher.status === 'Closed' ? 'closed' :
                    ['Active', 'Partial'].includes(voucher.status) ? 'active' : 'inactive',
                repaidAmount: voucher.repaidAmount || 0,
                balanceAmount: voucher.balanceAmount || voucher.overallLoanAmount,
                paymentProgress: voucher.paymentProgress || 0,
                daysOverdue: daysOverdue,
                voucherId: voucher._id,
                sourceType: 'voucher',
                sourceId: voucher._id,
                jewelryItems: voucher.jewelryItems || []
              };
            });
          }
        } catch (voucherError) {
          console.log('Voucher sync failed:', voucherError.message);
        }

        // If no vouchers, try daybooks
        if (loans.length === 0) {
          try {
            loans = await extractLoanDataFromDayBooks();
          } catch (dayBookError) {
            console.log('DayBook sync failed:', dayBookError.message);
          }
        }

        // Create stock summary with whatever data we have (even if empty)
        stockSummary = new StockSummary({
          loans: loans,
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
          dataVersion: '1.0'
        });

        await stockSummary.save();
        console.log(`Stock summary created with ${loans.length} loans`);

      } catch (syncError) {
        console.error('Auto-sync failed completely:', syncError);
        // Return empty response instead of error
        return res.json({
          success: true,
          data: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: parseInt(limit)
          },
          summary: {
            totalLoans: 0,
            activeLoans: 0,
            overdueLoans: 0,
            closedLoans: 0,
            totalActiveLoanAmount: 0,
            totalOverdueLoanAmount: 0,
            totalLoanAmount: 0,
            overdueRate: 0
          },
          jewelTypeSummary: {},
          overallSummary: {
            totalLoans: 0,
            activeLoans: 0,
            overdueLoans: 0,
            closedLoans: 0,
            totalLoanAmount: 0,
            overdueRate: 0,
            lastUpdated: new Date()
          },
          dataSource: 'empty'
        });
      }
    }

    console.log(`Found stock summary with ${stockSummary.loans?.length || 0} loans`);

    let filteredLoans = [...(stockSummary.loans || [])];

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      const beforeFilter = filteredLoans.length;
      filteredLoans = filteredLoans.filter(loan =>
        (loan.billNo && loan.billNo.toLowerCase().includes(searchLower)) ||
        (loan.customerName && loan.customerName.toLowerCase().includes(searchLower)) ||
        (loan.customerId && loan.customerId.toLowerCase().includes(searchLower)) ||
        (loan.customerPhone && loan.customerPhone.includes(search))
      );
      console.log(`Search filter: ${beforeFilter} -> ${filteredLoans.length} loans`);
    }

    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      const nextDay = new Date(filterDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const beforeFilter = filteredLoans.length;
      filteredLoans = filteredLoans.filter(loan => {
        const loanDate = new Date(loan.disbursementDate);
        return loanDate >= filterDate && loanDate < nextDay;
      });
      console.log(`Date filter: ${beforeFilter} -> ${filteredLoans.length} loans`);
    }

    if (statusFilter && statusFilter !== 'all') {
      const beforeFilter = filteredLoans.length;
      if (statusFilter === 'active') {
        filteredLoans = filteredLoans.filter(loan => loan.loanStatus === 'active');
      } else if (statusFilter === 'overdue') {
        filteredLoans = filteredLoans.filter(loan => loan.loanStatus === 'overdue');
      } else if (statusFilter === 'closed') {
        filteredLoans = filteredLoans.filter(loan => loan.loanStatus === 'closed');
      }
      console.log(`Status filter (${statusFilter}): ${beforeFilter} -> ${filteredLoans.length} loans`);
    }

    if (jewelTypeFilter && jewelTypeFilter !== 'all') {
      const beforeFilter = filteredLoans.length;
      filteredLoans = filteredLoans.filter(loan => loan.jewelType === jewelTypeFilter);
      console.log(`Jewel type filter (${jewelTypeFilter}): ${beforeFilter} -> ${filteredLoans.length} loans`);
    }

    // Apply pagination
    const totalCount = filteredLoans.length;
    const startIndex = (page - 1) * limit;
    const paginatedLoans = filteredLoans.slice(startIndex, startIndex + parseInt(limit));

    console.log(`Pagination: showing ${paginatedLoans.length} of ${totalCount} loans (page ${page})`);

    // Calculate filtered summary stats
    const filteredStats = {
      totalLoans: filteredLoans.length,
      activeLoans: filteredLoans.filter(loan => loan.loanStatus === 'active').length,
      overdueLoans: filteredLoans.filter(loan => loan.loanStatus === 'overdue').length,
      closedLoans: filteredLoans.filter(loan => loan.loanStatus === 'closed').length,
      totalActiveLoanAmount: filteredLoans
        .filter(loan => loan.loanStatus === 'active')
        .reduce((sum, loan) => sum + (loan.finalLoanAmount || 0), 0),
      totalOverdueLoanAmount: filteredLoans
        .filter(loan => loan.loanStatus === 'overdue')
        .reduce((sum, loan) => sum + (loan.finalLoanAmount || 0), 0),
      totalLoanAmount: filteredLoans.reduce((sum, loan) => sum + (loan.finalLoanAmount || 0), 0),
      overdueRate: filteredLoans.length > 0
        ? Math.round((filteredLoans.filter(loan => loan.loanStatus === 'overdue').length / filteredLoans.length) * 100)
        : 0
    };

    // Calculate jewel type summary for filtered data
    const jewelTypeSummary = filteredLoans.reduce((acc, loan) => {
      const type = loan.jewelType || 'gold';
      if (!acc[type]) {
        acc[type] = {
          active: 0,
          overdue: 0,
          closed: 0,
          totalAmount: 0,
          count: 0
        };
      }

      if (loan.loanStatus === 'active') acc[type].active++;
      if (loan.loanStatus === 'overdue') acc[type].overdue++;
      if (loan.loanStatus === 'closed') acc[type].closed++;

      acc[type].totalAmount += loan.finalLoanAmount || 0;
      acc[type].count++;

      return acc;
    }, {});

    // Format loans for frontend
    const formattedLoans = paginatedLoans.map(loan => ({
      id: loan._id || loan.voucherId,
      billNo: loan.billNo,
      customer: {
        _id: loan.customerId,
        fullName: loan.customerName,
        phoneNumber: loan.customerPhone,
        address: loan.customerAddress
      },
      jewelType: loan.jewelType,
      grossWeight: loan.grossWeight,
      netWeight: loan.netWeight,
      finalLoanAmount: loan.finalLoanAmount,
      overallLoanAmount: loan.overallLoanAmount,
      interestRate: loan.interestRate,
      disbursementDate: loan.disbursementDate,
      dueDate: loan.dueDate,
      status: loan.status,
      loanStatus: loan.loanStatus,
      repaidAmount: loan.repaidAmount,
      balanceAmount: loan.balanceAmount,
      paymentProgress: loan.paymentProgress,
      daysOverdue: loan.daysOverdue,
      jewelryItems: loan.jewelryItems
    }));

    console.log(`Returning ${formattedLoans.length} formatted loans`);

    return res.json({
      success: true,
      data: formattedLoans,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: parseInt(limit)
      },
      summary: filteredStats,
      jewelTypeSummary,
      overallSummary: {
        totalLoans: stockSummary.totalLoans,
        activeLoans: stockSummary.activeLoans,
        overdueLoans: stockSummary.overdueLoans,
        closedLoans: stockSummary.closedLoans,
        totalLoanAmount: stockSummary.totalLoanAmount,
        overdueRate: stockSummary.overdueRate,
        lastUpdated: stockSummary.lastUpdated
      },
      dataSource: 'stocksummary'
    });

  } catch (error) {
    console.error('Error in getStockSummary:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching stock summary',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get voucher details by ID from stock summary
export const getVoucherById = async (req, res) => {
  try {
    const { id } = req.params;

    const stockSummary = await StockSummary.findOne().sort({ lastUpdated: -1 });

    if (!stockSummary) {
      return res.status(404).json({
        success: false,
        message: 'Stock summary not found'
      });
    }

    const loan = stockSummary.loans.find(loan =>
      loan._id?.toString() === id ||
      loan.voucherId?.toString() === id
    );

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    return res.json({
      success: true,
      data: loan
    });

  } catch (error) {
    console.error('Error in getVoucherById:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching loan details',
      error: error.message
    });
  }
};

// Update voucher status in stock summary
export const updateVoucherStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Active', 'Partial', 'Overdue', 'Closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status provided'
      });
    }

    const stockSummary = await StockSummary.findOne().sort({ lastUpdated: -1 });

    if (!stockSummary) {
      return res.status(404).json({
        success: false,
        message: 'Stock summary not found'
      });
    }

    const loanIndex = stockSummary.loans.findIndex(loan =>
      loan._id?.toString() === id ||
      loan.voucherId?.toString() === id
    );

    if (loanIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    // Update the loan status
    stockSummary.loans[loanIndex].status = status;
    stockSummary.loans[loanIndex].loanStatus =
      status === 'Closed' ? 'closed' :
        status === 'Overdue' ? 'overdue' : 'active';

    if (status === 'Closed') {
      stockSummary.loans[loanIndex].closedDate = new Date();
      stockSummary.loans[loanIndex].repaidAmount = stockSummary.loans[loanIndex].overallLoanAmount;
      stockSummary.loans[loanIndex].balanceAmount = 0;
      stockSummary.loans[loanIndex].paymentProgress = 100;
    }

    stockSummary.lastUpdated = new Date();
    await stockSummary.save();

    return res.json({
      success: true,
      message: 'Loan status updated successfully',
      data: stockSummary.loans[loanIndex]
    });

  } catch (error) {
    console.error('Error in updateVoucherStatus:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating loan status',
      error: error.message
    });
  }
};

// Get dashboard statistics
export const getDashboardStats = async (req, res) => {
  try {
    const stockSummary = await StockSummary.findOne().sort({ lastUpdated: -1 });

    if (!stockSummary) {
      return res.status(404).json({
        success: false,
        message: 'Stock summary not found. Please sync data first.'
      });
    }

    const now = new Date();
    const loans = stockSummary.loans || [];

    // Calculate various statistics
    const stats = {
      totalLoans: stockSummary.totalLoans,
      activeLoans: stockSummary.activeLoans,
      overdueLoans: stockSummary.overdueLoans,
      closedLoans: stockSummary.closedLoans,

      totalLoanValue: stockSummary.totalLoanAmount,
      activeLoanValue: stockSummary.totalActiveLoanAmount,
      overdueLoanValue: stockSummary.totalOverdueLoanAmount,

      // This month's statistics
      thisMonthLoans: loans.filter(loan => {
        const loanDate = new Date(loan.disbursementDate);
        return loanDate.getMonth() === now.getMonth() && loanDate.getFullYear() === now.getFullYear();
      }).length,

      // Due this month
      dueThisMonth: loans.filter(loan => {
        const dueDate = new Date(loan.dueDate);
        return dueDate.getMonth() === now.getMonth() && dueDate.getFullYear() === now.getFullYear();
      }).length,

      // Average loan amount
      averageLoanAmount: stockSummary.averageLoanAmount,

      // Jewel type distribution
      jewelTypeDistribution: stockSummary.jewelTypeSummary,

      // Additional metrics
      overdueRate: stockSummary.overdueRate,
      collectionRate: stockSummary.collectionRate,
      totalRepaidAmount: stockSummary.totalRepaidAmount,
      totalBalanceAmount: stockSummary.totalBalanceAmount,
      lastUpdated: stockSummary.lastUpdated,
      recordCount: stockSummary.recordCount
    };

    return res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics',
      error: error.message
    });
  }
};

// Update overdue status for all loans in stock summary
export const updateOverdueStatus = async (req, res) => {
  try {
    const stockSummary = await StockSummary.findOne().sort({ lastUpdated: -1 });

    if (!stockSummary) {
      return res.status(404).json({
        success: false,
        message: 'Stock summary not found'
      });
    }

    let modifiedCount = 0;
    const now = new Date();

    // Update overdue status for loans
    stockSummary.loans.forEach(loan => {
      if (['active'].includes(loan.loanStatus) && new Date(loan.dueDate) < now) {
        loan.status = 'Overdue';
        loan.loanStatus = 'overdue';
        loan.daysOverdue = Math.ceil((now - new Date(loan.dueDate)) / (1000 * 60 * 60 * 24));
        modifiedCount++;
      }
    });

    if (modifiedCount > 0) {
      stockSummary.lastUpdated = new Date();
      await stockSummary.save();
    }

    return res.json({
      success: true,
      message: `Updated ${modifiedCount} loans to overdue status`,
      modifiedCount: modifiedCount
    });

  } catch (error) {
    console.error('Error in updateOverdueStatus:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating overdue status',
      error: error.message
    });
  }
};

// Delete stock summary (for reset/cleanup)
export const deleteStockSummary = async (req, res) => {
  try {
    const result = await StockSummary.deleteMany({});

    return res.json({
      success: true,
      message: `Deleted ${result.deletedCount} stock summary records`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Error in deleteStockSummary:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting stock summary',
      error: error.message
    });
  }
};