// controllers/dateTimeController.js
import DateTime from "../models/DateTime.js";

// ---------------- Get current system datetime ----------------
export const getDateTime = async (req, res) => {
  try {
    // Fetch latest datetime setting
    let settings = await DateTime.findOne().sort({ createdAt: -1 });

    // If no settings exist, return fallback (real time)
    if (!settings) {
      return res.json({
        customDateTime: new Date().toISOString().slice(0, 16),
        useCustomDate: false,
      });
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: "Error fetching date settings", error });
  }
};

// ---------------- Update system datetime ----------------
export const updateDateTime = async (req, res) => {
  try {
    const { customDateTime, useCustomDate } = req.body;

    // Fetch existing settings
    let settings = await DateTime.findOne();

    if (settings) {
      settings.customDateTime = customDateTime;
      settings.useCustomDate = useCustomDate;
      await settings.save();
    } else {
      settings = await DateTime.create({ customDateTime, useCustomDate });
    }

    // Calculate the disbursement date based on the settings
    const disbursementDate = useCustomDate 
      ? new Date(customDateTime).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    // Determine system date to apply
    const systemDate = useCustomDate ? new Date(customDateTime) : new Date();

    res.json({
      message: "DateTime settings updated successfully. New entries will use the configured date/time.",
      settings: {
        customDateTime,
        useCustomDate,
        systemDate: systemDate.toISOString(),
        disbursementDate
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating date settings", error });
  }
};