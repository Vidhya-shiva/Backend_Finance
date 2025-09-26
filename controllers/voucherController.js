// controllers/voucherController.js
import Voucher from "../models/Voucher.js";
import Trash from "../models/Trash.js";
import TrashLog from "../models/TrashLog.js";
import mongoose from "mongoose";

// Helper: Validate MongoDB ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// @desc    Get all vouchers
// @route   GET /api/vouchers
// @access  Private
export const getVouchers = async (req, res) => {
  try {
    const vouchers = await Voucher.find()
      .populate("customer", "customerId fullName phoneNumber")
      .sort({ createdAt: -1 });
    res.status(200).json(vouchers);
  } catch (err) {
    console.error("⚠️ Error fetching vouchers:", err.message);
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Get voucher by ID
// @route   GET /api/vouchers/:id
// @access  Private
export const getVoucherById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid voucher ID" });
    }

    const voucher = await Voucher.findById(id).populate(
      "customer",
      "customerId fullName phoneNumber fatherSpouse altPhoneNumber govIdType govIdNumber address"
    );

    if (!voucher) {
      return res.status(404).json({ message: "Voucher not found" });
    }

    res.status(200).json(voucher);
  } catch (err) {
    console.error("⚠️ Error fetching voucher by ID:", err.message);
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Create a new voucher
// @route   POST /api/vouchers
// @access  Private
export const createVoucher = async (req, res) => {
  try {
    const { billNo } = req.body;

    // Check if bill number already exists
    const existingVoucher = await Voucher.findOne({ billNo });
    if (existingVoucher) {
      return res.status(400).json({ message: "Bill number already exists" });
    }

    const newVoucher = new Voucher(req.body);
    const savedVoucher = await newVoucher.save();

    // Populate customer for response
    const populatedVoucher = await Voucher.findById(savedVoucher._id).populate(
      "customer",
      "customerId fullName phoneNumber"
    );

    res.status(201).json(populatedVoucher);
  } catch (err) {
    console.error("⚠️ Error creating voucher:", err.message);
    res.status(500).json({ message: "Error creating voucher", error: err.message });
  }
};

// @desc    Update a voucher
// @route   PUT /api/vouchers/:id
// @access  Private
export const updateVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid voucher ID" });
    }

    let voucher = await Voucher.findById(id);
    if (!voucher) {
      return res.status(404).json({ message: "Voucher not found" });
    }

    // Check if bill number changed and already exists
    if (req.body.billNo && req.body.billNo !== voucher.billNo) {
      const existingVoucher = await Voucher.findOne({ billNo: req.body.billNo });
      if (existingVoucher) {
        return res.status(400).json({ message: "Bill number already exists" });
      }
    }

    // Update voucher
    voucher = await Voucher.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true }
    ).populate("customer", "customerId fullName phoneNumber");

    res.status(200).json(voucher);
  } catch (err) {
    console.error("⚠️ Error updating voucher:", err.message);
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Delete a voucher (soft delete -> move to Trash)
// @route   DELETE /api/vouchers/:id
// @access  Private
export const deleteVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid voucher ID" });
    }

    const voucher = await Voucher.findById(id).populate("customer");
    if (!voucher) {
      return res.status(404).json({ message: "Voucher not found" });
    }

    // Move voucher to Trash
    const trashItem = new Trash({
      type: "voucher",
      data: voucher.toObject(),
      deletedAt: new Date(),
    });

    await trashItem.save();

    // Log the trash action
    await TrashLog.create({
      action: "delete",
      type: "voucher",
      data: voucher.toObject(),
    });

    // Remove from main collection
    await voucher.deleteOne();

    res.status(200).json({ message: "Voucher moved to trash successfully" });
  } catch (err) {
    console.error("⚠️ Error deleting voucher:", err.message);
    res.status(500).json({ message: "Server Error" });
  }
};

