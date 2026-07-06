

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pdfParse = require('pdf-parse');
const mysql = require('mysql2');
const PDFDocument = require('pdfkit');
const multer = require('multer');
const upload = multer();
router.use(express.json());
const cors = require('cors');


;const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) =>
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const uploadPdf = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_, file, cb) =>
    file.mimetype === 'application/pdf'
      ? cb(null, true)
      : cb(new Error('Only PDF files are allowed')),
});
// MySQL Connection
console.log('🔌 Connecting to main NOVA database...');
const db = mysql.createConnection({
  host: '162.215.210.38',
  user: 'root',
  password: 'NavyAtagsoLnovA@$000',
  database: 'NOVA',
});

db.connect(err => {
  if (err) console.error('❌ DB error:', err);
  else console.log('✅ MySQL connected to questionpaper');
});

function createDynamicConnection(schoolCode) {
  console.log(`🔧 Attempting to create dynamic DB connection for schoolCode: ${schoolCode}`);
  if (!schoolCode) throw new Error('schoolCode is required');
  const cleanedCode = schoolCode;
  if (!/^[a-zA-Z0-9_]+$/.test(cleanedCode)) {
    throw new Error('Invalid schoolCode format');
  }
  console.log(`✅ Dynamic DB connection created for schoolCode: ${cleanedCode}`);
  return mysql.createConnection({
    host: '162.215.210.38',
    user: 'root',
    password: 'NavyAtagsoLnovA@$000',
    database: cleanedCode,
  });
}

// Import the syllabus data
console.log('📚 Loading syllabusData...');
const syllabusData = require('../syllabusData');

// GET: All Classes






function fetchPDF(url) {
  console.log(`📥 Fetching PDF from URL: ${url}`);
  return new Promise((resolve, reject) => {
    const https = require('https');
    https.get(url, (res) => {
      const data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        console.log('✅ PDF fetched successfully');
        resolve(Buffer.concat(data));
      });
    }).on('error', (err) => {
      console.error('❌ Error fetching PDF:', err.message);
      reject(err);
    });
  });
}

async function generateQuestionPaperPDF(classLevel, subject, questions, totalMarks) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const fileName = `${uuidv4()}.pdf`;
    const filePath = path.join(__dirname, '../uploads', fileName);
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.font('Helvetica-Bold').fontSize(18).text('Question Paper', { align: 'center' });
    doc.moveDown();
    doc.font('Helvetica').fontSize(12).text(`Subject: ${subject}`, { align: 'left' });
    doc.font('Helvetica').fontSize(12).text(`Exam Type: mid`, { align: 'left' });
    doc.font('Helvetica').fontSize(12).text(`Total Marks: ${totalMarks}`, { align: 'left' });
    doc.moveDown();

    questions.forEach((question, index) => {
      if (question.type === 'section') {
        doc.font('Helvetica-Bold').fontSize(14).text(`${index + 1}. ${question.heading}`, { align: 'left' });
        doc.moveDown();
      } else {
        doc.font('Helvetica').fontSize(12).text(`Q${question.question_no}: ${question.question_text}`, { align: 'left' });
        doc.font('Helvetica').fontSize(10).text(`(${question.marks} marks)`, { align: 'right' });
        doc.moveDown();
      }
    });

    doc.end();
    stream.on('finish', () => {
      resolve(filePath);
    });
    stream.on('error', (err) => {
      reject(err);
    });
  });
}

async function saveQuestionPaperToDB(classLevel, subject, examType, filePath, totalMarks, schoolCode) {
  console.log(`🗄️ Saving question paper metadata to DB for schoolCode: ${schoolCode}`);
  let db;
  try {
    if (typeof schoolCode !== 'string') {
      throw new Error('School code must be a string');
    }
    db = createDynamicConnection(schoolCode);
    const escapedFilePath = filePath.replace(/\\/g, '\\\\');
    const insertQuery = `
      INSERT INTO question_papers (
        \`class\`, subject, exam_type, file_path
      ) VALUES (?, ?, ?, ?)
    `;
    const values = [classLevel, subject, examType, escapedFilePath];

    return new Promise((resolve, reject) => {
      db.query(insertQuery, values, (err, result) => {
        if (err) {
          console.error('❌ MySQL insert error:', err.message);
          try { db.end(); } catch (e) {
            console.warn('⚠️ DB close failed after error:', e.message);
          }
          return reject(err);
        }
        db.end();
        console.log('✅ Question paper saved to DB successfully');
        resolve(result);
      });
    });
  } catch (error) {
    console.error('❌ Exception in saveQuestionPaperToDB:', error.message);
    if (db) {
      try { db.end(); } catch (e) {
        console.warn('⚠️ Failed to close DB after exception:', e.message);
      }
    }
    throw error;
  }
}

