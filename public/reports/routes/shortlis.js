// const express = require('express');
// const mysql = require('mysql2');
// const bodyParser = require('body-parser');
// const cors = require('cors');
// const router = express.Router();
// const app = express();
// const port = 5000;

// // Middleware
// app.use(cors());
// app.use(bodyParser.json());

// // MySQL connection
// const db = mysql.createConnection({
//     host: '162.215.210.38',
//     user: 'root',
//     password: 'NavyAtagsoLnovA@$000',
//     database: 'NOVA',
// });

// // Connect to MySQL
// db.connect((err) => {
//   if (err) throw err;
//   console.log('Connected to MySQL database');
// });

// // Route to fetch all entrance test details
// router.get('/marks', (req, res) => {
//   const query = 'SELECT * FROM entrance_tests';
//   db.query(query, (err, results) => {
//     if (err) throw err;
//     res.json(results);
//   });
// });

// // Route to get shortlisted status by admission_id
// router.get('/shortlisted/:admission_id', (req, res) => {
//   const { admission_id, name, class: className } = req.query;

//   // Start the base query
//   let query = 'SELECT * FROM bizpulse_shortlisted_students WHERE 1=1';
//   const params = [];

//   // Add filters based on query parameters
//   if (admission_id) {
//     query += ' AND admission_id = ?';
//     params.push(admission_id);
//   }
//   if (name) {
//     query += ' AND name LIKE ?';
//     params.push(`%${name}%`);
//   }
//   if (className) {
//     query += ' AND class = ?';
//     params.push(className);
//   }

//   // Execute the query
//   db.query(query, params, (error, results) => {
//     if (error) {
//       console.error('Error fetching shortlisted students:', error);
//       return res.status(500).send('Error fetching shortlisted students');
//     }
//     res.json(results); // Send results as JSON response
//   });
// });

// // Route to insert shortlisted status based on percentage condition
// router.post('/shortlisted', (req, res) => {
//   const { admission_id, final_remarks } = req.body;

//   // Validate the input
//   if (!admission_id || !final_remarks) {
//     return res.status(400).json({ message: 'Admission ID and final remarks are required' });
//   }

//   // Query to fetch percentage of the student based on admission_id
//   const marksQuery = 'SELECT percentage FROM entrance_tests WHERE admission_id = ?';

//   db.query(marksQuery, [admission_id], (err, results) => {
//     if (err) {
//       console.error('Database error:', err);
//       return res.status(500).json({ message: 'Database query error' });
//     }

//     let status = '';
//     let percentage = null;

//     // Check if marks data exists
//     if (results.length > 0) {
//       percentage = results[0].percentage;

//       // Determine the status based on percentage
//       if (percentage > 50) {
//         status = 'Shortlisted';
//       } else {
//         status = 'Rejected';
//       }
//     } else {
//       // If no percentage data, set status to 'Not Available'
//       status = 'Not Available';
//     }

//     // Insert shortlisted status into the bizpulse_shortlisted_students table
//     const insertQuery = 'INSERT INTO bizpulse_shortlisted_students (admission_id, status, final_remarks) VALUES (?, ?, ?)';
//     db.query(insertQuery, [admission_id, status, final_remarks], (err, result) => {
//       if (err) {
//         console.error('Insert error:', err);
//         return res.status(500).json({ message: 'Error inserting shortlisted status' });
//       }
//       res.status(201).json({ 
//         message: 'Shortlisted status inserted successfully', 
//         admission_id,
//         status,
//         percentage: percentage !== null ? percentage : 'No data available', 
//         result 
//       });
//     });
//   });
// });

// // Route to search shortlisted students by name, date, or class
// router.get('/shortlisted/search', (req, res) => {
//     const { name, date, class_name } = req.query;
  
//     let query = `
//       SELECT s.*, a.name, a.date, a.class_name
//       FROM bizpulse_shortlisted_students s
//       JOIN bizpulse_admission_entries a ON s.admission_id = a.admission_id
//       WHERE 1=1
//     `;
//     const queryParams = [];
  
