require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
const User = require("./models/User");
const UserInfo = require("./models/UserInfo");
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require("twilio")(accountSid, authToken);

const app = express();

app.use(cors());
// Increase JSON payload limit to 10MB
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const otpStore = {};
const OTP_EXPIRY_TIME = 2 * 60 * 1000; // 2 minutes

// Middleware for content type
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

// Helper functions
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

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

// Get phone number endpoint
app.get("/get-phone-number", async (req, res) => {
  try {
    const latestUser = await User.findOne().sort({ createdAt: -1 });

    if (!latestUser) {
      return res.status(404).json({
        success: false,
        message: "No user found",
      });
    }

    res.status(200).json({
      success: true,
      phoneNumber: latestUser.phoneNumber,
    });
  } catch (error) {
    console.error("Error retrieving phone number:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve phone number",
      error: error.message,
    });
  }
});

// Save user info endpoint
app.post("/save-user-info", async (req, res) => {
  try {
    const { phoneNumber, username, shopname, profilePicture } = req.body;

    if (!phoneNumber || !username || !shopname) {
      return res.status(400).json({
        success: false,
        message: "Phone number, username, and shop name are required",
      });
    }

    // Find user by phone number
    const user = await User.findOne({ phoneNumber });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with this phone number",
      });
    }

    // Check if user info already exists
    let userInfo = await UserInfo.findOne({ userId: user._id });

    if (userInfo) {
      // Update existing user info
      userInfo.username = username;
      userInfo.shopname = shopname;
      if (profilePicture) {
        userInfo.profilePicture = profilePicture;
      }
      userInfo.updatedAt = new Date();
      await userInfo.save();
    } else {
      // Create new user info
      userInfo = new UserInfo({
        userId: user._id,
        username,
        shopname,
        profilePicture,
      });
      await userInfo.save();
    }

    res.status(200).json({
      success: true,
      message: "User information saved successfully",
      userInfo: {
        phoneNumber: user.phoneNumber,
        username: userInfo.username,
        shopname: userInfo.shopname,
        profilePicture: userInfo.profilePicture ? true : false,
      },
    });
  } catch (error) {
    console.error("Error saving user information:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save user information",
      error: error.message,
    });
  }
});

// Get user info endpoint
app.get("/get-user-info/:phoneNumber", async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userInfo = await UserInfo.findOne({ userId: user._id });
    if (!userInfo) {
      return res.status(404).json({
        success: false,
        message: "User information not found",
      });
    }

    res.status(200).json({
      success: true,
      userInfo: {
        phoneNumber: user.phoneNumber,
        username: userInfo.username,
        shopname: userInfo.shopname,
        profilePicture: userInfo.profilePicture,
      },
    });
  } catch (error) {
    console.error("Error retrieving user information:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve user information",
      error: error.message,
    });
  }
});

// Send OTP endpoint
app.post("/send-otp", async (req, res) => {
  const { number } = req.body;

  if (!number) {
    return res.status(400).json({
      success: false,
      message: "Phone number is required",
    });
  }

  if (
    otpStore[number] &&
    Date.now() - otpStore[number].timestamp < OTP_EXPIRY_TIME
  ) {
    return res.status(400).json({
      success: false,
      message: "An OTP has already been sent to your number.",
    });
  }

  try {
    // Check if user exists in MongoDB
    let user = await User.findOne({ phoneNumber: number });

    if (!user) {
      // Create new user if doesn't exist
      user = new User({ phoneNumber: number });
      await user.save();
    }

    const otp = generateOTP();
    console.log("Generated OTP for", number, ":", otp);

    otpStore[number] = { otp, timestamp: Date.now() };

    await sendSMS(number, `Your OTP is: ${otp}`);
    res.status(200).json({ success: true, message: "OTP sent successfully!" });
  } catch (error) {
    console.error("Error in /send-otp route:", error.message);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
});

// Verify OTP endpoint
app.post("/verify-otp", async (req, res) => {
  const { number, otp } = req.body;
  console.log("Verifying OTP:", number, otp);

  if (!otpStore[number]) {
    return res.status(400).json({
      success: false,
      message: "No OTP found for this number",
    });
  }

  if (otpStore[number].otp === otp) {
    if (Date.now() - otpStore[number].timestamp < OTP_EXPIRY_TIME) {
      delete otpStore[number];
      return res.status(200).json({
        success: true,
        message: "OTP verified successfully!",
      });
    } else {
      delete otpStore[number];
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }
  }

  console.warn(`Invalid OTP attempt for ${number}: ${otp}`);
  return res.status(400).json({
    success: false,
    message: "Invalid OTP",
  });
});

// Reset OTP endpoint
app.post("/reset-otp", (req, res) => {
  const { number } = req.body;

  if (otpStore[number]) {
    delete otpStore[number];
  }

  res.status(200).json({
    success: true,
    message: "OTP has been reset. Please request a new one.",
  });
});

// Serve static files
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
