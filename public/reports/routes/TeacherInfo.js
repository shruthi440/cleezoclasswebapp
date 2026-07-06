const express = require("express");
const mysql = require("mysql");
const router = express.Router();
const cors = require("cors");

// Enable CORS and JSON parsing
router.use(cors());
router.use(express.json());

// ✅ Connection Pool Per School Code
const pools = {};

function getDBPool(schoolCode) {
  if (!pools[schoolCode]) {
    pools[schoolCode] = mysql.createPool({
      host: "162.215.210.38",
      user: "root",
      password: "NavyAtagsoLnovA@$000",
      database: schoolCode,
      connectionLimit: 10,
    });
    console.log(`✅ Created DB pool for school: ${schoolCode}`);
  }
  return pools[schoolCode];
}

// ✅ Middleware: Attach school DB connection
function attachSchoolDB(req, res, next) {
  const schoolCode =
    (req.body && req.body.schoolCode) ||
    (req.query && req.query.schoolCode);

  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(schoolCode)) {
    return res.status(400).json({ error: "Invalid schoolCode format" });
  }

  try {
    req.db = getDBPool(schoolCode);
    next();
  } catch (err) {
    console.error("❌ DB Connection Error:", err);
    return res.status(500).json({ error: "Database connection failed" });
  }
}

// ✅ Route: Fetch teacher info
router.get("/teacherinfo", attachSchoolDB, (req, res) => {
  const classNum = req.query.classNum;
  const db = req.db;

  let query = `
    SELECT 
      id, name, designation, teaches_to_1, teaches_to_2, 
      teaches_to_3, teaches_to_4, teaches_to_5,
      (SELECT status FROM messages WHERE sender = management_login_creation.name LIMIT 1) AS status
    FROM management_login_creation 
    WHERE user_type = 'teacher'
  `;

  const params = [];

  if (classNum) {
    query += `
      AND (
        teaches_to_1 = ? OR
        teaches_to_2 = ? OR
        teaches_to_3 = ? OR
        teaches_to_4 = ? OR
        teaches_to_5 = ?
      )
    `;
    params.push(classNum, classNum, classNum, classNum, classNum);
  }

  db.query(query, params, (err, results) => {
    if (err) {
      console.error("❌ Error fetching teacher data:", err.message);
      return res.status(500).json({ error: "Failed to fetch teacher data" });
    }
    res.json(results);
  });
});

// ✅ Route: Update teacher status
router.post("/updateTeacherStatus", attachSchoolDB, (req, res) => {
  const { teacherName, newStatus, schoolCode } = req.body;
  const db = req.db;

  if (!teacherName || !newStatus) {
    return res.status(400).json({ error: "teacherName and newStatus are required" });
  }

  const query = `UPDATE messages SET status = ? WHERE sender = ?`;

  db.query(query, [newStatus, teacherName], (err, result) => {
    if (err) {
      console.error("❌ Error updating status:", err.message);
      return res.status(500).json({ error: "Failed to update status" });
    }

    res.json({
      message: `Live chat ${newStatus === "START" ? "enabled" : "disabled"}`,
    });
  });
});

module.exports = router;
