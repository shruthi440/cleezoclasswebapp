const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 5000;
const router = express.Router();
// Middleware to parse JSON requests
app.use(bodyParser.json());

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
  const { assetName, assetType, purchasePrice, depreciationRate, depreciationMethod, manualInput } = req.body;

  // Calculate depreciation based on selected method
  let depreciationValue = 0;

  const rate = parseFloat(depreciationRate.replace('%', '')) / 100;

  if (depreciationMethod === 'straight-line') {
    depreciationValue = purchasePrice * rate;
  } else if (depreciationMethod === 'declining-balance') {
    depreciationValue = purchasePrice * rate * 2; // Simplified calculation
  }

  res.json({
    message: `Asset "${assetName}" with type "${assetType}" has a depreciation value of $${depreciationValue.toFixed(2)}.`,
  });
});

module.exports=router;