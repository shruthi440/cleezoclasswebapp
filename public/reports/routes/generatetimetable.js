const express = require('express');
const mysql = require('mysql2/promise');
const router = express.Router();
let db;

// HELPER: Connect to a specific DB
const getDBConnection = async (schoolCode) => {
    try {
        console.log(`🔌 Attempting to connect to DB: ${schoolCode}`);
        const connection = await mysql.createConnection({
            host: '162.215.210.38',
            user: 'root',
            password: 'NavyAtagsoLnovA@$000',
            database: schoolCode,
        });
        console.log(`✅ Connected to DB: ${schoolCode}`);
        return connection;
    } catch (err) {
        console.error(`❌ Failed to connect to DB: ${schoolCode}`, err.message);
        throw err;
    }
};

// Middleware to ensure DB is connected
const ensureDB = (req, res, next) => {
    if (!db) {
        console.log("⚠️ DB middleware: Database not initialized");
        return res.status(500).json({
            message: "❌ Database not initialized. Use /school-init first."
        });
    }
    req.db = db;
    next();
};

// Distribute subjects in timetable
function distributeSubjectsInTimetable(timetable) {
    for (const className in timetable) {
        for (const section in timetable[className]) {
            for (const day in timetable[className][section]) {
                const dayPeriods = timetable[className][section][day];
                for (let i = 0; i < dayPeriods.length; i++) {
                    const period = dayPeriods[i];
                    if (!period.period || typeof period.subject !== 'string') continue;
                    const subjects = period.subject.split(',').map(s => s.trim());
                    if (subjects.length > 1) {
                        period.subject = subjects[0];
                        const remainingSubjects = subjects.slice(1);
                        for (let j = 0; j < dayPeriods.length && remainingSubjects.length > 0; j++) {
                            const candidate = dayPeriods[j];
                            if (candidate.period && candidate.subject === "Free Period" && candidate.teacher === "Not Assigned") {
                                candidate.subject = remainingSubjects.shift();
                                candidate.teacher = period.teacher;
                            }
                        }
                    }
                }
            }
        }
    return timetable;
}
}
// Get available teacher for a subject
function getAvailableTeacher(periodSubject, assignedTeachers, relevantTeachers) {
    for (const teacherData of relevantTeachers) {
        if (teacherData.subject === periodSubject && !assignedTeachers.has(teacherData.teacher)) {
            return teacherData.teacher;
        }
    }
    return null;
}

// Fetch teacher subjects from DB
async function getTeacherSubjects(db) {
    const sql = `
        SELECT name AS teacher_name, designation AS subject,
               teaches_to_1, teaches_to_2, teaches_to_3, teaches_to_4, teaches_to_5
        FROM management_login_creation
        WHERE user_type = 'teacher';
    `;
    try {
        const [rows] = await db.execute(sql);
        let teacherSubjects = [];
        rows.forEach(row => {
            for (let i = 1; i <= 5; i++) {
                const classId = row[`teaches_to_${i}`];
                if (classId !== null) {
                    teacherSubjects.push({
                        teacher: row.teacher_name,
                        subject: row.subject,
                        class_id: classId
                    });
                }
            }
        });
        return teacherSubjects;
    } catch (error) {
        console.error("❌ Error fetching teacher subjects:", error);
        throw error;
    }
}

// Shuffle array
function shuffleArray(array) {
    return array.sort(() => Math.random() - 0.5);
}

