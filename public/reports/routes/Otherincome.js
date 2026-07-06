const express = require('express');
const router = express.Router();
const mysql = require('mysql');

// Utility function to get DB config
function getDbConfigBySchoolCode(schoolCode) {
  return {
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: schoolCode,
  };
}

router.get('/others', (req, res) => {
  console.log('📥 Received request for other data');

  const { startDate, endDate, date, schoolCode } = req.query;

  if (!schoolCode) {
    console.error('❌ Missing schoolCode in query');
    return res.status(400).json({ error: 'Missing schoolCode parameter' });
  }

  const db = mysql.createConnection(getDbConfigBySchoolCode(schoolCode));

  db.connect((err) => {
    if (err) {
      console.error('❌ Database connection error:', err.message);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    let query = 'SELECT other_name, other_amount, other_date FROM school_income WHERE 1=1';
    const queryParams = [];

    if (startDate && endDate) {
      query += ' AND other_date BETWEEN ? AND ?';
      queryParams.push(startDate, endDate);
    } else if (date) {
      query += ' AND other_date = ?';
      queryParams.push(date);
    }

    console.log('📤 Executing SQL query:', query, queryParams);

    db.query(query, queryParams, (err, result) => {
      db.end(); // Close DB connection

      if (err) {
        console.error('❌ SQL query error:', err.message);
        return res.status(500).json({ error: 'Failed to retrieve other data' });
      }

      console.log(`✅ Retrieved ${result.length} rows`);

      const filteredResult = result.filter(row =>
        row.other_name !== null &&
        row.other_amount !== null &&
        row.other_date !== null
      );

      console.log(`✅ Filtered result: ${filteredResult.length} rows remain`);

      res.json(filteredResult);
    });
  });
});

module.exports = router;
