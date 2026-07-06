const express = require('express');
const mysql = require('mysql');
const router = express.Router();

// Database connection setup function
const createDbConnection = (schoolCode) => {
  return mysql.createConnection({
    host: '162.215.210.38', // replace with your actual database host
    user: 'root', // replace with your DB username
    password: 'NavyAtagsoLnovA@$000', // replace with your DB password
    database: schoolCode // dynamically set database based on schoolCode
  });
};

// Route to get donation data with optional date filters
router.get('/donations', (req, res) => {
  const schoolCode = req.query.schoolCode;
  if (!schoolCode) {
    return res.status(400).json({ error: 'School code is required' });
  }

  const db = createDbConnection(schoolCode);

  console.log('Received request for donation data for school code:', schoolCode);
  let query = 'SELECT donor_name, donation_amount, donation_date FROM school_income';
  let params = [];
  const { date, startDate, endDate } = req.query;

  // Apply filters based on frontend request
  if (date) {
    query += ' WHERE donation_date = ?';
    params.push(date);
  } else if (startDate && endDate) {
    query += ' WHERE donation_date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  // Log executed query
  console.log('Executing SQL query:', query, 'with params:', params);

  db.query(query, params, (err, result) => {
    if (err) {
      console.error('Error executing SQL query:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve donation data' });
    }
    console.log('Donation data retrieved:', result.length, 'rows found');

    // Filter out rows with null values
    const filteredResult = result.filter(row =>
      row.donor_name !== null &&
      row.donation_amount !== null &&
      row.donation_date !== null
    );

    console.log('Filtered donation data:', filteredResult.length, 'rows remaining after filtering null values');
    if (filteredResult.length === 0) {
      console.warn('No valid donation data available after filtering');
    }
    res.json(filteredResult);
    console.log('Sent filtered donation data to frontend');
  });

  db.end(); // Close the database connection
});

// Export the router
module.exports = router;
