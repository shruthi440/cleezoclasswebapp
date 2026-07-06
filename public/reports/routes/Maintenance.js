const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const router = express.Router();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());  // for parsing application/json

// MySQL database connection
const db = mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: 'NOVA',
});

db.connect((err) => {
  if (err) throw err;
  console.log('Connected to the database');
});

// Helper function to handle empty or null values
const handleEmptyString = (str) => {
  // Return empty string if the value is null, undefined, or empty
  return str && str.trim() !== '' ? str : '';
};

// POST endpoint to submit the maintenance form
router.post('/submitMaintenance', (req, res) => {
  const {
    electricMaintenance,
    electricCost,
    securityAndSafety,
    securityCost,
    itAndTechnological,
    itCost,
    transportation,
    transportCost,
    furnitureAndClassroom,
    furnitureCost,
    sportsFacilities,
    sportsCost,
    maintenanceDate,
    department,
    priority,
    maintenanceType,
    status,
  } = req.body;

  // Validate costs to avoid NaN and set defaults to 0
  const validCost = (cost) => (isNaN(cost) ? 0 : parseFloat(cost));

  // Calculate total cost
  const totalCost =
    validCost(electricCost) +
    validCost(securityCost) +
    validCost(itCost) +
    validCost(transportCost) +
    validCost(furnitureCost) +
    validCost(sportsCost);

  // Use helper function to replace empty strings with empty strings for optional fields
  const sql = `INSERT INTO requests (electric_maintenance, electric_cost, security_maintenance, security_cost, it_maintenance, it_cost, transportation_maintenance, transport_cost, furniture_maintenance, furniture_cost, sports_maintenance, sports_cost, maintenance_date, department, priority, maintenance_type, status, total_cost)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const values = [
    handleEmptyString(electricMaintenance),
    validCost(electricCost),
    handleEmptyString(securityAndSafety),
    validCost(securityCost),
    handleEmptyString(itAndTechnological),
    validCost(itCost),
    handleEmptyString(transportation),
    validCost(transportCost),
    handleEmptyString(furnitureAndClassroom),
    validCost(furnitureCost),
    handleEmptyString(sportsFacilities),
    validCost(sportsCost),
    maintenanceDate,
    department,
    priority,
    maintenanceType,
    status,
    totalCost,
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error inserting data:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    console.log('Record inserted:', result);
    res.status(200).json({ message: 'Maintenance request submitted successfully!' });
  });
});

module.exports = router;
