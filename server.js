require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
const User = require("./models/User");
const Product = require("./models/Product");
const Order = require("./models/Order");
const Customer = require("./models/Customers");
const bcrypt = require("bcryptjs");
const ShopLocation = require("./models/ShopLocation");
const billsRoute = require('./routes/bills'); // adjust path if needed
const axios = require('axios');
const schedule = require('node-schedule');
const PUSHALERT_API_KEY = process.env.PUSHALERT_API_KEY;
const PUSHALERT_BASE_URL = 'https://api.pushalert.co/rest/v1';
// Twilio configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require("twilio")(accountSid, authToken);
const router = express.Router();
// Initialize Express app
const app = express();
// app.use('/api/bills', billsRoute);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use('/api/bills', billsRoute);


// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// OTP Storage and Configuration
const otpStore = {};
const OTP_EXPIRY_TIME = 2 * 60 * 1000; // 2 minutes

// Helper Functions
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

// Content-Type middleware
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

// Routes

// Update user profile
app.post("/update-profile", async (req, res) => {
  const { phoneNumber, username, shopName, profilePicture } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({
      success: false,
      message: "Phone number is required",
    });
  }

  try {
    const user = await User.findOne({ phoneNumber });

    if (!user) {
      const formattedNumber = phoneNumber.replace(/\D/g, "");
      const userWithFormattedNumber = await User.findOne({
        phoneNumber: formattedNumber,
      });

      if (userWithFormattedNumber) {
        userWithFormattedNumber.username = username;
        userWithFormattedNumber.shopName = shopName;
        userWithFormattedNumber.profilePicture = profilePicture;
        await userWithFormattedNumber.save();

        return res.status(200).json({
          success: true,
          message: "Profile updated successfully",
          user: userWithFormattedNumber,
        });
      }

      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.username = username;
    user.shopName = shopName;
    user.profilePicture = profilePicture;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message,
    });
  }
});

// Get user details
app.post("/get-user", async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({
      success: false,
      message: "Phone number is required",
    });
  }

  try {
    const user = await User.findOne({ phoneNumber });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user: {
        username: user.username,
        shopName: user.shopName,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user details",
    });
  }
});

// Add product
app.post("/add-product", async (req, res) => {
  try {
    const {
      shopId,
      name,
      quantity,
      unit,
      barcode,
      mrp,
      retailPrice,
      wholesalePrice,
      includingGst,
      discount,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(shopId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid shop ID format",
      });
    }

    const shop = await User.findById(shopId);
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    if (
      !name ||
      !quantity ||
      !unit ||
      !mrp ||
      !retailPrice ||
      !wholesalePrice
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (
      quantity < 0 ||
      mrp < 0 ||
      retailPrice < 0 ||
      wholesalePrice < 0 ||
      discount < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Numeric values cannot be negative",
      });
    }

    const newProduct = new Product({
      shopId,
      name,
      quantity,
      unit,
      barcode,
      mrp,
      retailPrice,
      wholesalePrice,
      includingGst,
      discount,
    });

    await newProduct.save();

    res.status(201).json({
      success: true,
      message: "Product added successfully!",
      product: newProduct,
    });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add product",
      error: error.message,
    });
  }
});

// Get all products for a shop
app.get("/products/shop/:shopId", async (req, res) => {
  try {
    const { shopId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(shopId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid shop ID format",
      });
    }

    const products = await Product.find({ shopId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      products,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message,
    });
  }
});

// Get single product
app.get("/products/single/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
      error: error.message,
    });
  }
});

// Update product
app.put("/products/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update product",
      error: error.message,
    });
  }
});

app.delete("/products/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid product ID" });
    }

    const deletedProduct = await Product.findByIdAndDelete(productId);

    if (!deletedProduct) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Product deleted successfully!" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete product" });
  }
});

app.post("/place-order", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, customerDetails, paymentMode } = req.body;

    // Validate order items and update inventory
    for (const item of items) {
      const product = await Product.findById(item._id).session(session);

      if (!product) {
        throw new Error(`Product ${item.name} not found`);
      }

      if (product.quantity < item.quantity) {
        throw new Error(`Insufficient quantity for ${item.name}`);
      }

      // Update product quantity
      product.quantity -= item.quantity;
      await product.save({ session });
    }

    // Calculate total amount
    const totalAmount = items.reduce(
      (sum, item) => sum + item.retailPrice * item.quantity,
      0
    );

    // Create new order
    const order = new Order({
      customerDetails,
      items: items.map((item) => ({
        productId: item._id,
        name: item.name,
        quantity: item.quantity,
        price: item.retailPrice,
      })),
      totalAmount,
      paymentMode,
    });

    await order.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Order placed successfully",
      orderId: order._id,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error processing order:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to process order",
    });
  } finally {
    session.endSession();
  }
});

