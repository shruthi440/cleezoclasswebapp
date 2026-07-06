const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const router=express.Router();
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MySQL Connection
const db = mysql.createConnection({
  host: '162.215.210.38',  // Change to your MySQL host
  user: 'root',          // Change to your MySQL username
  password: 'NavyAtagsoLnovA@$000', // Change to your MySQL password
  database: 'NOVA',      // Change to your database name
});

db.connect((err) => {
  if (err) {
    console.error('[ERROR] Database connection failed:', err.stack);
    return;
  }
  console.log('[INFO] Connected to the database');
});

// API to handle form submission
router.post('/entries', (req, res) => {
  console.log('[INFO] Received request to submit entry:', req.body);

  const { name, amount, type, customType } = req.body;
  const finalType = type === 'other' ? customType : type; // If type is 'other', use customType
  
  // Log the final values that will be inserted
  console.log('[INFO] Final values for insertion:', {
    name,
    amount,
    type: finalType,
    customType: type === 'other' ? customType : null
  });

  const query = 'INSERT INTO entries (name, amount, type, customType) VALUES (?, ?, ?, ?)';
  const values = [name, amount, finalType, type === 'other' ? customType : null];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('[ERROR] Error inserting data into database:', err);
      return res.status(500).json({ message: 'Error inserting data' });
    }
    console.log('[INFO] Data inserted successfully:', result);
    return res.status(200).json({ message: 'Entry added successfully!' });
  });
});

module.exports = router;