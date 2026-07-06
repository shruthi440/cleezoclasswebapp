const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const cors = require('cors');

const app = express();
const port = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MySQL Connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // Replace with your MySQL password
  database: 'school_management', // Replace with your database name
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err.message);
    return;
  }
  console.log('Connected to MySQL database.');
});

// API Endpoint to Handle Budget Form Submission
app.post('/api/budget', (req, res) => {
  const data = req.body;

  const query = `
    INSERT INTO budget_plans (
      school_year, department_category, prepared_by, approved_by,
      tuition_fees, additional_fees, donations, fundraising_events,
      government_grants, other_income, teacher_salaries, admin_staff_salaries,
      support_staff_salaries, utilities, building_repair, grounds_maintenance,
      academic_materials, transport_costs, insurance, admin_costs,
      professional_development, marketing_expenses, miscellaneous_expenses
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    data.schoolYear,
    data.departmentCategory,
    data.preparedBy,
    data.approvedBy,
    data.tuitionFees,
    data.additionalFees,
    data.donations,
    data.fundraisingEvents,
    data.governmentGrants,
    data.otherIncome,
    data.teacherSalaries,
    data.adminStaffSalaries,
    data.supportStaffSalaries,
    data.utilities,
    data.buildingRepair,
    data.groundsMaintenance,
    data.academicMaterials,
    data.transportCosts,
    data.insurance,
    data.adminCosts,
    data.professionalDevelopment,
    data.marketingExpenses,
    data.miscellaneousExpenses,
  ];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Error inserting budget plan:', err.message);
      res.status(500).send('Error saving budget plan');
      return;
    }
    res.status(200).send({ message: 'Budget plan submitted successfully', id: result.insertId });
  });
});

// Start the Server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