app.get("/api/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ orderDate: -1 }); // Fetch latest orders first
    res.status(200).json(orders);
  } catch (error) {
    console.error("❌ Error Fetching Orders:", error);
    res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
});

// Update order status
app.put("/api/orders/:orderId/status", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    const validStatuses = ["Pending", "Processing", "Delivered", "Cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
    });
  }
});

app.post("/api/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if customer exists
    const existingCustomer = await Customer.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: username.toLowerCase() },
      ],
    });

    if (existingCustomer) {
      if (existingCustomer.email === email.toLowerCase()) {
        return res.status(400).json({
          success: false,
          message: "Email already registered. Please login.",
        });
      }
      if (existingCustomer.username === username.toLowerCase()) {
        return res.status(400).json({
          success: false,
          message: "Username already taken. Please choose another.",
        });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new customer
    const newCustomer = new Customer({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    await newCustomer.save();

    res.status(201).json({
      success: true,
      message: "Registration successful!",
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      success: false,
      message: "Error during registration. Please try again.",
      error: error.message,
    });
  }
});

// Login Route
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find customer by username
    const customer = await Customer.findOne({
      username: username.toLowerCase(),
    });

    if (!customer) {
      return res.status(400).json({
        success: false,
        message: "Account not found. Please sign up.",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, customer.password);

    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid password.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Login successful!",
      customer: {
        username: customer.username,
        email: customer.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Error during login. Please try again.",
      error: error.message,
    });
  }
});

// Get Customer Profile Route
app.get("/api/customer/:username", async (req, res) => {
  try {
    const customer = await Customer.findOne({
      username: req.params.username.toLowerCase(),
    }).select("-password"); // Exclude password from response

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      customer,
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching profile",
      error: error.message,
    });
  }
});

// Create or update shop location
app.post("/api/shop-location", async (req, res) => {
  try {
    const { shopId, latitude, longitude, address } = req.body;

    if (!shopId || !latitude || !longitude || !address) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    let shopLocation = await ShopLocation.findOne({ shopId });

    if (shopLocation) {
      shopLocation.latitude = latitude;
      shopLocation.longitude = longitude;
      shopLocation.address = address;
      await shopLocation.save();
    } else {
      shopLocation = new ShopLocation({ shopId, latitude, longitude, address });
      await shopLocation.save();
    }

    res.status(200).json({
      success: true,
      message: "Shop location saved successfully",
      data: shopLocation,
    });
  } catch (error) {
    console.error("Error saving shop location:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save shop location",
      error: error.message,
    });
  }
});

// Get shop location
app.get("/api/shop-location/:shopId", async (req, res) => {
  try {
    const { shopId } = req.params;
    const shopLocation = await ShopLocation.findOne({ shopId });

    if (!shopLocation) {
      return res
        .status(404)
        .json({ success: false, message: "Shop location not found" });
    }

    res.status(200).json({ success: true, data: shopLocation });
  } catch (error) {
    console.error("Error fetching shop location:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch shop location",
      error: error.message,
    });
  }
});

// Replace both existing nearby shop implementations with this one
app.get("/api/shops/nearby", async (req, res) => {
  try {
    const { lat, lon, radius = 6 } = req.query;

    // Validate inputs
    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const userLat = parseFloat(lat);
    const userLon = parseFloat(lon);
    const maxRadius = parseFloat(radius);

    if (isNaN(userLat) || isNaN(userLon) || isNaN(maxRadius)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coordinate or radius values",
      });
    }

    // Get shop locations with populated shop data
    const shopLocations = await ShopLocation.find().populate(
      "shopId",
      "username shopName"
    );

    // Calculate distance and filter by radius
    const nearbyShops = shopLocations
      .map((shop) => {
        const distance = calculateDistance(
          userLat,
          userLon,
          shop.latitude,
          shop.longitude
        );

        return {
          shopId: shop.shopId._id,
          shopName: shop.shopId.shopName || shop.shopId.username,
          latitude: shop.latitude,
          longitude: shop.longitude,
          address: shop.address,
          distance: distance.toFixed(1),
        };
      })
      .filter((shop) => parseFloat(shop.distance) <= maxRadius);

    res.status(200).json({
      success: true,
      data: nearbyShops,
    });
  } catch (error) {
    console.error("Error fetching nearby shops:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});
// Define this once at the top level of your file
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

// Send OTP
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
    const otp = generateOTP();
    console.log("Generated OTP for", number, ":", otp);

    otpStore[number] = { otp, timestamp: Date.now() };

    let user = await User.findOne({ phoneNumber: number });
    if (!user) {
      user = new User({
        phoneNumber: number,
        isVerified: false,
      });
      await user.save();
    }

    await sendSMS(number, `Your OTP is: ${otp}`);
    res.status(200).json({ success: true, message: "OTP sent successfully!" });
  } catch (error) {
    console.error("Error in /send-otp route:", error);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
});

