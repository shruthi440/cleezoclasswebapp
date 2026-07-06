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

    router.post('/create-category', async (req, res) => {
        const { category_name, from_year, to_year } = req.body;
      
        if (!category_name || !from_year || !to_year) {
            return res.status(400).send('All fields are required');
        }
      
        try {
            const query = `
                INSERT INTO categories (category_name, from_year, to_year) 
                VALUES (?, ?, ?)
            `;
            const [result] = await pool.query(query, [category_name, from_year, to_year]);
      
            const newCategory = {
                id: result.insertId,
                category_name,
                from_year,
                to_year,
                created_at: new Date()
            };
      
            res.status(201).json({ message: 'Category created successfully', category: newCategory });
        } catch (error) {
            console.error('Error creating category:', error);
            res.status(500).send('Failed to create category');
        }
      });
    module.exports = router;
