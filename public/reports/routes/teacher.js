const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();
const router = express.Router();

app.use(cors());
app.use(express.json());

const dbConfig = {
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: 'SatyaTech',
};

// ✅ Use connection pool
const db = mysql.createPool(dbConfig).promise(); 

// Shuffle function
function shuffleArray(array) {
    return array.sort(() => Math.random() - 0.5);
}

router.get("/teachers", async (req, res) => {
    const sql = `
        SELECT 
            id, name AS teacher_name, designation AS subject,
            teaches_to_1, teaches_to_2, teaches_to_3, teaches_to_4, teaches_to_5
        FROM management_login_creation
        WHERE user_type = 'teacher';
    `;

    try {
        // ✅ Ensure teachers is an array
        const [rows] = await db.execute(sql);
        if (!rows || !Array.isArray(rows)) {
            return res.status(500).json({ error: "Unexpected database response" });
        }
        const teachers = rows;

        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const numPeriods = 5;
        let weeklyTimetable = {};

        for (let classNum = 1; classNum <= 10; classNum++) {
            weeklyTimetable[classNum] = {};
            days.forEach(day => {
                weeklyTimetable[classNum][day] = [];
            });
        }

        let teacherAvailability = {};
        teachers.forEach(teacher => {
            teacherAvailability[teacher.teacher_name] = { available: true, teachingDays: {} };
            days.forEach(day => {
                teacherAvailability[teacher.teacher_name].teachingDays[day] = new Set();
            });
        });

        days.forEach(day => {
            let periodOrder = shuffleArray([...Array(numPeriods).keys()].map(i => i + 1));

            teachers.forEach(teacher => {
                for (let i = 1; i <= 5; i++) {
                    const classNum = teacher[`teaches_to_${i}`];
                    if (classNum) {
                        let assignedPeriod = periodOrder[i - 1];

                        if (!teacherAvailability[teacher.teacher_name].teachingDays[day].has(assignedPeriod)) {
                            weeklyTimetable[classNum][day].push({
                                period: assignedPeriod,
                                subject: teacher.subject,
                                teacher: teacher.teacher_name
                            });

                            teacherAvailability[teacher.teacher_name].teachingDays[day].add(assignedPeriod);
                        }
                    }
                }
            });
        });

        Object.keys(weeklyTimetable).forEach(classNum => {
            days.forEach(day => {
                weeklyTimetable[classNum][day].sort((a, b) => a.period - b.period);
            });
        });

        res.json({ timetable: weeklyTimetable });

    } catch (err) {
        console.error("❌ Error fetching timetable:", err);
        return res.status(500).json({ error: "Database error" });
    }
});

module.exports = router;
