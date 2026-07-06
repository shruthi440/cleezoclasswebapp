const express = require('express');
const mysql = require('mysql');

// Create Router for overall-income
const router = express.Router();

// Database Connection
const db = mysql.createConnection({
  host: '162.215.210.38',
  user: 'root',
  password: 'NavyAtagsoLnovA@$000',
  database: 'NOVA',
});

db.connect((err) => {
  if (err) {
    console.error('❌ Database Connection Error:', err);
  } else {
    console.log('✅ Feesmanag Database Connected');
  }
});

// API to Fetch Overall Income Data based on date or date range
router.get('/overall-income', (req, res) => {
  const { date, startDate, endDate } = req.query;

  let query = `
    SELECT 
      (SELECT COALESCE(SUM(Final_Amount), 0) FROM FeesDetails WHERE Final_Amount IS NOT NULL AND StudentName IS NOT NULL AND Class_name IS NOT NULL AND Section IS NOT NULL) AS total_fee,
      (SELECT COALESCE(SUM(finalamount), 0) FROM school_income_student WHERE finalamount IS NOT NULL) AS total_income,
      
      -- Fetch Other Income Details
      (SELECT JSON_ARRAYAGG(JSON_OBJECT('Class_name', class_name, 'Section', section, 'StudentName', name, 'TypeOfPayment', typeofpayment, 'PaidAmount', paidamount))
       FROM school_income_student
       WHERE finalamount IS NOT NULL) AS other_income_details
  `;

  if (date) {
    query = `
      SELECT 
        (SELECT COALESCE(SUM(Final_Amount), 0) 
         FROM FeesDetails 
         WHERE DATE(created_at) = ? 
         AND Final_Amount IS NOT NULL 
         AND StudentName IS NOT NULL 
         AND Class_name IS NOT NULL 
         AND Section IS NOT NULL) AS total_fee,
        
        (SELECT COALESCE(SUM(finalamount), 0) 
         FROM school_income_student 
         WHERE DATE(created_at) = ? 
         AND finalamount IS NOT NULL) AS total_income,

        (SELECT JSON_ARRAYAGG(JSON_OBJECT('StudentName', StudentName, 'Final_Amount', Final_Amount, 'Class_name', Class_name, 'Section', Section))
         FROM FeesDetails 
         WHERE DATE(created_at) = ? 
         AND Final_Amount IS NOT NULL 
         AND StudentName IS NOT NULL 
         AND Class_name IS NOT NULL 
         AND Section IS NOT NULL) AS student_details,

        -- Fetch Other Income Details for Specific Date
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('Class_name', class_name, 'Section', section, 'StudentName', name, 'TypeOfPayment', typeofpayment, 'PaidAmount', paidamount))
         FROM school_income_student
         WHERE DATE(created_at) = ? 
         AND finalamount IS NOT NULL) AS other_income_details
    `;
    db.query(query, [date, date, date, date], (err, results) => {
      if (err) {
        console.error('❌ Error Fetching Income Data:', err);
        return res.status(500).json({ error: 'Database Error' });
      }

      const { total_fee, total_income, student_details, other_income_details } = results[0];

      let parsedStudentDetails = [];
      let parsedOtherIncomeDetails = [];

      try {
        parsedStudentDetails = student_details ? JSON.parse(student_details) : [];
        parsedOtherIncomeDetails = other_income_details ? JSON.parse(other_income_details) : [];
      } catch (parseError) {
        console.error('❌ Error Parsing Details:', parseError);
      }

      return res.json({
        totalFee: total_fee,
        totalIncome: total_income,
        overallIncome: total_fee + total_income,
        studentDetails: parsedStudentDetails,
        otherIncomeDetails: parsedOtherIncomeDetails, // Include other income details
      });
    });
  } else if (startDate && endDate) {
    query = `
      SELECT 
        (SELECT COALESCE(SUM(Final_Amount), 0) 
         FROM FeesDetails 
         WHERE DATE(created_at) BETWEEN ? AND ? 
         AND Final_Amount IS NOT NULL 
         AND StudentName IS NOT NULL 
         AND Class_name IS NOT NULL 
         AND Section IS NOT NULL) AS total_fee,
        
        (SELECT COALESCE(SUM(finalamount), 0) 
         FROM school_income_student 
         WHERE DATE(created_at) BETWEEN ? AND ? 
         AND finalamount IS NOT NULL) AS total_income,

        (SELECT JSON_ARRAYAGG(JSON_OBJECT('StudentName', StudentName, 'Final_Amount', Final_Amount, 'Class_name', Class_name, 'Section', Section))
         FROM FeesDetails 
         WHERE DATE(created_at) BETWEEN ? AND ? 
         AND Final_Amount IS NOT NULL 
         AND StudentName IS NOT NULL 
         AND Class_name IS NOT NULL 
         AND Section IS NOT NULL) AS student_details,

        -- Fetch Other Income Details for Date Range
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('Class_name', class_name, 'Section', section, 'StudentName', name, 'TypeOfPayment', typeofpayment, 'PaidAmount', paidamount))
         FROM school_income_student
         WHERE DATE(created_at) BETWEEN ? AND ? 
         AND finalamount IS NOT NULL) AS other_income_details
    `;
    db.query(query, [startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate], (err, results) => {
      if (err) {
        console.error('❌ Error Fetching Income Data:', err);
        return res.status(500).json({ error: 'Database Error' });
      }

      const { total_fee, total_income, student_details, other_income_details } = results[0];

      let parsedStudentDetails = [];
      let parsedOtherIncomeDetails = [];

      try {
        parsedStudentDetails = student_details ? JSON.parse(student_details) : [];
        parsedOtherIncomeDetails = other_income_details ? JSON.parse(other_income_details) : [];
      } catch (parseError) {
        console.error('❌ Error Parsing Details:', parseError);
      }

      return res.json({
        totalFee: total_fee,
        totalIncome: total_income,
        overallIncome: total_fee + total_income,
        studentDetails: parsedStudentDetails,
        otherIncomeDetails: parsedOtherIncomeDetails, // Include other income details
      });
    });
  } else {
    db.query(query, (err, results) => {
      if (err) {
        console.error('❌ Error Fetching Income Data:', err);
        return res.status(500).json({ error: 'Database Error' });
      }

      const { total_fee, total_income, student_details, other_income_details } = results[0];

      let parsedStudentDetails = [];
      let parsedOtherIncomeDetails = [];

      try {
        parsedStudentDetails = student_details ? JSON.parse(student_details) : [];
        parsedOtherIncomeDetails = other_income_details ? JSON.parse(other_income_details) : [];
      } catch (parseError) {
        console.error('❌ Error Parsing Details:', parseError);
      }

      return res.json({
        totalFee: total_fee,
        totalIncome: total_income,
        overallIncome: total_fee + total_income,
        studentDetails: parsedStudentDetails,
        otherIncomeDetails: parsedOtherIncomeDetails, // Include other income details
      });
    });
  }
});

// Export the router
module.exports = router;
