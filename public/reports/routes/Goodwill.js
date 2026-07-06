const express = require('express');
const mysql = require('mysql');

// Create a router for total cost-related endpoints
const router = express.Router();

// Database connection setup
const db = mysql.createConnection({
  host: '162.215.210.38', // replace with your actual database host
  user: 'root', // replace with your DB username
  password: 'NavyAtagsoLnovA@$000', // replace with your DB password
  database: 'NOVA' // replace with your database name
});

// Log connection status
db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err.message);
    throw err;
  }
  console.log('Connected to the GOODWILL database successfully');
});

// Route to get total cost, amount, quantity, and other details with optional date filters
router.get('/expenses', (req, res) => {
  console.log('Received request for expense data');

  const { startDate, endDate, date } = req.query;

  let query = '';
  let queryParams = [];

  if (startDate && endDate) {
    // Date range query
    query = `
      SELECT 
        id,
        type,
        amount,
        quantity,
        total_cost,
        rent_type,
        vendor_type,
        vendor_name,
        vendor_contact,
        payment_method,
        date,
        description,
        created_at
      FROM Expense
      WHERE date BETWEEN ? AND ?
      ORDER BY id ASC;  -- Ensures the results are ordered by the id in ascending order
    `;
    queryParams = [startDate, endDate];
  } else if (date) {
    // Single date query
    query = `
      SELECT 
        id,
        type,
        amount,
        quantity,
        total_cost,
        rent_type,
        vendor_type,
        vendor_name,
        vendor_contact,
        payment_method,
        date,
        description,
        created_at
      FROM Expense
      WHERE date = ?
      ORDER BY id ASC;  -- Ensures the results are ordered by the id in ascending order
    `;
    queryParams = [date];
  } else {
    // Default query, no date filtering
    query = `
      SELECT 
        id,
        type,
        amount,
        quantity,
        total_cost,
        rent_type,
        vendor_type,
        vendor_name,
        vendor_contact,
        payment_method,
        date,
        description,
        created_at
      FROM Expense
      ORDER BY id ASC;  -- Ensures the results are ordered by the id in ascending order
    `;
  }

  console.log('Executing SQL query:', query);

  db.query(query, queryParams, (err, result) => {
    if (err) {
      console.error('Error executing SQL query:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve expense data' });
    }

    console.log('Expense data retrieved:', result);

    // Send the result to frontend
    res.json(result);
    console.log('Sent expense data to frontend:', result);
  });
});


// Export the router
module.exports = router;
