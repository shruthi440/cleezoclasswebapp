const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');

const app = express();
const port = 5000;
const router=express.Router();
// Middleware
app.use(bodyParser.json());

// Create a MySQL connection pool
const pool = mysql.createPool({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: 'NOVA',
});

// Routes
router.post('/expenses', (req, res) => {
  const { category, amount, date, description } = req.body;

  const query = 'INSERT INTO expenses (category, amount, date, description) VALUES (?, ?, ?, ?)';
  pool.execute(query, [category, amount, date, description], (err, results) => {
    if (err) {
      return res.status(500).send('Error saving expense');
    }
    res.status(201).send('Expense saved successfully');
  });
});

router.get('/expenses', (req, res) => {
  const query = 'SELECT * FROM expenses';
  pool.execute(query, (err, results) => {
    if (err) {
      return res.status(500).send('Error fetching expenses');
    }
    res.status(200).json(results);
  });
});

module.exports = router;
