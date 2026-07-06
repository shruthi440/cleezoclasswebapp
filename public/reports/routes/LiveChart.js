const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require("cors");
const router=express.Router();
const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// ===============================================
// 1. DATABASE CONNECTION FUNCTION
// ===============================================
const getDbConnection = (schoolCode) => {
  return mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: schoolCode
  }).promise();
};

// ===============================================
// Helper: Validate schoolCode
// ===============================================
const requireSchoolCode = (req, res) => {
  const schoolCode = req.query.schoolCode;
  if (!schoolCode) {
    res.status(400).json({ error: "Missing schoolCode in query parameter" });
    return null;
  }
  return schoolCode;
};


// ==========================================================================
// CHAT REQUESTS
// ==========================================================================
router.get("/api/chat-requests/all", async (req, res) => {
  const schoolCode = requireSchoolCode(req, res);
  if (!schoolCode) return;

  const db = getDbConnection(schoolCode);

  try {
    const [results] = await db.execute(`SELECT * FROM chat_requests ORDER BY id DESC`);
    res.json(results);

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch chats" });
  } finally {
    db.end();
  }
});

// Approved
router.get("/api/chat-requests/approved", async (req, res) => {
  const schoolCode = requireSchoolCode(req, res);
  if (!schoolCode) return;

  const db = getDbConnection(schoolCode);

  try {
    const [results] = await db.execute(`
      SELECT * FROM chat_requests WHERE status='approved' ORDER BY id DESC
    `);

    res.json(results);

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch" });
  } finally {
    db.end();
  }
});

// Pending
router.get("/api/chat-requests/pending", async (req, res) => {
  const schoolCode = requireSchoolCode(req, res);
  if (!schoolCode) return;

  const db = getDbConnection(schoolCode);

  try {
    const [results] = await db.execute(`
      SELECT * FROM chat_requests WHERE status='pending' ORDER BY id DESC
    `);

    res.json(results);

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pending" });
  } finally {
    db.end();
  }
});

// Summary
router.get("/api/chat-summary", async (req, res) => {
  const schoolCode = requireSchoolCode(req, res);
  if (!schoolCode) return;

  const db = getDbConnection(schoolCode);

  try {
    const [results] = await db.execute(`
      SELECT
        COUNT(id) AS total_chats,
        COUNT(CASE WHEN status='pending' THEN 1 END) AS chats_pending_approval,
        COUNT(CASE WHEN status='approved' THEN 1 END) AS chats_accepted
      FROM chat_requests
    `);

    res.json(results[0]);

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch summary" });
  } finally {
    db.end();
  }
});

// ==========================================================================
// EVENTS
// ==========================================================================
router.get("/api/event-summary", async (req, res) => {
  const schoolCode = requireSchoolCode(req, res);
  if (!schoolCode) return;

  const db = getDbConnection(schoolCode);

  try {
    const [results] = await db.execute(`
      SELECT COUNT(id) AS total_events 
      FROM school_festivals
    `);

    res.json(results[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch event summary" });
  } finally {
    db.end();
  }
});


// Pending event count
router.get("/api/pending-events-count", async (req, res) => {
  const schoolCode = requireSchoolCode(req, res);
  if (!schoolCode) return;

  const db = getDbConnection(schoolCode);

  try {
    const [results] = await db.execute(`
      SELECT COUNT(id) AS events_pending_approval
      FROM school_festivals
      WHERE type = 'pending'
    `);

    res.json(results[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pending events" });
  } finally {
    db.end();
  }
});

// Completed
router.get("/api/completed-events", async (req, res) => {
  const schoolCode = requireSchoolCode(req, res);
  if (!schoolCode) return;

  const db = getDbConnection(schoolCode);

  try {
    const [results] = await db.execute(`
      SELECT id, festival_name, festival_date, type
      FROM school_festivals
      WHERE festival_date < CURDATE()
      ORDER BY festival_date DESC
    `);

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch completed events" });
  } finally {
    db.end();
  }
});


router.get("/api/upcoming-events", async (req, res) => {
  const schoolCode = requireSchoolCode(req, res);
  if (!schoolCode) return;

  const db = getDbConnection(schoolCode);

  try {
    const [results] = await db.execute(`
      SELECT id, festival_name, festival_date, type
      FROM school_festivals
      WHERE festival_date >= CURDATE()
      ORDER BY festival_date ASC
    `);

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch upcoming events" });
  } finally {
    db.end();
  }
});


module.exports=router;