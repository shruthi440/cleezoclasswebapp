const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const router = express.Router();

// This is the correct way to import the legacy build in modern Node.js versions
const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs');

const app = express();
app.use(cors());

const SYLLABUS_BASE = '/var/www/work/CRM/syllabus';

async function getPdfText(filePath) {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjs.getDocument({
        data,
        useSystemFonts: true,
        disableFontFace: true 
    });
    
    const pdf = await loadingTask.promise;
    let fullText = "";

    // INCREASED to 10 pages to ensure we catch all index/topic pages
    const maxPages = Math.min(pdf.numPages, 50); 
    for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // Join with space to keep words together
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + "\n";
    }
    return fullText;
}
router.get('/extract-topics', async (req, res) => {
    const { subject, grade, fileCode } = req.query;
     console.log("📥 Incoming Request:");
    console.log("   Subject   :", subject);
    console.log("   Grade     :", grade);
    console.log("   File Code :", fileCode);
    const folderPath = path.join(SYLLABUS_BASE, subject, grade);

    try {
        const files = fs.readdirSync(folderPath);
        const searchNumber = fileCode.replace(/\s/g, "").replace(/gegp/gi, ""); 
        const targetFile = files.find(f => f.replace(/\s/g, "").toLowerCase().includes(searchNumber.toLowerCase()) && f.endsWith('.pdf'));

        if (!targetFile) return res.status(404).json({ error: "File not found" });

        const filePath = path.join(folderPath, targetFile);
        const extractedText = await getPdfText(filePath);

        // --- IMPROVED LOGIC START ---
        
        // This regex looks for:
        // 1. (\d+\.\d+) -> The ID (e.g. 1.1)
        // 2. \s+        -> Spaces
        // 3. ([A-Z].*?) -> The Title (starts with capital, non-greedy match)
        // 4. (?=\s{2,}|\n|$) -> LOOKAHEAD: Stop at 2+ spaces, a newline, or end of string
        const topicRegex = /(\d+\.\d+)\s+([A-Z].*?)(?=\s{2,}|\n|$)/g;
        
        let subTopics = [];
        let match;
        
        // Extract the chapter digit from your fileCode (e.g., '101' -> '1')
        // Using a more robust way to get the chapter number:
        const chapterNum = searchNumber.length > 2 ? searchNumber.charAt(searchNumber.length - 1) : searchNumber;

        while ((match = topicRegex.exec(extractedText)) !== null) {
            const id = match[1];
            let title = match[2].trim();
            
            // SECURITY CHECK: If title is too long, it probably grabbed a paragraph by mistake
            // Most sub-topic titles are under 60 characters.
            if (title.length > 70) {
                // Take only the first sentence or part before a period
                title = title.split('. ')[0].substring(0, 70);
            }

            // Only add if the ID matches the selected chapter (e.g., 1.1 for Chapter 1)
            if (id.startsWith(chapterNum + '.')) {
                subTopics.push({ id, title });
            }
        }
        // --- IMPROVED LOGIC END ---

        const uniqueTopics = subTopics
            .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
            .sort((a, b) => a.id.localeCompare(b.id, undefined, {numeric: true}));

        console.log(`Success! Found ${uniqueTopics.length} topics.`);
        res.json({ fileName: targetFile, subTopics: uniqueTopics });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
