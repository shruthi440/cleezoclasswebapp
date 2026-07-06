const express = require('express');
const router = express.Router();
const mysql = require('mysql2');

// MySQL Connection
const db = mysql.createConnection({
  host: '162.215.210.38',
  user: 'root',
  password: 'NavyAtagsoLnovA@$000',
  database: 'NOVA',
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to MySQL database.');
  }
});

// API to fetch students and teachers who joined this year
router.get('/', (req, res) => {
  const currentYear = new Date().getFullYear();
  const sql = `
    SELECT * FROM management_login_creation
    WHERE YEAR(date) = ?
  `;

  db.query(sql, [currentYear], (err, results) => {
    if (err) {
      console.error('Error fetching data:', err.message);
      res.status(500).send('Error fetching data.');
    } else {
      res.status(200).json(results);
    }
  });
});

module.exports = router;
