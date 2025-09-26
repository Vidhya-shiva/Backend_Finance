// models/DateTime.js
import mongoose from "mongoose";

const dateTimeSchema = new mongoose.Schema(
  {
    customDateTime: {
      type: String, // Store in ISO format (e.g. 2025-08-12T17:35)
      required: true,
    },
    useCustomDate: {
      type: Boolean,
      default: false,
    },
    // Optional: Add a field to track when settings were last applied
    lastApplied: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

const DateTime = mongoose.model("DateTime", dateTimeSchema);

export default DateTime;