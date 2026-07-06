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
    router.get("/classes/:from-:to", async (req, res) => {
        const { from, to } = req.params;
      
        try {
          const query = `
            SELECT DISTINCT class_name
            FROM management_login_creation
            WHERE YEAR(date) BETWEEN ? AND ?
            ORDER BY class_name ASC;
          `;
      
          const [rows] = await pool.query(query, [from, to]);
          
          // Send the array directly instead of wrapping it in an object
          const classes = rows.map((row) => row.class_name);
          res.json(classes);
      
        } catch (error) {
          console.error("Error fetching classes:", error);
          res.status(500).send("Internal Server Error");
        }
      });
      module.exports = router;
