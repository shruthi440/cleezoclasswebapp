// admissionRoutes.js
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
router.get('/admissionser', (req, res) => {
  db.query('SELECT * FROM admission_form', (err, results) => {
    if (err) {
      console.error('Error fetching admissions:', err);
      res.status(500).send('Error fetching data');
    } else {
      res.json(results);
    }
  });
});

module.exports = router;
