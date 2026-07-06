const express = require('express');
const mysql = require('mysql');
const router = express.Router();

function getDbConfigBySchoolCode(schoolcode) {
  // You can enhance this logic with mappings, environment variables, etc.
  return {
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: schoolcode || 'NOVA', // default to 'NOVA' if schoolcode not passed
  };
}

router.get('/totalcost', (req, res) => {
  console.log('Received request for total cost data');

  const { startDate, endDate, date, schoolCode } = req.query;
  const dbConfig = getDbConfigBySchoolCode(schoolCode);

  // Create connection dynamically
  const db = mysql.createConnection(dbConfig);

  db.connect((err) => {
    if (err) {
      console.error('Error connecting to the database:', err.message);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    console.log(`Connected to DB for schoolcode: ${schoolCode}`);

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

    console.log('Executing SQL query:', query);

    db.query(query, params, (err, result) => {
      db.end(); // Always close the connection

      if (err) {
        console.error('Error executing SQL query:', err.message);
        return res.status(500).json({ error: 'Failed to retrieve total cost data' });
      }

      const data = result[0];
      const responseData = {
        electric_cost: parseFloat(data.electric_cost),
        security_cost: parseFloat(data.security_cost),
        it_cost: parseFloat(data.it_cost),
        transport_cost: parseFloat(data.transport_cost),
        furniture_cost: parseFloat(data.furniture_cost),
        sports_cost: parseFloat(data.sports_cost),
        total_cost: parseFloat(data.total_cost),
      };

      console.log('Sent total cost data to frontend:', responseData);
      res.json(responseData);
    });
  });
});

module.exports = router;