// @desc    Revert and Delete a closed loan voucher
// @route   DELETE /api/vouchers/:id/revert-delete
// @access  Private
// (KEEPING EXISTING FUNCTIONALITY - BUT ENHANCED WITH TRASH INTEGRATION)
export const revertAndDeleteVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const { originalStatus, action } = req.body;

    // Validate the original status
    if (!originalStatus || !['Active', 'Overdue'].includes(originalStatus)) {
      return res.status(400).json({
        message: 'Invalid original status. Must be Active or Overdue.'
      });
    }

    // Find the voucher
    const voucher = await Voucher.findById(id).populate("customer");
    
    if (!voucher) {
      return res.status(404).json({
        message: 'Voucher not found'
      });
    }

    // Check if the voucher is currently closed
    if (voucher.status !== 'Closed') {
      return res.status(400).json({
        message: 'Can only revert closed vouchers'
      });
    }

    // Store original closed data for logging
    const originalClosedData = {
      closedDate: voucher.closedDate,
      finalAmountPaid: voucher.finalAmountPaid,
      totalInterestPaid: voucher.totalInterestPaid,
      monthsPaid: voucher.monthsPaid,
      paymentMethod: voucher.paymentMethod
    };

    // ENHANCED: Move to trash instead of just marking as deleted
    const trashItem = new Trash({
      type: "voucher",
      data: {
        ...voucher.toObject(),
        // Add revert information to trash data
        revertedFrom: 'Closed',
        revertedTo: originalStatus,
        originalClosedData: originalClosedData,
        revertedAt: new Date()
      },
      deletedAt: new Date(),
    });

    await trashItem.save();

    // Log the action for audit trail
    await TrashLog.create({
      action: "delete",
      type: "voucher",
      data: {
        ...voucher.toObject(),
        revertAction: true,
        revertedFrom: 'Closed',
        revertedTo: originalStatus
      },
    });

    // Remove from main collection
    await voucher.deleteOne();

    console.log(`✅ Voucher ${voucher.billNo} reverted from Closed to ${originalStatus} and moved to trash`);

    res.status(200).json({
      message: `Voucher ${voucher.billNo} has been reverted to ${originalStatus} status and moved to trash successfully`,
      action: 'revert_and_delete',
      originalStatus: 'Closed',
      newStatus: originalStatus,
      deletedAt: new Date(),
      revertedAt: new Date()
    });

  } catch (error) {
    console.error('⚠️ Error reverting and deleting voucher:', error);
    res.status(500).json({
      message: 'Internal server error while reverting and deleting voucher',
      error: error.message
    });
  }
};

