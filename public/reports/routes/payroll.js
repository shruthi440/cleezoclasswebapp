const express = require('express');
const mysql = require('mysql2');
const app = express();
const router = express.Router();

app.use(express.json()); // Middleware to parse JSON request bodies

function createDynamicConnection(schoolCode) {
  if (!schoolCode) throw new Error('schoolCode is required');

  const cleanedSchoolCode = schoolCode.trim().replace(/\s+/g, '_');

  if (!/^[a-zA-Z0-9_]+$/.test(cleanedSchoolCode)) {
    throw new Error('Invalid schoolCode format');
  }

  return mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: cleanedSchoolCode,
  });
}










router.get("/getSalary", async (req, res) => {
  const schoolCode = req.query.schoolCode;

  if (!schoolCode) {
    return res.status(400).json({ message: "Missing schoolCode in query" });
  }

  const connection = createDynamicConnection(schoolCode);

  // Wrap the query in a promise to use async/await
  function queryPromise(sql, params) {
    return new Promise((resolve, reject) => {
      connection.query(sql, params, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });
  }

  try {
    const rows = await queryPromise(`
      SELECT 
        s.salary_id,
        s.teacher_id,
        t.name AS teacher_name,
        s.salary_amount,
        s.payment_date,
        s.salary_type,
        s.status,
        s.effective_from
      FROM 
        bizpulse_teacher_salary s
      JOIN 
        management_login_creation t ON s.teacher_id = t.id
      ORDER BY s.salary_id DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error fetching salary data:", error.message);
    res.status(500).json({ message: "Database error", error: error.message });
  } finally {
    connection.end();  // Important: close connection after query
  }
});
// POST /add-salary
router.post('/add-salary', (req, res) => {
  try {
    const {
      schoolCode,
      teacher_id,
      salary_amount,
      salary_type,
      effective_from,
      status = 'pending',
      hra = 0,
      pf = 0,
      professional_tax = 0,
      mediclaim = 0,
      deductions = 0   // frontend sends "deductions"
    } = req.body;

    if (!schoolCode) {
      return res.status(400).json({ error: 'schoolCode is required' });
    }
    if (!teacher_id || !salary_amount || !salary_type || !effective_from) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const db = createDynamicConnection(schoolCode);

    const query = `
      INSERT INTO bizpulse_teacher_salary
      (teacher_id, salary_amount, payment_date, salary_type, status, effective_from, hra, pf, professional_tax, mediclaim, deduction)
      VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    db.query(
      query,
      [
        teacher_id,
        salary_amount,
        salary_type,
        status,
        effective_from,
        hra,
        pf,
        professional_tax,
        mediclaim,
        deductions    // ✅ correctly map to DB "deduction"
      ],
      (err, result) => {
        db.end();
        if (err) {
          console.error('Error inserting salary:', err);
          return res.status(500).json({ error: 'Failed to insert salary' });
        }
        res.status(200).json({
          message: 'Salary entered successfully',
          salary_id: result.insertId
        });
      }
    );

  } catch (err) {
    console.error('Error:', err);
    res.status(400).json({ error: err.message });
  }
});



// GET /salary/:teacherId?schoolCode=...
router.get('/salary/:teacherId', (req, res) => {
  const { teacherId } = req.params;
  const schoolCode = req.query.schoolCode;

  console.log(`[DEBUG] Incoming request for salary. teacherId: ${teacherId}, schoolCode: ${schoolCode}`);

  if (!schoolCode) {
    console.warn('[WARN] Missing schoolCode query parameter');
    return res.status(400).json({ error: 'Missing schoolCode query parameter' });
  }

  const db = createDynamicConnection(schoolCode);
  console.log('[DEBUG] Database connection created');

  const query = `
    SELECT * FROM bizpulse_teacher_salary
    WHERE teacher_id = ?
    ORDER BY effective_from DESC
    LIMIT 1;
  `;

  db.query(query, [teacherId], (err, result) => {
    db.end();
    if (err) {
      console.error('[ERROR] Error fetching salary:', err);
      return res.status(500).json({ error: 'Failed to fetch salary details' });
    }
    if (result.length === 0) {
      console.info(`[INFO] No salary records found for teacher_id: ${teacherId}`);
      return res.status(404).json({ error: 'No salary records found for the teacher' });
    }
    console.log('[DEBUG] Salary fetched successfully:', result[0]);
    res.status(200).json(result[0]);
  });
});
router.get('/payroll/:id', (req, res) => {
  const teacherId = req.params.id;
  const schoolCode = req.query.schoolCode;

  console.log('📥 Incoming Request -> /payroll/:id');
  console.log('🧾 Params: teacherId =', teacherId);
  console.log('🧾 Query: schoolCode =', schoolCode);

  if (!schoolCode) {
    console.warn('⚠️ Missing schoolCode in query');
    return res.status(400).json({ error: 'Missing schoolCode query parameter' });
  }

  const db = createDynamicConnection(schoolCode);
  console.log('🔌 Database connection created for schoolCode:', schoolCode);

  const query = `
    SELECT 
      ta.*
    FROM teachers_attendance ta
    JOIN management_login_creation mlc
      ON ta.username = mlc.username
    WHERE mlc.id = ?;
  `;

  console.log('📄 Executing SQL Query:\n', query);
  console.log('📦 Query Params:', [teacherId]);

  db.query(query, [teacherId], (err, results) => {
    db.end();
    console.log('🔌 Database connection closed.');

    if (err) {
      console.error('❌ Error fetching attendance:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length > 0) {
      console.log(`✅ Found ${results.length} attendance record(s) for teacherId = ${teacherId}`);
      res.json(results);
    } else {
      console.warn(`❗ No attendance records found for teacherId = ${teacherId}`);
      res.status(404).json({ error: 'No attendance records found for this teacher ID' });
    }
  });
});




// POST /salary  (save calculated salary)
router.post('/salary', (req, res) => {
  console.log("🟢 ---- /salary API CALLED ----");

  try {
    console.log("📥 Received Request Body:", req.body);

    const {
      schoolCode,
      teacher_id,
      base_salary,
      deductions,
      bonuses,
      final_salary,
      salary_month,
      status,
      payment_date
    } = req.body;

    // VALIDATION CHECK
    console.log("🔍 Step 1: Validating fields...");

    if (!schoolCode) {
      console.log("❌ Validation Error: Missing schoolCode");
      return res.status(400).json({ message: 'schoolCode is required' });
    }

    if (!teacher_id || !base_salary || !final_salary || !salary_month) {
      console.log("❌ Validation Error: Required fields missing", {
        teacher_id,
        base_salary,
        final_salary,
        salary_month
      });
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // DB CONNECTION
    console.log(`🔌 Step 2: Creating DB connection for schoolCode = ${schoolCode}`);
    const db = createDynamicConnection(schoolCode);

    if (!db) {
      console.log("❌ ERROR: DB connection object is NULL");
      return res.status(500).json({ message: "DB connection failed" });
    }

    console.log("✅ DB connection created successfully.");

    // QUERY
    const query = `
      INSERT INTO bizpulse_teacher_calculated_salary 
      (teacher_id, base_salary, deductions, bonuses, final_salary, salary_month, status, payment_date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const values = [
      teacher_id,
      base_salary,
      deductions || 0.00,
      bonuses || 0.00,
      final_salary,
      salary_month,
      status || 'pending',
      payment_date || null
    ];

    console.log("📝 Step 3: Prepared SQL Query:\n", query);
    console.log("📌 Query Values:", values);

    // EXECUTE QUERY
    console.log("⏳ Step 4: Executing SQL query...");

    db.query(query, values, (err, results) => {

      console.log("🔌 Closing DB connection...");
      db.end();

      if (err) {
        console.log("❌ SQL ERROR:", err.sqlMessage || err);
        console.log("❌ SQL ERROR CODE:", err.code);
        console.log("❌ SQL ERROR STACK:", err.stack);
        return res.status(500).json({ message: 'Failed to save salary details.' });
      }

      console.log("✅ Step 5: Salary Saved Successfully!");
      console.log("🆔 Inserted Record ID:", results.insertId);

      res.json({
        message: 'Salary details saved successfully.',
        salary_calc_id: results.insertId
      });

      console.log("🏁 ---- END OF /salary API ----");
    });

  } catch (err) {
    console.log("🔥 CRITICAL ERROR in /salary POST:", err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});


module.exports = router;