//     // Dynamically build the query based on the provided search parameters
//     if (name) {
//       query += ' AND a.name LIKE ?';
//       queryParams.push(`%${name}%`);
//     }
//     if (date) {
//       query += ' AND DATE(a.date) = ?';
//       queryParams.push(date);
//     }
//     if (class_name) {
//       query += ' AND a.class_applied  = ?';
//       queryParams.push(class_name);
//     }
  
//     // Execute the query
//     db.query(query, queryParams, (err, results) => {
//       if (err) {
//         console.error('Error querying shortlisted students:', err);
//         return res.status(500).json({ error: 'Internal Server Error' });
//       }
//       res.json(results);
//     });
//   });
  
// module.exports = router;
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const router = express.Router();
const app = express();
const port = 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MySQL connection
const db = mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: 'NOVA',
});

// Connect to MySQL
db.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL database');
});

// Route to fetch all entrance test details
router.get('/marks', (req, res) => {
  const query = 'SELECT * FROM entrance_tests';
  db.query(query, (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

// Route to get shortlisted status by admission_id
router.get('/shortlisted/:admission_id', (req, res) => {
  const { admission_id } = req.params;

  const query = 'SELECT * FROM bizpulse_shortlisted_students WHERE admission_id = ?';
  
  db.query(query, [admission_id], (error, results) => {
    if (error) {
      console.error('Error fetching shortlisted students:', error);
      return res.status(500).send('Error fetching shortlisted students');
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'No shortlisted student found for this admission ID' });
    }
    
    res.json(results); // Send results as JSON response
  });
});

// Route to insert shortlisted status based on percentage condition
router.post('/shortlisted', (req, res) => {
  const { admission_id } = req.body;

  // Validate the input
  if (!admission_id) {
    return res.status(400).json({ message: 'Admission ID is required' });
  }

  // Query to fetch percentage of the student based on admission_id
  const marksQuery = 'SELECT percentage FROM entrance_tests WHERE admission_id = ?';

  db.query(marksQuery, [admission_id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Database query error' });
    }

    let status = '';
    let finalRemarks = '';
    let percentage = null;

    // Check if marks data exists
    if (results.length > 0) {
      percentage = results[0].percentage;

      // Determine the status and final remarks based on percentage
      if (percentage > 50) {
        status = 'Shortlisted';
        finalRemarks = 'Congratulations';
      } else {
        status = 'Rejected';
        finalRemarks = 'All the best for next time';
      }
    } else {
      // If no percentage data, set status to 'Not Available' and remarks
      status = 'Not Available';
      finalRemarks = 'No data available';
    }

    // Insert shortlisted status into the bizpulse_shortlisted_students table
    const insertQuery = 'INSERT INTO bizpulse_shortlisted_students (admission_id, status, final_remarks) VALUES (?, ?, ?)';
    db.query(insertQuery, [admission_id, status, finalRemarks], (err, result) => {
      if (err) {
        console.error('Insert error:', err);
        return res.status(500).json({ message: 'Error inserting shortlisted status' });
      }
      res.status(201).json({ 
        message: 'Shortlisted status inserted successfully', 
        admission_id,
        status,
        percentage: percentage !== null ? percentage : 'No data available', 
        finalRemarks,
        result 
      });
    });
  });
});


// Route to search shortlisted students by name, date, or class
router.get('/shortlisted/search', (req, res) => {
    const { name, date, class_name } = req.query;
  
    let query = `SELECT s.*, a.name, a.date, a.class_name
      FROM bizpulse_shortlisted_students s
      JOIN bizpulse_admission_entries a ON s.admission_id = a.admission_id
      WHERE 1=1`;
    const queryParams = [];
  
    // Dynamically build the query based on the provided search parameters
    if (name) {
      query += ' AND a.name LIKE ?';
      queryParams.push(`%${name}%`);
    }
    if (date) {
      query += ' AND DATE(a.date) = ?';
      queryParams.push(date);
    }
    if (class_name) {
      query += ' AND a.class_applied  = ?';
      queryParams.push(class_name);
    }
  
    // Execute the query
    db.query(query, queryParams, (err, results) => {
      if (err) {
        console.error('Error querying shortlisted students:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      res.json(results);
    });
});

module.exports = router;
