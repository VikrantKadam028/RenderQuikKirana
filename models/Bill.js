// models/Bill.js
const mongoose = require('mongoose');

const BillSchema = new mongoose.Schema({
  billDate: {
    type: Date,
    default: Date.now
  },
  paymentType: {
    type: String,
    required: true,
    enum: ['Cash', 'UPI', 'UPI + Cash']
  },
  totalAmount: {
    type: Number,
    required: true
  },
  items: [{
    barcode: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    subtotal: {
      type: Number,
      required: true
    }
  }],
  discount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Bill', BillSchema);
