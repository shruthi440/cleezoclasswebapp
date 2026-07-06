const express = require('express');
const mysql = require('mysql');
const router = express.Router();

// Helper: Return database config for given schoolCode
function getDbConnection(schoolCode) {
  return mysql.createConnection({
    host: '50.6.194.240',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: schoolCode // Use schoolCode as DB name
  });
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

router.get('/profitloss', (req, res) => {
  const { startDate, endDate, schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: 'Missing schoolCode' });
  }

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date are required' });
  }

  const db = getDbConnection(schoolCode);

  db.connect((err) => {
    if (err) {
      console.error('Database connection error:', err.message);
      return res.status(500).json({ error: 'Failed to connect to the school database' });
    }

    // ===================================================================================
    // START: CORRECTED INCOME QUERY
    // This query now uses UNION ALL to combine income from different tables correctly.
    // This prevents the cross-join issue that was causing zero results.
    // ===================================================================================
    const incomeQuery = `
      SELECT
        MONTH(income_date) AS month,
        COALESCE(SUM(monthly_income), 0) AS total_income
      FROM (
        -- Income from student fees using the 'FeesDetails' table
        SELECT
          created_at AS income_date,
          CAST(UpdatedCompleteFee AS DECIMAL(10,2)) AS monthly_income
        FROM FeesDetails
        WHERE created_at BETWEEN ? AND ?

        UNION ALL

        -- Income from other student sources
        -- IMPORTANT: Confirm 'created_at' is the correct date column for this table
        SELECT
          created_at AS income_date,
          CAST(finalamount AS DECIMAL(10,2)) AS monthly_income
        FROM school_income_student
        WHERE created_at BETWEEN ? AND ?

        UNION ALL

        -- Income from other school sources (other + donation)
        -- IMPORTANT: Confirm 'created_at' is the correct date column for this table
        SELECT
          created_at AS income_date,
          (CAST(other_amount AS DECIMAL(10,2)) + CAST(donation_amount AS DECIMAL(10,2))) AS monthly_income
        FROM school_income
        WHERE created_at BETWEEN ? AND ?
      ) AS combined_income
      WHERE income_date IS NOT NULL
      GROUP BY month
      ORDER BY month;
    `;

    // ===================================================================================
    // START: CORRECTED EXPENSE QUERY
    // This query also uses UNION ALL to combine all expenses from different tables.
    // Each expense source is calculated independently before being summed.
    // ===================================================================================
    const expenseQuery = `
      SELECT
        MONTH(expense_date) AS month,
        SUM(total_amount) AS total_expense
      FROM (
        -- Salary expenses
        SELECT
          created_at AS expense_date,
          final_salary AS total_amount
        FROM bizpulse_teacher_calculated_salary
        WHERE created_at BETWEEN ? AND ?

        UNION ALL

        -- General entries
        SELECT
          created_at AS expense_date,
          amount AS total_amount
        FROM entries
        WHERE created_at BETWEEN ? AND ?

        UNION ALL

        -- Expense table (uses 'date' column)
        SELECT
          date AS expense_date,
          total_cost AS total_amount
        FROM Expense
        WHERE date BETWEEN ? AND ?

        UNION ALL

        -- Maintenance requests (uses 'maintenance_date')
        SELECT
          maintenance_date AS expense_date,
          total_cost AS total_amount
        FROM requests
        WHERE maintenance_date BETWEEN ? AND ?

        UNION ALL

        -- Bills (uses 'date' column)
        SELECT
          date AS expense_date,
          amount AS total_amount
        FROM bills
        WHERE date BETWEEN ? AND ?
      ) AS combined_expenses
      WHERE expense_date IS NOT NULL
      GROUP BY month
      ORDER BY month;
    `;

    // Execute income query with updated parameters
    db.query(incomeQuery, [
      startDate, endDate, // Parameters for FeesDetails
      startDate, endDate, // Parameters for school_income_student
      startDate, endDate  // Parameters for school_income
    ], (err, incomeResults) => {
      if (err) {
        console.error('Income query error:', err.message);
        db.end(); // Close connection on error
        return res.status(500).json({ error: 'Failed to retrieve income data' });
      }

      // Execute expense query with updated parameters
      db.query(expenseQuery, [
        startDate, endDate, // Parameters for salaries
        startDate, endDate, // Parameters for entries
        startDate, endDate, // Parameters for Expense
        startDate, endDate, // Parameters for requests
        startDate, endDate  // Parameters for bills
      ], (err, expenseResults) => {
        if (err) {
          console.error('Expense query error:', err.message);
          db.end(); // Close connection on error
          return res.status(500).json({ error: 'Failed to retrieve expense data' });
        }

        // This logic for combining results remains the same
        let financialData = Array(12).fill().map((_, index) => ({
          month: index + 1,
          monthName: monthNames[index],
          income: 0,
          expense: 0,
          profitOrLoss: 0
        }));

        incomeResults.forEach(row => {
          if (row.month >= 1 && row.month <= 12) {
            financialData[row.month - 1].income = row.total_income;
          }
        });

        expenseResults.forEach(row => {
          if (row.month >= 1 && row.month <= 12) {
            financialData[row.month - 1].expense = row.total_expense;
          }
        });

        financialData.forEach(data => {
          data.profitOrLoss = data.income - data.expense;
        });

        res.json(financialData);
        db.end(); // Close DB connection after all queries are successful
      });
    });
  });
});

module.exports = router;