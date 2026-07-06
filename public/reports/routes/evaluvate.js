
// module.exports = router;



const express = require('express');
const fs = require('fs');
const mysql = require('mysql2/promise');
const cors = require('cors');
const pdfParse = require('pdf-parse');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PDFDocument } = require('pdf-lib');

const app = express();
const router = express.Router();

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });
const uploadDir = path.join(__dirname, 'uploads');

// ✅ MySQL Connection
let db;
(async () => {
  try {
    db = await mysql.createConnection({
      host: '162.215.210.38',
      user: 'root',
      password: 'NavyAtagsoLnovA@$000',
      database: 'NOVA',
    });
    console.log('✅ Connected to MySQL');
  } catch (err) {
    console.error('❌ DB Connection Error:', err);
  }
})();

// ✅ Decode Base64 to PDF
function decodeBase64ToPDF(base64Data, filePath) {
  const cleanBase64Data = base64Data.replace(/^data:application\/pdf;base64,/, '');
  const buffer = Buffer.from(cleanBase64Data, 'base64');
  fs.writeFileSync(filePath, buffer);
  console.log(`✅ PDF written to: ${filePath}`);
}

// ✅ Validate PDF
async function validatePDF(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    await pdfParse(data);
    return true;
  } catch (err) {
    console.error(`❌ PDF validation failed for: ${filePath}`, err);
    return false;
  }
}

// ✅ Define Sections
const sectionMeta = [
  { name: 'Section A', startQ: 1, endQ: 5, marksPerQ: 10 },
  { name: 'Section B', startQ: 6, endQ: 10, marksPerQ: 12 },
  { name: 'Section C', startQ: 11, endQ: 15, marksPerQ: 14 },
  { name: 'Section D', startQ: 12, endQ: 20, marksPerQ: 16 },

];





