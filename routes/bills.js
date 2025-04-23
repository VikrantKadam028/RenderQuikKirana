// routes/bills.js
const express = require('express');
const router = express.Router();
const Bill = require('../models/Bill'); // adjust path if needed

// POST /api/bills/create
router.post('/create', async (req, res) => {
  try {
    const { billDate, paymentType, totalAmount, items, discount } = req.body;

    const newBill = new Bill({
      billDate: billDate || Date.now(),
      paymentType,
      totalAmount,
      items,
      discount: discount || 0
    });

    const savedBill = await newBill.save();
    res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      data: savedBill,
      billId: savedBill._id
    });

  } catch (error) {
    console.error('Error creating bill:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create bill',
      error: error.message
    });
  }
});

module.exports = router;
// GET /api/bills
router.get('/', async (req, res) => {
    try {
      const bills = await Bill.find().sort({ billDate: -1 }); // latest first
      res.status(200).json({
        success: true,
        data: bills
      });
    } catch (error) {
      console.error('Error fetching bills:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch bills',
        error: error.message
      });
    }
  });
  
