const express = require("express");
const mysql = require("mysql2/promise");   // ✅ Use promise-based MySQL
const cors = require("cors");
const bodyParser = require("body-parser");
const router = express.Router();
const app = express();

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

router.get('/category', async (req, res) => {
    try {
      const query = `
        SELECT * 
        FROM categories
        ORDER BY id ASC
      `;
  
      const [categories] = await pool.query(query);
  
      if (categories.length > 0) {
        res.json(categories);
      } else {
        res.status(404).send('No categories found.');
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).send('Internal Server Error');
    }
  });
  module.exports = router;
