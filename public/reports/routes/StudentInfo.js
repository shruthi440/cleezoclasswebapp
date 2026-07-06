
const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const router = express.Router();

const app = express();
// const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection pools
const pools = {};

function getDBPool(schoolCode) {
  if (!pools[schoolCode]) {
    pools[schoolCode] = mysql.createPool({
      host: '119.18.62.140',
      user: 'root',
      password: 'NavyAtagsoLnovA@$000',
      database: schoolCode,
      connectionLimit: 10
    });
    console.log(`✅ Created new connection pool for school: ${schoolCode}`);
  }
  return pools[schoolCode];
}

// Middleware to attach school-specific DB
function attachSchoolDB(req, res, next) {
  const { schoolCode } = req.body;
  
  if (!schoolCode) {
    return res.status(400).json({ error: 'schoolCode is required in request body' });
  }
  
  // Validate schoolCode format if needed
  if (!/^[a-zA-Z0-9_]+$/.test(schoolCode)) {
    return res.status(400).json({ error: 'Invalid schoolCode format' });
  }
  
  try {
    req.db = getDBPool(schoolCode);
    next();
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(500).json({ error: 'Database connection failed' });
  }
}

// Student Info Endpoint
router.post('/studentinfo', attachSchoolDB, (req, res) => {
  const { className, section, fromDate, toDate, selectedInfoOption } = req.body;
  const db = req.db;

  if (!className || !section || selectedInfoOption !== 'students') {
    return res.status(400).json({ error: 'className, section, and selectedInfoOption (students) are required' });
  }

  console.log(`Fetching students for ${className}, ${section} from ${fromDate} to ${toDate}`);

  const studentQuery = `
    SELECT 
      s.name, 
      s.class_name,
      s.section
    FROM 
      management_login_creation s
    WHERE 
      s.class_name = ? 
      AND s.section = ?`;

  db.query(studentQuery, [className, section], (err, students) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Error fetching students' });
    }

    if (students.length === 0) {
      return res.status(404).json({ error: 'No students found' });
    }

    // Academic performance query
    const academicQuery = `
      SELECT 
        a.name, 
        a.class_name,
        a.section,
        a.test_type AS term, 
        SUM(a.marks) AS total_marks
      FROM 
        academic_performance_of_student a
      WHERE 
        DATE(a.createdAt) BETWEEN ? AND ? 
        AND a.class_name = ? 
        AND a.section = ? 
      GROUP BY 
        a.name, a.class_name, a.section, a.test_type`;

    db.query(academicQuery, [fromDate, toDate, className, section], (err, academicPerformance) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Error fetching academic data' });
      }

      // Process and combine all data as in your original code
      const processedStudents = students.map(student => {
        const performance = academicPerformance.filter(ap => ap.name === student.name);
        const terms = performance.reduce((acc, ap) => {
          acc[ap.term] = ap.total_marks;
          return acc;
        }, {});

        return {
          ...student,
          academicPerformance: terms,
          status: "START" // Default status
        };
      });

      res.json({ students: processedStudents });
    });
  });
});

// Toggle Student Status Endpoint
router.post('/toggleStudentStatus', attachSchoolDB, (req, res) => {
  const { name, status } = req.body;
  const db = req.db;

  if (!name || !status) {
    return res.status(400).json({ error: 'name and status are required' });
  }

  const updateQuery = `
    UPDATE management_login_creation
    SET status = ?
    WHERE name = ? AND user_type = 'student'`;

  db.query(updateQuery, [status, name], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Error updating status' });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json({ message: 'Status updated successfully' });
  });
});



// Export router to use in main app
module.exports = router;
