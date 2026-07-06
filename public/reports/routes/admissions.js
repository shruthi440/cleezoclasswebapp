const express = require('express');
const mysql = require('mysql2');
const router = express.Router();

// MySQL connection
const db = mysql.createConnection({
  host: '162.215.210.38',
  user: 'root',
  password: 'NavyAtagsoLnovA@$000',
  database: 'NOVA'
});

// Connect DB
db.connect(err => {
  if (err) {
    console.error('Database connection failed:', err.stack);
    return;
  }
  console.log('Connected to database.');
});

// GET API - Fetch all admissions
router.get('/admissions', (req, res) => {
  console.log('Received request for /admissions'); // Debug 1: When route is hit

  const query = `
    SELECT a.*, e.score
    FROM admission_form a
    LEFT JOIN evaluations e ON a.id = e.id
  `;

  console.log('Executing SQL query:', query); // Debug 2: Before executing the query

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching admissions with scores:', err); // Debug 3: Log error if any
      res.status(500).send('Error fetching data');
    } else {
      console.log('Query successful. Results:', results); // Debug 4: Log successful results
      res.json(results);
    }
  });
});

 

module.exports = router;