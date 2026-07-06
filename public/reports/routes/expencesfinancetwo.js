const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const router = express.Router();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Function to create a MySQL connection based on the database name
const createConnection = (database) => mysql.createConnection({
  host: '162.215.210.38',
  user: 'root',
  password: 'NavyAtagsoLnovA@$000',
  database: database,
});

// POST route to insert finance data
router.post('/finance', (req, res) => {
  const {
    type,
    amount,
    quantity,
    totalCost,
    rentType,
    vendorType,
    vendorName,
    vendorContact,
    paymentMethod,
    date,
    description,
    schoolCode
  } = req.body;

  // Create a connection with the database name directly from schoolCode
  const db = createConnection(schoolCode);

  db.connect((err) => {
    if (err) {
      console.error('Error connecting to the database:', err);
      return res.status(500).json({ message: 'Error connecting to the database' });
    }

    const query = `
      INSERT INTO Expense (
        type, amount, quantity, total_cost, rent_type, vendor_type, vendor_name,
        vendor_contact, payment_method, date, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
      type,
      amount,
      quantity,
      totalCost,
      rentType || null,
      vendorType || null,
      vendorName || null,
      vendorContact || null,
      paymentMethod,
      date,
      description,
    ];

    db.query(query, values, (err, result) => {
      if (err) {
        console.error('Error inserting data:', err);
        return res.status(500).json({ message: 'Error inserting data' });
      }
      res.status(201).json({ message: 'Form data inserted successfully', schoolCode: schoolCode });
    });
  });
});

module.exports = router;
