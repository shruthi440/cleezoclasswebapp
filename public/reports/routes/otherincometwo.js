const express = require('express');
const mysql = require('mysql');
const router = express.Router();

// Route to get "other" data with date filtering
router.get('/others', (req, res) => {
  console.log('Received request for other data');

  const { startDate, endDate, date, schoolCode } = req.query;

  // Create a database connection with the dynamic database name
  const db = mysql.createConnection({
    host: '162.215.210.38', // replace with your actual database host
    user: 'root', // replace with your DB username
    password: 'NavyAtagsoLnovA@$000', // replace with your DB password
    database: schoolCode || 'NOVA' // Use schoolCode as the database name or default to 'NOVA'
  });

  // Log connection status
  db.connect((err) => {
    if (err) {
      console.error('Error connecting to the database:', err.message);
      return res.status(500).json({ error: 'Failed to connect to the database' });
    }
    console.log('Connected to the database successfully');
  });

  let query = 'SELECT other_name, other_amount, other_date FROM school_income WHERE 1=1';
  let queryParams = [];

  if (startDate && endDate) {
    query += ' AND other_date BETWEEN ? AND ?';
    queryParams = [startDate, endDate];
  } else if (date) {
    query += ' AND other_date = ?';
    queryParams = [date];
  }

  console.log('Executing SQL query:', query, queryParams);

  db.query(query, queryParams, (err, result) => {
    if (err) {
      console.error('Error executing SQL query:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve other data' });
    }

    console.log('Other data retrieved:', result.length, 'rows found');

    const filteredResult = result.filter(row =>
      row.other_name !== null &&
      row.other_amount !== null &&
      row.other_date !== null
    );

    console.log('Filtered other data:', filteredResult.length, 'rows remaining after filtering null values');

    res.json(filteredResult);
    console.log('Sent filtered other data to frontend');
  });
});

// Export the router
module.exports = router;
