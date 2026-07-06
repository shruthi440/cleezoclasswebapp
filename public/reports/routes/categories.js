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
    database: "NOVA",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection()
    .then(() => console.log("✅ Connected to MySQL database."))
    .catch((err) => console.error("❌ Database connection failed:", err));
  
      router.get("/categories", async (req, res) => {
        const { fromYear, toYear } = req.query;
      
        console.log("Received query parameters:", { fromYear, toYear }); // 🔥 Log incoming query parameters
      
        if (!fromYear || !toYear) {
          console.log("Missing parameters: fromYear or toYear"); // 🔥 Log missing params
          return res.status(400).json({ error: "Both fromYear and toYear are required." });
        }
      
        try {
          const query = `
            SELECT * 
            FROM categories
            WHERE from_year <= ? AND to_year >= ?
            ORDER BY from_year ASC
          `;
      
          console.log("Executing SQL query:", query); // 🔥 Log the query being executed
      
          const [rows] = await pool.execute(query, [fromYear, toYear]);
      
          console.log("SQL query result:", rows); // 🔥 Log the query result
      
          if (rows.length > 0) {
            console.log(`Categories found: ${rows.length}`); // 🔥 Log the number of categories found
            res.json({ exists: true, categories: rows });
          } else {
            console.log("No categories found for the selected years."); // 🔥 Log when no categories are found
            res.json({ exists: false, categories: [] });
          }
        } catch (error) {
          console.error("Error fetching categories:", error); // 🔥 Log any SQL or server errors
          res.status(500).json({ error: "Failed to fetch categories" });
        }
      });
      module.exports = router;
