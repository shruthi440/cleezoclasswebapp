const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise'); // using promise API

// Helper to create DB connection dynamically
async function getConnection(dbName) {
  if (!dbName) throw new Error('Database name is required');
  return await mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: dbName,
  });
}

// Middleware to extract dbName from query param instead of header
router.use((req, res, next) => {
  const schoolCode = req.query.schoolCode;
  if (!schoolCode) {
    return res.status(400).json({ error: 'Missing schoolCode query parameter' });
  }
  req.dbName = schoolCode;
  next();
});

// Get all teachers
router.get('/', async (req, res) => {
  try {
    const connection = await getConnection(req.dbName);
    const [results] = await connection.execute(
      'SELECT id, name FROM management_login_creation WHERE user_type = "teacher"'
    );
    await connection.end();
    res.json(results);
  } catch (err) {
    console.error('Error fetching teachers:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get teacher details by ID
router.get('/:id', async (req, res) => {
  try {
    const connection = await getConnection(req.dbName);
    const [results] = await connection.execute(
      'SELECT * FROM management_login_creation WHERE id = ?',
      [req.params.id]
    );
    await connection.end();
    if (results.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    res.json(results[0]);
  } catch (err) {
    console.error('Error fetching teacher details:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get academic performance
router.get('/academic-performance/:teacherId', async (req, res) => {
  try {
    const connection = await getConnection(req.dbName);
    const teacherId = req.params.teacherId;

    const [teacherResult] = await connection.execute(
      `SELECT teaches_to_1, teaches_to_2, teaches_to_3, teaches_to_4, teaches_to_5
       FROM management_login_creation WHERE id = ?`,
      [teacherId]
    );

    if (teacherResult.length === 0) {
      await connection.end();
      return res.status(404).json({ error: 'Teacher not found' });
    }

    let classesTaught = [
      teacherResult[0].teaches_to_1,
      teacherResult[0].teaches_to_2,
      teacherResult[0].teaches_to_3,
      teacherResult[0].teaches_to_4,
      teacherResult[0].teaches_to_5,
    ].filter(Boolean);

    if (req.query.class) {
      classesTaught = [req.query.class];
    }

    if (classesTaught.length === 0) {
      await connection.end();
      return res.json({ data: [] });
    }

    const placeholders = classesTaught.map(() => '?').join(',');

    const [academicResults] = await connection.execute(
      `SELECT name, class_name, section, test_type, subject, marks
       FROM academic_performance_of_student
       WHERE class_name IN (${placeholders})`,
      classesTaught
    );

    await connection.end();
    res.json({ data: academicResults });
  } catch (err) {
    console.error('Error fetching academic performance:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
