const pdfParse = require('pdf-parse');

app.post('/QuestionPaper', async (req, res) => {
  const { board, class: classLevel, subject, examType, selectedQuestionCounts, schoolCode } = req.body;

  console.log('🔥 Incoming request to /QuestionPaper');
  console.log('📦 Request body:', req.body);

  if (!schoolCode) {
    console.error('❌ Missing schoolCode in request body.');
    return res.status(400).json({ error: 'Missing schoolCode in request body.' });
  }

  let pdfUrl = '';
  let subjectKey = '';
  let db; // school DB connection

  try {
    // 🏫 Connect to the specific school database
    db = await getDatabaseConnection(schoolCode);
    console.log(`✅ Connected to database: ${schoolCode}`);

    // Example debug query (optional): verify connection works
    const [tables] = await db.query('SHOW TABLES');
    console.log(`📋 Tables found in ${schoolCode}:`, tables.map(t => Object.values(t)[0]));

    // --- BOARD LOGIC STARTS ---
    if (board === 'SSC') {
      const classKey = `class ${classLevel}`;
      const classPDFs = sscPDFMap[classKey];

      if (!classPDFs) {
        console.error(`⚠️ SSC class not found in map: ${classKey}`);
        return res.status(400).json({ error: `No SSC syllabus found for class: ${classLevel}` });
      }

      subjectKey = Object.keys(classPDFs).find(
        key => key.toLowerCase() === subject?.trim().toLowerCase()
      );

      if (!subjectKey) {
        console.error(`⚠️ Subject not found in SSC class ${classLevel}: ${subject}`);
        return res.status(400).json({ error: `No SSC PDF available for subject: ${subject}` });
      }

      pdfUrl = classPDFs[subjectKey];
    } 
    else if (board === 'CBSE') {
      const cbseClass = cbseSyllabusMap[classLevel];
      if (!cbseClass) {
        console.error(`⚠️ No CBSE syllabus found for class: ${classLevel}`);
        return res.status(400).json({ error: `No CBSE syllabus found for class: ${classLevel}` });
      }

      if (Array.isArray(cbseClass)) {
        const matched = cbseClass.find(
          item => item.subject.toLowerCase() === subject?.trim().toLowerCase()
        );

        if (!matched) {
          console.error(`⚠️ No CBSE PDF found for class ${classLevel}, subject ${subject}`);
          return res.status(400).json({ error: `No CBSE PDF found for class ${classLevel}, subject ${subject}` });
        }

        pdfUrl = matched.url;
        subjectKey = matched.subject;
      } 
      else if (typeof cbseClass === 'object') {
        subjectKey = Object.keys(cbseClass).find(
          key => key.toLowerCase() === subject?.trim().toLowerCase()
        );

        if (!subjectKey) {
          console.error(`⚠️ No CBSE PDF found for class ${classLevel}, subject ${subject}`);
          return res.status(400).json({ error: `No CBSE PDF found for class ${classLevel}, subject ${subject}` });
        }

        pdfUrl = cbseClass[subjectKey];
      } 
      else {
        console.error(`⚠️ Unexpected CBSE mapping for class: ${classLevel}`);
        return res.status(400).json({ error: `Unexpected CBSE mapping for class: ${classLevel}` });
      }
    } 
    else {
      return res.status(400).json({ error: `Unsupported board: ${board}` });
    }

    // --- PDF PARSING ---
    console.log('📄 Fetching and parsing PDF:', pdfUrl);
    const pdfBuffer = await fetchPDF(pdfUrl);
    const data = await pdfParse(pdfBuffer);

    // --- EXTRACT QUESTIONS ---
    const questions = extractQuestionsFromText(data.text, examType);
    if (!questions || questions.length === 0) {
      console.error('⚠️ No questions found in the PDF.');
      return res.status(500).json({ error: 'No questions found in the PDF.' });
    }

    // --- CATEGORIZE ---
    const questionsByType = { 'Short Answer': [], 'Long Answer': [], 'MCQ': [] };
    questions.forEach(q => {
      if (questionsByType[q.question_type]) {
        questionsByType[q.question_type].push(q);
      }
    });

    const selectedQuestions = [];
    Object.keys(questionsByType).forEach(type => {
      const count = selectedQuestionCounts?.[type] || 0;
      const shuffled = shuffleArray(questionsByType[type]);

      if (type === 'MCQ') {
        const mcqCount = Math.min(shuffled.length, count);
        selectedQuestions.push(...shuffled.slice(0, mcqCount));

        if (mcqCount < count) {
          const fallbackCount = count - mcqCount;
          const fallbackQuestions = generateFallbackMCQs(fallbackCount);
          selectedQuestions.push(...fallbackQuestions);
        }
      } else {
        selectedQuestions.push(...shuffled.slice(0, count));
      }
    });

    // --- SAVE PAPER ---
    const totalMarks = selectedQuestions.reduce((sum, q) => sum + (q.marks || 0), 0);
    const filePath = await saveQuestionPaperToFile(classLevel, subjectKey, selectedQuestions);

    // Save metadata into school’s DB
    await db.execute(
      `INSERT INTO generated_question_papers (class, subject, exam_type, total_marks, file_path, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [classLevel, subjectKey, examType, totalMarks, filePath]
    );

    console.log('✅ Question paper saved successfully in DB');

    res.json({
      success: true,
      board,
      class: classLevel,
      subject: subjectKey,
      examType,
      totalMarks,
      questions: selectedQuestions,
      filePath,
      source: pdfUrl
    });

  } catch (err) {
    console.error('❌ Error generating question paper:', err);
    res.status(500).json({ error: 'Failed to generate question paper.' });
  } finally {
    if (db) {
      await db.end();
      console.log(`🔒 Closed connection for ${schoolCode}`);
    }
  }
});
// Fallback function to generate dummy MCQs for Maths/Physics if not enough MCQs are found
function generateFallbackMCQs(count) {
  const fallbackMCQs = [];
  for (let i = 0; i < count; i++) {
    fallbackMCQs.push({
      question_no: i + 1,
      question_type: 'MCQ',
      question_text: `Fallback MCQ ${i + 1}?`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correct_answer: 'A',
      marks: 2,
    });
  }
  return fallbackMCQs;
}

// Function to return number of questions based on exam type
function getNumQuestionsBasedOnExamType(examType) {
  switch (examType.toLowerCase()) {
    case 'mid': return 50;
    case 'term': return 50;
    case 'quarterly': return 50;
    case 'half-yearly': return 50;
    case 'annual': return 50;
    default: return 50;
  }
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function extractQuestionsFromText(text, examType) {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const grouped = {
    'Short Answer': [],
    'MCQ': [],
    'Long Answer': [],
  };

  const isRegional = /telugu|hindi/i.test(text);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(\d+)[.)\-–]\s*(.+)$/); // Numbered question

    if (match) {
      let questionText = match[2].trim();
      if (!questionText.endsWith('?')) questionText += '?';

      // Check next 4 lines for options like A) Option text
      const options = [];
      for (let j = 1; j <= 4 && i + j < lines.length; j++) {
        const optMatch = lines[i + j].match(/^[A-Da-d][).]\s*(.+)$/); // Check for options A, B, C, D
        if (optMatch) {
          options.push(optMatch[1].trim());
        }
      }

      // Check if we have at least two options, then treat it as MCQ
      if (options.length >= 2) {
        grouped['MCQ'].push({
          questionText,
          options: options.length === 4
            ? options
            : [...options, ...Array(4 - options.length).fill('Option')]
        });
        i += options.length; // Skip the lines processed as options
      } else {
        // Use keyword-based classification if no options
        const normalized = questionText.toLowerCase();
        const isMCQ = /(mcq|objective|choose the correct answer|multiple choice)/i.test(normalized);
        const isLong = /(long answer|10 marks|explain in detail)/i.test(normalized);
        const isShort = /(short answer|5 marks|briefly|define|write short)/i.test(normalized);

        if (isRegional) {
          if (isMCQ) {
            grouped['MCQ'].push({ questionText, options: ["Option A", "Option B", "Option C", "Option D"] });
          } else if (isLong) {
            grouped['Long Answer'].push(questionText);
          } else if (isShort) {
            grouped['Short Answer'].push(questionText);
          } else {
            if (questionText.length < 80) {
              grouped['Short Answer'].push(questionText);
            } else if (questionText.length >= 90) {
              grouped['Long Answer'].push(questionText);
            }
          }
        } else {
          if (isMCQ) {
            grouped['MCQ'].push({ questionText, options: ["Option A", "Option B", "Option C", "Option D"] });
          } else if (isLong) {
            grouped['Long Answer'].push(questionText);
          } else if (isShort) {
            grouped['Short Answer'].push(questionText);
          } else {
            if (questionText.length < 80) {
              grouped['Short Answer'].push(questionText);
            } else if (questionText.length >= 90) {
              grouped['Long Answer'].push(questionText);
            }
          }
        }
      }
    }
  }

  const numPerType = getNumQuestionsBasedOnExamType(examType);
  const marksPerType = { 'Short Answer': 5, 'Long Answer': 10, 'MCQ': 2 };

  const questions = [];
  const sectionOrder = ['Short Answer', 'MCQ', 'Long Answer'];

  sectionOrder.forEach((type) => {
    const questionsList = grouped[type];
    const count = Math.min(questionsList.length, numPerType);
    const selected = shuffleArray(questionsList).slice(0, count);

    if (selected.length > 0) {
      questions.push({ heading: `${type} Questions`, type: 'section' });

      selected.forEach((item, index) => {
        const questionText = type === 'MCQ' ? item.questionText : item;
        const options = type === 'MCQ' ? item.options : null;

        questions.push({
          question_no: index + 1,
          question_type: type,
          question_text: questionText,
          options,
          correct_answer: type === 'MCQ' ? '' : null,
          marks: marksPerType[type],
        });
      });
    }
  });

  return questions;
}

// Shuffle array helper function
function shuffleArray(array) {
  const shuffledArray = [...array];
  for (let i = shuffledArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
  }
  return shuffledArray;
}

function fetchPDF(url) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    https.get(url, (res) => {
      const data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => resolve(Buffer.concat(data)));
    }).on('error', reject);
  });
}

function saveQuestionPaperToFile(classLevel, subject, questionPaper) {
  const folderPath = path.join(__dirname, '../uploads');
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

  const fileName = `${uuidv4()}.json`;
  const filePath = path.join(folderPath, fileName);
  const fileData = JSON.stringify(questionPaper, null,2);

  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, fileData, (err) => {
      if (err) reject(err);
      else resolve(filePath);
    });
  });
}

function saveQuestionPaperToDB(classLevel, subject, examType, filePath) {
  const query = `INSERT INTO question_papers (class, subject, exam_type, file_path) VALUES (?, ?, ?, ?)`;
  return new Promise((resolve, reject) => {
    db.query(query, [classLevel, subject, examType, filePath], (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}