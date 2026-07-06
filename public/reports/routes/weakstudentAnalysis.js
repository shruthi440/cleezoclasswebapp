const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();

// Load default image once on server start
const defaultImagePath = path.join(__dirname, '../public/images/women.png');
let defaultImageBase64 = null;
try {
  if (fs.existsSync(defaultImagePath)) {
    const buffer = fs.readFileSync(defaultImagePath);
    defaultImageBase64 = `data:image/png;base64,${buffer.toString('base64')}`;
  } else {
    console.warn('⚠️ Default image not found:', defaultImagePath);
  }
} catch (err) {
  console.error('⚠️ Failed to load default image:', err);
}

router.get('/weak_students', (req, res) => {
  const schoolCode = req.query.schoolCode || 'NOVA'; // get schoolCode from query parameter, fallback to NOVA
  console.log('[DEBUG] Received request for /weak_students');
  console.log('[DEBUG] schoolCode:', schoolCode);

  const dynamicDb = mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: schoolCode,
  });

  const query = `
    SELECT  
      a.name,
      l.photo,
      a.subject,
      a.marks,
      a.class_name,
      a.section
    FROM 
      academic_performance_of_student a
    JOIN 
      management_login_creation l ON a.name = l.name
    WHERE 
      a.marks < 20 
      AND LOWER(a.name) != 'lunch'
      AND a.subject NOT IN ('Lunch', 'PT')
    ORDER BY 
      a.marks ASC;
  `;

  dynamicDb.connect(err => {
    if (err) {
      console.error('❌ Database connection failed:', err);
      return res.status(500).json({ error: 'Database connection failed' });
    }
    console.log('[DEBUG] Connected to database:', schoolCode);

    dynamicDb.query(query, (err, results) => {
      dynamicDb.end();

      if (err) {
        console.error('❌ Query failed:', err);
        return res.status(500).json({ error: 'Query execution failed' });
      }

      console.log('[DEBUG] Number of weak students found:', results.length);

      const processed = results.map(student => {
        if (student.photo) {
          const base64 = Buffer.from(student.photo).toString('base64');
          student.photo = `data:image/jpeg;base64,${base64}`;
        } else {
          student.photo = defaultImageBase64 || null;
        }
        student.class_name = student.class_name || 'N/A';
        student.section = student.section || 'N/A';

        return student;
      });

      res.json(processed);
    });
  });
});

module.exports = router;
