


const express = require('express');
const mysql = require('mysql');

const router = express.Router(); // Use Express Router

// ✅ Database Connection
const db = mysql.createConnection({
  host: '162.215.210.38',
  user: 'root',
  password: 'NavyAtagsoLnovA@$000',
  database: 'NOVA',
});

db.connect((err) => {
  if (err) {
    console.error('❌ Database connection failed:', err.stack);
    return;
  }
  console.log('✅ Connected SALARIES to MySQL database.');
});

// ✅ API: Get Salary Summary (with optional date filtering)
// router.get('/salary-sum', (req, res) => {
//   let { startDate, endDate, date } = req.query;
//   let query;
//   let params = [];

//   if (date) {
//     query = `
//       SELECT 
//         COALESCE(SUM(CASE WHEN status = 'paid' THEN salary_amount ELSE 0 END), 0) AS paidAmount,
//         COALESCE(SUM(CASE WHEN status = 'pending' THEN salary_amount ELSE 0 END), 0) AS unpaidAmount
//       FROM bizpulse_teacher_salary 
//       WHERE payment_date = ?`;
//     params.push(date);
//   } else if (startDate && endDate) {
//     query = `
//       SELECT 
//         COALESCE(SUM(CASE WHEN status = 'paid' THEN salary_amount ELSE 0 END), 0) AS paidAmount,
//         COALESCE(SUM(CASE WHEN status = 'pending' THEN salary_amount ELSE 0 END), 0) AS unpaidAmount
//       FROM bizpulse_teacher_salary 
//       WHERE payment_date BETWEEN ? AND ?`;
//     params.push(startDate, endDate);
//   } else {
//     query = `
//       SELECT 
//         COALESCE(SUM(CASE WHEN status = 'paid' THEN salary_amount ELSE 0 END), 0) AS paidAmount,
//         COALESCE(SUM(CASE WHEN status = 'pending' THEN salary_amount ELSE 0 END), 0) AS unpaidAmount
//       FROM bizpulse_teacher_salary`;
//   }

//   db.query(query, params, (err, results) => {
//     if (err) {
//       console.error('❌ Error fetching salary sums:', err);
//       return res.status(500).json({ error: 'Database query error' });
//     }
//     console.log('✅ Salary Data:', results[0]);
//     res.json(results[0]);
//   });
// });
router.get('/salary-sum', (req, res) => {
  const { startDate, endDate, date, schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: 'Missing schoolCode in request' });
  }

  const db = mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: schoolCode, // ✅ dynamic school DB
  });

  db.connect((err) => {
    if (err) {
      console.error('❌ DB connection failed:', err.message);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    let query1, query2;
    let params1 = [], params2 = [];

    if (date) {
      query1 = `
        SELECT 
          teacher_id,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN final_salary ELSE 0 END), 0) AS paidAmount,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN final_salary ELSE 0 END), 0) AS unpaidAmount
        FROM bizpulse_teacher_calculated_salary 
        WHERE payment_date = ?
        GROUP BY teacher_id`;
      params1.push(date);

      query2 = `
        SELECT 
          salary_calc_id,
          teacher_id,
          base_salary,
          deductions,
          bonuses,
          final_salary,
          salary_month,
          status,
          payment_date
        FROM bizpulse_teacher_calculated_salary 
        WHERE payment_date = ?`;
      params2.push(date);

    } else if (startDate && endDate) {
      query1 = `
        SELECT 
          teacher_id,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN final_salary ELSE 0 END), 0) AS paidAmount,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN final_salary ELSE 0 END), 0) AS unpaidAmount
        FROM bizpulse_teacher_calculated_salary 
        WHERE payment_date BETWEEN ? AND ?
        GROUP BY teacher_id`;
      params1.push(startDate, endDate);

      query2 = `
        SELECT 
          salary_calc_id,
          teacher_id,
          base_salary,
          deductions,
          bonuses,
          final_salary,
          salary_month,
          status,
          payment_date
        FROM bizpulse_teacher_calculated_salary 
        WHERE payment_date BETWEEN ? AND ?`;
      params2.push(startDate, endDate);

    } else {
      query1 = `
        SELECT 
          teacher_id,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN final_salary ELSE 0 END), 0) AS paidAmount,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN final_salary ELSE 0 END), 0) AS unpaidAmount
        FROM bizpulse_teacher_calculated_salary
        GROUP BY teacher_id`;

      query2 = `
        SELECT 
          salary_calc_id,
          teacher_id,
          base_salary,
          deductions,
          bonuses,
          final_salary,
          salary_month,
          status,
          payment_date
        FROM bizpulse_teacher_calculated_salary`;
    }

    db.query(query1, params1, (err1, results1) => {
      if (err1) {
        console.error('❌ Error fetching salary sums:', err1);
        db.end();
        return res.status(500).json({ error: 'Query error - salary sums' });
      }

      db.query(query2, params2, (err2, results2) => {
        db.end(); // ✅ close DB connection

        if (err2) {
          console.error('❌ Error fetching salary details:', err2);
          return res.status(500).json({ error: 'Query error - salary details' });
        }

        let paidAmount = 0;
        let unpaidAmount = 0;

        const teachers = results2.map((teacher) => {
          const totals = results1.find(item => item.teacher_id === teacher.teacher_id);
          if (totals) {
            paidAmount += totals.paidAmount;
            unpaidAmount += totals.unpaidAmount;
          }

          return {
            teacher_id: teacher.teacher_id,
            final_salary: teacher.final_salary,
            base_salary: teacher.base_salary,
            payment_date: teacher.payment_date,
            salary_month: teacher.salary_month,
          };
        });

        res.json({ paidAmount, unpaidAmount, teachers });
      });
    });
  });
});

module.exports = router; // ✅ Export the router
