require("dotenv").config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const client = require("twilio")(accountSid, authToken);

// Function to generate a 4-digit random OTP
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// Function to send SMS
const sendSMS = async (toNumber, body) => {
  let msgOptions = {
    from: process.env.TWILIO_FROM_NUMBER,
    to: toNumber,
    body,
  };
  try {
    const message = await client.messages.create(msgOptions);
    console.log("Message sent:", message.sid);
  } catch (error) {
    console.error("Error sending message:", error);
  }
};

// Main function to generate OTP and send SMS
const main = async () => {
  const phoneNumber = '+917498084512'; // Replace with user input phone number
  const otp = generateOTP(); // Generate OTP
  console.log("Generated OTP:", otp); // Log OTP for testing purposes

  // Send the OTP via SMS
  await sendSMS(phoneNumber, `Your OTP is: ${otp}`);
};

// Execute the main function
main();
