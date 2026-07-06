const express = require('express');
const mysql = require('mysql2');

// Database connection setup
const db = mysql.createConnection({
  host: '162.215.210.38',
  user: 'root',
  password: 'NavyAtagsoLnovA@$000',
  database: 'NOVA',
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err.message);
    throw err;
  }
  console.log('Connected to the Depression database successfully');
});

const router = express.Router();

// Endpoint to fetch total depreciation, considering date range
router.get('/totaldepreciation', (req, res) => {
  console.log('Received request for total depreciation value');

  const { startDate, endDate, date } = req.query;

  let query = `
    SELECT 
      COALESCE(SUM(CAST(depreciationValue AS DECIMAL(10,2))), 0) AS total_depreciation
    FROM depreciation
  `;

  // Add conditions for date range or specific date
  if (startDate && endDate) {
    query += ` WHERE DATE(createDate) BETWEEN ? AND ?`;
  } else if (startDate) {
    query += ` WHERE DATE(createDate) = ?`;
  }

  console.log('Executing SQL query:', query);

  // Execute query with dynamic parameters
  db.query(query, [startDate, endDate].filter(Boolean), (err, result) => {
    if (err) {
      console.error('Error executing SQL query:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve total depreciation data' });
    }

    console.log('Total depreciation data retrieved:', result);

    const data = result[0];
    data.total_depreciation = parseFloat(data.total_depreciation); // Convert to float

    res.json(data);
    console.log('Sent total depreciation data to frontend:', data);
  });
});

module.exports = router;
