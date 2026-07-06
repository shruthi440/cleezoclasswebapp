const express = require('express');
const router = express.Router();
const mysql = require('mysql2');

// Function to create dynamic DB connection
function createDynamicConnection(schoolCode) {
  if (!schoolCode) throw new Error('schoolCode is required');
  
  // Optional: sanitize schoolCode if needed
  const cleanedCode = String(schoolCode).trim();

  return mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: cleanedCode,
  });
}

// GET all teachers
router.get('/', (req, res) => {
  const schoolCode = req.query.schoolCode;
  if (!schoolCode) return res.status(400).json({ error: 'Missing schoolCode query parameter' });

  const db = createDynamicConnection(schoolCode);

  const query = 'SELECT id, name FROM management_login_creation WHERE user_type = "teacher"';

  db.query(query, (err, results) => {
    db.end();
    if (err) {
      console.error('Error fetching teachers:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// POST add salary
router.post('/add-salary', (req, res) => {
  const { schoolCode, teacher_id, salary_amount, salary_type, effective_from, status = 'pending' } = req.body;
  if (!schoolCode || !teacher_id || !salary_amount || !salary_type || !effective_from) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const db = createDynamicConnection(schoolCode);

  const query = `
    INSERT INTO bizpulse_teacher_salary (teacher_id, salary_amount, payment_date, salary_type, status, effective_from)
    VALUES (?, ?, CURDATE(), ?, ?, ?);
  `;

  db.query(query, [teacher_id, salary_amount, salary_type, status, effective_from], (err, result) => {
    db.end();
    if (err) {
      console.error('Error inserting salary:', err);
      return res.status(500).json({ error: 'Failed to insert salary' });
    }
    res.status(200).json({ message: 'Salary entered successfully', salary_id: result.insertId });
  });
});

// GET latest salary for teacher
router.get('/salary/:teacherId', (req, res) => {
  const schoolCode = req.query.schoolCode;
  const teacherId = req.params.teacherId;
  
  if (!schoolCode) return res.status(400).json({ error: 'Missing schoolCode query parameter' });

  const db = createDynamicConnection(schoolCode);

  const query = `
    SELECT * FROM bizpulse_teacher_salary 
    WHERE teacher_id = ? 
    ORDER BY effective_from DESC 
    LIMIT 1;
  `;

  db.query(query, [teacherId], (err, result) => {
    db.end();
    if (err) {
      console.error('Error fetching salary:', err);
      return res.status(500).json({ error: 'Failed to fetch salary details' });
    }
    if (result.length === 0) {
      return res.status(404).json({ error: 'No salary records found for the teacher' });
    }
    res.status(200).json(result[0]);
  });
});

module.exports = router;