// REPLACE the entire /pdf-url route with this version
router.get('/pdf-url', cors(), async (req, res) => {
  const {
    classLevel,
    subject,
    board,
    state,
    schoolCode,            // 🆕  pulled from query
  } = req.query;

  console.log('📘 /pdf-url hit:', {
    classLevel,
    subject,
    board,
    state,
    schoolCode,
  });

  /* ---------- basic validation ---------- */
  if (!classLevel || !subject || !board || !schoolCode) {
    console.error('❌ Missing required fields');
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (board === 'SSC' && !state) {
    console.error('❌ State is required for SSC board');
    return res.status(400).json({ error: 'State is required for SSC board' });
  }

  try {
    /* ---------- syllabus lookup ---------- */
    let pdfUrl = '';

    if (board === 'SSC') {
      const stateMap = { AP: 'Andhra Pradesh', TS: 'Telangana' };
      const fullStateName = stateMap[state] || state;
      const classKey = String(classLevel);

      const subjectKey =
        syllabusData.SSC[fullStateName][classKey]?.find(
          (s) => s.toLowerCase() === subject.toLowerCase()
        );

      if (!subjectKey) {
        return res.status(400).json({ error: `No SSC PDF for subject ${subject}` });
      }

      pdfUrl =
        syllabusData.syllabusPaths[
          `SSC-${fullStateName}-${classKey}-${subjectKey}`
        ];
    } else if (board === 'CBSE') {
      const classKey = String(classLevel);
      const subjectKey =
        syllabusData.CBSE[classKey]?.find(
          (s) => s.toLowerCase() === subject.toLowerCase()
        );

      if (!subjectKey) {
        return res.status(400).json({ error: `No CBSE PDF for subject ${subject}` });
      }

      pdfUrl = syllabusData.syllabusPaths[`CBSE-${classKey}-${subjectKey}`];
    } else {
      return res
        .status(400)
        .json({ error: 'Only SSC and CBSE boards are supported' });
    }

    if (!pdfUrl) {
      return res
        .status(400)
        .json({ error: 'PDF URL not found for given parameters' });
    }

    /* ---------- dynamic DB save ---------- */
    try {
      await saveQuestionPaperToDB(
        classLevel,
        subject,
        'syllabus',   // examType – adjust if needed
        pdfUrl,
        null,         // totalMarks (not relevant for syllabus)
        schoolCode
      );
    } catch (dbErr) {
      // DB failure shouldn’t block the response, just log
      console.error('⚠️ Could not save metadata:', dbErr.message);
    }

    /* ---------- respond ---------- */
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ pdfUrl });
  } catch (err) {
    console.error('❌ Fatal error:', err.stack || err);
    res.status(500).json({ error: 'Failed to fetch PDF URL' });
  }
});


router.get('/download-pdf', cors(), async (req, res) => {
  const { url, schoolCode } = req.query;     // schoolCode ถ้ามีจะถูกส่งมาด้วย

  if (!url) return res.status(400).json({ error: 'Missing url param' });

  // ตรวจสอบ schoolCode ว่ามีอยู่จริง (ไม่บังคับ)
  if (schoolCode) {
    try {
      createDynamicConnection(schoolCode).end(); // เปิด-ปิดทดสอบเร็วๆ
      console.log(`📚 download-pdf ถูกเรียกโดย schoolCode: ${schoolCode}`);
    } catch (e) {
      console.warn(`⚠️ schoolCode ไม่ถูกต้อง '${schoolCode}' – ดำเนินการต่อ`);
    }
  }

  // สตรีมไฟล์จากเซิร์ฟเวอร์ภายนอกกลับไปให้ผู้ใช้
  const https = require('https');
  https
    .get(url, remoteRes => {
      if (remoteRes.statusCode !== 200) {
        console.error(`❌ แหล่งข้อมูลตอบกลับ ${remoteRes.statusCode} สำหรับ ${url}`);
        return res.status(502).json({ error: 'ดึงข้อมูล PDF ล้มเหลว' });
      }

      res.setHeader('Content-Type', 'application/pdf');

      const filename =
        path.basename(url.split('?')[0]) || `file-${Date.now()}.pdf`;
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );

      remoteRes.pipe(res);
    })
    .on('error', err => {
      console.error('❌ เกิดข้อผิดพลาดขณะดึงข้อมูล:', err.message);
      res.status(500).json({ error: 'เกิดข้อผิดพลาดขณะดึงไฟล์ PDF' });
    });
});


router.post(
  '/upload-questionpaper',
  uploadPdf.single('pdf'),          // field name must be "pdf"
  async (req, res) => {
    try {
      console.log('📥 /upload-questionpaper hit');

      // 1️⃣ pull fields from the multipart/form‑data
      let { schoolCode, classLevel, subject, examType } = req.body;

      // basic validation
      if (!schoolCode || !classLevel || !subject || !examType || !req.file) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // always store upper‑case code
      schoolCode = schoolCode.toUpperCase();

      // 2️⃣ connect to that school’s DB
      const db = createDynamicConnection(schoolCode);

      // 3️⃣ path where multer saved the file
      const savedPath = req.file.path.replace(/\\/g, '/');

      // 4️⃣ insert metadata (exactly the same four columns as old code)
      const sql = `
        INSERT INTO question_papers
          (\`class\`, subject, exam_type, file_path)
        VALUES
          (?,?,?,?)
      `;
      const values = [
        classLevel,
        subject,
        examType,
        savedPath
      ];

      db.query(sql, values, (err, result) => {
        db.end();
        if (err) {
          console.error('❌ DB insert error:', err.message);
          return res.status(500).json({ error: 'DB insert failed' });
        }
        console.log('✅ PDF metadata stored');
        res.json({ success: true, id: result.insertId, filePath: savedPath });
      });
    } catch (err) {
      console.error('❌ Upload error:', err.message);
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);


module.exports = router;




















