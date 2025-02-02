const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    customerDetails: {
        name: String,
        phone: String,
        address: String,
        message: String
    },
    items: [{
        productId: mongoose.Schema.Types.ObjectId,
        name: String,
        quantity: Number,
        price: Number
    }],
    totalAmount: Number,
    paymentMode: String,
    status: {
        type: String,
        default: 'Pending'
    },
    orderDate: {
        type: Date,
        default: Date.now
    }
});
module.exports = mongoose.model('Order', orderSchema);