// Verify OTP
app.post("/verify-otp", async (req, res) => {
  const { number, otp } = req.body;

  if (otpStore[number] && otpStore[number].otp === otp) {
    if (Date.now() - otpStore[number].timestamp < OTP_EXPIRY_TIME) {
      delete otpStore[number];

      let user = await User.findOne({ phoneNumber: number });
      if (!user) {
        user = new User({
          phoneNumber: number,
          isVerified: true,
        });
      } else {
        user.isVerified = true;
      }

      await user.save();
      return res.status(200).json({
        success: true,
        message: "OTP verified successfully!",
        userId: user._id,
      });
    } else {
      delete otpStore[number];
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }
  } else {
    return res.status(400).json({
      success: false,
      message: "Invalid OTP",
    });
  }
});

// Reset OTP
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

// Predefined notification messages
const notificationMessages = [
  {
    title: "Kirana ka Full Stock Aaya Hai! 💼",
    message: "Doodh, dal, chawal sab available hai! Abhi order karo before stock khatam ho jaye!",
    url: "/inventory"
  },
  {
    title: "Delivery Express Mode On! 🚀",
    message: "Aaj ka samaan aaj hi milega! Quick delivery, Quikkirana style!",
    url: "/track-order"
  },
  {
    title: "Bill Clear? Discount bhi Clear! 💸",
    message: "Billing karo bina tension ke, cashback aur offers bhi milenge!",
    url: "/billing"
  },
  {
    title: "Fresh Items Just In! 🌽",
    message: "Sabziyon ka naya stock aa gaya hai – ab no compromise on freshness!",
    url: "/fresh-stock"
  },
  {
    title: "Weekend Dhamaka Deals! 🛍️",
    message: "Sirf Saturday-Sunday! Kirane pe khaas chhoot – check karo abhi!",
    url: "/weekend-deals"
  },
  {
    title: "Delivery Boy Nikal Chuka Hai! 🛵",
    message: "Tayyar raho! Tumhara Quikkirana samaan raste mein hai!",
    url: "/delivery-status"
  }
];

// Function to send push notification
const sendPushNotification = async (notification) => {
  try {
    const response = await axios.post(`${PUSHALERT_BASE_URL}/notify`, 
      {
        title: notification.title,
        message: notification.message,
        url: notification.url,
        icon: '/public/logo.png' // Replace with your icon URL
      },
      {
        headers: {
          'Authorization': `Bearer ${PUSHALERT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Push notification sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending push notification:', error.response?.data || error.message);
    throw error;
  }
};

// Function to send a random notification
const sendRandomNotification = async () => {
  try {
    // Select a random notification from the array
    const randomIndex = Math.floor(Math.random() * notificationMessages.length);
    const notification = notificationMessages[randomIndex];
    
    await sendPushNotification(notification);
    console.log(`Random notification sent: ${notification.title}`);
  } catch (error) {
    console.error('Failed to send random notification:', error);
  }
};

// Schedule notifications - this example sends one every day at 2:00 PM
const scheduleNotifications = () => {
  schedule.scheduleJob('*/30 * * * *', sendRandomNotification);
  console.log('Notification scheduler initialized');
};

// API endpoint to manually trigger a random notification
app.post('/api/send-notification', async (req, res) => {
  try {
    await sendRandomNotification();
    res.status(200).json({ success: true, message: 'Notification sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send notification', error: error.message });
  }
});

// API endpoint to send a custom notification
app.post('/api/send-custom-notification', async (req, res) => {
  try {
    const { title, message, url } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title and message are required' 
      });
    }
    
    await sendPushNotification({ title, message, url: url || '/' });
    res.status(200).json({ success: true, message: 'Custom notification sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send notification', error: error.message });
  }
});

// Initialize the notification scheduler when the server starts
// Add this near the end of your file, before the app.listen call
scheduleNotifications();




// Serve static files
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
