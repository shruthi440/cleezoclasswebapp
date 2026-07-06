const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const router = express.Router();

const app = express();
app.use(cors());
app.use(express.json());

router.get('/top-3-students', (req, res) => {
  const schoolCode = req.query.schoolCode || 'NOVA'; // from query param

  console.log(`[DEBUG] Starting /top-3-students endpoint`);
  console.log(`[DEBUG] Received schoolCode: ${schoolCode}`);

  const dynamicDb = mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: schoolCode,
  });

  const query = `
    SELECT aps.name, aps.class_name, aps.section, 
           ROUND(AVG(aps.marks), 2) AS avg_marks, 
           mlc.photo
    FROM academic_performance_of_student AS aps
    JOIN management_login_creation AS mlc 
      ON TRIM(LOWER(aps.name)) = TRIM(LOWER(mlc.name))
    GROUP BY aps.name, aps.class_name, aps.section, mlc.photo
    ORDER BY aps.class_name, avg_marks DESC
  `;

  console.log(`[DEBUG] Attempting to connect to database: ${schoolCode}`);
  
  dynamicDb.connect(err => {
    if (err) {
      console.error('❌ Dynamic DB connection error:', err);
      console.log('[DEBUG] Connection failed, sending 500 response');
      return res.status(500).json({ 
        error: 'Database connection failed', 
        details: err.message,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log('[DEBUG] Successfully connected to DB');
    console.log('[DEBUG] Executing query:', query.replace(/\s+/g, ' ').trim());

    dynamicDb.query(query, (err, results) => {
      dynamicDb.end();
      console.log('[DEBUG] Database connection closed');

      if (err) {
        console.error('🔥 Query error:', err);
        console.log('[DEBUG] Query failed, sending 500 response');
        return res.status(500).json({ 
          error: 'Query failed', 
          details: err.message,
          sql: query.replace(/\s+/g, ' ').trim(),
          timestamp: new Date().toISOString()
        });
      }

      console.log(`✅ Query successful. Found ${results.length} student(s).`);
      console.log('[DEBUG] Sample result:', results.length > 0 ? results[0] : 'No results');

      // Convert photo buffers to base64
      const processedResults = results.map(student => {
        if (student.photo) {
          console.log(`[DEBUG] Converting photo to base64 for student: ${student.name}`);
          student.photo = Buffer.from(student.photo).toString('base64');
        } else {
          console.log(`[DEBUG] No photo found for student: ${student.name}`);
        }
        return student;
      });

      console.log('[DEBUG] Processing top 3 students per class');
      const top3Students = [];
      let currentClass = null;
      let classCounter = 0;

      processedResults.forEach((student, index) => {
        console.log(`[DEBUG] Processing student ${index + 1}/${processedResults.length}: ${student.name}`);
        
        if (currentClass !== student.class_name) {
          console.log(`[DEBUG] New class detected: ${student.class_name}`);
          currentClass = student.class_name;
          classCounter = 0;
        }
        
        if (classCounter < 3) {
          console.log(`[DEBUG] Adding student to top 3 for ${currentClass}: ${student.name}`);
          top3Students.push(student);
          classCounter++;
        } else {
          console.log(`[DEBUG] Skipping student (already have 3 for ${currentClass}): ${student.name}`);
        }
      });

      console.log('[DEBUG] Final top students count:', top3Students.length);
      console.log('[DEBUG] Sample top student:', top3Students.length > 0 ? top3Students[0] : 'No top students');

      res.status(200).json({ 
        students: top3Students,
        meta: {
          totalStudents: results.length,
          topStudentsCount: top3Students.length,
          classesRepresented: [...new Set(top3Students.map(s => s.class_name))],
          timestamp: new Date().toISOString()
        }
      });
    });
  });
});

module.exports = router;