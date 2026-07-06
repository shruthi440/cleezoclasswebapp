const express = require('express');
const mysql = require('mysql2/promise'); // Updated to use mysql2/promise
const app = express();
const PORT = 3010; // Change port if needed
const cors = require('cors');
const router = express.Router();

app.use(express.json()); // Optional: to parse JSON bodies
app.use(cors());

// Function to create a school-specific connection
async function getDatabaseConnection(schoolCode) {
  return await mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: schoolCode
  });
}

router.get('/top-3-students', async (req, res) => {
  const schoolCode = req.query.schoolCode || 'NOVA'; // from query param

  console.log(`[DEBUG] Starting /top-3-students endpoint`);
  console.log(`[DEBUG] Received schoolCode: ${schoolCode}`);

  try {
    const dynamicDb = await mysql.createConnection({
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
    console.log('[DEBUG] Executing query:', query.replace(/\s+/g, ' ').trim());

    const [results] = await dynamicDb.query(query);
    await dynamicDb.end();
    console.log('[DEBUG] Database connection closed');

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
  } catch (err) {
    console.error('❌ Error:', err);
    res.status(500).json({ 
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/totalcost', async (req, res) => {
  const { startDate, endDate, date, schoolCode } = req.query;
  console.log('Received request for total cost data:', { startDate, endDate, date, schoolCode });

  if (!schoolCode) {
    return res.status(400).json({ error: 'schoolCode is required' });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);

    let query = `
      SELECT 
        COALESCE(SUM(CAST(electric_cost AS DECIMAL(10,2))), 0) AS electric_cost,
        COALESCE(SUM(CAST(security_cost AS DECIMAL(10,2))), 0) AS security_cost,
        COALESCE(SUM(CAST(it_cost AS DECIMAL(10,2))), 0) AS it_cost,
        COALESCE(SUM(CAST(transport_cost AS DECIMAL(10,2))), 0) AS transport_cost,
        COALESCE(SUM(CAST(furniture_cost AS DECIMAL(10,2))), 0) AS furniture_cost,
        COALESCE(SUM(CAST(sports_cost AS DECIMAL(10,2))), 0) AS sports_cost,
        COALESCE(SUM(CAST(total_cost AS DECIMAL(10,2))), 0) AS total_cost
      FROM requests
    `;

    const params = [];

    if (startDate && endDate) {
      query += ` WHERE maintenance_date BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    } else if (date) {
      query += ` WHERE maintenance_date = ?`;
      params.push(date);
    }

    const [result] = await db.query(query, params);
    await db.end();

    const responseData = {
      electric_cost: parseFloat(result[0].electric_cost),
      security_cost: parseFloat(result[0].security_cost),
      it_cost: parseFloat(result[0].it_cost),
      transport_cost: parseFloat(result[0].transport_cost),
      furniture_cost: parseFloat(result[0].furniture_cost),
      sports_cost: parseFloat(result[0].sports_cost),
      total_cost: parseFloat(result[0].total_cost),
    };

    console.log('Successfully fetched total cost data');
    return res.json(responseData);

  } catch (err) {
    console.error('Error in /api/totalcost:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve total cost data' });
  }
});

// Total Expenses Endpoint
router.get('/totalexpenses', async (req, res) => {
  const { startDate, endDate, date, schoolCode } = req.query;
  console.log('Received request for total expenses:', { startDate, endDate, date, schoolCode });

  if (!schoolCode) {
    return res.status(400).json({ error: 'schoolCode is required' });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);

    let query = `
      SELECT 
        id,
        type,
        amount,
        quantity,
        total_cost,
        rent_type,
        vendor_type,
        vendor_name,
        vendor_contact,
        payment_method,
        date,
        description,
        COALESCE(SUM(CAST(amount AS DECIMAL(10,2))), 0) AS total_expenses
      FROM Expense
    `;

    const params = [];

    if (startDate && endDate) {
      query += ` WHERE date BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    } else if (date) {
      query += ` WHERE date = ?`;
      params.push(date);
    }

    query += ` GROUP BY id, type, amount, quantity, total_cost, rent_type, vendor_type, vendor_name, vendor_contact, payment_method, date, description`;

    const [results] = await db.query(query, params);
    await db.end();

    // Convert total_expenses to number
    const formattedResults = results.map(row => ({
      ...row,
      total_expenses: parseFloat(row.total_expenses)
    }));

    console.log('Successfully fetched expenses data');
    return res.json(formattedResults);

  } catch (err) {
    console.error('Error in /api/totalexpenses:', err.message);
    return res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// Endpoint to fetch total depreciation, considering date range
router.get('/totaldepreciation', async (req, res) => {
  const { startDate, endDate, date, schoolCode } = req.query;
  console.log('Received request for total depreciation:', { startDate, endDate, date, schoolCode });

  if (!schoolCode) {
    return res.status(400).json({ error: 'schoolCode is required' });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);

    let query = `
      SELECT 
        COALESCE(SUM(CAST(depreciationValue AS DECIMAL(10,2))), 0) AS total_depreciation
      FROM depreciation
    `;

    const params = [];

    if (startDate && endDate) {
      query += ` WHERE DATE(createDate) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    } else if (date) {
      query += ` WHERE DATE(createDate) = ?`;
      params.push(date);
    }

    const [result] = await db.query(query, params);
    await db.end();

    const responseData = {
      total_depreciation: parseFloat(result[0].total_depreciation)
    };

    console.log('Successfully fetched depreciation data');
    return res.json(responseData);

  } catch (err) {
    console.error('Error in /api/totaldepreciation:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve depreciation data' });
  }
});

router.get('/overall-income', async (req, res) => {
  const { date, startDate, endDate, schoolCode } = req.query;
  console.log("✅ Incoming Request:=============================", req.originalUrl);
  console.log("✅ Extracted Query Params:", { date, startDate, endDate, schoolCode });

  try {
    const db = await getDatabaseConnection(schoolCode);

    let query = `
      SELECT 
        (SELECT COALESCE(SUM(Final_Amount), 0) FROM FeesDetails WHERE Final_Amount IS NOT NULL AND StudentName IS NOT NULL AND Class_name IS NOT NULL AND Section IS NOT NULL) AS total_fee,
        (SELECT COALESCE(SUM(finalamount), 0) FROM school_income_student WHERE finalamount IS NOT NULL) AS total_income,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('Class_name', class_name, 'Section', section, 'StudentName', name, 'TypeOfPayment', typeofpayment, 'PaidAmount', paidamount))
         FROM school_income_student
         WHERE finalamount IS NOT NULL) AS other_income_details
    `;

    let queryParams = [];

    if (date) {
      query = `
        SELECT 
          (SELECT COALESCE(SUM(Final_Amount), 0) FROM FeesDetails WHERE DATE(created_at) = ? AND Final_Amount IS NOT NULL AND StudentName IS NOT NULL AND Class_name IS NOT NULL AND Section IS NOT NULL) AS total_fee,
          (SELECT COALESCE(SUM(finalamount), 0) FROM school_income_student WHERE DATE(created_at) = ? AND finalamount IS NOT NULL) AS total_income,
          (SELECT JSON_ARRAYAGG(JSON_OBJECT('StudentName', StudentName, 'Final_Amount', Final_Amount, 'Class_name', Class_name, 'Section', Section)) FROM FeesDetails WHERE DATE(created_at) = ? AND Final_Amount IS NOT NULL AND StudentName IS NOT NULL AND Class_name IS NOT NULL AND Section IS NOT NULL) AS student_details,
          (SELECT JSON_ARRAYAGG(JSON_OBJECT('Class_name', class_name, 'Section', section, 'StudentName', name, 'TypeOfPayment', typeofpayment, 'PaidAmount', paidamount)) FROM school_income_student WHERE DATE(created_at) = ? AND finalamount IS NOT NULL) AS other_income_details
      `;
      queryParams = [date, date, date, date];
    } else if (startDate && endDate) {
      query = `
        SELECT 
          (SELECT COALESCE(SUM(Final_Amount), 0) FROM FeesDetails WHERE DATE(created_at) BETWEEN ? AND ? AND Final_Amount IS NOT NULL AND StudentName IS NOT NULL AND Class_name IS NOT NULL AND Section IS NOT NULL) AS total_fee,
          (SELECT COALESCE(SUM(finalamount), 0) FROM school_income_student WHERE DATE(created_at) BETWEEN ? AND ? AND finalamount IS NOT NULL) AS total_income,
          (SELECT JSON_ARRAYAGG(JSON_OBJECT('StudentName', StudentName, 'Final_Amount', Final_Amount, 'Class_name', Class_name, 'Section', Section)) FROM FeesDetails WHERE DATE(created_at) BETWEEN ? AND ? AND Final_Amount IS NOT NULL AND StudentName IS NOT NULL AND Class_name IS NOT NULL AND Section IS NOT NULL) AS student_details,
          (SELECT JSON_ARRAYAGG(JSON_OBJECT('Class_name', class_name, 'Section', section, 'StudentName', name, 'TypeOfPayment', typeofpayment, 'PaidAmount', paidamount)) FROM school_income_student WHERE DATE(created_at) BETWEEN ? AND ? AND finalamount IS NOT NULL) AS other_income_details
      `;
      queryParams = [startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate];
    }

    const [results] = await db.query(query, queryParams);
    await db.end();

    const { total_fee, total_income, student_details, other_income_details } = results[0];

    let parsedStudentDetails = [];
    let parsedOtherIncomeDetails = [];

    try {
      parsedStudentDetails = student_details ? JSON.parse(student_details) : [];
      parsedOtherIncomeDetails = other_income_details ? JSON.parse(other_income_details) : [];
    } catch (parseErr) {
      console.error('❌ JSON Parse Error:', parseErr);
    }

    return res.json({
      totalFee: parseFloat(total_fee),
      totalIncome: parseFloat(total_income),
      overallIncome: parseFloat(total_fee) + parseFloat(total_income),
      studentDetails: parsedStudentDetails,
      otherIncomeDetails: parsedOtherIncomeDetails,
    });

  } catch (err) {
    console.error('❌ Database Error:', err);
    return res.status(500).json({ error: 'Database Operation Failed' });
  }
});

module.exports = router;