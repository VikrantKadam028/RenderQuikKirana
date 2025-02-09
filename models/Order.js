const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    customerDetails: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        address: { type: String, required: true },
        message: { type: String }
    },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true }
    }],
    totalAmount: { type: Number, required: true },
    paymentMode: { type: String, required: true },
    status: {
        type: String,
        enum: ['Pending', 'Processing', 'Delivered', 'Cancelled'],
        default: 'Pending'
    },
    orderDate: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Order', orderSchema);
