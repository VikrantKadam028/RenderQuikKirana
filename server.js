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

// Middleware to set correct MIME types
app.use((req, res, next) => {
  if (req.url.endsWith('.css')) {
    res.type('text/css');
  } else if (req.url.endsWith('.js')) {
    res.type('application/javascript');
  } else if (req.url.endsWith('.json')) {
    res.type('application/json');
  }
  next();
});

const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

const sendSMS = async (toNumber, body) => {
  let msgOptions = {
    from: process.env.TWILIO_FROM_NUMBER,
    to: toNumber,
    body: body
  };
  try {
    const message = await client.messages.create(msgOptions);
    console.log("Message sent:", message.sid);
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

app.post("/send-otp", async (req, res) => {
  const { number } = req.body;

  if (!number) {
    return res.status(400).json({ success: false, message: "Phone number is required" });
  }

  try {
    const otp = generateOTP();
    console.log("Generated OTP:", otp);
    
    await sendSMS(number, `Your OTP is: ${otp}`);
    res.status(200).json({ success: true, message: "OTP sent successfully!" });
  } catch (error) {
    console.error("Error in /send-otp route:", error);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});