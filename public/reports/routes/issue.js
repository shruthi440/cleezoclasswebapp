const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');

const app = express();
const port = 5000;

// Set up middleware
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// Set up MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root', // your MySQL username
  password: '', // your MySQL password
  database: 'school_management', // replace with your database name
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL database: ', err);
    process.exit(1);
  }
  console.log('Connected to MySQL database');
});

// POST route to handle book issue form submission
app.post('/api/issue-book', (req, res) => {
  const {
    studentName,
    studentId,
    classSection,
    bookTitle,
    bookAuthor,
    isbnNumber,
    issueDate,
    returnDate,
    bookCondition,
    issueStatus,
    remarks,
  } = req.body;

  // SQL query to insert book issue data into the database
  const query = `INSERT INTO book_issues (student_name, student_id, class_section, book_title, book_author, isbn_number, issue_date, return_date, book_condition, issue_status, remarks)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  db.execute(query, [
    studentName,
    studentId,
    classSection,
    bookTitle,
    bookAuthor,
    isbnNumber,
    issueDate,
    returnDate,
    bookCondition,
    issueStatus,
    remarks,
  ], (err, result) => {
    if (err) {
      console.error('Error inserting book issue data: ', err);
      return res.status(500).json({ message: 'Error inserting data into the database' });
    }
    res.status(200).json({ message: 'Book issued successfully!', data: result });
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
