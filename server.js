require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
const User = require("./models/User");
const Product = require("./models/Product");
const Order = require("./models/Order");
// Twilio configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require("twilio")(accountSid, authToken);

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
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

// Serve static files
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
