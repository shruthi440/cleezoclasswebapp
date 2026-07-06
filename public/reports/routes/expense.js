const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const mysql = require('mysql');
const multer = require('multer');

// Multer setup for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MySQL connection setup
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'expense_tracker',
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
  } else {
    console.log('Connected to the database');
  }
});

// Handle POST request for expenses
app.post('/api/expenses', upload.single('receipt'), (req, res) => {
  const {
    date,
    category,
    amount,
    description,
    vendor,
    invoiceNumber,
    approvedBy,
    notes,
    paymentStatus,
    recurringExpense,
    tax,
    totalWithTax,
  } = req.body;
  const receipt = req.file ? req.file.buffer : null; // If a file is uploaded, get its buffer

  const query = `
    INSERT INTO expenses (
      date, category, amount, description, vendor, invoice_number, 
      payment_method, receipt, approved_by, notes, payment_status, 
      recurring_expense, tax, total_with_tax
    ) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    date,
    category,
    amount,
    description,
    vendor,
    invoiceNumber,
    paymentStatus,
    receipt,
    approvedBy,
    notes,
    paymentStatus,
    recurringExpense ? 'Yes' : 'No',
    tax,
    totalWithTax,
  ];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Error inserting expense:', err);
      res.status(500).json({ error: 'Failed to insert expense data' });
    } else {
      res.status(200).json({ message: 'Expense added successfully' });
    }
  });
});

// Start the server
app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});
