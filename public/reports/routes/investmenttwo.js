const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const router = express.Router();

// Middleware
router.use(cors());
router.use(bodyParser.json());

// Function to create a database connection based on schoolCode
const createDbConnection = (schoolCode) => {
  return mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: schoolCode, // Use schoolCode as the database name
  });
};

// API to fetch investment data
router.get('/investments', (req, res) => {
  const { date, startDate, endDate, schoolCode } = req.query; // Retrieve schoolCode from query parameters

  if (!schoolCode) {
    return res.status(400).json({ error: 'School code is required.' });
  }

  const db = createDbConnection(schoolCode);

  console.log(`Connecting to database for school code: ${schoolCode}`);

  let sql = `
    SELECT
      investor_name,
      investment_date,
      SUM(investment_amount) AS total_investment
    FROM school_income
    WHERE income_type = 'investments'
  `;

  const queryParams = [];

  if (date) {
    sql += ` AND investment_date = ?`;
    queryParams.push(date);
  } else if (startDate && endDate) {
    sql += ` AND investment_date BETWEEN ? AND ?`;
    queryParams.push(startDate, endDate);
  } else {
    return res.status(400).json({ error: 'Please provide either a date or a date range.' });
  }

  sql += ` GROUP BY investment_date, investor_name ORDER BY investment_date DESC`;

  console.log(`Executing query: ${sql} with params: ${queryParams}`);

  db.query(sql, queryParams, (err, results) => {
    if (err) {
      console.error('[ERROR] Error executing query:', err);
      return res.status(500).json({ error: err.message });
    }
    console.log('[INFO] Query results:', results);
    res.json(results);
  });

  db.end(); // Close the database connection
});

// Export the router module
module.exports = router;
