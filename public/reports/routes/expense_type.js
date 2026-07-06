// server.js

const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const bodyParser = require('body-parser');

// Initialize express app
const app = express();
const port = 3000;

// Middleware
app.use(cors()); // Enable Cross-Origin Request
app.use(bodyParser.json()); // Parse incoming JSON requests

// MySQL database connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root', // Replace with your database user
  password: '', // Replace with your database password
  database: 'school_expenses' // Replace with your database name
});

// Connect to MySQL database
db.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    process.exit(1); // Exit if there is an error in DB connection
  }
  console.log('Connected to MySQL database');
});

// Create a table to store recurring expenses (run this once to create the table in MySQL)
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS recurring_expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    expense_type VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    due_date DATE NOT NULL,
    description TEXT
  );
`;

db.query(createTableQuery, (err) => {
  if (err) {
    console.error('Error creating table:', err);
  } else {
    console.log('Recurring expenses table is ready');
  }
});

// Get all expenses from the database
app.get('/api/expenses', (req, res) => {
  const query = 'SELECT * FROM recurring_expenses ORDER BY due_date ASC';
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching expenses', error: err });
    }
    res.json(results);
  });
});

// Add a new recurring expense
app.post('/api/expenses', (req, res) => {
  const { expense_type, amount, due_date, description } = req.body;

  // Validate incoming data
  if (!expense_type || !amount || !due_date) {
    return res.status(400).json({ message: 'Expense type, amount, and due date are required' });
  }

  // Insert expense data into the database
  const query = 'INSERT INTO recurring_expenses (expense_type, amount, due_date, description) VALUES (?, ?, ?, ?)';
  const values = [expense_type, amount, due_date, description || ''];

  db.query(query, values, (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Error adding expense', error: err });
    }
    res.status(201).json({ message: 'Expense added successfully', expenseId: result.insertId });
  });
});