// @desc    NEW - Delete voucher with payment history (from Interest Details page)
// @route   DELETE /api/vouchers/:id/delete-with-payments
// @access  Private
export const deleteVoucherWithPayments = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid voucher ID" });
    }

    const voucher = await Voucher.findById(id).populate("customer");
    if (!voucher) {
      return res.status(404).json({ message: "Voucher not found" });
    }

    // Move voucher to Trash
    const trashItem = new Trash({
      type: "voucher",
      data: {
        ...voucher.toObject(),
        deletedFrom: 'InterestDetailsPage',
        hadPaymentHistory: voucher.paymentHistory && voucher.paymentHistory.length > 0
      },
      deletedAt: new Date(),
    });

    await trashItem.save();

    // Log the trash action
    await TrashLog.create({
      action: "delete",
      type: "voucher",
      data: {
        ...voucher.toObject(),
        deletedFrom: 'InterestDetailsPage'
      },
    });

    // Remove from main collection
    await voucher.deleteOne();

    console.log(`✅ Voucher ${voucher.billNo} with payment history moved to trash successfully`);
    res.status(200).json({ 
      message: "Voucher with payment history moved to trash successfully",
      billNo: voucher.billNo
    });
  } catch (err) {
    console.error("⚠️ Error deleting voucher with payments:", err.message);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// @desc    Get closed vouchers
// @route   GET /api/vouchers/closed
// @access  Private
export const getClosedVouchers = async (req, res) => {
  try {
    const closedVouchers = await Voucher.find({ 
      status: "Closed",
      isDeleted: { $ne: true } // Exclude deleted vouchers
    })
    .populate("customer", "customerId fullName phoneNumber")
    .sort({ closedDate: -1 });
    
    res.status(200).json(closedVouchers);
  } catch (err) {
    console.error("⚠️ Error fetching closed vouchers:", err.message);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// @desc    Revert closure of a loan voucher (restore to saved vouchers)
// @route   PUT /api/vouchers/:id/revert-closure
// @access  Private
export const revertClosureVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Starting revert closure for voucher ID:', id);
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid voucher ID" });
    }

    // Find the voucher
    const voucher = await Voucher.findById(id).populate("customer");
    
    if (!voucher) {
      return res.status(404).json({
        message: 'Voucher not found'
      });
    }

    console.log('Found voucher:', voucher.billNo, 'Current status:', voucher.status);

    // Check if the voucher is currently closed
    if (voucher.status !== 'Closed') {
      return res.status(400).json({
        message: 'Can only revert closed vouchers'
      });
    }

    // Store closure data for logging before removing it
    const closureData = {
      closedDate: voucher.closedDate,
      finalAmountPaid: voucher.finalAmountPaid,
      totalInterestPaid: voucher.totalInterestPaid,
      monthsPaid: voucher.monthsPaid,
      paymentMethod: voucher.paymentMethod
    };

    console.log('Storing closure data:', closureData);

    // Revert the voucher to its pre-closure state
    voucher.status = 'Active'; // Reset to Active, UI will handle overdue display based on due date
    voucher.closedDate = null;
    voucher.finalAmountPaid = 0;
    voucher.totalInterestPaid = 0;
    voucher.monthsPaid = 0;
    voucher.paymentMethod = 'Cash'; // Reset to default

    console.log('Reverting voucher to Active status');

    // Save the reverted voucher (keep it in the main collection)
    const updatedVoucher = await voucher.save();

    console.log('Voucher saved successfully with status:', updatedVoucher.status);

    // Log the revert action for audit trail (optional - with try-catch)
    try {
      await TrashLog.create({
        action: "revert_closure",
        type: "voucher",
        data: {
          voucherId: voucher._id,
          billNo: voucher.billNo,
          revertedFrom: 'Closed',
          revertedTo: 'Active',
          previousClosureData: closureData,
          revertedAt: new Date(),
          keptInSavedVouchers: true
        },
      });
      console.log('Audit log created successfully');
    } catch (logError) {
      console.error('Error creating audit log:', logError.message);
      // Continue with the operation even if logging fails
    }

    console.log(`✅ Voucher ${voucher.billNo} closure reverted successfully - now available in saved vouchers`);

    res.status(200).json({
      message: `Voucher ${voucher.billNo} closure has been reverted and moved back to saved vouchers successfully`,
      voucher: updatedVoucher,
      action: 'revert_closure',
      revertedFrom: 'Closed',
      revertedTo: 'Active',
      revertedAt: new Date(),
      availableInSavedVouchers: true
    });

  } catch (error) {
    console.error('⚠️ Error reverting voucher closure:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      message: 'Internal server error while reverting voucher closure',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Revert auction transfer (restore voucher from auction back to overdue status)
// @route   PUT /api/vouchers/:id/revert-auction
// @access  Private
export const revertAuctionTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Starting revert auction transfer for voucher ID:', id);
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid voucher ID" });
    }

    // Find the voucher
    const voucher = await Voucher.findById(id).populate("customer");
    
    if (!voucher) {
      return res.status(404).json({
        message: 'Voucher not found'
      });
    }

    console.log('Found voucher:', voucher.billNo, 'Current status:', voucher.status);

    // FIXED: Allow reverting from any status since auction transfers are managed via localStorage
    // The voucher might still have "Active" or "Overdue" status in database even when transferred to auction
    // We'll trust that the frontend only calls this endpoint for valid auction transfers
    
    // Store current auction data for logging before removing it
    const auctionData = {
      transferredDate: voucher.auctionTransferDate || new Date(),
      previousStatus: voucher.status,
      transferredBy: voucher.auctionTransferredBy || null,
      auctionNotes: voucher.auctionNotes || null
    };

    console.log('Storing auction transfer data:', auctionData);

    // Determine the correct status to revert to based on due date
    const currentDate = new Date();
    const dueDate = new Date(voucher.dueDate);
    const isOverdue = currentDate > dueDate;
    
    // Set to Active and let UI handle overdue display
    const revertStatus = 'Active';
    
    // Revert the voucher to its pre-auction state
    voucher.status = revertStatus;
    
    // Remove auction-related fields if they exist
    if (voucher.auctionTransferDate) {
      voucher.auctionTransferDate = undefined;
    }
    if (voucher.auctionTransferredBy) {
      voucher.auctionTransferredBy = undefined;
    }
    if (voucher.auctionNotes) {
      voucher.auctionNotes = undefined;
    }

    console.log('Reverting voucher to status:', revertStatus);

    // Save the reverted voucher (keep it in the main collection)
    const updatedVoucher = await voucher.save();

    console.log('Voucher saved successfully with status:', updatedVoucher.status);

    // Log the revert action for audit trail (optional - with try-catch)
    try {
      await TrashLog.create({
        action: "revert_auction",
        type: "voucher",
        data: {
          voucherId: voucher._id,
          billNo: voucher.billNo,
          revertedFrom: 'Auction Transfer',
          revertedTo: revertStatus,
          previousAuctionData: auctionData,
          revertedAt: new Date(),
          keptInSavedVouchers: true,
          wasOverdue: isOverdue
        },
      });
      console.log('Audit log created successfully');
    } catch (logError) {
      console.error('Error creating audit log:', logError.message);
      // Continue with the operation even if logging fails
    }

    console.log(`✅ Voucher ${voucher.billNo} auction transfer reverted successfully - now available in saved vouchers`);

    res.status(200).json({
      message: `Voucher ${voucher.billNo} has been reverted from auction transfer and moved back to saved vouchers successfully`,
      voucher: updatedVoucher,
      action: 'revert_auction',
      revertedFrom: 'Auction Transfer',
      revertedTo: revertStatus,
      revertedAt: new Date(),
      availableInSavedVouchers: true,
      wasOverdue: isOverdue
    });

  } catch (error) {
    console.error('⚠️ Error reverting auction transfer:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      message: 'Internal server error while reverting auction transfer',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};