// Format time
function formatTime(minutes) {
    let hours = Math.floor(minutes / 60);
    let mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Calculate period times
function calculatePeriodTimes(
    startTime,
    periodDuration,
    numberOfPeriods,
    morningIntervalDuration,
    morningIntervalAfter,
    lunchIntervalDuration,
    lunchIntervalAfter,
    afternoonIntervalDuration,
    afternoonIntervalAfter
) {
    if (!startTime) return [];
    let [hours, minutes] = startTime.split(":").map(Number);
    let currentMinutes = hours * 60 + minutes;
    let timetable = [];
    const formatTime = (mins) => {
        let h = Math.floor(mins / 60) % 24;
        let m = mins % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };
    for (let i = 1; i <= numberOfPeriods; i++) {
        let periodStart = formatTime(currentMinutes);
        currentMinutes += periodDuration;
        let periodEnd = formatTime(currentMinutes);
        timetable.push({
            type: "period",
            period: i,
            startTime: periodStart,
            endTime: periodEnd,
        });
        if (morningIntervalDuration > 0 && i === morningIntervalAfter) {
            let breakStart = periodEnd;
            currentMinutes += morningIntervalDuration;
            let breakEnd = formatTime(currentMinutes);
            timetable.push({
                type: "break",
                name: "Morning Break",
                startTime: breakStart,
                endTime: breakEnd,
            });
        }
        if (lunchIntervalDuration > 0 && i === lunchIntervalAfter) {
            let breakStart = periodEnd;
            currentMinutes += lunchIntervalDuration;
            let breakEnd = formatTime(currentMinutes);
            timetable.push({
                type: "break",
                name: "Lunch Break",
                startTime: breakStart,
                endTime: breakEnd,
            });
        }
        if (afternoonIntervalDuration > 0 && i === afternoonIntervalAfter) {
            let breakStart = periodEnd;
            currentMinutes += afternoonIntervalDuration;
            let breakEnd = formatTime(currentMinutes);
            timetable.push({
                type: "break",
                name: "Afternoon Break",
                afterPeriod: i,
                startTime: breakStart,
                endTime: breakEnd,
            });
        }
    }
    return timetable;
}

// Save weekly timetable to DB
async function saveWeeklyTimetable(db, weeklyTimetable, lunchBreakTimeMap) {
    const query = `
        INSERT INTO UniqueTimetable (
            class_id, section_id, day,
            morning_interval_time, lunch_interval_time, afternoon_interval_time, evening_interval_time,
            period_1_subject, period_1_from_time, period_1_to_time,
            period_2_subject, period_2_from_time, period_2_to_time,
            period_3_subject, period_3_from_time, period_3_to_time,
            period_4_subject, period_4_from_time, period_4_to_time,
            period_5_subject, period_5_from_time, period_5_to_time,
            period_6_subject, period_6_from_time, period_6_to_time,
            period_7_subject, period_7_from_time, period_7_to_time,
            period_8_subject, period_8_from_time, period_8_to_time,
            period_9_subject, period_9_from_time, period_9_to_time,
            period_10_subject, period_10_from_time, period_10_to_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    for (let class_id in weeklyTimetable) {
        for (let section in weeklyTimetable[class_id]) {
            for (let day in weeklyTimetable[class_id][section]) {
                const timetable = weeklyTimetable[class_id][section][day];
                if (!timetable || timetable.length === 0) continue;
                const section_id = timetable[0]?.section || "Unknown";
                const formattedTimetable = Array.from({ length: 10 }, (_, i) => ({
                    subject: timetable[i]?.subject || "Free Period",
                    from_time: timetable[i]?.startTime || null,
                    to_time: timetable[i]?.endTime || null
                }));
                const values = [
                    class_id, section_id, day,
                    "09:30 AM",
                    lunchBreakTimeMap?.[class_id]?.[section]?.[day] || "12:30 PM",
                    "03:00 PM", "05:00 PM",
                    ...formattedTimetable.flatMap(p => [p.subject, p.from_time, p.to_time])
                ];
                try {
                    await db.query(query, values);
                } catch (err) {
                    console.error(`❌ Error saving timetable for ${class_id}, Section ${section}, Day ${day}:`, err);
                }
            }
        }
    }
}

// ROUTES

/**
 * GET /getteacher
 * Fetches teachers based on schoolCode
 */
router.get("/getteacher", async (req, res) => {
    const schoolCode = req.query.schoolCode;
    if (!schoolCode) {
        return res.status(400).json({ message: "schoolCode is required" });
    }
    try {
        const db = await getDBConnection(schoolCode);
        const sql = `
            SELECT id, name AS teacher_name, designation AS subject,
                   teaches_to_1, teaches_to_2, teaches_to_3, teaches_to_4, teaches_to_5
            FROM management_login_creation
            WHERE user_type = 'teacher';
        `;
        const [teachers] = await db.execute(sql);
        await db.end();
        if (!teachers || teachers.length === 0) {
            return res.status(404).json({ message: "No teachers found" });
        }
        res.json(teachers);
    } catch (error) {
        console.error("Error fetching teachers:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

/**
 * POST /school-init
 * Switches the global DB connection dynamically
 */
router.post('/school-init', async (req, res) => {
    const { schoolCode } = req.body;
    if (!schoolCode) {
        return res.status(400).json({ message: 'schoolCode is required in request body' });
    }
    try {
        db = await getDBConnection(schoolCode);
        const [tables] = await db.query('SHOW TABLES');
        res.json({ message: `✅ Connected to ${schoolCode}`, tables });
    } catch (err) {
        console.error('❌ Error initializing school database:', err.message);
        res.status(500).json({ message: 'Failed to initialize school database', error: err.message });
    }
});

/**
 * POST /generatetimetable
 * Generates and saves timetable using the active DB connection
 */
router.post('/generatetimetable', ensureDB, async (req, res) => {
    const db = req.db;
    try {
        const {
            classes,
            startTime,
            periodDuration,
            numberOfPeriods,
            morningIntervalDuration,
            morningIntervalAfter,
            lunchIntervalDuration,
            lunchIntervalAfter,
            afternoonIntervalDuration,
            afternoonIntervalAfter,
            customActivities
        } = req.body;

        // Validate request body
        if (!classes || !Array.isArray(classes) || classes.length === 0) {
            return res.status(400).json({ message: "Classes array is required and must not be empty." });
        }
        if (!startTime || !periodDuration || !numberOfPeriods) {
            return res.status(400).json({ message: "startTime, periodDuration, and numberOfPeriods are required." });
        }

        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const teacherSubjectsFromDB = await getTeacherSubjects(db);
        let teacherSubjects = [...teacherSubjectsFromDB];

        // Hardcoded subjects and teachers for specific classes
        const nurserySubjects = [
            { class_id: "Nursery", subject: "Rhymes & Songs", teacher: "Anitha" },
            { class_id: "Nursery", subject: "Story Time", teacher: "Kavitha" },
            { class_id: "Nursery", subject: "Drawing & Coloring", teacher: "Sunil" },
            { class_id: "Nursery", subject: "Numbers (Pre-Maths)", teacher: "Ramesh" },
            { class_id: "Nursery", subject: "Alphabet (Pre-English)", teacher: "Anitha" },
            { class_id: "Nursery", subject: "Play Activities", teacher: "Priya" },
            { class_id: "Nursery", subject: "Physical Play", teacher: "Suresh" }
        ];
        const lkgSubjects = [
            { class_id: "LKG", subject: "English", teacher: "Anitha" },
            { class_id: "LKG", subject: "Maths", teacher: "Ramesh" },
            { class_id: "LKG", subject: "Rhymes & Storytelling", teacher: "Kavitha" },
            { class_id: "LKG", subject: "Drawing & Craft", teacher: "Sunil" },
            { class_id: "LKG", subject: "Environmental Awareness", teacher: "Priya" },
            { class_id: "LKG", subject: "Physical Education", teacher: "Suresh" },
            { class_id: "LKG", subject: "Moral Values", teacher: "Lakshmi" }
        ];
        const ukgSubjects = [
            { class_id: "UKG", subject: "English", teacher: "Anitha" },
            { class_id: "UKG", subject: "Maths", teacher: "Ramesh" },
            { class_id: "UKG", subject: "General Knowledge", teacher: "Kavitha" },
            { class_id: "UKG", subject: "Rhymes & Storytelling", teacher: "Sunil" },
            { class_id: "UKG", subject: "Drawing & Handwriting", teacher: "Priya" },
            { class_id: "UKG", subject: "Physical Education", teacher: "Suresh" },
            { class_id: "UKG", subject: "Moral Science", teacher: "Lakshmi" }
        ];
        const class3Subjects = [
            { class_id: 3, subject: "Telugu", teacher: "Revathi" },
            { class_id: 3, subject: "Maths", teacher: "Satish" },
            { class_id: 3, subject: "Physical Science", teacher: "Reshma" },
            { class_id: 3, subject: "English", teacher: "Priya" },
            { class_id: 3, subject: "Social", teacher: "Anita" },
            { class_id: 3, subject: "EVS", teacher: "Suman" },
            { class_id: 3, subject: "Science", teacher: "Madhavi" }
        ];
        const class4Subjects = [
            { class_id: 4, subject: "Telugu", teacher: "Kiran" },
            { class_id: 4, subject: "Maths", teacher: "Divya" },
            { class_id: 4, subject: "Science", teacher: "Ramesh" },
            { class_id: 4, subject: "English", teacher: "Sunitha" },
            { class_id: 4, subject: "Social", teacher: "Raj" },
            { class_id: 4, subject: "EVS", teacher: "Aruna" },
            { class_id: 4, subject: "Physical Science", teacher: "Reshma" }
        ];
        const class5Subjects = [
            { class_id: 5, subject: "Telugu", teacher: "Manoj" },
            { class_id: 5, subject: "Maths", teacher: "Deepa" },
            { class_id: 5, subject: "Science", teacher: "Madhavi" },
            { class_id: 5, subject: "English", teacher: "Lakshmi" },
            { class_id: 5, subject: "Social", teacher: "Vijay" },
            { class_id: 5, subject: "EVS", teacher: "Kavya" },
            { class_id: 5, subject: "Physical Science", teacher: "Reshma" }
        ];
        const subjectTeacherMap = [
            { subject: "Telugu", teacher: "Ravi" },
            { subject: "Maths", teacher: "Anjali" },
            { subject: "Science", teacher: "Suresh" },
            { subject: "English", teacher: "Meena" },
            { subject: "Social", teacher: "Aravind" },
            { subject: "EVS", teacher: "Kalyani" },
            { subject: "Computer", teacher: "Prakash" }
        ];

        teacherSubjects.push(...nurserySubjects, ...lkgSubjects, ...ukgSubjects, ...class3Subjects, ...class4Subjects, ...class5Subjects);
        for (let classId = 6; classId <= 10; classId++) {
            subjectTeacherMap.forEach(st => {
                teacherSubjects.push({
                    class_id: classId,
                    subject: st.subject,
                    teacher: st.teacher
                });
            });
        }

        if (!teacherSubjects || teacherSubjects.length === 0) {
            return res.status(400).json({ message: "No teacher subjects found after populating." });
        }

        let weeklyTimetable = {};
        const lastDaySecondPeriodSubject = {};

        for (const classObj of classes) {
            const { class_name, sections } = classObj;
            weeklyTimetable[class_name] = {};
            const sectionLabels = Array.from({ length: sections }, (_, i) => String.fromCharCode(65 + i));
            const relevantTeachers = teacherSubjects.filter(ts => String(ts.class_id) === String(class_name));
            const uniqueSubjects = [...new Map(relevantTeachers.map(ts => [ts.subject, ts])).values()];
            const periodTimes = calculatePeriodTimes(
                startTime,
                periodDuration,
                numberOfPeriods,
                morningIntervalDuration,
                morningIntervalAfter,
                lunchIntervalDuration,
                lunchIntervalAfter,
                afternoonIntervalDuration,
                afternoonIntervalAfter
            );

            for (const section of sectionLabels) {
                const sectionKey = `Section ${section}`;
                weeklyTimetable[class_name][sectionKey] = {};
                lastDaySecondPeriodSubject[class_name] = lastDaySecondPeriodSubject[class_name] || {};
                lastDaySecondPeriodSubject[class_name][sectionKey] = null;
                const fixedSubjectForSection = shuffleArray([...uniqueSubjects])[0];

                for (const day of days) {
                    weeklyTimetable[class_name][sectionKey][day] = [];
                    let dailySubjects = shuffleArray([...uniqueSubjects]);
                    let lastAssignedSubject = null;
                    let currentDaySecondPeriodSubject = null;

                    for (const slot of periodTimes) {
                        if (slot.type === "break") {
                            weeklyTimetable[class_name][sectionKey][day].push({
                                interval: slot.name,
                                teacher: "N/A",
                                startTime: slot.startTime,
                                endTime: slot.endTime,
                                section
                            });
                            continue;
                        }

                        let subject, teacher;
                        const period = slot.period;
                        if (period === 1) {
                            subject = fixedSubjectForSection.subject;
                            teacher = fixedSubjectForSection.teacher;
                        } else {
                            let subjectEntry;
                            const remainingDailySubjects = dailySubjects.filter(s => s.subject !== lastAssignedSubject);
                            let candidateSubjects = [...remainingDailySubjects];
                            if (period === 2) {
                                candidateSubjects = candidateSubjects.filter(s => s.subject !== lastDaySecondPeriodSubject[class_name][sectionKey]);
                            }
                            if (candidateSubjects.length > 0) {
                                subjectEntry = shuffleArray(candidateSubjects)[0];
                                const indexToRemove = dailySubjects.findIndex(s => s.subject === subjectEntry.subject);
                                if (indexToRemove !== -1) {
                                    dailySubjects.splice(indexToRemove, 1);
                                }
                            } else {
                                subjectEntry = dailySubjects.shift();
                                if (!subjectEntry) {
                                    subjectEntry = shuffleArray([...uniqueSubjects])[0];
                                }
                            }
                            subject = subjectEntry.subject;
                            teacher = subjectEntry.teacher;
                        }

                        lastAssignedSubject = subject;
                        if (period === 2) {
                            currentDaySecondPeriodSubject = subject;
                        }

                        weeklyTimetable[class_name][sectionKey][day].push({
                            period,
                            subject,
                            teacher,
                            startTime: slot.startTime,
                            endTime: slot.endTime,
                            section
                        });
                    }

                    lastDaySecondPeriodSubject[class_name][sectionKey] = currentDaySecondPeriodSubject;

                    if (customActivities && Array.isArray(customActivities)) {
                        customActivities.forEach(({ activity, day: actDay, period: actPeriod, class_name: actClass }) => {
                            if (day === actDay && String(class_name) === String(actClass)) {
                                const slotIndex = weeklyTimetable[class_name][sectionKey][day].findIndex(p => p.period === Number(actPeriod));
                                if (slotIndex !== -1) {
                                    weeklyTimetable[class_name][sectionKey][day][slotIndex].subject = activity;
                                    weeklyTimetable[class_name][sectionKey][day][slotIndex].teacher = "Custom";
                                }
                            }
                        });
                    }
                }
            }
        }

        const lunchBreakTimeMap = {};
        for (let class_id in weeklyTimetable) {
            lunchBreakTimeMap[class_id] = {};
            for (let section in weeklyTimetable[class_id]) {
                lunchBreakTimeMap[class_id][section] = {};
                for (let day in weeklyTimetable[class_id][section]) {
                    const periods = weeklyTimetable[class_id][section][day];
                    const lunchBreak = periods.find(p => p.interval === "Lunch Break");
                    lunchBreakTimeMap[class_id][section][day] = lunchBreak ? lunchBreak.startTime : null;
                }
            }
        }

        await saveWeeklyTimetable(db, weeklyTimetable, lunchBreakTimeMap);
        res.json({ message: "Weekly timetable generated successfully", weeklyTimetable });
    } catch (error) {
        console.error("❌ Error generating timetable:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

module.exports = router;
