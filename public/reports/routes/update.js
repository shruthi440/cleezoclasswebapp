const express = require("express");
const mysql = require("mysql2/promise");   // ✅ Use promise-based MySQL
const cors = require("cors");
const bodyParser = require("body-parser");
const router = express.Router();
const app = express();
const PORT = 3010;

app.use(cors());
app.use(bodyParser.json());

// ✅ MySQL Connection with Pool
const pool = mysql.createPool({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: "SatyaTech",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection()
    .then(() => console.log("✅ Connected to MySQL database."))
    .catch((err) => console.error("❌ Database connection failed:", err));
    router.put('/update', async (req, res) => {
        const { fees, from_year, to_year } = req.body;
      
        if (!from_year || !to_year || !Array.isArray(fees) || fees.length === 0) {
          return res.status(400).send('Invalid fee data or missing years.');
        }
      
        const connection = await pool.getConnection();
      
        try {
          await connection.beginTransaction();
      
          for (const fee of fees) {
            const { class_name, fee_category, amount } = fee;
      
            // Check if the fee record exists for the selected years
            const checkQuery = `
              SELECT id FROM fees
              WHERE class_name = ? AND fee_category = ? AND from_year = ? AND to_year = ?
            `;
            
            const [existingFees] = await connection.query(checkQuery, [class_name, fee_category, from_year, to_year]);
      
            if (existingFees.length > 0) {
              // Update the existing fee for the given years
              const updateQuery = `
                UPDATE fees
                SET amount = ?
                WHERE class_name = ? AND fee_category = ? AND from_year = ? AND to_year = ?
              `;
              await connection.query(updateQuery, [amount, class_name, fee_category, from_year, to_year]);
      
            } else {
              // Insert new fee record with the selected years
              const insertQuery = `
                INSERT INTO fees (class_name, fee_category, amount, duration, from_year, to_year, category_id)
                VALUES (?, ?, ?, 'Annual', ?, ?, NULL)
              `;
              await connection.query(insertQuery, [class_name, fee_category, amount, from_year, to_year]);
            }
          }
      
          await connection.commit();
          res.status(200).send('Fees updated successfully');
        
        } catch (error) {
          await connection.rollback();
          console.error('Error updating fees:', error);
          res.status(500).send('Failed to update fees');
        
        } finally {
          connection.release();
        }
      });
      module.exports = router;
