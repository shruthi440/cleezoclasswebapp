const express = require('express');
const router = express.Router();
const mysql = require('mysql2');

// Enhanced connection creation with validation
function createDynamicConnection(schoolCode) {
  if (!schoolCode) throw new Error('schoolCode is required');
  
  // Strict validation for database name
  const cleanedSchoolCode = schoolCode.trim().replace(/\s+/g, '_');
  if (!/^[a-zA-Z0-9_]+$/.test(cleanedSchoolCode)) {
    throw new Error(`Invalid schoolCode format: ${schoolCode}`);
  }

  console.log(`Creating connection to database: '${cleanedSchoolCode}'`);
  
  return mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: cleanedSchoolCode,
  });
}
router.get('/teach', (req, res) => {
  const schoolCode = req.query.schoolCode;
  if (!schoolCode) {
    return res.status(400).json({ error: 'Missing schoolCode query parameter' });
  }
  console.log('[DEBUG] /test route was called');
  res.json({ message: 'Attendance route is working' });
});

router.get('/teach', (req, res) => {
  console.log('[ROUTE HIT] GET /teach');

  try {
    const rawSchoolCode = req.query.schoolCode;
    if (!rawSchoolCode) {
      return res.status(400).json({ error: 'schoolCode parameter is required' });
    }

    const schoolCode = String(rawSchoolCode).trim();
    console.log('[DEBUG] schoolCode:', schoolCode);

    const db = createDynamicConnection(schoolCode);

    db.connect((err) => {
      if (err) {
        console.error('[DB CONNECTION ERROR]:', err);
        return res.status(500).json({
          error: 'Failed to connect to school database',
          details: err.message,
        });
      }

      const query = 'SELECT id, name FROM management_login_creation WHERE user_type = "teacher"';

      db.query(query, (err, results) => {
        db.end();

        if (err) {
          console.error('[QUERY ERROR]:', err);
          return res.status(500).json({
            error: 'Failed to fetch teachers',
            details: err.message,
          });
        }

        console.log('[QUERY RESULTS]:', results);

        if (results.length === 0) {
          return res.json([]);
        }

        res.json(results);
      });
    });
  } catch (err) {
    console.error('[ENDPOINT ERROR]:', err);
    res.status(400).json({
      error: 'Invalid request',
      details: err.message,
    });
  }
});

