const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const router = express.Router();


const app = express();


// Middleware
app.use(cors());
app.use(bodyParser.json()); // for parsing application/json


// Helper function to handle empty or null values
const handleEmptyString = (str) => {
  // Return empty string if the value is null, undefined, or empty
  return str && str.trim() !== '' ? str : '';
};


// Helper function to validate costs
const validCost = (cost) => (isNaN(cost) ? 0 : parseFloat(cost));


// POST endpoint to submit the maintenance form
router.post('/submitMaintenancedata', (req, res) => {
  console.log("🔧 Incoming request body:", req.body);


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
    schoolCode,
  } = req.body;


  if (!schoolCode) {
    return res.status(400).json({ error: 'School code is required' });
  }


  const dbName = schoolCode;


  const db = mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: dbName,
  });


  db.connect((err) => {
    if (err) {
      console.error(`❌ Error connecting to DB '${dbName}':`, err);
      return res.status(500).json({ error: `Database connection error to ${dbName}` });
    }
    console.log(`✅ Connected to database: ${dbName}`);


    const handleEmptyString = (val) => {
      const clean = val === undefined || val === null || val === '' ? '' : val;
      console.log(`📦 handleEmptyString ->`, clean);
      return clean;
    };


    const validCost = (val) => {
      const cost = parseFloat(val);
      const final = isNaN(cost) ? 0 : cost;
      console.log(`💰 validCost(${val}) ->`, final);
      return final;
    };


    const formattedDate = maintenanceDate && maintenanceDate !== ''
      ? maintenanceDate
      : new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    console.log("📅 Maintenance Date Used:", formattedDate);


    const totalCost =
      validCost(electricCost) +
      validCost(securityCost) +
      validCost(itCost) +
      validCost(transportCost) +
      validCost(furnitureCost) +
      validCost(sportsCost);


    console.log("🧮 Total Cost Calculated: ", totalCost);


    const insertData = {
      electric_maintenance: handleEmptyString(electricMaintenance),
      electric_cost: validCost(electricCost),
      security_maintenance: handleEmptyString(securityAndSafety),
      security_cost: validCost(securityCost),
      it_maintenance: handleEmptyString(itAndTechnological),
      it_cost: validCost(itCost),
      transportation_maintenance: handleEmptyString(transportation),
      transport_cost: validCost(transportCost),
      furniture_maintenance: handleEmptyString(furnitureAndClassroom),
      furniture_cost: validCost(furnitureCost),
      sports_maintenance: handleEmptyString(sportsFacilities),
      sports_cost: validCost(sportsCost),
      maintenance_date: formattedDate,
      department: handleEmptyString(department),
      priority: handleEmptyString(priority),
      maintenance_type: handleEmptyString(maintenanceType),
      status: handleEmptyString(status),
      total_cost: totalCost,
    };


    // ✅ Log all fields clearly
    console.log("📤 Data going to be inserted into DB:");
    for (const [key, value] of Object.entries(insertData)) {
      console.log(`  ${key}:`, value);
    }


    const insertSQL = `INSERT INTO requests (
      electric_maintenance, electric_cost,
      security_maintenance, security_cost,
      it_maintenance, it_cost,
      transportation_maintenance, transport_cost,
      furniture_maintenance, furniture_cost,
      sports_maintenance, sports_cost,
      maintenance_date, department, priority,
      maintenance_type, status, total_cost
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;


    const values = Object.values(insertData);


    db.query(insertSQL, values, (err, result) => {
      if (err) {
        console.error('❌ Error inserting data into DB:', err);
        return res.status(500).json({ error: 'Database error while inserting data' });
      }


      console.log('✅ Record inserted successfully into DB. Insert ID:', result.insertId);


      // ⬇️ NOW do SELECT * FROM requests
      db.query('Select * from Accountant', (err, rows) => {
        if (err) {
          console.error('❌ Error fetching all data after insert:', err);
          return res.status(500).json({ error: 'Error fetching inserted records' });
        }


        console.log('📄 Current rows in `requests` table:');
        rows.forEach((row, index) => {
          console.log(`🔹 Row ${index + 1}:`, row);
        });


        res.status(200).json({
          message: 'Maintenance request submitted and verified!',
          insertedData: insertData,
          totalRows: rows.length,
          allRequests: rows,
          databaseUsed: dbName,
        });
      });
    });
  });
});





router.post('/Accountntdata', (req, res) => {
  const {
    expenseName,
    expenseType,
    description,
    paymentMode,
    paidAmount,
    balance,
    totalAmount,
    personName,
    mobileNumber,
    schoolCode
  } = req.body;


  console.log('\n📩 Incoming Request to /Accountntdata:');
  console.log('▶️ schoolCode:', schoolCode);
  console.log('▶️ description:', description);
  console.log('▶️ expenseName:', expenseName);
  console.log('▶️ totalAmount (price):', totalAmount);
  console.log('▶️ paymentMode:', paymentMode);
  console.log('▶️ paidAmount:', paidAmount);
  console.log('▶️ balance:', balance);
  console.log('▶️ personName:', personName);
  console.log('▶️ mobileNumber:', mobileNumber);
  console.log('▶️ expenseType:', expenseType);


  if (!schoolCode) {
    return res.status(400).json({ error: 'School code is required' });
  }


  const dbName = schoolCode;
  const db = mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: dbName,
  });


  db.connect((err) => {
    if (err) {
      console.error(`❌ Error connecting to DB '${dbName}':`, err);
      return res.status(500).json({ error: 'Database connection failed' });
    }


    console.log(`✅ Connected to DB '${dbName}'`);


    const expense_date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD


    const fields = [];
    const values = [];
    const placeholders = [];


    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }


    fields.push('description');
    values.push(description);
    placeholders.push('?');


    fields.push('expense_name');
    values.push(expenseName || null);
    placeholders.push('?');


    // ✅ Use only totalAmount for 'price'
    fields.push('price');
    values.push(totalAmount !== undefined ? parseFloat(totalAmount) : null);
    placeholders.push('?');


    fields.push('payment_mode');
    values.push(paymentMode ? paymentMode.toLowerCase() : null);
    placeholders.push('?');


    fields.push('paid_amount');
    values.push(paidAmount !== undefined ? parseFloat(paidAmount) : null);
    placeholders.push('?');


    fields.push('balance_amount');
    values.push(balance !== undefined ? parseFloat(balance) : null);
    placeholders.push('?');


    fields.push('expense_date');
    values.push(expense_date);
    placeholders.push('?');


    fields.push('expense_type');
    values.push(expenseType || null);
    placeholders.push('?');


    fields.push('person_name');
    values.push(personName || null);
    placeholders.push('?');


    fields.push('mobile_number');
    values.push(mobileNumber || null);
    placeholders.push('?');


    const insertQuery = `INSERT INTO Accountant (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`;


    console.log("📥 Final Insert Query:", insertQuery);
    console.log("📦 Final Values Array:", values);


    db.query(insertQuery, values, (err, result) => {
      if (err) {
        console.error('❌ Error inserting into Accountant:', err);
        return res.status(500).json({ error: 'Insert failed', sqlMessage: err.sqlMessage });
      }


      console.log('✅ Inserted into Accountant. ID:', result.insertId);
      res.status(200).json({
        message: '✅ Expense saved!',
        insertId: result.insertId
      });
    });
  });
});


router.get('/Accountentdataget', (req, res) => {
  const { schoolCode, fromDate, toDate } = req.query;

  console.log('\n📥 GET /api/Accountentdataget called');
  console.log('▶️ Received schoolCode:', schoolCode);
  console.log('▶️ Received fromDate:', fromDate);
  console.log('▶️ Received toDate:', toDate);

  if (!schoolCode) {
    return res.status(400).json({ error: 'School code is required' });
  }

  const dbName = schoolCode.trim().replace(/\s+/g, '_');
  const db = mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: dbName,
  });

  db.connect((err) => {
    if (err) {
      console.error(`❌ Failed to connect to DB '${dbName}':`, err);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    console.log(`✅ Connected to database '${dbName}'`);

    let selectQuery = `SELECT * FROM Accountant`;
    const conditions = [];
    const values = [];

    if (fromDate && toDate) {
      conditions.push('expense_date BETWEEN ? AND ?');
      values.push(fromDate, toDate);
    } else if (fromDate) {
      conditions.push('expense_date >= ?');
      values.push(fromDate);
    } else if (toDate) {
      conditions.push('expense_date <= ?');
      values.push(toDate);
    }

    if (conditions.length > 0) {
      selectQuery += ' WHERE ' + conditions.join(' AND ');
    }
    selectQuery += ' ORDER BY expense_date DESC';
    console.log("📄 Final SQL Query:", selectQuery);
    console.log("🔍 Parameters:", values);

    db.query(selectQuery, values, (err, results) => {
      if (err) {
        console.error('❌ Query failed:', err);
        return res.status(500).json({ error: 'Failed to fetch data', sqlMessage: err.sqlMessage });
      }

      console.log(`✅ ${results.length} record(s) fetched from Accountant table`);

      // ✨ Format result for frontend
      const formattedResults = results.map(row => ({
        date: row.expense_date,
        name: row.expense_name,
        type: row.expense_type,
        description: row.description,
        paymentMode: row.payment_mode
      }));

      res.status(200).json(formattedResults);
    });
  });
});




app.use('/api', router);



module.exports = router;