const express = require('express');
const mysql = require('mysql');

// Create a router for total expenses-related endpoints
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
  console.log('Connected to the Expense database successfully');
});

// Helper function to handle date range query
const buildDateQuery = (startDate, endDate) => {
  if (endDate) {
    // If date range is provided
    return `WHERE date >= ? AND date <= ?`;
  } else {
    // If single date is provided
    return `WHERE date = ?`;
  }
};

// Route to get total expenses with optional date range or single date
// router.get('/totalexpenses', (req, res) => {
//   console.log('Received request for total expenses value');

//   const { startDate, endDate, date } = req.query; // Extract the date query parameters from the request

//   let query = `
//     SELECT 
//       COALESCE(SUM(CAST(amount AS DECIMAL(10,2))), 0) AS total_expenses
//     FROM expenses
//   `;

//   // If date range is provided, adjust the query
//   if (startDate && endDate) {
//     query += buildDateQuery(startDate, endDate);
//   } else if (date) {
//     query += ` WHERE date = ?`;
//   }

//   console.log('Executing SQL query:', query);

//   // Execute the SQL query
//   db.query(query, [startDate || date, endDate], (err, result) => {
//     if (err) {
//       console.error('Error executing SQL query:', err.message);
//       return res.status(500).json({ error: 'Failed to retrieve total expenses data' });
//     }

//     console.log('Total expenses data retrieved:', result);

//     const data = result[0];
//     data.total_expenses = parseFloat(data.total_expenses); // Convert to float

//     res.json(data);
//     console.log('Sent total expenses data to frontend:', data);
//   });
// });
router.get('/totalexpenses', (req, res) => {
  console.log('Received request for total expenses value');

  const { startDate, endDate, date } = req.query;
  console.log('Query Parameters:', { startDate, endDate, date });

  let query = `
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
      COALESCE(SUM(CAST(amount AS DECIMAL(10,2))), 0) AS total_expenses
    FROM Expense
  `;

  let queryParams = [];

  if (startDate && endDate) {
    query += ` WHERE date BETWEEN ? AND ?`;
    queryParams.push(startDate, endDate);
  } else if (date) {
    query += ` WHERE date = ?`;
    queryParams.push(date);
  }

  query += ` GROUP BY id, type, amount, quantity, total_cost, rent_type, vendor_type, vendor_name, vendor_contact, payment_method, date, description`;

  console.log('Executing SQL query:', query, 'with parameters:', queryParams);

  db.query(query, queryParams, (err, result) => {
    if (err) {
      console.error('Error executing SQL query:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve total expenses data' });
    }

    console.log('Total expenses data retrieved:', result);

    result.forEach(row => {
      row.total_expenses = parseFloat(row.total_expenses);
    });

    res.json(result);
    console.log('Sent total expenses data to frontend:', result);
  });
});


// Export the router
module.exports = router;
