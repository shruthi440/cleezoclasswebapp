
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pdfParse = require('pdf-parse');
const mysql = require('mysql2');

// MySQL Connection
const db = mysql.createConnection({
  host: '162.215.210.38',
  user: 'root',
  password: 'NavyAtagsoLnovA@$000',
  database: 'NOVA',
});

const sscPDFMap = {
  'class 10': {
  Telugu: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/10th%20telugu%20fl%20inner%202021-22%20with%20qr%20codes%20for%20website.pdf',
  English: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/10th%20english%20inner%202021-22%20for%20website.pdf',
  Hindi: 'https://scert.telangana.gov.in/PDF/publication/ebooks/10_SAN_OC.pdf',
  Maths: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/10%20maths%20em%202021.pdf',
  Physics: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/10%20physics%20em%202021.pdf',
  Biology: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/10%20biology%20em%202021.pdf',
  sports: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/10%20social%20em-21.pdf',
  geography: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/10%20env%20edn%20em%202021.pdf',
  },
  'class 9': {
    Telugu: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/9th%20telugu%20fl%20inner%202021-22%20with%20qr%20codes%20for%20website.pdf',
    English: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/9th%20english%20inner%202021-22%20for%20website.pdf',
    Hindi: 'https://scert.telangana.gov.in/PDF/publication/ebooks/9_SAN_OC.pdf',
    Maths: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/9%20maths%20em%202021.pdf',
    Physics: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/9%20physics%20em%202021.pdf',
    Biology: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/9%20biology%20em%202021.pdf',
    Social: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/9%20social%20em-21.pdf',
    Evs: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/9%20env%20edn%20em%202021.pdf',
  },
  'class 8': {
    Telugu: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/8th%20telugu%20fl%20inner%202021-22%20with%20qr%20codes%20for%20website.pdf',
    English: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/8th%20english%20inner%202021-22%20for%20website.pdf',
    Hindi: 'https://scert.telangana.gov.in/PDF/publication/ebooks/8_SAN_OC.pdf',
    Maths: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/8%20maths%20em%202021.pdf',
    Physics: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/8%20physics%20em%202021.pdf',
    Biology: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/8%20biology%20em%202021.pdf',
    Social: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/8%20social%20em-21.pdf',
  },
  'class 7': {
    Telugu: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/7th%20telugu%20fl%20inner%202021-22%20with%20qr%20codes%20for%20website.pdf',
    English: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/7th%20english%20inner%202021-22%20for%20website.pdf',
    Hindi: 'https://scert.telangana.gov.in/PDF/publication/ebooks/7_SAN_OC.pdf',
    Maths:'https://scert.telangana.gov.in/pdf/publication/ebooks2019/7%20maths%20em%202021.pdf',
    Science:'https://scert.telangana.gov.in/pdf/publication/ebooks2019/7%20general%20science%20em%202021.pdf',
    Social:'https://scert.telangana.gov.in/pdf/publication/ebooks2019/7%20social%20em-21.pdf',
  },
  'class 6': {
    Telugu:'https://scert.telangana.gov.in/pdf/publication/ebooks2019/6th%20telugu%20fl%20inner%202021-22%20with%20qr%20codes%20for%20website.pdf',
    English: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/6th%20english%20inner%202021-22%20for%20website.pdf',
    Hindi: 'https://scert.telangana.gov.in/PDF/publication/ebooks/6_SAN_OC.pdf',
    Maths: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/6%20maths%20em%202020-21.pdf',
    Science: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/6%20science%20em%202021.pdf',
    Social: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/6%20social%20em-21.pdf',
  },
  'class 5': {
    Telugu: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/5th%20telugu%20fl%20inner%20pages%202021-22%20for%20website.pdf',
    English: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/5th%20english%20inner%202021-22%20for%20website.pdf',
    Maths:'https://scert.telangana.gov.in/pdf/publication/ebooks2019/5%20maths%20em%202021.pdf',
     Evs:'https://scert.telangana.gov.in/pdf/publication/ebooks2019/5%20evs%20em%202021.pdf',
  },
  'class 4': {
    Telugu: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/4th%20telugu%20fl%20inner%20pages%202021-22%20for%20website.pdf',
    English:'https://scert.telangana.gov.in/pdf/publication/ebooks2019/4th%20english%20inner%202021-22%20for%20website.pdf',
    Maths:'https://scert.telangana.gov.in/pdf/publication/ebooks2019/4%20maths%20em%202021.pdf',
    Evs: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/4%20evs%20em%202021.pdf',
  },
  'class 3': {
    Telugu: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/3rd%20telugu%20fl%20inner%20pages%202021-22%20for%20website.pdf',
    English: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/3rd%20english%20inner%202021-22%20for%20website.pdf',
    Maths:'https://scert.telangana.gov.in/pdf/publication/ebooks2019/3%20maths%20em%202021.pdf',
    Evs:'https://scert.telangana.gov.in/pdf/publication/ebooks2019/3%20evs%20em%202021.pdf',
  },
  'class 2': {
    Telugu:'https://scert.telangana.gov.in/pdf/publication/ebooks2019/2nd%20telugu%20fl%20inner%20pages%202021-22%20for%20website.pdf',
    English:'https://scert.telangana.gov.in/pdf/publication/ebooks2019/2nd%20english%20inner%202021-22%20for%20website.pdf',
   Maths:'https://scert.telangana.gov.in/pdf/publication/ebooks2019/2%20maths%20em%202021.pdf',
   Evs: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/3%20evs%20em%202021.pdf',
  },
  'class 1': {
    Telugu: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/1st%20telugu%20fl%20inner%20pages%202021-22%20for%20website.pdf',
    English: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/1st%20english%20inner%202021-22%20for%20website.pdf',
     Maths:'https://scert.telangana.gov.in/pdf/publication/ebooks2019/1%20maths%20em%202021.pdf',
     Evs: 'https://scert.telangana.gov.in/pdf/publication/ebooks2019/3%20evs%20em%202021.pdf',
  },
  
  'UKG': [
    { subject: 'All Subjects', url: 'https://rljdmcdavpsraniganj.org/File/4569/CLASS%20UKG%20SYLLABUS%20BOOK%20FINAL.pdf.pdf' },
    { subject: 'Rhymes & Stories', url: 'https://childrenchoice.in/app/monopoly/a/rhymes/mobile/index.html' }
  ],
  'LKG': [
    { subject: 'All Subjects', url: 'https://www.dbmskhs.in/assets/images/syllabus/LKG%20%20ALL%20SUBJECTS%20SYLLABUS.pdf' },
    { subject: 'Rhymes', url: 'https://childrenchoice.in/app/monopoly/a/rhymes/mobile/index.html' }
  ],
  Nursery: [
    { subject: 'Maths', url: 'https://childrenchoice.in/app/monopoly/a/math/mobile/index.html' },
    { subject: 'Hindi', url: 'https://childrenchoice.in/app/monopoly/a/hindi/mobile/index.html' },
    { subject: 'English', url: 'https://childrenchoice.in/app/monopoly/a/english/mobile/index.html' },
    { subject: 'Pictures', url: 'https://childrenchoice.in/app/monopoly/a/picture/mobile/index.html' },
    { subject: 'Rhymes', url: 'https://childrenchoice.in/app/monopoly/a/rhymes/mobile/index.html' },
    { subject: 'Sulekh', url: 'https://childrenchoice.in/app/monopoly/a/sulekh/mobile/index.html' },
  ],
};
const cbseSyllabusMap = {
  '10': { 
  English: 'https://edustud.nic.in/edu/SYLLABUS_2025_26/10/10_English_EM.pdf',
  Maths: 'https://edustud.nic.in/edu/SYLLABUS_2025_26/10/10_Maths_EM.pdf',
  Science: 'https://edustud.nic.in/edu/SYLLABUS_2025_26/10/10_Science_EM.pdf',
  },
  'Class 9': [
    { subject: 'English', url: 'https://edustud.nic.in/edu/SYLLABUS_2025_26/9/9_English_EM.pdf' },
    { subject: 'Mathematics', url: 'https://cbseacademic.nic.in/web_material/CurriculumMain25/Sec/Maths_Sec_2024-25.pdf' },
    { subject: 'Science', url: 'https://edustud.nic.in/edu/SYLLABUS_2025_26/9/9_Science_EM.pdf' }
  ],
  'Class 8': [
    { subject: 'English', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/8/8_english_english_2024_25.pdf' },
    { subject: 'Hindi', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/8/8_hindi_hindi_2024_25.pdf' },
    { subject: 'Mathematics', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/8/8_math_english_2024_25.pdf' },
    { subject: 'Science', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/8/8_science_english_2024_25.pdf' },
    { subject: 'Social Science', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/8/8_socialscience_english_2024_25.pdf' }
  ],
  'Class 7': [
    { subject: 'English', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/7/7_english_english_2024_25.pdf' },
    { subject: 'Hindi', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/7/7_hindi_hindi_2024_25.pdf' },
    { subject: 'Mathematics', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/7/7_math_english_2024_25.pdf' },
    { subject: 'Science', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/7/7_science_english_2024_25.pdf' },
    { subject: 'Social Science', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/7/7_socialscience_english_2024_25.pdf' }
  ],
  
  'Class 6': [
    { subject: 'English', url: 'https://cbseacademic.nic.in/web_material/CurriculumMain25/Middle/English_Class6.pdf' },
    { subject: 'Hindi', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/6/6_hindi_hindi_2024_25.pdf' },
    { subject: 'Mathematics', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/6/6_math_english_2024_25.pdf' },
    { subject: 'Science', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/6/6_science_english_2024_25.pdf' },
    { subject: 'Social Science', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/6/6_socialscience_english_2024_25.pdf' }
  ],
  'Class 5': [
    { subject: 'English', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/5/class_v_english.pdf' },
    { subject: 'Hindi', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/5/class_v_hindi.pdf' },
    { subject: 'Mathematics', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/5/class_v_math_engmed.pdf' },
    { subject: 'EVS', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/5/class_v_evs_eng.pdf' }
  ],
  'Class 4': [
    { subject: 'English', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/4/class_iv_english.pdf' },
    { subject: 'Hindi', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/4/class_iv_hindi.pdf' },
    { subject: 'Mathematics', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/4/class_iv_maths_engmed.pdf' },
    { subject: 'EVS', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/4/class_iv_evs_eng.pdf' }
  ],
  'Class 3': [
    { subject: 'English', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/3/class_iii_english.pdf' },
    { subject: 'Hindi', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/3/class_iii_hindi.pdf' },
    { subject: 'Mathematics', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/3/class_iii_math_engmed.pdf' },
    { subject: 'EVS', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/3/class_iii_evs_eng.pdf' }
  ],
  
  'Class 2': [
    { subject: 'English', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/2/class_ii_english.pdf' },
    { subject: 'Hindi', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/2/class_ii_hindi.pdf' },
    { subject: 'Mathematics', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/2/class_ii_maths.pdf' }
  ],
  'Class 1': [
    { subject: 'English', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/1/class_I_english.pdf' },
    { subject: 'Hindi', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/1/class_i_hindi.pdf' },
    { subject: 'Mathematics', url: 'https://edustud.nic.in/edu/SYLLABUS_2024_25/1/class_i_maths_eng.pdf' }
  ],
'UKG': [
    { subject: 'All Subjects', url: 'https://rljdmcdavpsraniganj.org/File/4569/CLASS%20UKG%20SYLLABUS%20BOOK%20FINAL.pdf.pdf' },
    { subject: 'Rhymes & Stories', url: 'https://childrenchoice.in/app/monopoly/a/rhymes/mobile/index.html' }
  ],
 
  'LKG': [
    { subject: 'All Subjects', url: 'https://www.dbmskhs.in/assets/images/syllabus/LKG%20%20ALL%20SUBJECTS%20SYLLABUS.pdf' },
    { subject: 'Rhymes', url: 'https://childrenchoice.in/app/monopoly/a/rhymes/mobile/index.html' }
  ],
 
  'Nursery': [
    { subject: 'Maths', url: 'https://childrenchoice.in/app/monopoly/a/math/mobile/index.html' },
    { subject: 'Hindi', url: 'https://childrenchoice.in/app/monopoly/a/hindi/mobile/index.html' },
    { subject: 'English', url: 'https://childrenchoice.in/app/monopoly/a/english/mobile/index.html' },
    { subject: 'Pictures', url: 'https://childrenchoice.in/app/monopoly/a/picture/mobile/index.html' },
    { subject: 'Rhymes', url: 'https://childrenchoice.in/app/monopoly/a/rhymes/mobile/index.html' },
    { subject: 'Sulekh', url: 'https://childrenchoice.in/app/monopoly/a/sulekh/mobile/index.html' }
  ],
};



// GET: All Classes
router.get('/clases', (req, res) => {
  const classes = ['Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'];
  res.json(classes);
});







router.get('/subjects/:classes/:board', (req, res) => {
  const classLevel = req.params.classes;  // Class level (1 to 10)
  const board = req.params.board; // Board (SSC, CBSE, etc.)

  // Validate the class level parameter
  if (isNaN(classLevel) || classLevel < 1 || classLevel > 10) {
    return res.status(400).json({ error: 'Invalid class level. Please select a class between 1 and 10.' });
  }

  // Validate the board parameter (either 'ssc' or 'cbse')
  if (!['ssc', 'cbse'].includes(board.toLowerCase())) {
    return res.status(400).json({ error: 'Invalid board. Please select either "ssc" or "cbse".' });
  }

  // Construct the query to fetch subjects based on the class level and board
  const query = `
    SELECT DISTINCT subject FROM (
      SELECT period_1_subject AS subject FROM UniqueTimetable WHERE class_id = ?
      UNION
      SELECT period_2_subject FROM UniqueTimetable WHERE class_id = ?
      UNION
      SELECT period_3_subject FROM UniqueTimetable WHERE class_id = ?
      UNION
      SELECT period_4_subject FROM UniqueTimetable WHERE class_id = ?
      UNION
      SELECT period_5_subject FROM UniqueTimetable WHERE class_id = ?
      UNION
      SELECT period_6_subject FROM UniqueTimetable WHERE class_id = ?
      UNION
      SELECT period_7_subject FROM UniqueTimetable WHERE class_id = ?
      UNION
      SELECT period_8_subject FROM UniqueTimetable WHERE class_id = ?
      UNION
      SELECT period_9_subject FROM UniqueTimetable WHERE class_id = ?
      UNION
      SELECT period_10_subject FROM UniqueTimetable WHERE class_id = ?
    ) AS all_subjects
    WHERE subject IS NOT NULL AND subject <> ''
  `;

  // Execute the query dynamically with the class level as the parameter
  db.query(query, Array(10).fill(classLevel), (err, results) => {
    if (err) {
      console.error('Error fetching subjects:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    const subjects = results.map(row => row.subject);
    res.json(subjects);
  });
});






router.post('/QuestionPaper', async (req, res) => {
  const { board, class: classLevel, subject, examType, selectedQuestionCounts } = req.body;

  console.log('🔥 Incoming request:', req.body);

  let pdfUrl = '';
  let subjectKey = '';

  try {
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

    } else if (board === 'CBSE') {
      const cbseClass = cbseSyllabusMap[classLevel];
      // console.log('🔍 CBSE class mapping:', cbseClass);

      if (!cbseClass) {
        return res.status(400).json({ error: `No CBSE syllabus found for class: ${classLevel}` });
      }

      if (Array.isArray(cbseClass)) {
        const matched = cbseClass.find(
          item => item.subject.toLowerCase() === subject?.trim().toLowerCase()
        );

        if (!matched) {
          return res.status(400).json({ error: `No CBSE PDF found for class ${classLevel}, subject ${subject}` });
        }

        pdfUrl = matched.url;
        subjectKey = matched.subject;

      } else if (typeof cbseClass === 'object') {
        subjectKey = Object.keys(cbseClass).find(
          key => key.toLowerCase() === subject?.trim().toLowerCase()
        );

        if (!subjectKey) {
          return res.status(400).json({ error: `No CBSE PDF found for class ${classLevel}, subject ${subject}` });
        }

        pdfUrl = cbseClass[subjectKey];
      } else {
        return res.status(400).json({ error: `Unexpected CBSE mapping for class: ${classLevel}` });
      }

    } else {
      return res.status(400).json({ error: `Unsupported board: ${board}` });
    }

    // Step 1: Fetch and parse the PDF
    const pdfBuffer = await fetchPDF(pdfUrl);
    const data = await pdfParse(pdfBuffer);

    // Step 2: Extract questions from text
    const questions = extractQuestionsFromText(data.text, examType);
    if (!questions || questions.length === 0) {
      return res.status(500).json({ error: 'No questions found in the PDF.' });
    }

    // Step 3: Categorize and select questions
    const questionsByType = {
      'Short Answer': [],
      'Long Answer': [],
      'MCQ': [],
    };

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

    // Step 4: Save paper to file and DB
    const totalMarks = selectedQuestions.reduce((sum, q) => sum + (q.marks || 0), 0);
    const filePath = await saveQuestionPaperToFile(classLevel, subjectKey, selectedQuestions);
    await saveQuestionPaperToDB(classLevel, subjectKey, examType, filePath);

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

module.exports = router;
