const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Utility function to create connection dynamically based on schoolCode
function getDatabaseConnection(schoolCode) {
  if (!schoolCode) throw new Error('Missing schoolCode');

  // Clean schoolCode to form valid DB name
  const dbName = schoolCode.trim().replace(/\s+/g, '_');

  return mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: dbName,
  });
}

// Get all teachers (from dynamic DB)
router.get('/', async (req, res) => {
  const schoolCode = req.query.schoolCode;
  if (!schoolCode) {
    return res.status(400).json({ error: 'schoolCode query parameter is required' });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);
    const [results] = await db.query(
      'SELECT id, name FROM management_login_creation WHERE user_type = "teacher"'
    );
    await db.end();

    res.json(results);
  } catch (err) {
    console.error('[ERROR] Fetching teachers:', err);
    res.status(500).json({ error: err.message || 'Database error' });
  }
});

// Submit attendance form
router.post('/', async (req, res) => {
  const schoolCode = req.query.schoolCode;
  if (!schoolCode) {
    return res.status(400).json({ error: 'schoolCode query parameter is required' });
  }

  const { id, name, date, timeIn, timeOut, status, absenceReason } = req.body;

  try {
    const db = await getDatabaseConnection(schoolCode);

    await db.query(
      `INSERT INTO attendance (id, name, date, timeIn, timeOut, status, absenceReason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, date, timeIn, timeOut, status, absenceReason]
    );

    await db.end();
    res.status(200).json({ message: 'Attendance submitted successfully' });
  } catch (err) {
    console.error('[ERROR] Inserting attendance:', err);
    res.status(500).json({ error: err.message || 'Failed to insert attendance' });
  }
});

// Get today's teacher attendance
router.get('/teacheravailability/today', async (req, res) => {
  const schoolCode = req.query.schoolCode;
  if (!schoolCode) {
    return res.status(400).json({ error: 'schoolCode query parameter is required' });
  }

  const today = new Date().toISOString().split('T')[0];

  try {
    const db = await getDatabaseConnection(schoolCode);

    const [rows] = await db.query(`
      SELECT
        m.id, m.name,
        m.teaches_to_1, m.teaches_to_2, m.teaches_to_3, m.teaches_to_4, m.teaches_to_5,
        t.status AS attendance_today,
        t.entry_time, t.exit_time, t.working_hours
      FROM management_login_creation m
      LEFT JOIN teachers_attendance t ON m.id = t.teacher_id AND t.date = ?
      WHERE m.user_type = 'teacher'
    `, [today]);

    await db.end();
    res.json(rows);
  } catch (err) {
    console.error('[ERROR] Fetching today\'s teacher attendance:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

module.exports = router;
