const express = require('express');
const mysql = require('mysql');
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
  console.log('Connected to the database ManagAppriciation successfully');
});

router.get('/managentries', (req, res) => {
  console.log('Received request for entries data');

  // Get the date range or specific date from query params
  const { startDate, endDate, date } = req.query;

  // Start with a basic query to select individual amounts, types, and other relevant data (e.g., amount, name, type)
  let query = `
    SELECT 
      amount, 
      (SELECT name FROM entries WHERE amount = e.amount LIMIT 1) AS name,
      type
    FROM entries e
  `;

  // If a date range is provided, filter by created_at date range
  if (startDate && endDate) {
    query += ` WHERE created_at BETWEEN ? AND ?`;
  } else if (date) {
    query += ` WHERE DATE(created_at) = ?`;
  }

  console.log('Executing SQL query:', query);

  // Execute the query with parameters if necessary
  db.query(query, [startDate, endDate, date].filter(Boolean), (err, result) => {
    if (err) {
      console.error('Error executing SQL query:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve entries data' });
    }

    console.log('Entries data retrieved:', result);

    // Format the data as an array of amounts, types, and names
    const data = result.map(row => ({
      amount: parseFloat(row.amount),
      name: row.name || 'Unknown',  // Handle case where no name is found
      type: row.type || 'Unknown',  // Handle case where no type is found
    }));

    // Send the response with the full data (including type)
    res.json(data);
    console.log('Sent entries data to frontend:', data);
  });
});




module.exports = router;
