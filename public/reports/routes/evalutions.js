

// server.js
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const nodemailer = require('nodemailer');
const router = express.Router();

require('dotenv').config(); // Load .env variables

const app = express();
const port = 3010;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// ✅ Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ✅ Function to create dynamic DB connection
function createDynamicConnection(dbName) {
  if (!dbName) throw new Error('Database name is required');

  // Allow only safe DB names
  if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
    throw new Error('Invalid database name');
  }

  return mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: dbName,
  });
}

router.post('/evaluate', async (req, res) => {
  try {
    console.log('📥 Received POST /evaluate request');
    const { schoolCode } = req.body;

    if (!schoolCode) {
      console.error('⚠️ Missing schoolCode in request body');
      return res.status(400).json({ error: 'Missing schoolCode in request body' });
    }

    console.log(`🔍 Connecting to database for schoolCode: ${schoolCode}`);
    const db = createDynamicConnection(schoolCode);

    db.connect((err) => {
      if (err) {
        console.error('❌ MySQL connection error:', err);
        return res.status(500).json({ error: 'Database connection failed', details: err.message });
      }

      console.log('✅ MySQL connected successfully');

      const query = `
        SELECT
          e.student_name,
          e.score,
          a.email,
          a.phone AS phonenum,
          a.student_photo
        FROM evaluations e
        LEFT JOIN admission_form a ON e.student_name = a.student_name;
      `;

      console.log('📤 Executing query to fetch evaluation data...');
      db.query(query, (err, rows) => {
        console.log('🔚 Closing database connection');
        db.end();

        if (err) {
          console.error('❌ Query execution error:', err.message);
          return res.status(500).json({ error: 'Query failed', details: err.message });
        }

        if (!rows || rows.length === 0) {
          console.warn('⚠️ No evaluation data found');
          return res.status(404).json({ error: 'No data found' });
        }

        console.log(`✅ Query successful - ${rows.length} records retrieved`);
        return res.json(rows);
      });
    });
  } catch (error) {
    console.error('❌ Caught error during request processing:', error.message);
    return res.status(400).json({ error: error.message });
  }
});



module.exports = router;