router.post('/evaluate', async (req, res) => {
  try {
    console.log('📥 Received request for evaluation.');

    const { question_pdf_base64, answer_pdf_base64, student_pdf_base64, evaluation_id, subject,student_name,student_class, class: className, board } = req.body;

    if (!question_pdf_base64 || !answer_pdf_base64 || !student_pdf_base64) {
      return res.status(400).json({ error: 'Please provide all three PDF Base64 strings.' });
    }

    const questionPdfPath = path.join(uploadDir, `${uuidv4()}.pdf`);
    const answerPdfPath = path.join(uploadDir, `${uuidv4()}.pdf`);
    const studentPdfPath = path.join(uploadDir, `${uuidv4()}.pdf`);

    try {
      decodeBase64ToPDF(question_pdf_base64, questionPdfPath);
      decodeBase64ToPDF(answer_pdf_base64, answerPdfPath);
      decodeBase64ToPDF(student_pdf_base64, studentPdfPath);
    } catch (decodeError) {
      console.error('❌ Error decoding or writing PDF files:', decodeError);
      return res.status(500).json({ error: 'Error processing PDF data.', details: decodeError.message });
    }

    // Function to safely parse PDFs
    const safeParsePDF = async (pdfPath) => {
      try {
        const pdfData = fs.readFileSync(pdfPath);
        return await pdfParse(pdfData);
      } catch (error) {
        console.error(`❌ Error parsing PDF ${pdfPath}:`, error);
        return { text: '' };  // Return an empty string for malformed PDFs
      }
    };

    // Parse all PDFs safely
    const questionText = await safeParsePDF(questionPdfPath);
    const answerText = await safeParsePDF(answerPdfPath);
    const studentText = await safeParsePDF(studentPdfPath);

    const questions = questionText.text.split(/\s*\d+\.\s*/).filter(t => t.trim().length > 0);
    const answers = answerText.text.split(/\s*\d+\.\s*/).map(a => a.trim()).filter(Boolean);
    const studentAnswers = studentText.text.split(/\s*\d+\.\s*/).map(a => a.trim()).filter(Boolean);

    console.log(`📊 Extracted ${questions.length} questions, ${answers.length} answers, ${studentAnswers.length} student answers.`);

    // Define your subject/topic list
    // const topicList = ['English', 'Hindi', 'Telugu', 'Maths', 'Science', 'Social Studies', 'Biology', 'History', 'Geography']; // Add more subjects here

    // Extract topic for each question based on keywords from topicList
  const topicList = [
  // General Topics
  'Vocabulary',
  'Comprehension',
  'Writing Skills',
  'Simple Sentences',
  'Active and Passive Voice',
  'Prepositions',
  'Literature',
  'Reading Comprehension',
  'Basic Shapes',
  'Numbers 1-10',
  'Alphabets (A-Z)',
  'Colors',
  'Fruits and Vegetables',
  'Animals',
  'Body Parts',
  'Days of the Week',
  'Seasons',
  'Simple Rhymes and Songs',

  // Class 1 Topics
  'English Grammar (Nouns, Pronouns, Simple Sentences)',
  'Mathematics (Addition, Subtraction, Shapes, Time)',
  'Environmental Studies (My Body, Animals, Plants, Seasons)',
  'Hindi (Varnamala, Simple Words)',
  'Moral Science (Good Habits, Festivals)',

  // Class 2 Topics
  'English Grammar (Verbs, Nouns, Pronouns, Simple Sentences)',
  'Mathematics (Multiplication, Division, Place Value, Fractions)',
  'Environmental Studies (Water, Air, Human Body, Transportation)',
  'Hindi (Vyakaran: Noun, Pronoun, Adjectives)',
  'General Knowledge (National Symbols, Famous Personalities)',

  // Class 3 Topics
  'English Grammar (Tenses, Simple Present, Past, Future, Reading Comprehension)',
  'Mathematics (Multiplication, Division, Measurement, Fractions)',
  'Environmental Studies (Plants, Animals, Human Body, Safety)',
  'Hindi (Vyakaran, Story Writing)',
  'Arts and Crafts (Drawing, Paper Folding)',

  // Class 4 Topics
  'English Grammar (Articles, Prepositions, Comprehension)',
  'Mathematics (Addition, Subtraction, Time, Fractions, Geometry)',
  'Environmental Studies (Our Earth, Plants, Water Cycle, Pollution)',
  'Hindi (Sentence Formation, Vowel Sounds)',
  'Moral Science (Honesty, Kindness)',
  'Social Studies (Indian History, Geography Basics)',

  // Class 5 Topics
  'English Grammar (Tenses, Active and Passive Voice, Comprehension)',
  'Mathematics (Decimals, Fractions, Multiplication and Division)',
  'Science (Water, Air, Animals, Plants, States of Matter)',
  'Social Studies (Indian History, Landforms, Early Civilizations)',
  'Hindi (Grammar, Writing Skills)',
  'General Knowledge (National Heroes, Indian Monuments)',

  // Class 6 Topics
  'English Grammar (Vocabulary, Nouns, Adjectives, Pronouns, Punctuation)',
  'Mathematics (Fractions, Decimals, Percentage, Geometry)',
  'Science (Electricity, Magnetism, Water, Air)',
  'Social Science (Geography, Ancient Civilizations, Maps)',
  'Hindi (Poetry, Vyakaran, Sentence Structure)',
  'Computer Science (Basic Computer Skills, MS Word)',

  // Class 7 Topics
  'English Grammar (Nouns, Verbs, Articles, Punctuation, Writing Skills)',
  'Mathematics (Integers, Fractions, Decimals, Geometry)',
  'Science (Plants, Animal Kingdom, Respiration, Digestion)',
  'Social Studies (Indian Freedom Struggle, Geography)',
  'Hindi (Grammar, Story Writing)',
  'Computer Science (Introduction to Computers, Internet Basics)',

  // Class 8 Topics
  'English Grammar (Comprehension, Punctuation, Writing Skills)',
  'Mathematics (Linear Equations, Geometry, Data Handling)',
  'Science (Reproduction in Animals, Forces, Motion, Light)',
  'Social Science (History of India, Geography, Political Science)',
  'Hindi (Literature, Comprehension, Essay Writing)',
  'Computer Science (MS Excel, Programming Basics)',

  // Class 9 Topics
  'English Grammar (Comprehension, Writing Skills)',
  'Mathematics (Algebra, Geometry, Trigonometry, Coordinate Geometry)',
  'Science (Physics: Laws of Motion, Chemistry: Atoms and Molecules, Biology: Cell Structure)',
  'Social Science (History, Geography, Political Science)',
  'Hindi (Literature, Writing, Essay)',
  'Computer Science (Basic Programming, Introduction to Python)',

  // Class 10 Topics
  'English Grammar (Writing Skills, Literature, Reading Comprehension)',
  'Mathematics (Algebra, Geometry, Trigonometry, Statistics, Probability)',
  'Science (Physics: Motion, Electricity, Chemistry: Acids, Bases, Biology: Human Reproduction)',
  'Social Science (History: Indian National Movement, Geography: Natural Resources, Political Science)',
  'Hindi (Literature, Essay Writing, Poetry)',
  'Computer Science (Python Programming, Data Structures)',
  'General Knowledge (Current Affairs, National and International Issues)',

  // SSC Topics
  'English Grammar (Grammar, Comprehension, Writing)',
  'Mathematics (Real Numbers, Algebra, Geometry, Trigonometry)',
  'Science (Physics, Chemistry, Biology)',
  'Social Studies (History, Geography, Political Science)',
  'Hindi (Literature, Essay Writing, Poetry)',

  // CBSE Topics
  'English Grammar (Literature, Writing Skills, Grammar)',
  'Mathematics (Algebra, Geometry, Statistics, Trigonometry)',
  'Science (Physics, Chemistry, Biology)',
  'Social Science (History, Geography, Political Science, Economics)',
  'Hindi (Literature, Essay Writing, Grammar)',
  'Computer Science (Basic Programming, Data Structures)',
  'General',
  'Technology',
  'Science',
  'Mathematics',
  'History',
  'Literature',
  'Art and Design',
  'Sports',
  'Politics',
  'Economics',
  'Health and Wellness',
  'Education',
  'Entertainment',
  'Music',
  'Travel',
  'Culture',
  'Environment',
  'Philosophy',
  'Psychology',
  'Business',
  'Social Issues',
  'Religion',
  'Law',
  'Engineering',
  'Astronomy',
  'Food and Cuisine',
  'Artificial Intelligence',
  'Machine Learning',
  'Blockchain',
  'Cybersecurity',
  'Space Exploration',
  'Genetics',
  'Physics',
  'Chemistry',
  'Medicine',
  'Global Warming',
  'Climate Change',
  'Sociology',
  'Geography',
  'Public Policy',
  'Philanthropy',
  'Entrepreneurship',
  'Startups',
  'Innovation',
  'Data Science',
  'Big Data',
  'Cloud Computing',
  'Software Development',
  'Mobile Development',
  'Web Development',
  'Networking',
  'Robotics',
  'Neuroscience',
  'Linguistics',
  'Film and Cinema',
  'Photography',
  'Architecture',
  'Fashion',
  'Theater',
  'Psychiatry',
  'Agriculture',
  'Finance',
  'Real Estate',
  'Human Rights',
  'Mental Health',
  'Public Health',
  'Tourism',
  'Education Technology',
  'Social Media',
  'Digital Marketing',
  'E-commerce',
  'Artificial Organisms',
  'Nanotechnology',
  'Smart Cities',
  'Renewable Energy',
  'Quantum Computing',
  'Virtual Reality',
  'Augmented Reality',
  'Ethics',
  'Public Speaking',
  'Creative Writing',
  'Literary Criticism',
  'Social Justice',
  'Cyberbullying',
  'Cognitive Science',
  'Autonomous Vehicles',

  // Nursery to 10th SSC and CBSE Topics
  // Nursery to Class 1 Topics
  
];
    
    const questionTopics = questions.map((q, idx) => {
      console.log(`🔍 Question ${idx + 3}:`, q); // Show the question text
    
      // Check if the question contains any of the topics
      let topic = topicList.find(subject => q.toLowerCase().includes(subject.toLowerCase()));
    
      // If no topic match found, fall back to 'General'
      if (!topic) {
        // topic = 'General';
      }
    
      console.log(`🧠 Extracted Topic for Q${idx + 3}:`, topic); // Show matched topic
      return topic;
    });
    

    console.log('📘 Extracted Topics:', questionTopics);

    let score = 0;
    const results = [];
    const sectionSummary = {};
    const topicSummary = {};
    const weakTopics = [];

    sectionMeta.forEach(section => {
      sectionSummary[section.name] = {
        totalQuestions: section.endQ - section.startQ + 1,
        answeredQuestions: 0,
        answeredCorrectly: 0,
        totalMarks: 0,
        obtainedMarks: 0
      };
    });

    function normalizeAnswer(str) {
      return str?.replace(/\s+/g, ' ').trim().toLowerCase() || '';
    }

    questions.forEach((q, idx) => {
      const qNum = idx + 1;
      const studentRaw = studentAnswers[idx] || '';
      const correctRaw = answers[idx] || '';
      const studentAns = normalizeAnswer(studentRaw);
      const correctAns = normalizeAnswer(correctRaw);
      const isCorrect = studentAns === correctAns;

      const section = sectionMeta.find(s => qNum >= s.startQ && qNum <= s.endQ);
      const sectionName = section?.name || section.name;
      const mark = section?.marksPerQ || 0;

      if (section) {
        sectionSummary[sectionName].answeredQuestions += 3;
        sectionSummary[sectionName].totalMarks += mark;
      }

      if (isCorrect) {
        score += mark;
        if (section) {
          sectionSummary[sectionName].answeredCorrectly += 3;
          sectionSummary[sectionName].obtainedMarks += mark;
        }
      } else {
        const topic = questionTopics[idx] || section.name;
        weakTopics.push(topic);
      }

      const topic = questionTopics[idx] || section.name;
      if (!topicSummary[topic]) {
        topicSummary[topic] = { total: 0, correct: 0 };
      }
      topicSummary[topic].total += 1;
      if (isCorrect) {
        topicSummary[topic].correct += 1;
      }

      results.push({
        questionNumber: qNum,
        section: sectionName,
        topic,
        question: q,
        correctAnswer: correctRaw || 'N/A',
        studentAnswer: studentRaw || 'N/A',
        isCorrect,
      });
    });

    const allTopics = [...new Set(questionTopics.concat(Object.keys(topicSummary)))].filter(Boolean);
    const uniqueWeakTopics = [...new Set(weakTopics)];

    let revisionLinks = [];

    if (db && board && subject && className) {
      try {
        const [syllabusTopics] = await db.execute(
          `SELECT topic, pdf_url FROM syllabus WHERE board = ? AND class = ? AND subject = ?`,
          [board, className, subject]
        );

        revisionLinks = syllabusTopics.filter(row =>
          uniqueWeakTopics.includes(row.topic)
        );
      } catch (dbFetchError) {
        console.error('❌ Error fetching syllabus for weak topics:', dbFetchError.message);
      }
    }

    if (db) {
      try {
        const topicListStr = allTopics.join(', ');

        if (evaluation_id) {
          await db.execute(
            `UPDATE evaluations 
             SET score = ?, question_pdf_path = ?, answer_pdf_path = ?, student_pdf_path = ?, topic = ? 
             WHERE id = ?`,
            [
              score,
              questionPdfPath,
              answerPdfPath,
              studentPdfPath,
              topicListStr,
              evaluation_id
            ]
          );
        } else {
          await db.execute(
            `INSERT INTO evaluations (score, question_pdf_path, answer_pdf_path, student_pdf_path, topic,student_name,student_class,subject) 
             VALUES (?, ?, ?, ?, ?,?,?,?)`,
            [
              score,
              questionPdfPath,
              answerPdfPath,
              studentPdfPath,
              topicListStr,
              student_name,student_class,subject
            ]
          );
        }
      } catch (dbError) {
        console.error('❌ Error saving/updating database:', dbError);
        return res.status(500).json({ error: 'Database error', details: dbError.message });
      }
    }

    res.json({
      score,
      results,
      topics: allTopics,
      weakTopics: uniqueWeakTopics,
      revisionLinks
    });

    [questionPdfPath, answerPdfPath, studentPdfPath].forEach(filePath => {
      fs.unlink(filePath, err => {
        if (err) console.error('❌ Error deleting file:', err);
      });
    });

  } catch (err) {
    console.error('❌ Evaluation Error:', err);
    res.status(500).json({ error: 'Internal server error.', details: err.message });
  }
});

app.use('/', router);
module.exports = router;
