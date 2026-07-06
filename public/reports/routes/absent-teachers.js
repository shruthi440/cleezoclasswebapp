






// server.js
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const app = express();
const PORT = 5000;
const router = express.Router();

app.use(cors());
app.use(express.json());

// MySQL DB Connection
const db = mysql.createConnection({
  host: '162.215.210.38',
  user: 'root',
  password: 'NavyAtagsoLnovA@$000',
  database: 'NOVA'
});

db.connect((err) => {
  if (err) {
    console.error('❌ DB connection error:', err);
  } else {
    console.log('✅ Connected to MySQL DB');
  }
});


// Absent teachers list
router.get('/absent-teachers', (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const query = `
      SELECT a.id AS teacher_id, m.designation AS subject, a.absenceReason, a.date
      FROM attendance a
      LEFT JOIN management_login_creation m ON a.id = m.id
      WHERE a.date = ? AND a.status = 'Absent'
    `;
  
    db.query(query, [today], (err, results) => {
      if (err) {
        console.error('❌ Error fetching absent data:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json(results);
    });
  });
  
  // Get available substitute for a given subject and period
  router.get('/substitute/:period/:subject', (req, res) => {
    const { period, subject } = req.params;
    const today = new Date().toLocaleString('en-US', { weekday: 'long' });
  
    // Map for dynamic column selection based on period
    const periodNum = parseInt(period);
    const timeCol = `period_${periodNum}_from_time`;
    const subjectCol = `period_${periodNum}_subject`;
  
    const query = `
      SELECT 
        ut.class_id AS class,
        ut.section_id AS section,
        ut.${timeCol} AS time,
        ut.${subjectCol} AS subject,
        (
          SELECT name 
          FROM management_login_creation mlc
          LEFT JOIN UniqueTimetable t2 ON t2.day = ? 
            AND t2.period_${periodNum}_subject = mlc.designation
          WHERE mlc.designation = ? 
            AND t2.period_${periodNum}_subject IS NULL
          LIMIT 1
        ) AS substitute
      FROM UniqueTimetable ut
      WHERE ut.day = ? AND ut.${subjectCol} = ?
      LIMIT 1
    `;
  
    db.query(query, [today, subject, today, subject], (err, results) => {
      if (err) {
        console.error('❌ Error fetching substitute:', err);
        return res.status(500).json({ error: 'Server error' });
      }
  
      if (results.length === 0) {
        return res.json({
          class: "Not Available",
          section: "Not Available",
          time: "Not Available",
          subject,
          substitute: "Not Assigned",
          period: periodNum
        });
      }
  
      const { class: cls, section, time, substitute } = results[0];
  
      res.json({
        class: cls || "Not Available",
        section: section || "Not Available",
        time: time || "Not Available",
        subject,
        substitute: substitute || "Not Assigned",
        period: periodNum
      });
    });
  });



// Absent teachers list
router.get('/absent-teachers', (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const query = `
      SELECT a.id AS teacher_id, m.name AS teacher_name, m.designation AS subject, a.absenceReason, a.date
      FROM attendance a
      LEFT JOIN management_login_creation m ON a.id = m.id
      WHERE a.date = ? AND a.status = 'Absent'
    `;
  
    db.query(query, [today], (err, results) => {
      if (err) {
        console.error('❌ Error fetching absent data:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json(results);
    });
  });
  
  // Get available substitute for a given subject and period
  router.get('/substitute/:period/:subject', (req, res) => {
    const { period, subject } = req.params;
    const today = new Date().toLocaleString('en-US', { weekday: 'long' });
  
    // Map for dynamic column selection based on period
    const periodNum = parseInt(period);
    const timeCol = `period_${periodNum}_from_time`;
    const subjectCol = `period_${periodNum}_subject`;
  
    const query = `
      SELECT 
        ut.class_id AS class,
        ut.section_id AS section,
        ut.${timeCol} AS time,
        ut.${subjectCol} AS subject,
        (
          SELECT mlc.name
          FROM management_login_creation mlc
          LEFT JOIN UniqueTimetable t2 ON t2.day = ? 
            AND t2.period_${periodNum}_subject = mlc.designation
          WHERE mlc.designation = ? 
            AND t2.period_${periodNum}_subject IS NULL
          LIMIT 1
        ) AS substitute
      FROM UniqueTimetable ut
      WHERE ut.day = ? AND ut.${subjectCol} = ?
      LIMIT 1
    `;
  
    db.query(query, [today, subject, today, subject], (err, results) => {
      if (err) {
        console.error('❌ Error fetching substitute:', err);
        return res.status(500).json({ error: 'Server error' });
      }
  
      if (results.length === 0) {
        return res.json({
          class: "Not Available",
          section: "Not Available",
          time: "Not Available",
          subject,
          substitute: "Not Assigned",
          period: periodNum
        });
      }
  
      const { class: cls, section, time, substitute } = results[0];
  
      res.json({
        class: cls || "Not Available",
        section: section || "Not Available",
        time: time || "Not Available",
        subject,
        substitute: substitute || "Not Assigned",
        period: periodNum
      });
    });
  });
// Get available teachers for a given period and subject
router.get('/available-teachers/:period/:subject', (req, res) => {
  const { period, subject } = req.params;
  const periodNum = parseInt(period);
  const day = new Date().toLocaleString('en-US', { weekday: 'long' });
  const subjectCol = `period_${periodNum}_subject`;

  const query = `
    SELECT id AS teacher_id, name AS teacher_name, designation 
    FROM management_login_creation 
    WHERE designation != ?
    AND user_type = 'teacher'
    AND id NOT IN (
      SELECT id FROM UniqueTimetable 
      WHERE day = ? AND ${subjectCol} IS NOT NULL
    )
  `;

  db.query(query, [subject, day], (err, results) => {
    if (err) {
      console.error('❌ Error fetching available teachers:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json(results);
  });
});
  
  // Assign substitute for a class/section
  router.post('/assign-substitute', (req, res) => {
    const { period, subject, substituteId, classId, sectionId } = req.body;
    console.log("📦 Received body:", req.body);
  
    if (!period || !subject || !substituteId || !classId || !sectionId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
  
    const day = new Date().toLocaleString('en-US', { weekday: 'long' });
    const periodNum = parseInt(period);
    const subjectCol = `period_${periodNum}_subject`;
  
    // Fetch substitute teacher's name
    const getSubstituteNameQuery = `
      SELECT name FROM management_login_creation WHERE id = ?
    `;
  
    db.query(getSubstituteNameQuery, [substituteId], (err, result) => {
      if (err) {
        console.error('❌ Error fetching substitute name:', err.sqlMessage);
        return res.status(500).json({ error: 'Server error while fetching substitute name' });
      }
  
      if (result.length === 0) {
        return res.status(404).json({ error: 'Substitute teacher not found' });
      }
  
      const substituteName = result[0].name;
  
      // Now update the timetable with substitute's name
      const updateQuery = `
        UPDATE UniqueTimetable
        SET ${subjectCol} = ?
        WHERE day = ? AND class_id = ? AND section_id = ? AND ${subjectCol} = ?;
      `;
  
      db.query(updateQuery, [substituteName, day, classId, sectionId, subject], (err, result) => {
        if (err) {
          console.error('❌ Error assigning substitute:', err.sqlMessage);
          return res.status(500).json({ error: 'Server error while updating timetable' });
        }
  
        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'No matching class/section/subject found' });
        }
  
        res.json({ message: `✅ Substitute ${substituteName} assigned successfully` });
      });
    });
  });
  
  module.exports = router;
