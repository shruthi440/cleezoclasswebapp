const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');

const router = express.Router();

// Middleware
router.use(bodyParser.json());

// Function to create a MySQL connection pool based on the database name
const createPool = (database) => mysql.createPool({
  host: '162.215.210.38',
  user: 'root',
  password: 'NavyAtagsoLnovA@$000',
  database: database,
});

// Route to handle POST requests for expenses
router.post('/expenses', (req, res) => {
  const { category, amount, date, description, schoolCode } = req.body;

  // Create a pool with the database name directly from schoolCode
  const pool = createPool(schoolCode);

  const query = 'INSERT INTO expenses (category, amount, date, description) VALUES (?, ?, ?, ?)';
  pool.execute(query, [category, amount, date, description], (err, results) => {
    if (err) {
      console.error('Error saving expense:', err);
      return res.status(500).send('Error saving expense');
    }
    // Send back a response with the schoolCode
    res.status(201).json({
      message: 'Expense saved successfully',
      schoolCode: schoolCode
    });
  });
});

// Route to handle GET requests for expenses
router.get('/expenses', (req, res) => {
  const { schoolCode } = req.query;

  // Create a pool with the database name directly from schoolCode
  const pool = createPool(schoolCode);

  const query = 'SELECT * FROM expenses';
  pool.execute(query, (err, results) => {
    if (err) {
      console.error('Error fetching expenses:', err);
      return res.status(500).send('Error fetching expenses');
    }
    res.status(200).json(results);
  });
});

module.exports = router;
