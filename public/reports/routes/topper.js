

// server.js
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const router = express.Router();

const app = express();
app.use(cors());

const db = mysql.createConnection({
  host: '162.215.210.38',
  user: 'root',
  password: 'NavyAtagsoLnovA@$000',
  database: 'NOVA'
});

router.get('/top-and-weak-students', (req, res) => {
  const { class: selectedClass, section: selectedSection } = req.query;

  console.log("📥 Received request for class:", selectedClass, "section:", selectedSection);

  if (!selectedClass || !selectedSection) {
    console.warn("⚠️ Missing class or section");
    return res.status(400).json({ error: "Class and Section are required" });
  }

  const query = `
    SELECT aps.name, aps.class_name, aps.section,
           ROUND(AVG(aps.marks), 2) AS avg_marks,
           mlc.photo
    FROM academic_performance_of_student AS aps
    LEFT JOIN management_login_creation AS mlc 
      ON TRIM(LOWER(aps.name)) = TRIM(LOWER(mlc.name))
    WHERE aps.class_name = ? AND aps.section = ?
    GROUP BY aps.name, aps.class_name, aps.section, mlc.photo
    ORDER BY avg_marks DESC
  `;

  db.query(query, [selectedClass, selectedSection], (err, results) => {
    if (err) {
      console.error('🔥 Database error:', err);
      return res.status(500).json({ error: "Internal Server Error", details: err.message });
    }

    console.log(`✅ Query successful. Found ${results.length} student(s).`);

    const resultsWithImages = results.map(student => {
      let image_url = null;

      if (student.photo) {
        image_url = `data:image/jpeg;base64,${student.photo.toString('base64')}`;
      }

      return {
        name: student.name,
        class_name: student.class_name,
        section: student.section,
        avg_marks: student.avg_marks,
        image_url: image_url
      };
    });

    const top5 = resultsWithImages.slice(0, 5);
    const bottom5 = resultsWithImages.slice(-5).reverse();

    return res.status(200).json({ top5, bottom5 });
  });
});

module.exports = router;


