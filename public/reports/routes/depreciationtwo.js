const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');

const app = express();
const router = express.Router();

// Middleware to parse JSON requests
app.use(bodyParser.json());

// Function to create a MySQL connection based on the database name
const createConnection = (database) => mysql.createConnection({
  host: '162.215.210.38',
  user: 'root',
  password: 'NavyAtagsoLnovA@$000',
  database: database,
});

// Example data
const assetTypes = ['Laptop', 'Projector', 'Desk', 'Chair', 'Whiteboard'];
const depreciationRates = ['5%', '10%', '15%', '20%'];

// Endpoint for getting asset types
router.get('/assetTypes', (req, res) => {
  res.json(assetTypes);
});

// Endpoint for getting depreciation rates
router.get('/depreciationRates', (req, res) => {
  res.json(depreciationRates);
});

// Endpoint for submitting asset data and calculating depreciation
router.post('/submitAsset', (req, res) => {
  const { assetName, assetType, purchasePrice, depreciationRate, depreciationMethod, schoolCode } = req.body;

  // Create a connection with the database name directly from schoolCode
  const db = createConnection(schoolCode);

  db.connect((err) => {
    if (err) {
      console.error('Error connecting to the database:', err);
      return res.status(500).json({ message: 'Error connecting to the database' });
    }

    // Calculate depreciation based on selected method
    let depreciationValue = 0;
    const rate = parseFloat(depreciationRate.replace('%', '')) / 100;

    if (depreciationMethod === 'straight-line') {
      depreciationValue = purchasePrice * rate;
    } else if (depreciationMethod === 'declining-balance') {
      depreciationValue = purchasePrice * rate * 2; // Simplified calculation
    }

    // Send back a response with the schoolCode
    res.json({
      message: `Asset "${assetName}" with type "${assetType}" has a depreciation value of $${depreciationValue.toFixed(2)} for school ${schoolCode}.`,
    });
  });
});

module.exports = router;
