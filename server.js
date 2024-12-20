require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require("twilio")(accountSid, authToken);

const app = express();

// Enable CORS for all routes
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Create an in-memory store for OTPs
const otpStore = {};
const OTP_EXPIRY_TIME = 2 * 60 * 1000; // 2 minutes in milliseconds

// Middleware to set correct MIME types
app.use((req, res, next) => {
  if (req.url.endsWith(".css")) {
    res.type("text/css");
  } else if (req.url.endsWith(".js")) {
    res.type("application/javascript");
  } else if (req.url.endsWith(".json")) {
    res.type("application/json");
  }
  next();
});

// Generate a random 4-digit OTP
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// Function to send SMS
const sendSMS = async (toNumber, body) => {
  const msgOptions = {
    from: process.env.TWILIO_FROM_NUMBER,
    to: toNumber,
    body: body,
  };

  try {
    const message = await client.messages.create(msgOptions);
    console.log("Message sent:", message.sid);
  } catch (error) {
    console.error("Error sending message:", error);
    throw new Error("Failed to send SMS");
  }
};

// Endpoint to send OTP
app.post("/send-otp", async (req, res) => {
  const { number } = req.body;

  // Validate phone number
  if (!number) {
    return res
      .status(400)
      .json({ success: false, message: "Phone number is required" });
  }

  // Check if an OTP has already been sent to this number
  if (
    otpStore[number] &&
    Date.now() - otpStore[number].timestamp < OTP_EXPIRY_TIME
  ) {
    return res
      .status(400)
      .json({
        success: false,
        message: "An OTP has already been sent to your number.",
      });
  }

  try {
    const otp = generateOTP();
    console.log("Generated OTP for", number, ":", otp);

    // Store the OTP in the otpStore with a timestamp
    otpStore[number] = { otp, timestamp: Date.now() };

    await sendSMS(number, `Your OTP is: ${otp}`);
    res.status(200).json({ success: true, message: "OTP sent successfully!" });
  } catch (error) {
    console.error("Error in /send-otp route:", error.message);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
});

app.post("/verify-otp", async (req, res) => {
  const { number, otp } = req.body;
  console.log("Verifying OTP:", number, otp);
  console.log("OTP Store:", otpStore);
  if (otpStore[number] && otpStore[number].otp === otp) {
    if (Date.now() - otpStore[number].timestamp < OTP_EXPIRY_TIME) {
      delete otpStore[number]; 
      return res
        .status(200)
        .json({ success: true, message: "OTP verified successfully!" });
    } else {
      delete otpStore[number]; 
      return res
        .status(400)
        .json({
          success: false,
          message: "OTP has expired. Please request a new one.",
        });
    }
  } else {
    console.warn(`Invalid OTP attempt for ${number}: ${otp}`);
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }
});

// Endpoint to reset OTP
app.post("/reset-otp", (req, res) => {
  const { number } = req.body;

  if (otpStore[number]) {
    delete otpStore[number]; // Remove the existing OTP
  }

  res
    .status(200)
    .json({
      success: true,
      message: "OTP has been reset. Please request a new one.",
    });
});

// Serve the index.html for any other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
