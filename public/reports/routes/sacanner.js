const express = require('express');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');

const app = express();
const router = express.Router();

// --- 1. GLOBAL MIDDLEWARE ---
// Critical: This must be defined before router attachment
app.use(bodyParser.json({ limit: '150mb' }));
app.use(bodyParser.urlencoded({ limit: '150mb', extended: true, parameterLimit: 50000 }));

// --- 2. CONFIGURATION ---
const baseDbConfig = {
  host: '162.215.210.38',
  user: 'root',
  password: 'NavyAtagsoLnovA@$000',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// --- 3. GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'The image file is too large. Limit is 50MB.'
    });
  }
  next(err);
});

// --- 4. THE API ROUTE ---
router.post('/uploadscanner', async (req, res) => {
  const { image, schoolCode } = req.body;

  // Validation
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ success: false, message: 'No valid image provided' });
  }
  
  const trimmedSchoolCode = schoolCode ? schoolCode.trim() : null;
  if (!trimmedSchoolCode) {
    return res.status(400).json({ success: false, message: 'Valid school code is required' });
  }

  // File paths
  const baseName = `report_${Date.now()}`;
  const originalPath = path.join(uploadDir, `${baseName}-original.jpg`);
  const processedMain = path.join(uploadDir, `${baseName}-main.png`);
  const processedCircle = path.join(uploadDir, `${baseName}-circle.png`);

  let worker = null;

  try {
    // 1. Convert Base64 to Buffer
    let base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Save original for metadata reference
    fs.writeFileSync(originalPath, imageBuffer);

    // 2. Image Processing (Sharp)
    const metadata = await sharp(imageBuffer).metadata();

    // Process main view for general text
    await sharp(imageBuffer)
      .grayscale()
      .normalize()
      .toFile(processedMain);

    // Crop specific region for marks (60% left, 70% top)
    const cropWidth = Math.round(metadata.width * 0.2);
    const cropHeight = Math.round(metadata.height * 0.1);
    const cropLeft = Math.round(metadata.width * 0.6);
    const cropTop = Math.round(metadata.height * 0.7);

    await sharp(imageBuffer)
      .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
      .resize(cropWidth * 2, cropHeight * 2)
      .grayscale()
      .normalize()
      .threshold(150)
      .toFile(processedCircle);

    // 3. OCR (Tesseract)
    worker = await createWorker('eng');
    
    // Full Analysis
    await worker.setParameters({ tessedit_pageseg_mode: '11' });
    const { data: { text: fullText } } = await worker.recognize(processedMain);

    // Marks Analysis
    await worker.setParameters({
      tessedit_pageseg_mode: '6',
      tessedit_char_whitelist: '0123456789/\\|',
    });
    const { data: { text: circleText } } = await worker.recognize(processedCircle);

    // 4. Extraction Logic
    const nameMatch = fullText.match(/Name\s*[:\-]?\s*([A-Za-z ]{3,})/i);
    const testTypeMatch = fullText.match(/\b(Mid|Final|Unit|Computer\s*Science)\b/i);
    const classMatch = fullText.match(/Class\s*[:\-]?\s*(\d+)/i);
    const sectionMatch = fullText.match(/Section\s*[:\-]?\s*([A-Za-z])/i);
    const subjectMatch = fullText.match(/(?:Subject|Test Type)\s*[:\-]?\s*([A-Za-z ]{3,})/i);

    const extracted = {
      name: nameMatch?.[1]?.trim() || 'Unknown',
      testType: testTypeMatch?.[1]?.trim() || 'Mid',
      class_name: classMatch?.[1] || 'Unknown',
      section: sectionMatch?.[1] || 'Unknown',
      subject: subjectMatch?.[1]?.trim() || (testTypeMatch?.[1] || 'Mid'),
      marks: 0
    };

    // Extract highest number from marks region
    const possibleMarks = circleText.match(/\d+/g);
    if (possibleMarks) {
      extracted.marks = Math.max(...possibleMarks.map(Number));
    }

    // 5. Database Insertion
    const connection = await mysql.createConnection({ ...baseDbConfig, database: trimmedSchoolCode });
    await connection.execute(
      `INSERT INTO academic_performance_of_student 
       (name, class_name, section, test_type, subject, marks) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [extracted.name, extracted.class_name, extracted.section, extracted.testType, extracted.subject, extracted.marks]
    );
    await connection.end();

    res.json({ success: true, data: extracted });

  } catch (error) {
    console.error('Processing error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  } finally {
    // 6. Cleanup - Always delete files and terminate worker
    if (worker) await worker.terminate();
    [originalPath, processedMain, processedCircle].forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
  }
});

app.use('/', router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Scanner service running on port ${PORT}`));