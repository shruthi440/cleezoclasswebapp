const express = require('express');
const router = express.Router();
const mysql = require('mysql2'); // ✅ use mysql2 (recommended for promises and better handling)

// ✅ Function to return a connection config based on schoolCode
function getDbConfigBySchoolCode(schoolCode) {
  if (!schoolCode) return null;
  return {
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: schoolCode,
  };
}

router.get('/managentries', (req, res) => {
  const { startDate, endDate, date, schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: 'Missing schoolCode in query parameters' });
  }

  const dbConfig = getDbConfigBySchoolCode(schoolCode);
  if (!dbConfig) {
    return res.status(400).json({ error: 'Invalid schoolCode' });
  }

  // ✅ Create connection on demand
  const connection = mysql.createConnection(dbConfig);

  let query = `
    SELECT 
      amount, 
      (SELECT name FROM entries WHERE amount = e.amount LIMIT 1) AS name,
      type
    FROM entries e
  `;

  const queryParams = [];

  if (startDate && endDate) {
    query += ` WHERE created_at BETWEEN ? AND ?`;
    queryParams.push(startDate, endDate);
  } else if (date) {
    query += ` WHERE DATE(created_at) = ?`;
    queryParams.push(date);
  }

  console.log('Executing SQL:', query, 'Params:', queryParams);

  connection.query(query, queryParams, (err, result) => {
    connection.end(); // ✅ Close connection after query

    if (err) {
      console.error('DB query error:', err.message);
      return res.status(500).json({ error: 'Database query failed' });
    }

    const data = result.map(row => ({
      amount: parseFloat(row.amount),
      name: row.name || 'Unknown',
      type: row.type || 'Unknown',
    }));

    console.log('✅ Entries data:', data.length, 'rows');
    res.json(data);
  });
});
// ✅ Route to get donation data with optional date filters and required schoolCode
router.get('/donations', (req, res) => {
  console.log('Received request for donation data');

  const { date, startDate, endDate, schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: 'Missing schoolCode in query' });
  }

  const db = mysql.createConnection(getDbConfigBySchoolCode(schoolCode));

  db.connect((err) => {
    if (err) {
      console.error('Database connection failed:', err.message);
      return res.status(500).json({ error: 'Database connection error' });
    }

    let query = 'SELECT donor_name, donation_amount, donation_date FROM school_income WHERE income_type = "donations"';
    const params = [];

    // Apply filters
    if (date) {
      query += ' AND donation_date = ?';
      params.push(date);
    } else if (startDate && endDate) {
      query += ' AND donation_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    console.log('Executing SQL query:', query, 'with params:', params);

    db.query(query, params, (err, result) => {
      db.end(); // Always close the connection
      if (err) {
        console.error('Error executing SQL query:', err.message);
        return res.status(500).json({ error: 'Failed to retrieve donation data' });
      }

      const filteredResult = result.filter(row =>
        row.donor_name !== null &&
        row.donation_amount !== null &&
        row.donation_date !== null
      );

      console.log(`Filtered donation data: ${filteredResult.length} rows returned`);
      res.json(filteredResult);
    });
  });
});
// ✅ GET /api/investments with schoolCode and optional date filters
router.get('/investments', (req, res) => {
  const { date, startDate, endDate, schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: 'Missing schoolCode in query' });
  }

  const db = mysql.createConnection(getDbConfigBySchoolCode(schoolCode));

  db.connect((err) => {
    if (err) {
      console.error('Database connection failed:', err);
      return res.status(500).json({ error: 'Database connection error' });
    }

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
      return res.status(400).json({ error: 'Please provide a date or date range' });
    }

    sql += ` GROUP BY investment_date, investor_name ORDER BY investment_date DESC`;

    db.query(sql, queryParams, (err, results) => {
      db.end();
      if (err) {
        console.error('Query error:', err);
        return res.status(500).json({ error: 'Query failed' });
      }

      res.json(results);
    });
  });
});

module.exports = router;
