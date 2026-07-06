const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const router = express.Router();

// Middleware
router.use(cors());
router.use(bodyParser.json());

// Function to create a MySQL connection based on the database name
const createConnection = (database) => mysql.createConnection({
  host: '162.215.210.38',
  user: 'root',
  password: 'NavyAtagsoLnovA@$000',
  database: database,
});

// API to handle form submission
router.post('/entries', (req, res) => {
  const { name, amount, type, customType, schoolCode } = req.body;
  const finalType = type === 'other' ? customType : type;

  // Create a connection with the database name directly from schoolCode
  const db = createConnection(schoolCode);

  db.connect((err) => {
    if (err) {
      console.error('[ERROR] Database connection failed:', err.stack);
      return res.status(500).json({ message: 'Database connection failed' });
    }
    console.log('[INFO] Connected to the database');

    const checkQuery = 'SELECT * FROM entries WHERE name = ?';
    db.query(checkQuery, [name], (err, result) => {
      if (err) {
        console.error('[ERROR] Error checking existing data:', err);
        return res.status(500).json({ message: 'Error checking data' });
      }

      if (result.length > 0) {
        const existingAmount = parseFloat(result[0].amount);
        console.log(`[INFO] Found existing entry for ${name}. Existing amount: ${existingAmount}`);

        const newAmount = existingAmount + parseFloat(amount);
        console.log(`[INFO] New amount to be updated: ${newAmount}`);

        const updateQuery = 'UPDATE entries SET amount = ?, type = ?, customType = ? WHERE name = ?';
        const updateValues = [newAmount, finalType, type === 'other' ? customType : null, name];

        console.log('[INFO] Executing update query:', updateQuery);
        db.query(updateQuery, updateValues, (err, result) => {
          if (err) {
            console.error('[ERROR] Error updating data:', err);
            return res.status(500).json({ message: 'Error updating data' });
          }
          console.log('[INFO] Data updated successfully:', result);
          return res.status(200).json({ message: `Amount updated successfully for school: ${schoolCode}!` });
        });
      } else {
        console.log(`[INFO] Name ${name} not found. Inserting new entry.`);

        const insertQuery = 'INSERT INTO entries (name, amount, type, customType) VALUES (?, ?, ?, ?)';
        const insertValues = [name, parseFloat(amount), finalType, type === 'other' ? customType : null];

        console.log('[INFO] Executing insert query:', insertQuery);
        db.query(insertQuery, insertValues, (err, result) => {
          if (err) {
            console.error('[ERROR] Error inserting data into database:', err);
            return res.status(500).json({ message: 'Error inserting data' });
          }
          console.log('[INFO] Data inserted successfully:', result);
          return res.status(200).json({ message: `Entry added successfully for school: ${schoolCode}!` });
        });
      }
    });
  });
});

// Export the router module
module.exports = router;
