require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const nodemailer = require('nodemailer');
const router = express.Router();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MySQL connection
const db = mysql.createConnection({
  host: process.env.MYSQL_HOST || '162.215.210.38',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'NavyAtagsoLnovA@$000',
  database: process.env.MYSQL_DATABASE || 'NOVA'
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('Connected to MySQL database');
});

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Routes

// GET all tickets
router.get('/tickets', (req, res) => {
  db.query('SELECT * FROM tickets ORDER BY dateCreated DESC', (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(results);
  });
});

// POST new ticket
router.post('/tickets', (req, res) => {
  const {
    schoolName,
    contactPerson,
    email,
    phone,
    department,
    issueType,
    priority,
    subject,
    description
  } = req.body;

  const sql = `
    INSERT INTO tickets (
      schoolName, contactPerson, email, phone, department,
      issueType, priority, subject, description,
      status, dateCreated, lastUpdated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', NOW(), NOW())
  `;

  const values = [schoolName, contactPerson, email, phone, department, issueType, priority, subject, description];

  db.query(sql, values, (err, result) => {
    if (err) return res.status(400).json({ message: err.message });

    // Send email notification
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.DEV_TEAM_EMAIL,
      subject: `New Support Ticket: ${subject}`,
      text: `
New support ticket created:

School: ${schoolName}
Contact: ${contactPerson} (${email})
Department: ${department}
Priority: ${priority}

Issue:
${description}

Please log in to the support dashboard to respond.
      `
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) console.error('Error sending email:', error);
      else console.log('Email sent:', info.response);
    });

    res.status(201).json({ id: result.insertId, message: 'Ticket created' });
  });
});

// PATCH ticket status
router.patch('/tickets/:id', (req, res) => {
  const ticketId = req.params.id;
  const { status } = req.body;

  db.query(
    'UPDATE tickets SET status = ?, lastUpdated = NOW() WHERE id = ?',
    [status, ticketId],
    (err, result) => {
      if (err) return res.status(400).json({ message: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Ticket not found' });
      res.json({ message: 'Ticket updated successfully' });
    }
  );
});

module.exports = router;
