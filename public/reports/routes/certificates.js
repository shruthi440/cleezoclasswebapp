/**
 * routes/syllabusRouter.js
 * Dynamic‑DB router that never blocks on a missing connection.
 */

const express = require("express");
const mysql   = require("mysql2");
const router  = express.Router();

const syllabusData = require("../syllabusData");

// -----------------------------------------------------------------------------
//  Dynamic‑DB helpers
// -----------------------------------------------------------------------------
let db = null;              // active MySQL connection object   (may be null)
let dbName = null;          // name of the DB we tried to use   (string | null)
let dbConnected = false;    // last known connection status     (boolean)

/** Attempt (or re‑attempt) to connect to the given school‑specific DB. */
function createAndConnectDatabase(schoolCode) {
  // If we’re already on the right DB and still flagged “connected”, do nothing.
  if (dbName === schoolCode && dbConnected) return;

  // Close any previous connection (best‑effort).
  if (db) db.destroy();

  dbName = schoolCode;
  dbConnected = false; // pessimistic until proven otherwise

  db = mysql.createConnection({
    host     : "162.215.210.38",
    user     : "root",
    password : "NavyAtagsoLnovA@$000",
    database : schoolCode
  });

  db.connect(err => {
    if (err) {
      console.error(`❌  DB connect failed [${schoolCode}]:`, err.message);
      dbConnected = false;
      return;
    }
    console.log(`✅  Connected to MySQL DB: ${schoolCode}`);
    dbConnected = true;
  });
}

/** Utility to include DB status in every JSON response. */
function withDbInfo(payload = {}) {
  return {
    ...payload,
    dbInfo: {
      name      : dbName,
      connected : dbConnected
    }
  };
}

// -----------------------------------------------------------------------------
//  Routes that establish / switch the DB
// -/** Get student list from DB based on class name */
router.get('/certificate/:className', async (req, res) => {
  const { className } = req.params;
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json(withDbInfo({ error: "School code is required" }));
  }

  // Attempt DB connection if not already connected
  createAndConnectDatabase(schoolCode);

  // Wait for DB connection to be established before proceeding
  setTimeout(() => {
    if (!dbConnected) {
      return res.status(500).json(withDbInfo({ error: "Database not connected" }));
    }

    // Extract numeric part of className (e.g., "class1" → "1")
    const classNumber = className.replace(/[^\d]/g, '');
    const sql = `SELECT * FROM management_login_creation WHERE user_type = 'student' AND class_name = ?`;

    db.query(sql, [classNumber], (err, results) => {
      if (err) {
        console.error("❌ Query error:", err.message);
        return res.status(500).json(withDbInfo({ error: err.message }));
      }

      res.json(withDbInfo({ students: results }));
    });
  }, 300); // Short delay to allow async `db.connect()` to complete
});

router.post("/subjectpageSchoolCode", (req, res) => {
  const { schoolCode } = req.body;
  if (!schoolCode) return res.status(400).json({ error: "School code is required" });

  createAndConnectDatabase(schoolCode);
  res.json(withDbInfo({ message: "Database toggle attempted" }));
});

router.post("/dropdownpageSchoolCode", (req, res) => {
  const { schoolCode } = req.body;
  if (!schoolCode) return res.status(400).json({ error: "School code is required" });

  createAndConnectDatabase(schoolCode);
  res.json(withDbInfo({ message: "Database toggle attempted" }));
});

router.post("/syllabusPageSchoolCode", (req, res) => {
  const { schoolCode } = req.body;
  if (!schoolCode) return res.status(400).json({ error: "School code is required" });

  createAndConnectDatabase(schoolCode);
  res.json(withDbInfo({ message: "Database toggle attempted" }));
});

// -----------------------------------------------------------------------------
//  Data‑only routes — work even if DB isn’t connected
// -----------------------------------------------------------------------------

/** Get list of subjects for a given board / class / state. */
router.get("/subjects", (req, res) => {
  const { board, className, state } = req.query;

  // Purely JSON‑driven; no DB required.
  if (board === "CBSE") {
    const subjects = syllabusData.CBSE[className] || [];
    return res.json(withDbInfo({ subjects }));
  }

  if (board === "SSC" && state) {
    const subjects = syllabusData.SSC[state]?.[className] || [];
    return res.json(withDbInfo({ subjects }));
  }

  return res.status(400).json(withDbInfo({ error: "Invalid request" }));
});

/** Get syllabus PDF path for a given board / class / subject / state. */
router.get("/syllabus", (req, res) => {
  const { board, className, subject, state } = req.query;

  const key  = state
    ? `SSC-${state}-${className}-${subject}`
    : `CBSE-${className}-${subject}`;

  const path = syllabusData.syllabusPaths[key];

  if (!path) {
    return res.status(404).json(withDbInfo({ error: "Syllabus not found" }));
  }

  return res.json(withDbInfo({ path }));
});

module.exports = router;