// Improved POST /submit-attendance
router.post('/submit-attendance', (req, res) => {
  try {
    const { schoolCode, ...attendanceData } = req.body;
    
    if (!schoolCode) {
      throw new Error('schoolCode is required in request body');
    }

    const cleanedSchoolCode = String(schoolCode).trim();
    console.log(`Attendance submission for: '${cleanedSchoolCode}'`);

    const db = createDynamicConnection(cleanedSchoolCode);

    db.connect((err) => {
      if (err) {
        console.error('DB CONNECTION ERROR:', err);
        return res.status(500).json({ 
          error: 'Database connection failed',
          details: err.message
        });
      }

      const query = `
        INSERT INTO attendance 
        (id, name, date, timeIn, timeOut, status, absenceReason) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        attendanceData.id,
        attendanceData.name,
        attendanceData.date,
        attendanceData.timeIn,
        attendanceData.timeOut,
        attendanceData.status,
        attendanceData.absenceReason
      ];

      db.query(query, params, (err, result) => {
        db.end();
        
        if (err) {
          console.error('INSERT ERROR:', err);
          return res.status(500).json({ 
            error: 'Failed to insert attendance',
            details: err.message
          });
        }
        
        console.log('Attendance recorded successfully');
        res.json({ message: 'Attendance submitted successfully' });
      });
    });
  } catch (err) {
    console.error('SUBMISSION ERROR:', err);
    res.status(400).json({ 
      error: 'Invalid request data',
      details: err.message
    });
  }
});

module.exports = router;

// const express = require('express');
// const mysql = require('mysql2');
// const app = express();
// const PORT = 3010;
// const cors = require('cors');

// app.use(express.json());
// app.use(cors());

// // ✅ Enhanced dynamic DB connection function
// function createDynamicConnection(schoolCode) {
//   if (!schoolCode) throw new Error('schoolCode is required');

//   const cleanedSchoolCode = schoolCode.trim().replace(/\s+/g, '_');
//   if (!/^[a-zA-Z0-9_]+$/.test(cleanedSchoolCode)) {
//     throw new Error(`Invalid schoolCode format: ${schoolCode}`);
//   }

//   console.log(`Creating connection to database: '${cleanedSchoolCode}'`);

//   return mysql.createConnection({
//     host: '162.215.210.38',
//     user: 'root',
//     password: 'NavyAtagsoLnovA@$000',
//     database: cleanedSchoolCode,
//   });
// }

// // ✅ GET /api/teach - fetch teacher list
// app.get('/api/teach', (req, res) => {
//   console.log('[ROUTE HIT] GET /api/teach');

//   try {
//     const rawSchoolCode = req.query.schoolCode;
//     if (!rawSchoolCode) {
//       return res.status(400).json({ error: 'schoolCode parameter is required' });
//     }

//     const schoolCode = String(rawSchoolCode).trim();
//     console.log('[DEBUG] schoolCode:', schoolCode);

//     const db = createDynamicConnection(schoolCode);

//     db.connect((err) => {
//       if (err) {
//         console.error('[DB CONNECTION ERROR]:', err);
//         return res.status(500).json({
//           error: 'Failed to connect to school database',
//           details: err.message,
//         });
//       }

//       const query = 'SELECT id, name FROM management_login_creation WHERE user_type = "teacher"';

//       db.query(query, (err, results) => {
//         db.end();

//         if (err) {
//           console.error('[QUERY ERROR]:', err);
//           return res.status(500).json({
//             error: 'Failed to fetch teachers',
//             details: err.message,
//           });
//         }

//         console.log('[QUERY RESULTS]:', results);

//         if (results.length === 0) {
//           return res.json([]);
//         }

//         res.json(results);
//       });
//     });
//   } catch (err) {
//     console.error('[ENDPOINT ERROR]:', err);
//     res.status(400).json({
//       error: 'Invalid request',
//       details: err.message,
//     });
//   }
// });

// // ✅ POST /api/submit-attendance - store attendance data
// app.post('/api/submit-attendance', (req, res) => {
//   try {
//     const { schoolCode, ...attendanceData } = req.body;

//     if (!schoolCode) {
//       throw new Error('schoolCode is required in request body');
//     }

//     const cleanedSchoolCode = String(schoolCode).trim();
//     console.log(`Attendance submission for: '${cleanedSchoolCode}'`);

//     const db = createDynamicConnection(cleanedSchoolCode);

//     db.connect((err) => {
//       if (err) {
//         console.error('DB CONNECTION ERROR:', err);
//         return res.status(500).json({
//           error: 'Database connection failed',
//           details: err.message,
//         });
//       }

//       const query = `
//         INSERT INTO attendance 
//         (id, name, date, timeIn, timeOut, status, absenceReason) 
//         VALUES (?, ?, ?, ?, ?, ?, ?)
//       `;

//       const params = [
//         attendanceData.id,
//         attendanceData.name,
//         attendanceData.date,
//         attendanceData.timeIn,
//         attendanceData.timeOut,
//         attendanceData.status,
//         attendanceData.absenceReason,
//       ];

//       db.query(query, params, (err, result) => {
//         db.end();

//         if (err) {
//           console.error('INSERT ERROR:', err);
//           return res.status(500).json({
//             error: 'Failed to insert attendance',
//             details: err.message,
//           });
//         }

//         console.log('Attendance recorded successfully');
//         res.json({ message: 'Attendance submitted successfully' });
//       });
//     });
//   } catch (err) {
//     console.error('SUBMISSION ERROR:', err);
//     res.status(400).json({
//       error: 'Invalid request data',
//       details: err.message,
//     });
//   }
// });

// // ✅ Start server
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
// });
