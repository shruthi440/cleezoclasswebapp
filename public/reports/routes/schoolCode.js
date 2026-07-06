const express = require('express');
const mysql = require('mysql2/promise'); // Promise-based API
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const router = express.Router();

app.use(cors());
app.use(bodyParser.json());

// Database connection function
const getDbConnection = async (schoolCode) => {
  try {
    const connection = await mysql.createConnection({
      host: '162.215.210.38',
      user: 'root',
      password: 'NavyAtagsoLnovA@$000',
      database: schoolCode
    });
    return connection;
  } catch (error) {
    console.error(`Error connecting to database ${schoolCode}:`, error);
    throw error;
  }
};

// Middleware to ensure schoolCode is provided
const requireSchoolCode = (req, res, next) => {
  const schoolCode = req.body.schoolCode || req.query.schoolCode;
  if (!schoolCode) return res.status(400).json({ error: 'schoolCode is required' });
  req.schoolCode = schoolCode;
  next();
};

// --- Routes ---

// Behaviour report
router.post('/api/behaviour', requireSchoolCode, async (req, res) => {
  const { name, class_name, section } = req.body;
  try {
    const connection = await getDbConnection(req.schoolCode);
    const [result] = await connection.execute(
      'SELECT report FROM teachers_student_report WHERE name = ? AND class_name = ? AND section = ?',
      [name, class_name, section]
    );
    await connection.end();
    res.json(result[0] || {});
  } catch (error) {
    console.error('Error fetching behaviour report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get username
router.get('/getUserName', requireSchoolCode, async (req, res) => {
  const username = req.query.username;
  try {
    const connection = await getDbConnection(req.schoolCode);
    const [rows] = await connection.execute(
      'SELECT name FROM management_login_creation WHERE username = ?',
      [username]
    );
    await connection.end();
    res.json(rows[0] || {});
  } catch (err) {
    console.error('Error fetching user name:', err);
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

// Attendance
router.post('/api/attendance', requireSchoolCode, async (req, res) => {
  const { name, class_name, section } = req.body;
  try {
    const connection = await getDbConnection(req.schoolCode);
    const [result] = await connection.execute(
      `SELECT
        COUNT(*) AS total,
        SUM(LOWER(leavetype) = 'present') AS present
       FROM attendance_frontend
       WHERE name = ? AND class = ? AND section = ?`,
      [name, class_name, section]
    );
    await connection.end();
    res.json(result[0] || {});
  } catch (err) {
    console.error('Error fetching attendance:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Extra-curricular activities
router.post('/api/activities', requireSchoolCode, async (req, res) => {
  const { name, class_name, section } = req.body;
  try {
    const connection = await getDbConnection(req.schoolCode);
    const [result] = await connection.execute(
      'SELECT program_name, winning_event, winning_rank, winning_date FROM ExtraCurcularActivities WHERE student_name = ? AND class_name = ? AND section = ?',
      [name, class_name, section]
    );
    await connection.end();
    res.json(result);
  } catch (err) {
    console.error('Error fetching activities:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Student details
router.post('/api/student-details', requireSchoolCode, async (req, res) => {
  const { name, class_name, section } = req.body;
  if (!name || !class_name || !section) return res.status(400).json({ error: 'Name, class, and section are required' });
  try {
    const connection = await getDbConnection(req.schoolCode);
    const [rows] = await connection.execute(
      'SELECT * FROM management_login_creation WHERE name = ? AND class_name = ? AND section = ?',
      [name, class_name, section]
    );
    await connection.end();
    if (rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const student = rows[0];
    if (student.photo) student.photo = student.photo.toString('base64');
    res.json(student);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Student with most positive comments
router.get('/api/student-most-positive-comments', requireSchoolCode, async (req, res) => {
  const positiveKeywords = ['good', 'excellent', 'well', 'outstanding', 'great', 'amazing', 'brilliant'];
  const likeClauses = positiveKeywords.map(() => 'comment LIKE ?').join(' OR ');
  const query = `
    SELECT name, class_name, section, COUNT(*) AS positive_comment_count
    FROM teachers_student_report
    WHERE ${likeClauses}
    GROUP BY name, class_name, section
    ORDER BY positive_comment_count DESC
    LIMIT 1
  `;
  try {
    const connection = await getDbConnection(req.schoolCode);
    const params = positiveKeywords.map(word => `%${word}%`);
    const [rows] = await connection.execute(query, params);
    await connection.end();
    res.json(rows[0] || null);
  } catch (err) {
    console.error('Error fetching positive comments:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// Highest scorer by class
router.post('/api/highest-scorer', requireSchoolCode, async (req, res) => {
  const { class_name } = req.body;
  if (!class_name) return res.status(400).json({ error: 'class_name is required' });
  const query = `
    SELECT name, class_name, section, AVG(marks) AS avg_marks
    FROM academic_performance_of_student
    WHERE class_name = ?
    GROUP BY name, class_name, section
    ORDER BY avg_marks DESC
    LIMIT 1
  `;
  try {
    const connection = await getDbConnection(req.schoolCode);
    const [rows] = await connection.execute(query, [class_name]);
    await connection.end();
    if (rows.length === 0) return res.status(404).json({ message: 'No data found for this class' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching highest scorer:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// Overall highest scorer
router.get('/api/overall-highest-scorer', requireSchoolCode, async (req, res) => {
  const query = `
    SELECT name, class_name, section, AVG(marks) AS avg_marks
    FROM academic_performance_of_student
    GROUP BY name, class_name, section
    ORDER BY avg_marks DESC
    LIMIT 1
  `;
  try {
    const connection = await getDbConnection(req.schoolCode);
    const [rows] = await connection.execute(query);
    await connection.end();
    res.json(rows[0] || null);
  } catch (err) {
    console.error('Error fetching overall highest scorer:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// Get students by class and range
router.post('/api/getStudents', requireSchoolCode, async (req, res) => {
  const { class_name, range } = req.body;
  if (!class_name || !range) return res.status(400).json({ error: 'class_name and range are required' });

  let testTypes = [];
  switch (range) {
    case 'FA1': testTypes = ['FA1']; break;
    case 'FA2': testTypes = ['FA2']; break;
    case 'SA1': testTypes = ['SA1']; break;
    case 'FA3': testTypes = ['FA3']; break;
    case 'FA4': testTypes = ['FA4']; break;
    case 'SA2': testTypes = ['SA2']; break;
    case 'THIS WEEK':
    case 'LAST WEEK': testTypes = ['FA1', 'FA2', 'SA1', 'FA3', 'FA4', 'SA2']; break;
    default: return res.status(400).json({ error: 'Invalid range' });
  }

  const placeholders = testTypes.map(() => '?').join(',');
  const query = `
    SELECT name, class_name, section, subject, marks, test_type
    FROM academic_performance_of_student
    WHERE class_name = ? AND test_type IN (${placeholders})
    ORDER BY name, subject
  `;

  try {
    const connection = await getDbConnection(req.schoolCode);
    const params = [class_name, ...testTypes];
    const [rows] = await connection.execute(query, params);
    await connection.end();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// Academic performance of a student
router.post('/api/academic-performance', requireSchoolCode, async (req, res) => {
  const { name, class_name, section } = req.body;
  if (!name || !class_name || !section) return res.status(400).json({ error: 'Name, class_name, and section are required' });

  const query = `
    SELECT test_type, subject, marks, createdAt
    FROM academic_performance_of_student
    WHERE name = ? AND class_name = ? AND section = ?
    ORDER BY createdAt DESC
  `;

  try {
    const connection = await getDbConnection(req.schoolCode);
    const [rows] = await connection.execute(query, [name, class_name, section]);
    await connection.end();
    if (rows.length === 0) return res.status(404).json({ message: 'No academic records found for this student' });
    res.json(rows);
  } catch (err) {
    console.error('Error fetching academic performance:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
