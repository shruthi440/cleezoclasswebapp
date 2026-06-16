// process.on('uncaughtException', async (err) => {
//   console.error('❌ Uncaught Exception:', err);
//   await gracefulShutdown('uncaughtException');
// });

// process.on('unhandledRejection', async (err) => {
//   console.error('❌ Unhandled Rejection:', err);
//   await gracefulShutdown('unhandledRejection');
// });

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const nodeHtmlToImage = require("node-html-to-image");
// const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');


const app = express();
const port = 4000;
const path = require('path');
const https = require('https');
const fs = require('fs');
const { execFile } = require('child_process');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const nodemailer = require('nodemailer');
const admin = require("firebase-admin");
require('dotenv').config();
const http = require('http');
const os = require('os');
const { Server } = require('socket.io');
app.use(express.json());
app.use(cors());
const cron = require("node-cron");
const generatePoster = require("./utils/generatePoster");
const errorHandler = require('./MiddleWare/errorHandler');
const getSchoolDetails = require("./utils/getSchoolDetails");
const generateWelcomeCardHTML = require("./templates/welcomeCardTemplate");
const createPosterTemplateRenderer = require("./templates/htmlPosterTemplateFactory");

// const generateMarketingPoster = require("./generatePoster/generatePoster");
const templates = require("./templates");
app.use(express.urlencoded({ extended: true })); // Add this line

let firebasePushEnabled = false;
try {
  const serviceAccount = require("./firebase-service.json");
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  firebasePushEnabled = true;
  console.log("[BIRTHDAY-PUSH] Firebase initialized successfully.");
} catch (error) {
  firebasePushEnabled = false;
  console.warn("[BIRTHDAY-PUSH] Firebase init failed. Push will be skipped.", error?.message || error);
}
// Quality database (used for centralized accounts or other shared data)
const qualityPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: 'Quality',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.use('/uploads', express.static('uploads'));
app.use("/backend/templates", express.static(path.join(__dirname, "templates")));
let notificationIo = null;

const schoolPhotosDir =
  process.env.SCHOOL_PHOTOS_DIR ||
  "/var/www/cleezoclass/CRM/public/schoolPhotos";
if (!fs.existsSync(schoolPhotosDir)) {
  fs.mkdirSync(schoolPhotosDir, { recursive: true });
}

const postersDir =
  process.env.POSTERS_DIR || "/var/www/cleezoclass/CRM/public/posters";

app.get("/posters/:file", (req, res) => {
  const requested = req.params.file;
  const primaryPath = path.join(postersDir, requested);
  const localPath = path.join(__dirname, "../public/posters", requested);

  if (fs.existsSync(primaryPath)) return res.sendFile(primaryPath);
  if (fs.existsSync(localPath)) return res.sendFile(localPath);

  // Try alternate name (poster_ <-> school_poster_)
  const altName = requested.startsWith("school_poster_")
    ? requested.replace("school_poster_", "poster_")
    : requested.startsWith("poster_")
      ? requested.replace("poster_", "school_poster_")
      : null;

  if (altName) {
    const altPrimary = path.join(postersDir, altName);
    const altLocal = path.join(__dirname, "../public/posters", altName);
    if (fs.existsSync(altPrimary)) return res.sendFile(altPrimary);
    if (fs.existsSync(altLocal)) return res.sendFile(altLocal);
  }

  // Fallback to latest school photo
  const photos = listSchoolPhotos();
  if (photos.length) {
    return res.sendFile(photos[0].fullPath);
  }

  return res.status(404).send("Poster not found");
});

app.get("/api/poster-templates", (req, res) => {
  const postersTemplatesDir = path.join(__dirname, "templates", "posters");
  const posterPrefix = "/api/poster-template-preview";

  try {
    const templatesList = [];
    if (!fs.existsSync(postersTemplatesDir)) {
      return res.json({ success: true, data: templatesList });
    }

    const files = fs
      .readdirSync(postersTemplatesDir)
      .filter((name) => name.toLowerCase().endsWith(".html"))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

    files.forEach((name) => {
      templatesList.push({
        id: name,
        name,
        urlPath: `${posterPrefix}/${encodeURIComponent(name)}`,
      });
    });

    return res.json({ success: true, data: templatesList });
  } catch (error) {
    console.error("Failed to read poster templates:", error);
    return res.status(500).json({ success: false, message: "Failed to load poster templates" });
  }
});

app.get("/api/poster-asset-images", (req, res) => {
  try {
    return res.json({ success: true, data: listPosterAssetPreviews() });
  } catch (error) {
    console.error("Failed to list poster asset images:", error);
    return res.status(500).json({ success: false, message: "Failed to load poster asset images" });
  }
});

app.get("/api/welcome-card-templates", (req, res) => {
  const data = Array.from({ length: 8 }, (_, i) => {
    const id = String(i + 1);
    return {
      id: `welcome${id}`,
      name: `welcomecard${id}`,
      urlPath: `/api/welcome-card-template/${id}`,
    };
  });

  return res.json({ success: true, data });
});

function sanitizePreviewSchoolCode(value) {
  return String(value || "").trim();
}

async function resolvePreviewSchool(req) {
  const requestedSchoolCode = sanitizePreviewSchoolCode(req.query.schoolCode);
  if (requestedSchoolCode) {
    try {
      const found = await getSchoolDetails(requestedSchoolCode);
      if (found) return found;
    } catch (error) {
      console.warn("Preview school lookup failed:", error?.message || error);
    }
  }

  return {
    institute_name: "Cleezo Public School",
    dominantColor: "#1e3a8a",
    tagline: "Where learning begins with care & values",
    logo: "https://cleezoclass.com/CRM/logo1.png",
  };
}

function buildPreviewLead() {
  return {
    full_name: "Parent Name",
    features: [
      "CBSE Curriculum",
      "Experienced Teachers",
      "Safe Campus",
      "Activity Based Learning",
    ],
    footer: "Admissions Open - Pre-KG to Grade 10",
  };
}

function appendResponsivePreviewScript(html) {
  const fitScript = `
<script>
(function () {
  var CARD_W = 600;
  var CARD_H = 600;
  var fitMode = "cover";

  try {
    var modeFromUrl = new URLSearchParams(window.location.search).get("fit");
    if (modeFromUrl === "contain" || modeFromUrl === "cover") fitMode = modeFromUrl;
  } catch (_) {}

  try {
    var params = new URLSearchParams(window.location.search);
    var w = Number(params.get("cw"));
    var h = Number(params.get("ch"));
    if (Number.isFinite(w) && w >= 320 && w <= 1200) CARD_W = w;
    if (Number.isFinite(h) && h >= 320 && h <= 1600) CARD_H = h;
  } catch (_) {}

  function fit() {
    try {
      var root = document.documentElement;
      var body = document.body;
      if (!root || !body) return;

      root.style.margin = "0";
      root.style.padding = "0";
      root.style.width = CARD_W + "px";
      root.style.height = CARD_H + "px";
      root.style.overflow = "hidden";
      body.style.margin = "0";
      body.style.padding = "0";
      body.style.overflow = "visible";
      body.style.transform = "none";
      body.style.transformOrigin = "top left";

      var panel = body.querySelector('[data-preview-panel="true"],[data-poster-welcome="true"]');
      if (panel) panel.style.position = "fixed";

      var contentW = Math.max(body.scrollWidth, body.offsetWidth, 1);
      var contentH = Math.max(body.scrollHeight, body.offsetHeight, 1);
      var scale =
        fitMode === "contain"
          ? Math.min(CARD_W / contentW, CARD_H / contentH)
          : Math.max(CARD_W / contentW, CARD_H / contentH);
      var scaledW = contentW * scale;
      var scaledH = contentH * scale;
      var offsetX = (CARD_W - scaledW) / 2;
      var offsetY = (CARD_H - scaledH) / 2;

      body.style.width = contentW + "px";
      body.style.height = contentH + "px";
      body.style.transform = "translate(" + offsetX + "px," + offsetY + "px) scale(" + scale + ")";
    } catch (_) {}
  }

  window.addEventListener("load", fit);
  window.addEventListener("resize", fit);
  setTimeout(fit, 60);
})();
</script>`;

  return /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${fitScript}</body>`)
    : `${html}${fitScript}`;
}

function isTemplatePreviewPath(rawPath) {
  const value = String(rawPath || "").trim();
  return (
    value.includes("/api/welcome-card-template/") ||
    value.includes("/api/poster-template-preview/")
  );
}

function getTemplateRendererFromPreviewPath(rawPath) {
  const value = String(rawPath || "").trim();
  if (value.includes("/api/welcome-card-template/")) {
    const match = value.match(/\/api\/welcome-card-template\/(\d+)/);
    const id = Number(match?.[1] || 0);
    if (Number.isInteger(id) && id >= 1 && id <= 8) {
      return require(`./templates/welcomeCardTemplate${id}`);
    }
  }

  if (value.includes("/api/poster-template-preview/")) {
    const match = value.match(/\/api\/poster-template-preview\/([^/?#]+)/);
    const rawName = decodeURIComponent(match?.[1] || "").trim();
    if (rawName && !rawName.includes("..") && rawName.toLowerCase().endsWith(".html")) {
      return createPosterTemplateRenderer(rawName);
    }
  }

  return null;
}

async function renderTemplatePreviewImage({ templateItem, schoolCode }) {
  const rawPath = String(templateItem?.file_path || "").trim();
  const safeSchoolCode = String(schoolCode || "").trim();
  if (!safeSchoolCode) {
    throw new Error("schoolCode is required");
  }

  const renderer = getTemplateRendererFromPreviewPath(rawPath);
  if (!renderer) {
    throw new Error("Template image source is invalid.");
  }

  const school = await getSchoolDetails(safeSchoolCode);
  const lead = buildPreviewLead();
  const showMetaPanel = String(templateItem?.showMeta || "").trim() === "1";
  const html = appendResponsivePreviewScript(renderer(lead, school, { showMetaPanel }));

  const fileBase = String(templateItem?.file_name || templateItem?.title || "template")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/gi, "_")
    .replace(/^_+|_+$/g, "") || "template";
  const outputFileName = `${fileBase}-${Date.now()}-${Math.round(Math.random() * 1e6)}.png`;
  const outputPath = path.join(schoolPhotosDir, outputFileName);

  await nodeHtmlToImage({
    output: outputPath,
    html,
    type: "png",
    transparent: false,
    waitUntil: "networkidle0",
    selector: "body",
    puppeteerArgs: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  return { outputPath, outputFileName };
}

app.get("/api/welcome-card-template/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1 || id > 8) {
    return res.status(400).send("Invalid welcome card template id");
  }

  try {
    const renderer = require(`./templates/welcomeCardTemplate${id}`);
    const lead = buildPreviewLead();
    const school = await resolvePreviewSchool(req);
    const html = appendResponsivePreviewScript(renderer(lead, school));
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (error) {
    console.error("Failed to render welcome card template:", error);
    return res.status(500).send("Failed to render welcome card template");
  }
});

app.get("/api/poster-template-preview/:name", async (req, res) => {
  const rawName = decodeURIComponent(String(req.params.name || "")).trim();
  if (!rawName || rawName.includes("..") || !rawName.toLowerCase().endsWith(".html")) {
    return res.status(400).send("Invalid poster template name");
  }

  try {
    const renderer = createPosterTemplateRenderer(rawName);
    const lead = buildPreviewLead();
    const school = await resolvePreviewSchool(req);
    const showMetaPanel = String(req.query.showMeta || "").trim() === "1";
    const html = appendResponsivePreviewScript(
      renderer(lead, school, { showMetaPanel })
    );

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (error) {
    console.error("Failed to render poster template preview:", error);
    return res.status(500).send("Failed to render poster template preview");
  }
});

app.get("/api/poster-template-preview/:name/download", async (req, res) => {
  const rawName = decodeURIComponent(String(req.params.name || "")).trim();
  if (!rawName || rawName.includes("..") || !rawName.toLowerCase().endsWith(".html")) {
    return res.status(400).send("Invalid poster template name");
  }

  const schoolCode = String(req.query.schoolCode || "").trim();
  if (!schoolCode) {
    return res.status(400).send("schoolCode is required");
  }

  try {
    const { outputPath, outputFileName } = await renderTemplatePreviewImage({
      templateItem: {
        file_name: rawName,
        file_path: `/api/poster-template-preview/${encodeURIComponent(rawName)}`,
        showMeta: req.query.showMeta,
      },
      schoolCode,
    });

    res.setHeader("Content-Type", "image/png");
    return res.download(outputPath, outputFileName);
  } catch (error) {
    console.error("Failed to download poster template preview image:", error);
    return res.status(500).send("Failed to download poster template image");
  }
});

app.post("/api/school-photos/upload-template", async (req, res) => {
  const schoolCode = String(req.body?.schoolCode || "").trim();
  const templateItem = req.body?.templateItem || {};
  const galleryScope = String(req.body?.galleryScope || templateItem?.gallery_scope || templateItem?.scope || "both").trim().toLowerCase();
  const leadName = String(req.body?.lead_name || templateItem?.lead_name || templateItem?.title || templateItem?.file_name || "Dashboard Template Upload").trim();

  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  try {
    const { outputFileName } = await renderTemplatePreviewImage({ templateItem, schoolCode });
    const db = await getDatabaseConnection(schoolCode);
    await ensureSchoolPhotosTable(db);
    const filePath = `/schoolPhotos/${outputFileName}`;
    const [result] = await db.query(
      `INSERT INTO school_photos (school_code, lead_name, gallery_scope, file_name, file_path)
       VALUES (?, ?, ?, ?, ?)`,
      [schoolCode, leadName || null, galleryScope || "both", outputFileName, filePath]
    );

    const [rows] = await db.query(
      `SELECT id, lead_name, gallery_scope, file_name, file_path, uploaded_at
       FROM school_photos
       WHERE id = ? AND school_code = ?`,
      [result.insertId, schoolCode]
    );

    return res.json({
      success: true,
      item: rows[0] || {
        id: result.insertId,
        lead_name: leadName || null,
        gallery_scope: galleryScope || "both",
        file_name: outputFileName,
        file_path: filePath,
      },
    });
  } catch (err) {
    console.error("Upload template error:", err);
    return res.status(500).json({ error: err?.message || "Failed to upload template" });
  }
});

app.get("/api/template-preview-image", async (req, res) => {
  const schoolCode = String(req.query?.schoolCode || "").trim();
  const rawPath = String(req.query?.path || "").trim();

  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }
  if (!isTemplatePreviewPath(rawPath)) {
    return res.status(400).json({ error: "Template image source is invalid." });
  }

  try {
    const { outputPath } = await renderTemplatePreviewImage({
      templateItem: { file_path: rawPath, file_name: path.basename(rawPath).replace(/\.html$/i, "") },
      schoolCode,
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    return res.sendFile(outputPath);
  } catch (err) {
    console.error("Template preview image error:", err);
    return res.status(500).json({ error: err?.message || "Failed to render template preview image" });
  }
});
// const novaDB = mysql.createPool({
//   host: '162.215.210.38',
//   user: 'root',
//   password: 'NavyAtagsoLnovA@$000',
//   database: 'NOVA',
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0
// });

// function restoreSessions() {

//   const sessionsFolder = path.join(__dirname, "whatsapp-sessions");

//   if (!fs.existsSync(sessionsFolder)) {
//     console.log("No WhatsApp sessions found");
//     return;
//   }

//   const sessionDirs = fs.readdirSync(sessionsFolder);

//   sessionDirs.forEach(folder => {

//     if (!folder.startsWith("session-")) return;

//     const schoolCode = folder.replace("session-", "");

//     console.log("🔄 Restoring WhatsApp session for:", schoolCode);

//     createSession(schoolCode);

//   });

// }
/* ---------------- WHATSAPP SESSION STORAGE ---------------- */
const sessions = {};
const qrCodes = {};
const readySessions = {};
const sanitizeSchoolCode = (code) => String(code || "").trim();
const sessionsFolder = path.join(__dirname, "whatsapp-sessions");
// const initializing = {};
// function createSession(schoolCode) {

//   if (sessions[schoolCode]) {
//     return sessions[schoolCode];
//   }

//   if (initializing[schoolCode]) {
//     return;
//   }

//   initializing[schoolCode] = true;

//   const sessionsFolder = path.join(__dirname, "whatsapp-sessions");
//   const sessionDir = path.join(sessionsFolder, `session-${schoolCode}`);
//   // Clear stale Chromium locks (common after crashes/restarts)
//   try {
//     fs.rmSync(path.join(sessionDir, "SingletonLock"), { force: true });
//     fs.rmSync(path.join(sessionDir, "SingletonCookie"), { force: true });
//     fs.rmSync(path.join(sessionDir, "SingletonSocket"), { force: true });
//   } catch (_) {}

//   const client = new Client({
//     authStrategy: new LocalAuth({
//       clientId: schoolCode,
//       dataPath: sessionsFolder
//     }),
//     puppeteer: {
//       headless: true,
//       executablePath:
//         process.env.CHROME_PATH ||
//         "/snap/chromium/current/usr/lib/chromium-browser/chrome" ||
//         "/usr/bin/google-chrome",
//       args: [
//         "--no-sandbox",
//         "--disable-setuid-sandbox",
//         "--disable-dev-shm-usage",
//         "--single-process",
//         "--no-zygote"
//       ]
//     }
//   });

//   client.on("qr", (qr) => {
//     console.log(`QR Generated for ${schoolCode}`);
//     qrCodes[schoolCode] = qr;
//   });

//   client.on("ready", () => {
//     console.log(`✅ WhatsApp Ready for ${schoolCode}`);
//     readySessions[schoolCode] = true;
//     initializing[schoolCode] = false;
//   });

//   client.on("disconnected", () => {
//     console.log(`❌ WhatsApp disconnected for ${schoolCode}`);
//     delete sessions[schoolCode];
//     delete readySessions[schoolCode];
//     delete qrCodes[schoolCode];
//     initializing[schoolCode] = false;
//   });

//   client.on("auth_failure", (err) => {
//     console.error(`❌ Auth failure for ${schoolCode}`, err);
//     deleteSession(schoolCode);
//     initializing[schoolCode] = false;
//   });

//   client.initialize();

//   sessions[schoolCode] = client;

//   return client;
// }

// /* ---------------- WAIT UNTIL READY ---------------- */

// function waitUntilReady(schoolCode, timeout = 15000) {

//   return new Promise((resolve, reject) => {

//     const start = Date.now();

//     function checkReady() {

//       if (readySessions[schoolCode]) {
//         return resolve(sessions[schoolCode]);
//       }

//       if (Date.now() - start > timeout) {
//         return reject(new Error("WhatsApp session not ready"));
//       }

//       setTimeout(checkReady, 500);
//     }

//     checkReady();
//   });
// }

// /* ---------------- DELETE SESSION ---------------- */

// function deleteSession(schoolCode) {

//   if (sessions[schoolCode]) {
//     sessions[schoolCode].destroy();
//   }

//   delete sessions[schoolCode];
//   delete qrCodes[schoolCode];
//   delete readySessions[schoolCode];

//   console.log(`Deleted WhatsApp session for ${schoolCode}`);
// }

// /* ---------------- SEND POSTER ---------------- */

// async function sendPoster(schoolCode, number, posterPath) {

//   try {

//     if (!readySessions[schoolCode]) {
//       console.log("⚠ WhatsApp not ready yet");
//       return;
//     }

//     const client = sessions[schoolCode];

//     const numberId = await client.getNumberId(number);

//     if (!numberId) {
//       console.log("❌ Number not on WhatsApp:", number);
//       return;
//     }

//     const media = MessageMedia.fromFilePath(posterPath);

//     await client.sendMessage(numberId._serialized, media);

//     console.log("✅ Poster sent to", number);

//     await new Promise(r => setTimeout(r, 2000)); // anti-spam delay

//   } catch (err) {

//     console.error("❌ Failed to send poster:", err);

//   }

// }

// /* ---------------- SEND TEXT MESSAGE ---------------- */

async function sendTextMessage(schoolCode, number, message) {

  try {

    if (!readySessions[schoolCode]) {
      console.log("⚠ WhatsApp not ready yet");
      return;
    }

    const client = sessions[schoolCode];

    const chatId = `91${number}@c.us`;

    await client.sendMessage(chatId, message);

    console.log("✅ Message sent to", number);

    await new Promise(r => setTimeout(r, 2000));

  } catch (err) {

    console.error("❌ Failed to send message:", err);

  }

}

// const DEFAULT_SCHOOL = process.env.WHATSAPP_DEFAULT_SCHOOL || "";
// if (DEFAULT_SCHOOL && !sessions[DEFAULT_SCHOOL] && !initializing[DEFAULT_SCHOOL]) {
//   createSession(DEFAULT_SCHOOL);
// }
// /* ---------------- GET QR CODE ---------------- */
// async function respondWithQrOrReady(schoolCode, res) {
//   const code = String(schoolCode || "").trim();
//   if (!code) return res.status(400).json({ success: false, message: "Missing schoolCode" });

//   if (!sessions[code]) {
//     createSession(code);
//   }

//   if (readySessions[code]) return res.json({ success: true, ready: true });
//   if (qrCodes[code]) return res.json({ success: true, ready: false, qr: qrCodes[code] });

//   const start = Date.now();
//   while (Date.now() - start < 30000) {
//     if (readySessions[code]) return res.json({ success: true, ready: true });
//     if (qrCodes[code]) return res.json({ success: true, ready: false, qr: qrCodes[code] });
//     await new Promise((r) => setTimeout(r, 500));
//   }

//   return res.json({
//     success: true,
//     ready: false,
//     qr: null,
//     message: "QR not generated yet (poll again)"
//   });
// }

// // Legacy endpoint used by some frontends
// app.get("/api/whatsapp-qr/:schoolCode", async (req, res) => {
//   return respondWithQrOrReady(req.params.schoolCode, res);
// });

// // Endpoint used by dashboardupload-style frontend
// app.get("/api/whatsapp/qr", async (req, res) => {
//   return respondWithQrOrReady(req.query.schoolCode, res);
// });

// /* ---------------- WHATSAPP STATUS ---------------- */
// app.get("/api/whatsapp-status/:schoolCode", (req, res) => {
//   const { schoolCode } = req.params;
//   res.json({ status: readySessions[schoolCode] ? "connected" : "not_connected" });
// });

// app.get("/api/whatsapp/status", (req, res) => {
//   const schoolCode = String(req.query.schoolCode || "");
//   res.json({ status: readySessions[schoolCode] ? "connected" : "not_connected" });
// });

app.post("/api/whatsapp-reset/:schoolCode", async (req, res) => {
  const schoolCode = sanitizeSchoolCode(req.params.schoolCode);
  if (!schoolCode) {
    return res.status(400).json({ success: false, message: "Missing schoolCode" });
  }

  const sessionDir = path.join(sessionsFolder, `session-${schoolCode}`);
  try {
    const client = sessions[schoolCode];
    if (client) {
      try {
        await client.logout();
      } catch (_) {}
      try {
        await client.destroy();
      } catch (_) {}
    }

    delete sessions[schoolCode];
    delete qrCodes[schoolCode];
    delete readySessions[schoolCode];

    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch (_) {}

    if (typeof createSession === "function") {
      createSession(schoolCode);
    }

    return res.json({ success: true, message: "Session reset. Scan QR again." });
  } catch (err) {
    console.error("❌ Failed to reset WhatsApp session:", err?.message || err);
    return res.status(500).json({
      success: false,
      message: "Failed to reset WhatsApp session",
    });
  }
});

app.get("/api/whatsapp/status", (req, res) => {
  const schoolCode = sanitizeSchoolCode(req.query.schoolCode);
  if (!schoolCode) {
    return res.status(400).json({ success: false, message: "Missing schoolCode" });
  }

  const connected = getConnectedWhatsAppState(schoolCode);
  const connectedNumber = String(
    connected.clientState?.number ||
      connected.clientState?.client?.info?.wid?.user ||
      ""
  ).trim();

  return res.json({
    success: true,
    schoolCode,
    ready: Boolean(connected.clientState?.client && connected.clientState?.ready),
    connectedNumber: connectedNumber || null,
    hasClient: Boolean(connected.clientState?.client),
  });
});

const lastAutoImageSendStatusBySchool = new Map();

function saveAutoImageSendStatus(schoolCode, payload) {
  const key = sanitizeSchoolCode(schoolCode);
  if (!key) return null;
  const record = {
    schoolCode: key,
    updatedAt: new Date().toISOString(),
    ...payload,
  };
  lastAutoImageSendStatusBySchool.set(key, record);
  return record;
}

function getAutoImageSendStatus(schoolCode) {
  const key = sanitizeSchoolCode(schoolCode);
  if (!key) return null;
  return lastAutoImageSendStatusBySchool.get(key) || null;
}

app.get("/api/auto-image/status", (req, res) => {
  const schoolCode = sanitizeSchoolCode(req.query.schoolCode);
  if (!schoolCode) {
    return res.status(400).json({ success: false, message: "Missing schoolCode" });
  }

  return res.json({
    success: true,
    data: getAutoImageSendStatus(schoolCode),
  });
});

// /* ---------------- SEND TEST MESSAGE ---------------- */
app.post("/api/send-test/:schoolCode", async (req, res) => {
  const { schoolCode } = req.params;
  const { number, message } = req.body;

  try {
    await sendTextMessage(schoolCode, number, message);
    res.json({ success: true, message: "Message sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});
app.use("/posters", express.static(postersDir));
app.use("/schoolPhotos", express.static(schoolPhotosDir));
// Function to create a school-specific connection
const schoolPools = {};
const schoolSchemaInitPromises = {};
const adminCalendarSchemaInitPromises = {};

async function ensureColumn(pool, tableName, columnName, ddlDefinition) {
  const [rows] = await pool.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );

  if (!rows.length) {
    await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN ${ddlDefinition}`);
    console.log(`✅ Added column ${tableName}.${columnName}`);
  }
}

function normalizeFeeColumnBase(feeName) {
  const normalized = String(feeName || "")
    .trim()
    .toLowerCase()
    .replace(/\bfees?\b/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  if (!normalized) return "";
  return /^[0-9]/.test(normalized) ? `fee_${normalized}` : normalized;
}

const STATIC_FEE_BASES = new Set([
  "tuition",
  "admission",
  "exam",
  "bus",
  "uniform",
  "books",
  "book",
  "other",
  "others",
  "previousfeedue",
  "previous_due",
  "residential",
  "saving",
  "savings",
]);

function buildSqlSum(columns) {
  if (!Array.isArray(columns) || !columns.length) return "0";
  return columns.map((columnName) => `IFNULL(${columnName},0)`).join(" + ");
}

async function getActiveDynamicFeeColumns(pool, schoolCode) {
  await ensureSchoolSchemaOnce(schoolCode, pool);

  const [rows] = await pool.query(
    `SELECT fee_name
     FROM fee_type_master
     WHERE schoolCode = ? AND is_active = 1
     ORDER BY id ASC`,
    [schoolCode]
  );

  const seen = new Set();
  return rows
    .map((row) => normalizeFeeColumnBase(row?.fee_name))
    .filter((base) => base && !STATIC_FEE_BASES.has(base))
    .filter((base) => {
      if (seen.has(base)) return false;
      seen.add(base);
      return true;
    })
    .map((base) => ({
      base,
      feeColumn: `\`${base}\``,
      paidColumn: `\`${base}_paid\``,
      dueColumn: `\`${base}_due\``,
    }));
}

function buildDynamicFeeSelectSql(dynamicFeeColumns, options = {}) {
  const { includeFee = true, includePaid = true, includeDue = true, sourceAlias = "" } = options;
  const prefix = sourceAlias ? `${sourceAlias}.` : "";

  return dynamicFeeColumns
    .flatMap(({ base, feeColumn, paidColumn, dueColumn }) => {
      const parts = [];
      if (includeFee) parts.push(`IFNULL(${prefix}${feeColumn},0) AS \`${base}\``);
      if (includePaid) parts.push(`IFNULL(${prefix}${paidColumn},0) AS \`${base}_paid\``);
      if (includeDue) parts.push(`IFNULL(${prefix}${dueColumn},0) AS \`${base}_due\``);
      return parts;
    })
    .join(",\n      ");
}

async function ensureFeeTypeColumns(pool, feeName) {
  const base = normalizeFeeColumnBase(feeName);
  if (!base) return;

  await ensureColumn(pool, "FeesDetails", base, `\`${base}\` DECIMAL(10,2) DEFAULT 0.00`);
  await ensureColumn(pool, "FeesDetails", `${base}_paid`, `\`${base}_paid\` DECIMAL(10,2) DEFAULT 0.00`);
  await ensureColumn(pool, "FeesDetails", `${base}_due`, `\`${base}_due\` DECIMAL(10,2) DEFAULT 0.00`);
  await ensureColumn(pool, "FeesDetails", `${base}_discount`, `\`${base}_discount\` DECIMAL(10,2) DEFAULT 0.00`);
}

async function ensureSchoolSchema(schoolCode, pool) {
  // Create dynamic fee type master table in each school DB
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fee_type_master (
      id INT AUTO_INCREMENT PRIMARY KEY,
      schoolCode VARCHAR(100) NOT NULL,
      fee_name VARCHAR(100) NOT NULL,
      fees_type VARCHAR(100) DEFAULT 'Custom Fee',
      scope ENUM('All','Class wise','Individual') DEFAULT 'All',
      frequency ENUM('One time','Term wise') DEFAULT 'One time',
      installments INT DEFAULT 1,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_fee_type_school (schoolCode, fee_name)
    )
  `);

  await pool.query(`
    ALTER TABLE fee_type_master
    MODIFY COLUMN scope ENUM('All','Class wise','Individual') DEFAULT 'All'
  `).catch((error) => {
    if (error?.code !== "ER_BAD_FIELD_ERROR" && error?.code !== "ER_CANT_DROP_FIELD_OR_KEY") {
      if (!String(error?.message || "").includes("Data truncated")) {
        console.warn("⚠️ Unable to update fee_type_master.scope enum:", error.message);
      }
    }
  });

  // Ensure Saving columns in FeesDetails
  await ensureColumn(pool, "FeesDetails", "Saving_Fees", "Saving_Fees DECIMAL(10,2) DEFAULT 0.00");
  await ensureColumn(pool, "FeesDetails", "Saving_paid", "Saving_paid DECIMAL(10,2) DEFAULT 0.00");
  await ensureColumn(pool, "FeesDetails", "Saving_Due", "Saving_Due DECIMAL(10,2) DEFAULT 0.00");

  const [feeTypeRows] = await pool.query(
    `SELECT fee_name
     FROM fee_type_master
     WHERE schoolCode = ? AND is_active = 1`,
    [schoolCode]
  );

  for (const row of feeTypeRows) {
    await ensureFeeTypeColumns(pool, row.fee_name);
  }

  console.log(`✅ Schema ensured for school DB: ${schoolCode}`);
}

function ensureSchoolSchemaOnce(schoolCode, pool) {
  if (!schoolSchemaInitPromises[schoolCode]) {
    schoolSchemaInitPromises[schoolCode] = ensureSchoolSchema(schoolCode, pool).catch((err) => {
      console.error(`❌ Schema init failed for ${schoolCode}:`, err.message);
      delete schoolSchemaInitPromises[schoolCode];
      throw err;
    });
  }
  return schoolSchemaInitPromises[schoolCode];
}

function getDatabaseConnection(schoolCode) {
  if (!schoolPools[schoolCode]) {
  schoolPools[schoolCode] = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
      database: schoolCode,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    console.log(`🟢 Pool created for ${schoolCode}`);
    // Run schema creation/migration once per school database.
    ensureSchoolSchemaOnce(schoolCode, schoolPools[schoolCode]).catch(() => {
      // Keep API responsive; per-request handlers can retry through the same promise helper.
    });
  }
  return schoolPools[schoolCode];
}

async function ensureAdminCalendarTables(schoolCode, pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_announcements (
      id INT NOT NULL AUTO_INCREMENT,
      schoolCode VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(100) DEFAULT 'General',
      announcement_date DATE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_admin_announcements_school (schoolCode),
      KEY idx_admin_announcements_date (announcement_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_events (
      id INT NOT NULL AUTO_INCREMENT,
      schoolCode VARCHAR(100) NOT NULL,
      event_name VARCHAR(255) NOT NULL,
      event_type VARCHAR(100) DEFAULT 'General',
      event_date DATE NOT NULL,
      event_time TIME DEFAULT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_admin_events_school (schoolCode),
      KEY idx_admin_events_date (event_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_meetings (
      id INT NOT NULL AUTO_INCREMENT,
      schoolCode VARCHAR(100) NOT NULL,
      meeting_title VARCHAR(255) NOT NULL,
      meeting_date DATE NOT NULL,
      meeting_time TIME DEFAULT NULL,
      agenda TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_admin_meetings_school (schoolCode),
      KEY idx_admin_meetings_date (meeting_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_event_poster_dispatch (
      id BIGINT NOT NULL AUTO_INCREMENT,
      schoolCode VARCHAR(100) NOT NULL,
      class_name VARCHAR(50) NOT NULL,
      section VARCHAR(50) NOT NULL,
      student_id INT NULL,
      student_name VARCHAR(255) NULL,
      phone_no VARCHAR(30) NULL,
      template_id VARCHAR(100) NOT NULL,
      template_path VARCHAR(255) NOT NULL,
      event_date DATE NULL,
      event_time TIME NULL,
      audience VARCHAR(30) DEFAULT 'Student',
      status VARCHAR(30) DEFAULT 'queued',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_admin_event_poster_dispatch_school (schoolCode),
      KEY idx_admin_event_poster_dispatch_class_sec (class_name, section),
      KEY idx_admin_event_poster_dispatch_date (event_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_store_items (
      id INT NOT NULL AUTO_INCREMENT,
      schoolCode VARCHAR(100) NOT NULL,
      category_type VARCHAR(120) DEFAULT 'Books / Other',
      title VARCHAR(255) NOT NULL,
      units DECIMAL(10,2) DEFAULT 0.00,
      price_per_unit DECIMAL(10,2) DEFAULT 0.00,
      shortage_reminder INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_admin_store_items_school (schoolCode),
      KEY idx_admin_store_items_title (title)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_store_vendors (
      id INT NOT NULL AUTO_INCREMENT,
      schoolCode VARCHAR(100) NOT NULL,
      company VARCHAR(255) NOT NULL,
      address TEXT,
      item_supply VARCHAR(255),
      contact_name VARCHAR(255),
      contact_number VARCHAR(60),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_admin_store_vendors_school (schoolCode),
      KEY idx_admin_store_vendors_company (company)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_store_orders (
      id INT NOT NULL AUTO_INCREMENT,
      schoolCode VARCHAR(100) NOT NULL,
      item_type VARCHAR(120) NOT NULL,
      item_title VARCHAR(255) NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      vendor_name VARCHAR(255),
      order_date DATE DEFAULT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'purchase',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_admin_store_orders_school (schoolCode),
      KEY idx_admin_store_orders_status (status),
      KEY idx_admin_store_orders_date (order_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  console.log(`✅ Admin calendar tables ensured for school DB: ${schoolCode}`);
}

function ensureAdminCalendarTablesOnce(schoolCode, pool) {
  if (!adminCalendarSchemaInitPromises[schoolCode]) {
    adminCalendarSchemaInitPromises[schoolCode] = ensureAdminCalendarTables(schoolCode, pool).catch((err) => {
      console.error(`❌ Admin calendar schema init failed for ${schoolCode}:`, err.message);
      delete adminCalendarSchemaInitPromises[schoolCode];
      throw err;
    });
  }

  return adminCalendarSchemaInitPromises[schoolCode];
}

const NOTIFICATION_LOG_TABLE = "push_notification_log";

const notificationRoomName = (schoolCode) => `school:${String(schoolCode || "").trim()}`;

const getKolkataDateString = (value = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value instanceof Date ? value : new Date(value));

const getKolkataMonthDayString = (value = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    month: "2-digit",
    day: "2-digit",
  }).format(value instanceof Date ? value : new Date(value));

const formatNotificationEventTime = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const [hour = "00", minute = "00"] = raw.split(":");
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
};

async function ensureNotificationLogTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${NOTIFICATION_LOG_TABLE} (
      id INT NOT NULL AUTO_INCREMENT,
      schoolCode VARCHAR(100) NOT NULL,
      notification_key VARCHAR(255) NOT NULL,
      notification_type VARCHAR(50) NOT NULL,
      ref_id VARCHAR(100) DEFAULT NULL,
      title VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      payload JSON DEFAULT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_notification_key (notification_key),
      KEY idx_notification_school (schoolCode),
      KEY idx_notification_type (notification_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function hasNotificationBeenSent(pool, notificationKey) {
  const [rows] = await pool.query(
    `SELECT id FROM ${NOTIFICATION_LOG_TABLE} WHERE notification_key = ? LIMIT 1`,
    [notificationKey]
  );
  return rows.length > 0;
}

async function storeNotificationLog(pool, entry) {
  const payload = entry.payload ? JSON.stringify(entry.payload) : null;
  await pool.query(
    `INSERT INTO ${NOTIFICATION_LOG_TABLE}
      (schoolCode, notification_key, notification_type, ref_id, title, body, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.schoolCode,
      entry.notificationKey,
      entry.notificationType,
      entry.refId || null,
      entry.title,
      entry.body,
      payload,
    ]
  );
}

function broadcastSchoolNotification(schoolCode, payload) {
  const room = notificationRoomName(schoolCode);
  if (!notificationIo) {
    console.warn(`[NOTIFY] Socket server not ready for ${room}`);
    return;
  }

  notificationIo.to(room).emit("school-notification", payload);
  console.log(`[NOTIFY] Broadcasted to ${room}: ${payload?.title || "Notification"}`);
}

async function getNotificationSchools(targetSchoolCode = "") {
  const specificSchoolCode = String(targetSchoolCode || "").trim();
  if (specificSchoolCode) {
    return [{ institute_name: specificSchoolCode, database_name: specificSchoolCode }];
  }

  const [schools] = await novaPool.query(
    "SELECT institute_name, database_name FROM Seller WHERE database_name IS NOT NULL AND database_name <> ''"
  );
  return Array.isArray(schools) ? schools : [];
}

async function sendBirthdayNotificationsForSchool(schoolCode, pool, dateValue = new Date()) {
  await ensureNotificationLogTable(pool);

  const todayMonthDay = getKolkataMonthDayString(dateValue);
  const [rows] = await pool.query(
    `
      SELECT id, username, name, dob
      FROM management_login_creation
      WHERE dob IS NOT NULL
        AND DATE_FORMAT(dob, '%m-%d') = ?
    `,
    [todayMonthDay]
  );

  const results = [];
  for (const row of rows) {
    const studentName = String(row.name || row.username || "Member").trim();
    const notificationKey = `birthday:${schoolCode}:${row.id}:${todayMonthDay}`;
    if (await hasNotificationBeenSent(pool, notificationKey)) {
      continue;
    }

    const title = `Happy Birthday, ${studentName}`;
    const body = `Today is ${studentName}'s birthday. Let's celebrate and send warm wishes.`;
    const payload = {
      schoolCode,
      type: "birthday",
      title,
      body,
      refId: String(row.id),
      date: getKolkataDateString(dateValue),
      studentName,
    };

    await storeNotificationLog(pool, {
      schoolCode,
      notificationKey,
      notificationType: "birthday",
      refId: String(row.id),
      title,
      body,
      payload,
    });
    broadcastSchoolNotification(schoolCode, payload);
    results.push(payload);
  }

  return results;
}

async function sendEventNotificationsForSchool(schoolCode, pool, dateValue = new Date()) {
  await ensureNotificationLogTable(pool);
  await ensureAdminCalendarTablesOnce(schoolCode, pool);

  const today = getKolkataDateString(dateValue);
  const [rows] = await pool.query(
    `
      SELECT id, event_name, event_type, event_date, event_time, description
      FROM admin_events
      WHERE event_date = ?
      ORDER BY event_time IS NULL, event_time ASC, id ASC
    `,
    [today]
  );

  const results = [];
  for (const row of rows) {
    const eventName = String(row.event_name || "Event").trim();
    const eventTime = formatNotificationEventTime(row.event_time);
    const notificationKey = `event:${schoolCode}:${row.id}:${today}`;
    if (await hasNotificationBeenSent(pool, notificationKey)) {
      continue;
    }

    const title = `Event Today: ${eventName}`;
    const body = eventTime
      ? `${eventName} is scheduled today at ${eventTime}.`
      : `${eventName} is scheduled today.`;
    const payload = {
      schoolCode,
      type: "event",
      title,
      body,
      refId: String(row.id),
      date: today,
      eventName,
      eventTime: eventTime || null,
      eventType: row.event_type || "General",
      description: row.description || "",
    };

    await storeNotificationLog(pool, {
      schoolCode,
      notificationKey,
      notificationType: "event",
      refId: String(row.id),
      title,
      body,
      payload,
    });
    broadcastSchoolNotification(schoolCode, payload);
    results.push(payload);
  }

  return results;
}

async function sendBirthdayPushNotificationsForSchool(schoolCode, pool, dateValue = new Date()) {
  await ensureNotificationLogTable(pool);

  const todayMonthDay = getKolkataMonthDayString(dateValue);
  const todayDate = getKolkataDateString(dateValue);
  console.log(`[BIRTHDAY-PUSH][${schoolCode}] Scan started for ${todayDate} (${todayMonthDay})`);

  const [rows] = await pool.query(
    `
      SELECT
        mlc.id,
        mlc.username,
        mlc.name,
        mlc.user_type,
        mlc.dob,
        ut.push_token
      FROM management_login_creation mlc
      LEFT JOIN user_tokens ut ON ut.username = mlc.username
      WHERE mlc.is_deleted = 0
        AND mlc.dob IS NOT NULL
        AND DATE_FORMAT(mlc.dob, '%m-%d') = ?
        AND mlc.username IS NOT NULL
        AND TRIM(mlc.username) <> ''
    `,
    [todayMonthDay]
  );

  console.log(`[BIRTHDAY-PUSH][${schoolCode}] Birthday matches found: ${rows.length}`);

  const summary = {
    total: rows.length,
    sent: 0,
    skippedNoToken: 0,
    skippedAlreadySent: 0,
    invalidTokenPruned: 0,
    failed: 0,
  };

  for (const row of rows) {
    const username = String(row.username || "").trim();
    const displayName = String(row.name || username || "Member").trim();
    const pushToken = String(row.push_token || "").trim();
    const notificationKey = `birthday-push:${schoolCode}:${row.id}:${todayMonthDay}`;

    if (await hasNotificationBeenSent(pool, notificationKey)) {
      summary.skippedAlreadySent += 1;
      console.log(`[BIRTHDAY-PUSH][${schoolCode}] Skip already sent: id=${row.id}, username=${username}`);
      continue;
    }

    if (!pushToken) {
      summary.skippedNoToken += 1;
      console.log(`[BIRTHDAY-PUSH][${schoolCode}] Skip no token: id=${row.id}, username=${username}`);
      continue;
    }

    if (!firebasePushEnabled) {
      summary.failed += 1;
      console.warn(`[BIRTHDAY-PUSH][${schoolCode}] Firebase disabled; cannot send: id=${row.id}, username=${username}`);
      continue;
    }

    const message = {
      notification: {
        title: "Happy Birthday",
        body: `Happy Birthday ${displayName}! Wishing you a wonderful day.`,
      },
      token: pushToken,
      data: {
        type: "birthday_wish",
        schoolCode: String(schoolCode),
        userId: String(row.id),
        username,
      },
    };

    try {
      const responseId = await admin.messaging().send(message);
      summary.sent += 1;
      console.log(`[BIRTHDAY-PUSH][${schoolCode}] Sent: id=${row.id}, username=${username}, messageId=${responseId}`);

      await storeNotificationLog(pool, {
        schoolCode,
        notificationKey,
        notificationType: "birthday_push",
        refId: String(row.id),
        title: message.notification.title,
        body: message.notification.body,
        payload: {
          type: "birthday_wish",
          userId: String(row.id),
          username,
          sentAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      summary.failed += 1;
      const errorCode = String(error?.code || "").trim();
      const errorMessage = String(error?.message || error || "").trim();
      console.error(
        `[BIRTHDAY-PUSH][${schoolCode}] Failed: id=${row.id}, username=${username}, user_type=${row.user_type || "-"}, code=${errorCode || "-"}, error=${errorMessage}`
      );

      const isPermanentTokenError =
        errorCode === "messaging/registration-token-not-registered" ||
        errorCode === "messaging/invalid-registration-token" ||
        errorCode === "messaging/mismatched-credential" ||
        /senderid mismatch/i.test(errorMessage);

      if (isPermanentTokenError && username) {
        try {
          const [updateResult] = await pool.query(
            `UPDATE user_tokens
             SET push_token = NULL
             WHERE username = ?
               AND push_token = ?`,
            [username, pushToken]
          );
          summary.invalidTokenPruned += Number(updateResult?.affectedRows || 0);
          console.warn(
            `[BIRTHDAY-PUSH][${schoolCode}] Pruned invalid token for username=${username}, affectedRows=${updateResult?.affectedRows || 0}`
          );
        } catch (pruneErr) {
          console.error(
            `[BIRTHDAY-PUSH][${schoolCode}] Failed pruning token for username=${username}: ${pruneErr?.message || pruneErr}`
          );
        }
      }
    }
  }

  console.log(`[BIRTHDAY-PUSH][${schoolCode}] Summary:`, summary);
  return summary;
}

async function sendEventPushNotificationsForSchool(schoolCode, pool, dateValue = new Date()) {
  await ensureNotificationLogTable(pool);
  await ensureAdminCalendarTablesOnce(schoolCode, pool);

  const today = getKolkataDateString(dateValue);
  console.log(`[EVENT-PUSH][${schoolCode}] Scan started for date=${today}`);

  const [events] = await pool.query(
    `
      SELECT id, event_name, event_type, event_date, event_time, description
      FROM admin_events
      WHERE event_date = ?
      ORDER BY event_time IS NULL, event_time ASC, id ASC
    `,
    [today]
  );

  console.log(`[EVENT-PUSH][${schoolCode}] Events found: ${events.length}`);
  if (!events.length) {
    return {
      events: 0,
      recipients: 0,
      sent: 0,
      skippedNoToken: 0,
      skippedAlreadySent: 0,
      invalidTokenPruned: 0,
      failed: 0,
    };
  }

  const [users] = await pool.query(
    `
      SELECT
        mlc.id,
        mlc.username,
        mlc.name,
        mlc.user_type,
        ut.push_token
      FROM management_login_creation mlc
      LEFT JOIN user_tokens ut ON ut.username = mlc.username
      WHERE mlc.is_deleted = 0
        AND mlc.username IS NOT NULL
        AND TRIM(mlc.username) <> ''
    `
  );

  console.log(`[EVENT-PUSH][${schoolCode}] Recipients found: ${users.length}`);

  const summary = {
    events: events.length,
    recipients: users.length,
    sent: 0,
    skippedNoToken: 0,
    skippedAlreadySent: 0,
    invalidTokenPruned: 0,
    failed: 0,
  };

  for (const eventRow of events) {
    const eventName = String(eventRow.event_name || "Event").trim();
    const eventTime = formatNotificationEventTime(eventRow.event_time);
    const title = `Event Today: ${eventName}`;
    const body = eventTime
      ? `${eventName} is scheduled today at ${eventTime}.`
      : `${eventName} is scheduled today.`;

    for (const userRow of users) {
      const username = String(userRow.username || "").trim();
      const pushToken = String(userRow.push_token || "").trim();
      const notificationKey = `event-push:${schoolCode}:${eventRow.id}:${today}:${username}`;

      if (await hasNotificationBeenSent(pool, notificationKey)) {
        summary.skippedAlreadySent += 1;
        continue;
      }

      if (!pushToken) {
        summary.skippedNoToken += 1;
        continue;
      }

      if (!firebasePushEnabled) {
        summary.failed += 1;
        console.warn(`[EVENT-PUSH][${schoolCode}] Firebase disabled; cannot send: eventId=${eventRow.id}, username=${username}`);
        continue;
      }

      const message = {
        notification: { title, body },
        token: pushToken,
        data: {
          type: "event_today",
          schoolCode: String(schoolCode),
          eventId: String(eventRow.id),
          eventName,
          username,
        },
      };

      try {
        const responseId = await admin.messaging().send(message);
        summary.sent += 1;
        console.log(
          `[EVENT-PUSH][${schoolCode}] Sent: eventId=${eventRow.id}, username=${username}, messageId=${responseId}`
        );

        await storeNotificationLog(pool, {
          schoolCode,
          notificationKey,
          notificationType: "event_push",
          refId: String(eventRow.id),
          title,
          body,
          payload: {
            type: "event_today",
            eventId: String(eventRow.id),
            eventName,
            username,
            sentAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        summary.failed += 1;
        const errorCode = String(error?.code || "").trim();
        const errorMessage = String(error?.message || error || "").trim();
        console.error(
          `[EVENT-PUSH][${schoolCode}] Failed: eventId=${eventRow.id}, username=${username}, code=${errorCode || "-"}, error=${errorMessage}`
        );

        const isPermanentTokenError =
          errorCode === "messaging/registration-token-not-registered" ||
          errorCode === "messaging/invalid-registration-token" ||
          errorCode === "messaging/mismatched-credential" ||
          /senderid mismatch/i.test(errorMessage);

        if (isPermanentTokenError && username) {
          try {
            const [updateResult] = await pool.query(
              `UPDATE user_tokens
               SET push_token = NULL
               WHERE username = ?
                 AND push_token = ?`,
              [username, pushToken]
            );
            summary.invalidTokenPruned += Number(updateResult?.affectedRows || 0);
            console.warn(
              `[EVENT-PUSH][${schoolCode}] Pruned invalid token for username=${username}, affectedRows=${updateResult?.affectedRows || 0}`
            );
          } catch (pruneErr) {
            console.error(
              `[EVENT-PUSH][${schoolCode}] Failed pruning token for username=${username}: ${pruneErr?.message || pruneErr}`
            );
          }
        }
      }
    }
  }

  console.log(`[EVENT-PUSH][${schoolCode}] Summary:`, summary);
  return summary;
}

async function scanAndBroadcastTodayNotifications(targetSchoolCode = "") {
  const schools = await getNotificationSchools(targetSchoolCode);
  const summary = {
    schools: 0,
    birthdays: 0,
    events: 0,
  };

  for (const schoolRow of schools) {
    const schoolCode = String(schoolRow.database_name || schoolRow.institute_name || "").trim();
    if (!schoolCode) continue;

    try {
      const pool = getDatabaseConnection(schoolCode);
      summary.schools += 1;
      const [birthdayResults, eventResults] = await Promise.all([
        sendBirthdayNotificationsForSchool(schoolCode, pool),
        sendEventNotificationsForSchool(schoolCode, pool),
      ]);
      summary.birthdays += birthdayResults.length;
      summary.events += eventResults.length;
    } catch (error) {
      console.error(`[NOTIFY][${schoolCode}] Failed to scan today notifications:`, error);
    }
  }

  return summary;
}

async function scanAndSendBirthdayPushNotifications(targetSchoolCode = "") {
  const schools = await getNotificationSchools(targetSchoolCode);
  const summary = {
    schools: 0,
    totalMatches: 0,
    sent: 0,
    skippedNoToken: 0,
    skippedAlreadySent: 0,
    invalidTokenPruned: 0,
    failed: 0,
  };

  for (const schoolRow of schools) {
    const schoolCode = String(schoolRow.database_name || schoolRow.institute_name || "").trim();
    if (!schoolCode) continue;

    try {
      const pool = getDatabaseConnection(schoolCode);
      summary.schools += 1;
      const schoolSummary = await sendBirthdayPushNotificationsForSchool(schoolCode, pool);
      summary.totalMatches += schoolSummary.total;
      summary.sent += schoolSummary.sent;
      summary.skippedNoToken += schoolSummary.skippedNoToken;
      summary.skippedAlreadySent += schoolSummary.skippedAlreadySent;
      summary.invalidTokenPruned += schoolSummary.invalidTokenPruned;
      summary.failed += schoolSummary.failed;
    } catch (error) {
      summary.failed += 1;
      console.error(`[BIRTHDAY-PUSH][${schoolCode}] School scan failed:`, error?.message || error);
    }
  }

  return summary;
}

async function scanAndSendEventPushNotifications(targetSchoolCode = "") {
  const schools = await getNotificationSchools(targetSchoolCode);
  const summary = {
    schools: 0,
    events: 0,
    recipients: 0,
    sent: 0,
    skippedNoToken: 0,
    skippedAlreadySent: 0,
    invalidTokenPruned: 0,
    failed: 0,
  };

  for (const schoolRow of schools) {
    const schoolCode = String(schoolRow.database_name || schoolRow.institute_name || "").trim();
    if (!schoolCode) continue;

    try {
      const pool = getDatabaseConnection(schoolCode);
      summary.schools += 1;
      const schoolSummary = await sendEventPushNotificationsForSchool(schoolCode, pool);
      summary.events += schoolSummary.events;
      summary.recipients += schoolSummary.recipients;
      summary.sent += schoolSummary.sent;
      summary.skippedNoToken += schoolSummary.skippedNoToken;
      summary.skippedAlreadySent += schoolSummary.skippedAlreadySent;
      summary.invalidTokenPruned += schoolSummary.invalidTokenPruned;
      summary.failed += schoolSummary.failed;
    } catch (error) {
      summary.failed += 1;
      console.error(`[EVENT-PUSH][${schoolCode}] School scan failed:`, error?.message || error);
    }
  }

  return summary;
}

app.post("/api/admin-announcements", async (req, res) => {
  const schoolCode = String(req.body.schoolCode || "").trim();
  const title = String(req.body.title || "").trim();
  const category = String(req.body.category || "General").trim();
  const announcementDate = String(req.body.announcementDate || "").trim();
  const description = String(req.body.description || "").trim();

  if (!schoolCode || !title || !announcementDate) {
    return res.status(400).json({
      success: false,
      message: "schoolCode, title, and announcementDate are required",
    });
  }

  try {
    const pool = getDatabaseConnection(schoolCode);
    await ensureAdminCalendarTablesOnce(schoolCode, pool);

    const [result] = await pool.query(
      `INSERT INTO admin_announcements
        (schoolCode, title, category, announcement_date, description)
       VALUES (?, ?, ?, ?, ?)`,
      [schoolCode, title, category || "General", announcementDate, description || null]
    );

    const [rows] = await pool.query(
      `SELECT
        id,
        title,
        category,
        announcement_date AS announcementDate,
        description,
        created_at AS createdAt
      FROM admin_announcements
      WHERE id = ?`,
      [result.insertId]
    );

    return res.status(201).json({ success: true, data: rows[0] || null });
  } catch (error) {
    console.error("❌ Failed to create admin announcement:", error);
    return res.status(500).json({ success: false, message: "Failed to create announcement" });
  }
});

app.get("/api/admin-announcements", async (req, res) => {
  const schoolCode = String(req.query.schoolCode || "").trim();
  const year = String(req.query.year || "").trim();
  const month = String(req.query.month || "").trim();

  if (!schoolCode) {
    return res.status(400).json({ success: false, message: "schoolCode is required" });
  }

  try {
    const pool = getDatabaseConnection(schoolCode);
    await ensureAdminCalendarTablesOnce(schoolCode, pool);

    let sql = `
      SELECT
        id,
        title,
        category,
        announcement_date AS announcementDate,
        description,
        created_at AS createdAt
      FROM admin_announcements
      WHERE schoolCode = ?
    `;
    const params = [schoolCode];

    if (year) {
      sql += " AND YEAR(announcement_date) = ?";
      params.push(Number(year));
    }
    if (month) {
      sql += " AND MONTH(announcement_date) = ?";
      params.push(Number(month));
    }

    sql += " ORDER BY announcement_date DESC, id DESC";

    const [rows] = await pool.query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Failed to fetch admin announcements:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch announcements" });
  }
});

app.post("/api/admin-events", async (req, res) => {
  const schoolCode = String(req.body.schoolCode || "").trim();
  const eventName = String(req.body.eventName || "").trim();
  const eventType = String(req.body.eventType || "General").trim();
  const eventDate = String(req.body.eventDate || "").trim();
  const eventTime = String(req.body.eventTime || "").trim();
  const description = String(req.body.description || "").trim();

  if (!schoolCode || !eventName || !eventDate) {
    return res.status(400).json({
      success: false,
      message: "schoolCode, eventName, and eventDate are required",
    });
  }

  try {
    const pool = getDatabaseConnection(schoolCode);
    await ensureAdminCalendarTablesOnce(schoolCode, pool);

    const [result] = await pool.query(
      `INSERT INTO admin_events
        (schoolCode, event_name, event_type, event_date, event_time, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [schoolCode, eventName, eventType || "General", eventDate, eventTime || null, description || null]
    );

    const [rows] = await pool.query(
      `SELECT
        id,
        event_name AS eventName,
        event_type AS eventType,
        event_date AS eventDate,
        event_time AS eventTime,
        description,
        created_at AS createdAt
      FROM admin_events
      WHERE id = ?`,
      [result.insertId]
    );

    if (String(eventDate) === getKolkataDateString()) {
      await sendEventNotificationsForSchool(schoolCode, pool);
    }

    return res.status(201).json({ success: true, data: rows[0] || null });
  } catch (error) {
    console.error("❌ Failed to create admin event:", error);
    return res.status(500).json({ success: false, message: "Failed to create event" });
  }
});

app.get("/api/admin-events", async (req, res) => {
  const schoolCode = String(req.query.schoolCode || "").trim();
  const year = String(req.query.year || "").trim();
  const month = String(req.query.month || "").trim();

  if (!schoolCode) {
    return res.status(400).json({ success: false, message: "schoolCode is required" });
  }

  try {
    const pool = getDatabaseConnection(schoolCode);
    await ensureAdminCalendarTablesOnce(schoolCode, pool);

    let sql = `
      SELECT
        id,
        event_name AS eventName,
        event_type AS eventType,
        event_date AS eventDate,
        event_time AS eventTime,
        description,
        created_at AS createdAt
      FROM admin_events
      WHERE schoolCode = ?
    `;
    const params = [schoolCode];

    if (year) {
      sql += " AND YEAR(event_date) = ?";
      params.push(Number(year));
    }
    if (month) {
      sql += " AND MONTH(event_date) = ?";
      params.push(Number(month));
    }

    sql += " ORDER BY event_date DESC, event_time DESC, id DESC";

    const [rows] = await pool.query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Failed to fetch admin events:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch events" });
  }
});

app.post("/api/admin-event-posters/send", async (req, res) => {
  const schoolCode = String(req.body.schoolCode || "").trim();
  const className = String(req.body.className || "").trim();
  const section = String(req.body.section || "").trim();
  const templateId = String(req.body.templateId || "").trim().toLowerCase();
  const eventDate = String(req.body.eventDate || "").trim();
  const eventTime = String(req.body.eventTime || "").trim();
  const audience = String(req.body.audience || "Student").trim();

  const isEventTemplate = /^event[1-6]\.html$/.test(templateId);
  const isBirthdayTemplate = /^birthday[1-5]\.html$/.test(templateId);
  const validTemplate = isEventTemplate || isBirthdayTemplate;
  if (!schoolCode || !className || !section || !validTemplate) {
    return res.status(400).json({
      success: false,
      message:
        "schoolCode, className, section and valid template are required (event1-6.html or birthday1-5.html)",
    });
  }

  try {
    const pool = getDatabaseConnection(schoolCode);
    await ensureAdminCalendarTablesOnce(schoolCode, pool);

    const [students] = await pool.query(
      `
        SELECT id, name, phone_no, class_name, section
        FROM management_login_creation
        WHERE user_type = 'student'
          AND class_name = ?
          AND section = ?
          AND name IS NOT NULL
          AND TRIM(name) <> ''
      `,
      [className, section]
    );

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No students found for selected class and section",
        data: { queuedCount: 0 },
      });
    }

    const templatePath = isBirthdayTemplate ? `Bdays/${templateId}` : `Events/${templateId}`;
    const templateType = isBirthdayTemplate ? "birthday" : "event";
    const rows = students.map((student) => [
      schoolCode,
      className,
      section,
      student?.id || null,
      student?.name || null,
      student?.phone_no || null,
      templateId,
      templatePath,
      eventDate || null,
      eventTime || null,
      audience || "Student",
      "queued",
    ]);

    await pool.query(
      `
        INSERT INTO admin_event_poster_dispatch (
          schoolCode,
          class_name,
          section,
          student_id,
          student_name,
          phone_no,
          template_id,
          template_path,
          event_date,
          event_time,
          audience,
          status
        )
        VALUES ?
      `,
      [rows]
    );

    return res.status(201).json({
      success: true,
      message: "Event poster queued successfully",
      data: {
        queuedCount: rows.length,
        className,
        section,
        templateId,
        templatePath,
        templateType,
      },
    });
  } catch (error) {
    console.error("❌ Failed to queue admin event posters:", error);
    return res.status(500).json({ success: false, message: "Failed to queue event posters" });
  }
});

app.get("/api/admin-event-posters", async (req, res) => {
  const schoolCode = String(req.query.schoolCode || "").trim();
  const username = String(req.query.username || "").trim();
  const studentName = String(req.query.studentName || "").trim();
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  if (!schoolCode) {
    return res.status(400).json({ success: false, message: "schoolCode is required" });
  }

  try {
    const pool = getDatabaseConnection(schoolCode);
    await ensureAdminCalendarTablesOnce(schoolCode, pool);

    let studentId = null;
    let resolvedStudentName = studentName || null;
    let className = null;
    let section = null;

    if (username) {
      const [rows] = await pool.query(
        `
          SELECT id, name, class_name, section
          FROM management_login_creation
          WHERE schoolCode = ?
            AND user_type = 'student'
            AND username = ?
          LIMIT 1
        `,
        [schoolCode, username]
      );
      if (rows.length > 0) {
        studentId = rows[0].id || null;
        resolvedStudentName = rows[0].name || resolvedStudentName;
        className = rows[0].class_name || null;
        section = rows[0].section || null;
      }
    }

    if (!studentId && studentName) {
      const [rows] = await pool.query(
        `
          SELECT id, name, class_name, section
          FROM management_login_creation
          WHERE schoolCode = ?
            AND user_type = 'student'
            AND name = ?
          LIMIT 1
        `,
        [schoolCode, studentName]
      );
      if (rows.length > 0) {
        studentId = rows[0].id || null;
        resolvedStudentName = rows[0].name || resolvedStudentName;
        className = rows[0].class_name || null;
        section = rows[0].section || null;
      }
    }

    let sql = `
      SELECT
        id,
        class_name AS className,
        section,
        student_id AS studentId,
        student_name AS studentName,
        template_id AS templateId,
        template_path AS templatePath,
        event_date AS eventDate,
        event_time AS eventTime,
        audience,
        status,
        created_at AS createdAt
      FROM admin_event_poster_dispatch
      WHERE schoolCode = ?
    `;
    const params = [schoolCode];

    if (studentId) {
      sql += " AND student_id = ?";
      params.push(studentId);
    } else if (resolvedStudentName) {
      sql += " AND student_name = ?";
      params.push(resolvedStudentName);
    } else if (className && section) {
      sql += " AND class_name = ? AND section = ?";
      params.push(className, section);
    }

    sql += " ORDER BY id DESC LIMIT ?";
    params.push(limit);

    const [rows] = await pool.query(sql, params);
    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("❌ Failed to fetch admin event posters:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch event posters" });
  }
});

app.post("/api/admin-meetings", async (req, res) => {
  const schoolCode = String(req.body.schoolCode || "").trim();
  const meetingTitle = String(req.body.meetingTitle || "").trim();
  const meetingDate = String(req.body.meetingDate || "").trim();
  const meetingTime = String(req.body.meetingTime || "").trim();
  const agenda = String(req.body.agenda || "").trim();
  const description = String(req.body.description || "").trim();

  if (!schoolCode || !meetingTitle || !meetingDate) {
    return res.status(400).json({
      success: false,
      message: "schoolCode, meetingTitle, and meetingDate are required",
    });
  }

  try {
    const pool = getDatabaseConnection(schoolCode);
    await ensureAdminCalendarTablesOnce(schoolCode, pool);

    const [result] = await pool.query(
      `INSERT INTO admin_meetings
        (schoolCode, meeting_title, meeting_date, meeting_time, agenda, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [schoolCode, meetingTitle, meetingDate, meetingTime || null, agenda || null, description || null]
    );

    const [rows] = await pool.query(
      `SELECT
        id,
        meeting_title AS meetingTitle,
        meeting_date AS meetingDate,
        meeting_time AS meetingTime,
        agenda,
        description,
        created_at AS createdAt
      FROM admin_meetings
      WHERE id = ?`,
      [result.insertId]
    );

    return res.status(201).json({ success: true, data: rows[0] || null });
  } catch (error) {
    console.error("❌ Failed to create admin meeting:", error);
    return res.status(500).json({ success: false, message: "Failed to create meeting" });
  }
});

app.get("/api/admin-meetings", async (req, res) => {
  const schoolCode = String(req.query.schoolCode || "").trim();
  const year = String(req.query.year || "").trim();
  const month = String(req.query.month || "").trim();

  if (!schoolCode) {
    return res.status(400).json({ success: false, message: "schoolCode is required" });
  }

  try {
    const pool = getDatabaseConnection(schoolCode);
    await ensureAdminCalendarTablesOnce(schoolCode, pool);

    let sql = `
      SELECT
        id,
        meeting_title AS meetingTitle,
        meeting_date AS meetingDate,
        meeting_time AS meetingTime,
        agenda,
        description,
        created_at AS createdAt
      FROM admin_meetings
      WHERE schoolCode = ?
    `;
    const params = [schoolCode];

    if (year) {
      sql += " AND YEAR(meeting_date) = ?";
      params.push(Number(year));
    }
    if (month) {
      sql += " AND MONTH(meeting_date) = ?";
      params.push(Number(month));
    }

    sql += " ORDER BY meeting_date DESC, meeting_time DESC, id DESC";

    const [rows] = await pool.query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Failed to fetch admin meetings:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch meetings" });
  }
});

const normalizeStoreOrderStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["purchase", "request", "cancelled"].includes(normalized)) return normalized;
  return "purchase";
};

const buildStoreAssistantActions = ({ itemCount, vendorCount, orderCount, pendingChatCount, pendingPoCount }) => [
  `Track low-stock reminders for ${itemCount} item records.`,
  `Review ${vendorCount} registered vendors and verify vendor contacts.`,
  `Check ${orderCount} total orders and prioritize request/purchase follow-ups.`,
  `Resolve ${pendingChatCount} pending Live Chat requests from Store dashboard.`,
  `Process ${pendingPoCount} pending Store PO approvals.`,
];

app.post("/api/admin-store/items", async (req, res) => {
  const schoolCode = String(req.body.schoolCode || "").trim();
  const categoryType = String(req.body.categoryType || "Books / Other").trim();
  const title = String(req.body.title || "").trim();
  const units = Number(req.body.units || 0);
  const pricePerUnit = Number(req.body.pricePerUnit || 0);
  const shortageReminderRaw = req.body.shortageReminder;
  const shortageReminder =
    shortageReminderRaw === "" || shortageReminderRaw === null || shortageReminderRaw === undefined
      ? null
      : Number(shortageReminderRaw);

  if (!schoolCode || !title) {
    return res.status(400).json({ success: false, message: "schoolCode and title are required" });
  }

  try {
    const pool = getDatabaseConnection(schoolCode);
    await ensureAdminCalendarTablesOnce(schoolCode, pool);

    const [result] = await pool.query(
      `
        INSERT INTO admin_store_items
          (schoolCode, category_type, title, units, price_per_unit, shortage_reminder)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [schoolCode, categoryType || "Books / Other", title, Number.isFinite(units) ? units : 0, Number.isFinite(pricePerUnit) ? pricePerUnit : 0, Number.isFinite(shortageReminder) ? shortageReminder : null]
    );

    const [rows] = await pool.query(
      `
        SELECT
          id,
          category_type AS categoryType,
          title,
          units,
          price_per_unit AS pricePerUnit,
          shortage_reminder AS shortageReminder,
          created_at AS createdAt
        FROM admin_store_items
        WHERE id = ?
      `,
      [result.insertId]
    );

    return res.status(201).json({ success: true, data: rows[0] || null });
  } catch (error) {
    console.error("❌ Failed to create admin store item:", error);
    return res.status(500).json({ success: false, message: "Failed to create item" });
  }
});

app.get("/api/admin-store/items", async (req, res) => {
  const schoolCode = String(req.query.schoolCode || "").trim();
  if (!schoolCode) {
    return res.status(400).json({ success: false, message: "schoolCode is required" });
  }

  try {
    const pool = getDatabaseConnection(schoolCode);
    await ensureAdminCalendarTablesOnce(schoolCode, pool);

    const [rows] = await pool.query(
      `
        SELECT
          id,
          category_type AS categoryType,
          title,
          units,
          price_per_unit AS pricePerUnit,
          shortage_reminder AS shortageReminder,
          created_at AS createdAt
        FROM admin_store_items
        WHERE schoolCode = ?
        ORDER BY id DESC
      `,
      [schoolCode]
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Failed to fetch admin store items:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch items" });
  }
});

app.post("/api/admin-store/vendors", async (req, res) => {
  const schoolCode = String(req.body.schoolCode || "").trim();
  const company = String(req.body.company || "").trim();
  const address = String(req.body.address || "").trim();
  const itemSupply = String(req.body.itemSupply || "").trim();
  const contactName = String(req.body.contactName || "").trim();
  const contactNumber = String(req.body.contactNumber || "").trim();

  if (!schoolCode || !company) {
    return res.status(400).json({ success: false, message: "schoolCode and company are required" });
  }

  try {
    const pool = getDatabaseConnection(schoolCode);
    await ensureAdminCalendarTablesOnce(schoolCode, pool);

    const [result] = await pool.query(
      `
        INSERT INTO admin_store_vendors
          (schoolCode, company, address, item_supply, contact_name, contact_number)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [schoolCode, company, address || null, itemSupply || null, contactName || null, contactNumber || null]
    );

    const [rows] = await pool.query(
      `
        SELECT
          id,
          company,
          address,
          item_supply AS itemSupply,
          contact_name AS contactName,
          contact_number AS contactNumber,
          created_at AS createdAt
        FROM admin_store_vendors
        WHERE id = ?
      `,
      [result.insertId]
    );

    return res.status(201).json({ success: true, data: rows[0] || null });
  } catch (error) {
    console.error("❌ Failed to create admin store vendor:", error);
    return res.status(500).json({ success: false, message: "Failed to create vendor" });
  }
});

app.get("/api/admin-store/vendors", async (req, res) => {
  const schoolCode = String(req.query.schoolCode || "").trim();
  if (!schoolCode) {
    return res.status(400).json({ success: false, message: "schoolCode is required" });
  }

  try {
    const pool = getDatabaseConnection(schoolCode);
    await ensureAdminCalendarTablesOnce(schoolCode, pool);

    const [rows] = await pool.query(
      `
        SELECT
          id,
          company,
          address,
          item_supply AS itemSupply,
          contact_name AS contactName,
          contact_number AS contactNumber,
          created_at AS createdAt
        FROM admin_store_vendors
        WHERE schoolCode = ?
        ORDER BY id DESC
      `,
      [schoolCode]
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Failed to fetch admin store vendors:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch vendors" });
  }
});

app.post("/api/admin-store/orders", async (req, res) => {
  const schoolCode = String(req.body.schoolCode || "").trim();
  const itemType = String(req.body.itemType || "").trim();
  const itemTitle = String(req.body.itemTitle || "").trim();
  const quantity = Number(req.body.quantity || 0);
  const vendorName = String(req.body.vendorName || "").trim();
  const orderDate = String(req.body.orderDate || "").trim();
  const status = normalizeStoreOrderStatus(req.body.status);
  const notes = String(req.body.notes || "").trim();

  if (!schoolCode || !itemType || !itemTitle || !quantity) {
    return res.status(400).json({
      success: false,
      message: "schoolCode, itemType, itemTitle, and quantity are required",
    });
  }

  try {
    const pool = getDatabaseConnection(schoolCode);
    await ensureAdminCalendarTablesOnce(schoolCode, pool);

    const [result] = await pool.query(
      `
        INSERT INTO admin_store_orders
          (schoolCode, item_type, item_title, quantity, vendor_name, order_date, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [schoolCode, itemType, itemTitle, Number.isFinite(quantity) ? quantity : 1, vendorName || null, orderDate || null, status, notes || null]
    );

    const [rows] = await pool.query(
      `
        SELECT
          id,
          item_type AS itemType,
          item_title AS itemTitle,
          quantity,
          vendor_name AS vendorName,
          order_date AS orderDate,
          status,
          notes,
          created_at AS createdAt
        FROM admin_store_orders
        WHERE id = ?
      `,
      [result.insertId]
    );

    return res.status(201).json({ success: true, data: rows[0] || null });
  } catch (error) {
    console.error("❌ Failed to create admin store order:", error);
    return res.status(500).json({ success: false, message: "Failed to create order" });
  }
});

app.get("/api/admin-store/orders", async (req, res) => {
  const schoolCode = String(req.query.schoolCode || "").trim();
  const status = String(req.query.status || "").trim().toLowerCase();

  if (!schoolCode) {
    return res.status(400).json({ success: false, message: "schoolCode is required" });
  }

  try {
    const pool = getDatabaseConnection(schoolCode);
    await ensureAdminCalendarTablesOnce(schoolCode, pool);

    let sql = `
      SELECT
        id,
        item_type AS itemType,
        item_title AS itemTitle,
        quantity,
        vendor_name AS vendorName,
        order_date AS orderDate,
        status,
        notes,
        created_at AS createdAt
      FROM admin_store_orders
      WHERE schoolCode = ?
    `;
    const params = [schoolCode];

    if (status) {
      sql += " AND status = ?";
      params.push(normalizeStoreOrderStatus(status));
    }

    sql += " ORDER BY id DESC";
    const [rows] = await pool.query(sql, params);

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Failed to fetch admin store orders:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
});

app.get("/api/admin-store/dashboard", async (req, res) => {
  const schoolCode = String(req.query.schoolCode || "").trim();
  if (!schoolCode) {
    return res.status(400).json({ success: false, message: "schoolCode is required" });
  }

  try {
    const pool = getDatabaseConnection(schoolCode);
    await ensureAdminCalendarTablesOnce(schoolCode, pool);

    const [items] = await pool.query(
      `
        SELECT
          id,
          category_type AS categoryType,
          title,
          units,
          price_per_unit AS pricePerUnit,
          shortage_reminder AS shortageReminder,
          created_at AS createdAt
        FROM admin_store_items
        WHERE schoolCode = ?
        ORDER BY id DESC
        LIMIT 50
      `,
      [schoolCode]
    );

    const [vendors] = await pool.query(
      `
        SELECT
          id,
          company,
          address,
          item_supply AS itemSupply,
          contact_name AS contactName,
          contact_number AS contactNumber,
          created_at AS createdAt
        FROM admin_store_vendors
        WHERE schoolCode = ?
        ORDER BY id DESC
        LIMIT 50
      `,
      [schoolCode]
    );

    const [orders] = await pool.query(
      `
        SELECT
          id,
          item_type AS itemType,
          item_title AS itemTitle,
          quantity,
          vendor_name AS vendorName,
          order_date AS orderDate,
          status,
          notes,
          created_at AS createdAt
        FROM admin_store_orders
        WHERE schoolCode = ?
        ORDER BY id DESC
        LIMIT 100
      `,
      [schoolCode]
    );

    const [chatRequests] = await pool.query(
      `
        SELECT
          id,
          party1_name,
          party2_class,
          party2_section,
          party2_student,
          date,
          time,
          status
        FROM chat_requests
        ORDER BY created_at DESC
        LIMIT 30
      `
    );

    let storeActions = [];
    try {
      const [poRequests] = await pool.query(
        `
          SELECT id, stock_name, quantity, status, category
          FROM po_requests
          ORDER BY id DESC
          LIMIT 30
        `
      );
      storeActions = (Array.isArray(poRequests) ? poRequests : []).map((row) => ({
        id: row.id,
        text: `PO - ${row.id}, ${row.stock_name || "Stock"}, ${row.quantity || 0}qty`,
        status: row.status === "PENDING" ? "AWAITING" : row.status,
        stockName: row.stock_name,
        quantity: row.quantity,
        category: row.category,
      }));
    } catch (poError) {
      if (poError?.code !== "ER_NO_SUCH_TABLE") {
        throw poError;
      }
    }

    const pendingChatCount = (Array.isArray(chatRequests) ? chatRequests : []).filter((row) =>
      ["pending", "requested", "awaiting"].includes(String(row?.status || "").toLowerCase())
    ).length;
    const pendingPoCount = storeActions.filter((row) =>
      String(row?.status || "").toUpperCase() === "AWAITING" || String(row?.status || "").toUpperCase() === "PENDING"
    ).length;

    const assistantActions = buildStoreAssistantActions({
      itemCount: Array.isArray(items) ? items.length : 0,
      vendorCount: Array.isArray(vendors) ? vendors.length : 0,
      orderCount: Array.isArray(orders) ? orders.length : 0,
      pendingChatCount,
      pendingPoCount,
    });

    return res.json({
      success: true,
      data: {
        items,
        vendors,
        orders,
        chatRequests: Array.isArray(chatRequests) ? chatRequests : [],
        storeActions,
        assistantActions,
      },
    });
  } catch (error) {
    console.error("❌ Failed to fetch admin store dashboard:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch admin store dashboard" });
  }
});

app.post("/api/notifications/run-today", async (req, res) => {
  const schoolCode = String(req.body?.schoolCode || req.query?.schoolCode || "").trim();

  try {
    const summary = await scanAndBroadcastTodayNotifications(schoolCode);
    return res.json({
      success: true,
      summary,
      schoolCode: schoolCode || null,
    });
  } catch (error) {
    console.error("❌ Failed to run today notification scan:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to run notification scan",
      error: error.message,
    });
  }
});

app.post("/api/notifications/birthday-push/run-today", async (req, res) => {
  const schoolCode = String(req.body?.schoolCode || req.query?.schoolCode || "").trim();
  console.log(`[BIRTHDAY-PUSH] Manual trigger received. schoolCode=${schoolCode || "ALL"}`);

  try {
    const summary = await scanAndSendBirthdayPushNotifications(schoolCode);
    return res.json({
      success: true,
      schoolCode: schoolCode || null,
      summary,
    });
  } catch (error) {
    console.error("[BIRTHDAY-PUSH] Manual trigger failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to run birthday push scan",
      error: error.message,
    });
  }
});

app.post("/api/notifications/event-push/run-today", async (req, res) => {
  const schoolCode = String(req.body?.schoolCode || req.query?.schoolCode || "").trim();
  console.log(`[EVENT-PUSH] Manual trigger received. schoolCode=${schoolCode || "ALL"}`);

  try {
    const summary = await scanAndSendEventPushNotifications(schoolCode);
    return res.json({
      success: true,
      schoolCode: schoolCode || null,
      summary,
    });
  } catch (error) {
    console.error("[EVENT-PUSH] Manual trigger failed:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to run event push scan",
      error: error.message,
    });
  }
});

cron.schedule("0 8 * * *", async () => {
  try {
    const summary = await scanAndBroadcastTodayNotifications();
    console.log(`[NOTIFY] Daily scan complete:`, summary);
  } catch (error) {
    console.error("❌ Daily notification scan failed:", error);
  }
}, {
  scheduled: true,
  timezone: "Asia/Kolkata",
});

cron.schedule("33 13 * * *", async () => {
  try {
    console.log("[PUSH] 13:10 IST cron started.");
    const [birthdaySummary, eventSummary] = await Promise.all([
      scanAndSendBirthdayPushNotifications(),
      scanAndSendEventPushNotifications(),
    ]);
    console.log("[BIRTHDAY-PUSH] 13:10 IST cron completed:", birthdaySummary);
    console.log("[EVENT-PUSH] 13:10 IST cron completed:", eventSummary);
  } catch (error) {
    console.error("[PUSH] 13:10 IST cron failed:", error);
  }
}, {
  scheduled: true,
  timezone: "Asia/Kolkata",
});

// Daily auto-image sync at 10:00 IST.
cron.schedule("0 10 * * *", async () => {
  try {
    console.log("[AUTO-IMAGE][cron] daily run started");
    const novaPool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: "NOVA",
      waitForConnections: true,
      connectionLimit: 5
    });

    const [schools] = await novaPool.query("SELECT institute_name, database_name FROM Seller");
    const results = [];

    for (const schoolRow of schools) {
      const instituteName = String(schoolRow.institute_name || "").trim();
      const dbNameFromSeller = String(schoolRow.database_name || "").trim();
      const schoolLookupKey = dbNameFromSeller || instituteName;
      if (!schoolLookupKey) continue;

      try {
        let school = null;
        try {
          school = await getSchoolDetails(schoolLookupKey);
        } catch {
          school = null;
        }

        const resolvedDbName = String(school?.database_name || dbNameFromSeller || "").trim();
        if (!resolvedDbName) {
          console.warn(`[AUTO-IMAGE][${instituteName || schoolLookupKey}] Skipping school because database_name could not be resolved`);
          continue;
        }

        const generationSummary = await ensureDailyAutoImages(resolvedDbName);
        const summary = await sendDailyAutoImagesToConnectedWhatsApp(resolvedDbName);
        console.log("[AUTO-IMAGE][cron] school summary", {
          schoolCode: resolvedDbName,
          generationSummary,
          sent: Number(summary?.sent || 0),
          total: Number(summary?.total || 0),
          skipped: Boolean(summary?.skipped),
          reason: summary?.reason || null,
        });
        if (!summary?.skipped) {
          results.push({
            schoolCode: resolvedDbName,
            generationSummary,
            sent: Number(summary?.sent || 0),
            total: Number(summary?.total || 0),
          });
        }
      } catch (err) {
        console.error(`[AUTO-IMAGE][${instituteName || schoolLookupKey}] Daily send failed:`, err?.message || err);
      }
    }

    console.log("[AUTO-IMAGE][cron] daily run complete:", results);
  } catch (error) {
    console.error("[AUTO-IMAGE][cron] failed:", error);
  }
}, {
  scheduled: true,
  timezone: "Asia/Kolkata",
});

app.get("/api/fee-types", async (req, res) => {
  const schoolCode = String(req.query.schoolCode || "").trim();
  if (!schoolCode) {
    return res.status(400).json({ success: false, message: "schoolCode is required" });
  }

  try {
    const pool = getDatabaseConnection(schoolCode);
    await ensureSchoolSchemaOnce(schoolCode, pool);
    const [rows] = await pool.query(
      `SELECT
        id,
        fee_name AS feeName,
        fees_type AS feesType,
        scope,
        frequency,
        installments
      FROM fee_type_master
      WHERE schoolCode = ? AND is_active = 1
      ORDER BY id ASC`,
      [schoolCode]
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Failed to fetch fee types:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch fee types" });
  }
});

const createFeeTypeHandler = async (req, res) => {
  const schoolCode = String(req.body.schoolCode || "").trim();
  const feeName = String(req.body.feeName || "").trim();
  const feesType = String(req.body.feesType || "Custom Fee").trim();
  const allowedScopes = new Set(["All", "Class wise", "Individual"]);
  const scope = allowedScopes.has(String(req.body.scope || "All").trim())
    ? String(req.body.scope || "All").trim()
    : "All";
  const frequency = String(req.body.frequency || "One time").trim();
  const installments = Math.max(1, Number(req.body.installments) || 1);

  if (!schoolCode || !feeName) {
    return res.status(400).json({ success: false, message: "schoolCode and feeName are required" });
  }

  try {
    const pool = getDatabaseConnection(schoolCode);
    await ensureSchoolSchemaOnce(schoolCode, pool);

    await pool.query(
      `INSERT INTO fee_type_master
      (schoolCode, fee_name, fees_type, scope, frequency, installments)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [schoolCode, feeName, feesType || "Custom Fee", scope || "All", frequency || "One time", installments]
    );

    await ensureFeeTypeColumns(pool, feeName);

    const [savedRows] = await pool.query(
      `SELECT
        id,
        fee_name AS feeName,
        fees_type AS feesType,
        scope,
        frequency,
        installments
      FROM fee_type_master
      WHERE schoolCode = ? AND fee_name = ?
      ORDER BY id DESC
      LIMIT 1`,
      [schoolCode, feeName]
    );

    return res.status(201).json({
      success: true,
      message: "Fee type created successfully",
      data: savedRows[0] || null,
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Fee type already exists" });
    }
    console.error("❌ Failed to create fee type:", error.message);
    return res.status(500).json({ success: false, message: "Failed to create fee type" });
  }
};

app.post("/api/fee-types", createFeeTypeHandler);

app.post("/api/fee-type", async (req, res) => {
  // Compatibility alias for older frontend code
  return createFeeTypeHandler(req, res);
});

const schoolPhotosStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, schoolPhotosDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^\w.\-]/g, "_");
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}-${safeName}`);
  }
});

const schoolPhotosUpload = multer({
  storage: schoolPhotosStorage,
  limits: {
    files: 20,
    fileSize: Math.max(1, Number(process.env.SCHOOL_MEDIA_MAX_MB || 200)) * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype.startsWith("image/");
    const isVideo = file.mimetype.startsWith("video/");
    if (!isImage && !isVideo) {
      return cb(new Error("Only image or video files are allowed"));
    }
    cb(null, true);
  }
});

const schoolPhotosUploadMiddleware = (req, res, next) => {
  schoolPhotosUpload.array("photos", 20)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      const maxMb = Math.max(1, Number(process.env.SCHOOL_MEDIA_MAX_MB || 200));
      return res.status(400).json({
        error: `File too large. Maximum allowed size is ${maxMb} MB per file`
      });
    }
    return res.status(400).json({ error: err.message || "Upload failed" });
  });
};

const autoImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Math.max(1, Number(process.env.SCHOOL_MEDIA_MAX_MB || 20)) * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype.startsWith("image/");
    if (!isImage) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  }
});

const studentTopperBatchUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 8,
    fileSize: Math.max(1, Number(process.env.SCHOOL_MEDIA_MAX_MB || 20)) * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype.startsWith("image/");
    if (!isImage) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

const AUTO_IMAGE_THEME = {
  admissions: {
    accent: "#2563eb",
    accentSoft: "rgba(37, 99, 235, 0.16)",
    glow: "rgba(37, 99, 235, 0.18)",
    badge: "Admission"
  },
  promotions: {
    accent: "#0f766e",
    accentSoft: "rgba(15, 118, 110, 0.16)",
    glow: "rgba(15, 118, 110, 0.18)",
    badge: "Promotion"
  },
  festivals: {
    accent: "#d97706",
    accentSoft: "rgba(217, 119, 6, 0.16)",
    glow: "rgba(217, 119, 6, 0.18)",
    badge: "Festival"
  },
  celebrations: {
    accent: "#be185d",
    accentSoft: "rgba(190, 24, 93, 0.16)",
    glow: "rgba(190, 24, 93, 0.18)",
    badge: "Celebration"
  }
};

function escapePosterHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtml(value) {
  return escapePosterHtml(value);
}

function normalizeAutoImageScope(value) {
  const scope = String(value || "digital").trim().toLowerCase();
  if (scope === "auto") return "auto";
  if (scope === "staff") return "staff";
  return "digital";
}

function normalizeAutoImageCategory(value) {
  const category = String(value || "admissions").trim().toLowerCase();
  if (AUTO_IMAGE_THEME[category]) return category;
  return "admissions";
}

function bufferToDataUrl(buffer, mimetype) {
  if (!buffer || !mimetype) return "";
  return `data:${mimetype};base64,${Buffer.from(buffer).toString("base64")}`;
}

function wrapPosterText(text, maxLength = 112) {
  const clean = String(text || "").trim();
  if (!clean) return "";
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}…`;
}

function splitPosterLines(value) {
  return String(value || "")
    .split(/\n|•|·|;/g)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function buildAutoImageHeadline(title, category, occasion) {
  const normalizedCategory = normalizeAutoImageCategory(category);
  const normalizedTitle = String(title || "").trim();
  if (normalizedTitle && normalizedTitle.toLowerCase() !== "auto image") {
    return normalizedTitle;
  }
  if (normalizedCategory === "promotions") return "A Proud Achievement";
  if (normalizedCategory === "festivals") return occasion ? `Happy ${wrapPosterText(occasion, 28)}` : "Festive Greetings";
  if (normalizedCategory === "celebrations") return "Celebrate the Moment";
  return "Congratulations!";
}

function buildAutoImageRibbon(category, occasion) {
  const normalizedCategory = normalizeAutoImageCategory(category);
  const normalizedOccasion = String(occasion || "").trim();
  if (normalizedOccasion) return wrapPosterText(normalizedOccasion, 32);
  if (normalizedCategory === "promotions") return "A PROUD ACHIEVEMENT";
  if (normalizedCategory === "festivals") return "JOYFUL CELEBRATION";
  if (normalizedCategory === "celebrations") return "SPECIAL OCCASION";
  return "SUCCESS STORY";
}

function buildActionItems(writeup, category) {
  const lines = splitPosterLines(writeup)
    .map((line) => line.replace(/^\d+[\).\-\s]*/, "").trim())
    .filter(Boolean);

  const defaults = {
    admissions: [
      "Strong academic support for every learner",
      "Smooth admission process and guidance",
      "A positive first step for the future",
    ],
    promotions: [
      "Dedication and hard work made this possible",
      "Consistent effort and discipline paid off",
      "A milestone to celebrate with pride",
    ],
    festivals: [
      "Share joy, culture, and togetherness",
      "Celebrate with warmth and gratitude",
      "Create happy memories with your community",
    ],
    celebrations: [
      "A special moment worth remembering",
      "Best wishes for the journey ahead",
      "Keep shining and achieving more",
    ],
  };

  const fallback = defaults[normalizeAutoImageCategory(category)] || defaults.admissions;
  const picked = lines.slice(0, 3);
  while (picked.length < 3) {
    picked.push(fallback[picked.length] || fallback[0]);
  }

  return picked.slice(0, 3).map((text, index) => ({
    icon: ["★", "✓", "✦"][index] || "•",
    text: wrapPosterText(text, 118),
  }));
}

function normalizeStudentPercentage(value) {
  const text = String(value || "").trim().replace("%", "");
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return "";
  return Math.max(0, Math.min(parsed, 100)).toFixed(1).replace(/\.0$/, "");
}

function buildStudentTopperHtml({
  school = {},
  studentName = "",
  marksPercentage = "",
  photoUrl = "",
  className = "",
  academicYear = "",
  rankLabel = "",
}) {
  const schoolName = escapePosterHtml(
    school.institute_name || school.name || school.school_name || "Your School"
  );
  const tagline = escapePosterHtml(
    school.tagline || school.school_tagline || "A moment of pride and achievement"
  );
  const logo = school.logo ? String(school.logo).trim() : "";
  const safeStudentName = escapePosterHtml(String(studentName || "Student").trim() || "Student");
  const safeClassName = escapePosterHtml(String(className || "Topper").trim() || "Topper");
  const safeAcademicYear = escapePosterHtml(String(academicYear || "").trim());
  const safeRank = escapePosterHtml(String(rankLabel || "1").trim() || "1");
  const safePercentage = escapePosterHtml(normalizeStudentPercentage(marksPercentage) || "0");
  const photoMarkup = photoUrl
    ? `<img src="${photoUrl}" alt="${safeStudentName}" class="topper-photo" />`
    : `<div class="topper-photo-fallback">${safeStudentName
        .split(" ")
        .map((part) => part.charAt(0))
        .filter(Boolean)
        .slice(0, 2)
        .join("") || "S"}</div>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      width: 1400px;
      height: 1040px;
      overflow: hidden;
      font-family: Arial, Helvetica, sans-serif;
      background:
        radial-gradient(circle at top left, rgba(251, 191, 36, 0.22), transparent 28%),
        radial-gradient(circle at top right, rgba(244, 114, 182, 0.14), transparent 24%),
        linear-gradient(180deg, #fffdf5 0%, #f7f3e8 50%, #f0ead8 100%);
    }
    body {
      padding: 18px;
    }
    .poster {
      position: relative;
      width: 100%;
      height: 100%;
      border: 8px solid #c88f18;
      border-radius: 18px;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,249,236,0.9)),
        linear-gradient(135deg, rgba(13, 42, 92, 0.06), rgba(10, 30, 70, 0.02));
      box-shadow: 0 28px 70px rgba(58, 44, 11, 0.22);
    }
    .shine {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 20% 18%, rgba(255, 255, 255, 0.58), transparent 26%),
        radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.48), transparent 18%);
      pointer-events: none;
    }
    .header {
      position: relative;
      display: grid;
      grid-template-columns: 170px 1fr 170px;
      gap: 16px;
      align-items: center;
      padding: 24px 26px 18px;
    }
    .logo-box,
    .trophy-box {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 120px;
    }
    .logo-box img,
    .trophy-box img {
      max-width: 140px;
      max-height: 120px;
      object-fit: contain;
    }
    .school-copy {
      text-align: center;
      color: #0d2b69;
      text-transform: uppercase;
    }
    .school-name {
      font-size: 74px;
      line-height: 0.95;
      font-weight: 900;
      letter-spacing: 1px;
    }
    .tagline {
      margin-top: 6px;
      font-size: 28px;
      font-weight: 800;
      color: #17336e;
    }
    .banner {
      margin: 8px auto 0;
      width: min(1000px, calc(100% - 120px));
      padding: 14px 18px;
      border-radius: 14px;
      border: 6px solid #e0a21a;
      color: #ffd45a;
      background: linear-gradient(180deg, #17336e, #0c2453);
      font-size: 50px;
      font-weight: 900;
      letter-spacing: 2px;
      text-align: center;
      box-shadow: inset 0 0 0 2px rgba(255,255,255,0.12);
    }
    .meta-row {
      display: flex;
      justify-content: center;
      gap: 14px;
      margin: 16px 0 8px;
      flex-wrap: wrap;
    }
    .meta-chip {
      padding: 10px 18px;
      border-radius: 999px;
      background: rgba(16, 37, 82, 0.08);
      color: #0d2b69;
      font-size: 20px;
      font-weight: 800;
      border: 1px solid rgba(13, 43, 105, 0.16);
    }
    .content {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 20px;
      padding: 20px 28px 10px;
      height: calc(100% - 270px);
    }
    .info-panel,
    .photo-panel {
      border-radius: 20px;
      border: 2px solid rgba(17, 38, 79, 0.18);
      background: rgba(255,255,255,0.9);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.8);
    }
    .info-panel {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 26px 28px;
    }
    .rank-pill {
      align-self: flex-start;
      min-width: 72px;
      padding: 8px 18px;
      border-radius: 999px;
      background: #17336e;
      color: #fff;
      font-size: 30px;
      font-weight: 900;
      box-shadow: 0 8px 18px rgba(23, 51, 110, 0.22);
    }
    .student-name {
      margin-top: 20px;
      color: #0d2b69;
      font-size: 56px;
      line-height: 1.06;
      font-weight: 900;
      text-transform: uppercase;
    }
    .details {
      margin-top: 12px;
      display: grid;
      gap: 10px;
      max-width: 94%;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 18px;
      border-radius: 14px;
      background: linear-gradient(180deg, #fff, #fbf5e6);
      border: 1px solid rgba(200, 143, 24, 0.28);
      color: #18336e;
      font-size: 24px;
      font-weight: 800;
    }
    .detail-row span:last-child {
      color: #7f1d1d;
      font-weight: 900;
      text-align: right;
    }
    .percentage-box {
      margin-top: 26px;
      padding: 22px 20px;
      border-radius: 20px;
      background: linear-gradient(180deg, #fff6db, #fffdf4);
      border: 2px solid rgba(200, 143, 24, 0.4);
      text-align: center;
    }
    .percentage-label {
      color: #17336e;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .percentage-value {
      margin-top: 8px;
      font-size: 74px;
      line-height: 1;
      font-weight: 900;
      color: #8c1212;
    }
    .photo-panel {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
    }
    .photo-frame {
      width: 180px;
      height: 180px;
      border-radius: 50%;
      overflow: hidden;
      border: 2px solid rgba(13, 43, 105, 0.18);
      background: linear-gradient(180deg, #f7fbff, #eaf0fa);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
    }
    .topper-photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center center;
      display: block;
      border-radius: 50%;
    }
    .topper-photo-fallback {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: linear-gradient(180deg, #17336e, #0c2453);
      color: #ffd45a;
      font-size: 76px;
      font-weight: 900;
      letter-spacing: 2px;
      box-shadow: 0 18px 38px rgba(23, 51, 110, 0.25);
    }
    .footer {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 18px 30px 26px;
      text-align: center;
      background: linear-gradient(180deg, rgba(17, 38, 79, 0), rgba(17, 38, 79, 0.96) 18%, #11264f 100%);
      color: #fff;
    }
    .footer-title {
      font-size: 48px;
      font-weight: 800;
      color: #ffd45a;
      font-family: Georgia, "Times New Roman", serif;
    }
    .footer-subtitle {
      margin-top: 6px;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 1px;
    }
    @media print {
      body { padding: 0; }
      .poster { box-shadow: none; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="poster">
    <div class="shine"></div>
    <div class="header">
      <div class="logo-box">
        ${
          logo
            ? `<img src="${logo}" alt="${schoolName} logo" />`
            : ""
        }
      </div>
      <div class="school-copy">
        <div class="school-name">${schoolName}</div>
        <div class="tagline">${tagline}</div>
        <div class="banner">STUDENT TOPPER REPORT</div>
        <div class="meta-row">
          ${safeClassName ? `<span class="meta-chip">${safeClassName}</span>` : ""}
          ${safeAcademicYear ? `<span class="meta-chip">${safeAcademicYear}</span>` : ""}
        </div>
      </div>
      <div class="trophy-box">
        <div style="font-size:72px;color:#d69e2e;">🏆</div>
      </div>
    </div>

    <div class="content">
      <div class="info-panel">
        <div class="rank-pill">#${safeRank}</div>
        <div>
          <div class="student-name">${safeStudentName}</div>
          <div class="details">
            <div class="detail-row">
              <span>Student Name</span>
              <span>${safeStudentName}</span>
            </div>
            <div class="detail-row">
              <span>Class / Batch</span>
              <span>${safeClassName}</span>
            </div>
            <div class="detail-row">
              <span>Academic Year</span>
              <span>${safeAcademicYear || "-"}</span>
            </div>
          </div>
        </div>
        <div class="percentage-box">
          <div class="percentage-label">Marks Percentage</div>
          <div class="percentage-value">${safePercentage}%</div>
        </div>
      </div>

      <div class="photo-panel">
        <div class="photo-frame">
          ${photoMarkup}
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-title">Congratulations</div>
      <div class="footer-subtitle">KEEP WORKING HARD AND ACHIEVING GREATER HEIGHTS!</div>
    </div>
  </div>
</body>
  </html>`;
}

function buildStudentTopperBatchHtml({
  school = {},
  title = "",
  className = "",
  academicYear = "",
  students = [],
}) {
  const schoolName = escapeHtml(school.institute_name || school.name || school.school_name || "Your School");
  const tagline = escapeHtml(school.tagline || school.school_tagline || "Where excellence shines");
  const safeTitle = escapeHtml(String(title || "Class Topper List").trim() || "Class Topper List");
  const safeClassName = escapeHtml(String(className || "Topper Batch").trim() || "Topper Batch");
  const safeAcademicYear = escapeHtml(String(academicYear || "").trim());
  const rows = Array.isArray(students) ? students.slice(0, 8) : [];
  while (rows.length < 8) rows.push(null);

  const cardsHtml = rows
    .map((student, index) => {
      const safeName = escapeHtml(String(student?.name || `Student ${index + 1}`).trim() || `Student ${index + 1}`);
      const safeMarks = escapeHtml(String(student?.marksPercentage || student?.percentage || "0").trim() || "0");
      const photoUrl = String(student?.photoUrl || "").trim();
      const photoMarkup = photoUrl
        ? `<img src="${photoUrl}" alt="${safeName}" class="batch-photo" />`
        : `<div class="batch-photo-fallback">${safeName
            .split(" ")
            .map((part) => part.charAt(0))
            .filter(Boolean)
            .slice(0, 2)
            .join("") || "S"}</div>`;

      return `
        <div class="batch-card">
          <div class="batch-rank">${index + 1}</div>
          <div class="batch-body">
            <div class="batch-name">${safeName}</div>
            <div class="batch-divider"></div>
            <div class="batch-marks">${safeMarks}%</div>
          </div>
          <div class="batch-photo-wrap">
            ${photoMarkup}
          </div>
        </div>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      width: 1400px;
      height: 1040px;
      overflow: hidden;
      font-family: Arial, Helvetica, sans-serif;
      background:
        radial-gradient(circle at top left, rgba(251, 191, 36, 0.22), transparent 26%),
        radial-gradient(circle at top right, rgba(59, 130, 246, 0.14), transparent 20%),
        linear-gradient(180deg, #fffdf6 0%, #f7f2e7 50%, #f0ead8 100%);
    }
    body { padding: 18px; }
    .poster {
      position: relative;
      width: 100%;
      height: 100%;
      border: 8px solid #c88f18;
      border-radius: 18px;
      overflow: hidden;
      background: linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,249,236,0.92));
      box-shadow: 0 28px 70px rgba(58, 44, 11, 0.22);
    }
    .shine {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 20% 18%, rgba(255, 255, 255, 0.58), transparent 24%),
        radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.48), transparent 18%);
      pointer-events: none;
    }
    .header {
      position: relative;
      display: grid;
      grid-template-columns: 160px 1fr 160px;
      gap: 16px;
      align-items: center;
      padding: 24px 28px 18px;
    }
    .logo-box, .trophy-box {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 110px;
    }
    .logo-box img {
      max-width: 130px;
      max-height: 110px;
      object-fit: contain;
    }
    .school-copy {
      text-align: center;
      color: #0d2b69;
      text-transform: uppercase;
    }
    .school-name {
      font-size: 68px;
      line-height: 0.95;
      font-weight: 900;
      letter-spacing: 1px;
    }
    .tagline {
      margin-top: 6px;
      font-size: 24px;
      font-weight: 800;
    }
    .banner {
      margin: 8px auto 0;
      width: min(1000px, calc(100% - 120px));
      padding: 12px 18px;
      border-radius: 14px;
      border: 6px solid #e0a21a;
      color: #ffd45a;
      background: linear-gradient(180deg, #17336e, #0c2453);
      font-size: 42px;
      font-weight: 900;
      letter-spacing: 2px;
      text-align: center;
    }
    .meta-row {
      display: flex;
      justify-content: center;
      gap: 14px;
      margin-top: 10px;
      flex-wrap: wrap;
    }
    .meta-chip {
      padding: 8px 16px;
      border-radius: 999px;
      background: rgba(16, 37, 82, 0.08);
      color: #0d2b69;
      font-size: 18px;
      font-weight: 800;
      border: 1px solid rgba(13, 43, 105, 0.16);
    }
    .content {
      padding: 6px 28px 18px;
      height: calc(100% - 250px);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 14px 18px;
      border-radius: 16px;
      background: rgba(255,255,255,0.94);
      border: 1px solid rgba(13, 43, 105, 0.14);
      box-shadow: 0 10px 22px rgba(13, 43, 105, 0.08);
      color: #0d2b69;
      font-weight: 800;
    }
    .summary strong {
      font-size: 24px;
      text-transform: uppercase;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      flex: 1;
    }
    .batch-card {
      position: relative;
      display: grid;
      grid-template-columns: 1fr 120px;
      gap: 10px;
      padding: 12px;
      border-radius: 16px;
      background: rgba(255,255,255,0.94);
      border: 1px solid rgba(13, 43, 105, 0.15);
      box-shadow: 0 10px 20px rgba(13, 43, 105, 0.08);
      overflow: hidden;
    }
    .batch-rank {
      position: absolute;
      top: 10px;
      left: 10px;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: #17336e;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: 900;
      z-index: 2;
    }
    .batch-body {
      padding-top: 36px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 10px;
    }
    .batch-name {
      color: #0d2b69;
      font-size: 24px;
      font-weight: 900;
      line-height: 1.08;
      text-transform: uppercase;
    }
    .batch-divider {
      width: 74%;
      height: 2px;
      border-radius: 999px;
      background: linear-gradient(90deg, transparent, #e0a21a, transparent);
    }
    .batch-marks {
      color: #8c1212;
      font-size: 36px;
      font-weight: 900;
    }
    .batch-photo-wrap {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      overflow: hidden;
      background: linear-gradient(180deg, #f7fbff, #eaf0fa);
      border: 1px solid rgba(13, 43, 105, 0.15);
      min-height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      align-self: center;
      justify-self: center;
    }
    .batch-photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      object-position: center center;
      border-radius: 50%;
    }
    .batch-photo-fallback {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: linear-gradient(180deg, #17336e, #0c2453);
      color: #ffd45a;
      display: grid;
      place-items: center;
      font-size: 34px;
      font-weight: 900;
    }
    .footer {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 16px 30px 24px;
      text-align: center;
      background: linear-gradient(180deg, rgba(17,38,79,0), rgba(17,38,79,0.96) 18%, #11264f 100%);
      color: #fff;
    }
    .footer-title {
      font-size: 44px;
      font-weight: 800;
      color: #ffd45a;
      font-family: Georgia, "Times New Roman", serif;
    }
    .footer-subtitle {
      margin-top: 4px;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="poster">
    <div class="shine"></div>
    <div class="header">
      <div class="logo-box">
        ${
          school.logo
            ? `<img src="${String(school.logo).startsWith("data:") ? school.logo : escapeHtml(school.logo)}" alt="${schoolName} logo" />`
            : ""
        }
      </div>
      <div class="school-copy">
        <div class="school-name">${schoolName}</div>
        <div class="tagline">${tagline}</div>
        <div class="banner">${safeTitle}</div>
        <div class="meta-row">
          ${safeClassName ? `<span class="meta-chip">${safeClassName}</span>` : ""}
          ${safeAcademicYear ? `<span class="meta-chip">${safeAcademicYear}</span>` : ""}
        </div>
      </div>
      <div class="trophy-box" style="font-size:72px;color:#d69e2e;">🏆</div>
    </div>

    <div class="content">
      <div class="summary">
        <strong>${safeTitle}</strong>
        <span>${safeClassName}</span>
        <span>${safeAcademicYear || "-"}</span>
      </div>

      <div class="grid">
        ${cardsHtml}
      </div>
    </div>

    <div class="footer">
      <div class="footer-title">Congratulations</div>
      <div class="footer-subtitle">KEEP WORKING HARD AND ACHIEVING GREATER HEIGHTS!</div>
    </div>
  </div>
</body>
</html>`;
}

async function generateStudentTopperPoster({
  school,
  studentName,
  marksPercentage,
  className,
  academicYear,
  rankLabel,
  photoFile,
}) {
  const outputFileName = `student-topper-${Date.now()}-${Math.round(Math.random() * 1e6)}.png`;
  const outputPath = path.join(schoolPhotosDir, outputFileName);
  const photoUrl = photoFile?.buffer ? bufferToDataUrl(photoFile.buffer, photoFile.mimetype) : "";
  const html = buildStudentTopperHtml({
    school,
    studentName,
    marksPercentage,
    className,
    academicYear,
    rankLabel,
    photoUrl,
  });

  await nodeHtmlToImage({
    output: outputPath,
    html,
    type: "png",
    transparent: false,
    waitUntil: "networkidle0",
    selector: "body",
    puppeteerArgs: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  return { outputPath, outputFileName };
}

async function generateStudentTopperBatchPoster({
  school,
  title,
  className,
  academicYear,
  students,
}) {
  const outputFileName = `student-topper-batch-${Date.now()}-${Math.round(Math.random() * 1e6)}.png`;
  const outputPath = path.join(schoolPhotosDir, outputFileName);
  const html = buildStudentTopperBatchHtml({
    school,
    title,
    className,
    academicYear,
    students,
  });

  await nodeHtmlToImage({
    output: outputPath,
    html,
    type: "png",
    transparent: false,
    waitUntil: "networkidle0",
    selector: "body",
    puppeteerArgs: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  return { outputPath, outputFileName };
}

function buildAutoImageHtml({
  school = {},
  title = "",
  category = "admissions",
  occasion = "",
  writeup = "",
  time = "",
  heroImage = "",
}) {
  const theme = AUTO_IMAGE_THEME[normalizeAutoImageCategory(category)] || AUTO_IMAGE_THEME.admissions;
  const schoolName = escapePosterHtml(
    school.institute_name || school.name || school.school_name || "Your School"
  );
  const tagline = escapePosterHtml(school.tagline || school.school_tagline || "Powered by your content");
  const address = escapePosterHtml(school.institute_address || school.address || "");
  const contact = escapePosterHtml(school.institute_contact_number || school.contact_number || "");
  const email = escapePosterHtml(school.email || school.institute_email || "");
  const headline = escapePosterHtml(buildAutoImageHeadline(title, category, occasion));
  const ribbonText = escapePosterHtml(buildAutoImageRibbon(category, occasion));
  const safeOccasion = escapePosterHtml(wrapPosterText(occasion || "Occasion"));
  const safeWriteup = escapePosterHtml(
    wrapPosterText(
      writeup ||
        "Choose an image, add a write-up, and generate a polished poster automatically from the content."
    )
  );
  const safeTime = escapePosterHtml(wrapPosterText(time || ""));
  const actionItems = buildActionItems(writeup, category);
  const titleAccent = normalizedCategory => {
    if (normalizedCategory === "promotions") return "#9b111e";
    if (normalizedCategory === "festivals") return "#b45309";
    if (normalizedCategory === "celebrations") return "#7c2d12";
    return "#0f172a";
  };
  const accentText = titleAccent(normalizeAutoImageCategory(category));

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 500px;
      height: 500px;
      overflow: hidden;
      font-family: Arial, Helvetica, sans-serif;
      color: #0f172a;
      background:
        radial-gradient(circle at top left, rgba(255,255,255,0.40), transparent 35%),
        linear-gradient(135deg, #0f172a 0%, ${theme.accent} 52%, #f8fafc 52%, #f8fafc 100%);
    }
    .canvas {
      position: relative;
      width: 100%;
      height: 100%;
      padding: 12px;
    }
    .gold-border {
      position: absolute;
      inset: 10px;
      border-radius: 22px;
      border: 2px solid rgba(214, 158, 46, 0.65);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.65);
      pointer-events: none;
    }
    .orb {
      position: absolute;
      border-radius: 999px;
      filter: blur(2px);
      pointer-events: none;
    }
    .orb.one {
      width: 120px;
      height: 120px;
      right: -22px;
      top: -22px;
      background: ${theme.glow};
    }
    .orb.two {
      width: 96px;
      height: 96px;
      left: 12px;
      bottom: 18px;
      background: rgba(255,255,255,0.20);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 16px;
      background: rgba(255,255,255,0.92);
      box-shadow: 0 10px 18px rgba(15,23,42,0.14);
      position: relative;
      z-index: 2;
    }
    .logo {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      object-fit: contain;
      background: #fff;
      flex-shrink: 0;
      border: 1px solid rgba(148,163,184,0.35);
    }
    .school-name {
      font-size: 15px;
      line-height: 1.05;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .tagline {
      font-size: 9px;
      color: #475569;
      line-height: 1.35;
    }
    .badge-row {
      margin-top: 6px;
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
    }
    .badge {
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 8px;
      font-weight: 700;
      background: ${theme.accentSoft};
      color: ${theme.accent};
      border: 1px solid rgba(255,255,255,0.6);
    }
    .main {
      margin-top: 8px;
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      align-items: stretch;
      position: relative;
      z-index: 2;
    }
    .hero {
      border-radius: 18px;
      overflow: hidden;
      min-height: 0;
      background: rgba(255,255,255,0.9);
      box-shadow: 0 12px 20px rgba(15,23,42,0.14);
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
    }
    .hero-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }
    .hero-copy {
      min-width: 0;
      flex: 1 1 auto;
      max-width: 56%;
    }
    .hero-image {
      width: 160px;
      height: 170px;
      border-radius: 14px;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(15,23,42,0.10), rgba(15,23,42,0.02)),
        #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 18px rgba(15,23,42,0.14);
      border: 3px solid rgba(214, 158, 46, 0.86);
      flex-shrink: 0;
    }
    .hero-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .title {
      font-size: 20px;
      line-height: 0.94;
      font-weight: 900;
      color: ${accentText};
      margin: 0 0 6px 0;
      letter-spacing: -0.04em;
      text-transform: uppercase;
    }
    .ribbon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 5px 8px;
      margin: 3px 0 6px;
      background: linear-gradient(180deg, #112b66 0%, #0d224f 100%);
      color: #fff;
      font-size: 8px;
      font-weight: 900;
      border-radius: 8px;
      box-shadow: 0 8px 16px rgba(13, 34, 79, 0.20);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      width: fit-content;
    }
    .intro {
      font-size: 8px;
      line-height: 1.4;
      color: #1f2937;
      margin: 0 0 2px;
    }
    .highlight {
      color: #8c1111;
      font-weight: 900;
      text-transform: uppercase;
      font-size: 11px;
      line-height: 1.05;
      margin: 0 0 2px;
      letter-spacing: -0.02em;
    }
    .subline {
      font-size: 8px;
      line-height: 1.3;
      color: #334155;
      margin: 0 0 3px;
    }
    .action-panel {
      border-radius: 12px;
      background: linear-gradient(180deg, rgba(255,248,231,0.98), rgba(255,255,255,0.96));
      border: 1px solid rgba(214, 158, 46, 0.30);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.7);
      padding: 6px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
      margin-top: 0;
    }
    .action-row {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: 4px;
      padding: 6px 4px;
      border: 1px solid rgba(214, 158, 46, 0.18);
      border-radius: 10px;
      background: rgba(255,255,255,0.85);
      text-align: center;
      min-height: 74px;
    }
    .action-icon {
      width: 24px;
      height: 24px;
      border-radius: 999px;
      background: linear-gradient(180deg, #0f2d75 0%, #0b2050 100%);
      color: #ffd45d;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 12px;
      font-weight: 900;
      box-shadow: 0 4px 8px rgba(11, 32, 80, 0.16);
      border: 1px solid #f7c948;
    }
    .action-text {
      font-size: 7px;
      line-height: 1.25;
      color: #1f2937;
      font-weight: 700;
    }
    .bottom-zone {
      margin-top: 0;
      display: grid;
      grid-template-columns: 1fr 86px;
      gap: 6px;
      align-items: end;
    }
    .footer-box {
      border-radius: 10px;
      background: #0f172a;
      color: #fff;
      padding: 6px 8px;
      line-height: 1.45;
      box-shadow: 0 10px 18px rgba(15,23,42,0.2);
    }
    .footer-box strong {
      display: block;
      font-size: 8px;
      margin-bottom: 2px;
    }
    .footer-box small {
      display: block;
      font-size: 7px;
      color: rgba(255,255,255,0.82);
    }
    .trophy-stack {
      min-height: 72px;
      border-radius: 10px;
      background: radial-gradient(circle at 50% 10%, rgba(255, 217, 120, 0.24), rgba(255,255,255,0.88));
      border: 1px solid rgba(214, 158, 46, 0.24);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      padding: 6px;
      position: relative;
      overflow: hidden;
    }
    .trophy-icon {
      font-size: 18px;
      line-height: 1;
      filter: drop-shadow(0 8px 14px rgba(0,0,0,0.18));
    }
    .medal {
      width: 28px;
      height: 28px;
      border-radius: 999px;
      background: radial-gradient(circle at 30% 30%, #ffe89c, #d69e2e 60%, #a16207 100%);
      box-shadow: inset 0 0 0 2px rgba(255,255,255,0.22), 0 6px 10px rgba(0,0,0,0.16);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 14px;
      font-weight: 900;
      border: 2px solid #fff2bf;
    }
    .medal-ribbon {
      width: 12px;
      height: 18px;
      background: linear-gradient(180deg, #c1121f, #7f1d1d);
      clip-path: polygon(0 0, 100% 0, 78% 100%, 50% 78%, 22% 100%);
      margin-top: -4px;
    }
    .books {
      position: absolute;
      right: 4px;
      bottom: 4px;
      display: flex;
      flex-direction: column;
      gap: 1px;
      transform: rotate(-8deg);
    }
    .book {
      width: 24px;
      height: 4px;
      border-radius: 3px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.12);
    }
    .book.one { background: linear-gradient(90deg, #1d4ed8, #3b82f6); }
    .book.two { background: linear-gradient(90deg, #dc2626, #ef4444); width: 28px; }
    .book.three { background: linear-gradient(90deg, #0f766e, #14b8a6); width: 22px; }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="gold-border"></div>
    <div class="orb one"></div>
    <div class="orb two"></div>

    <div class="header">
      ${
        school.logo
          ? `<img class="logo" src="${String(school.logo).startsWith("data:") ? school.logo : escapePosterHtml(school.logo)}" alt="${schoolName}" />`
          : ""
      }
      <div>
        <div class="school-name">${schoolName}</div>
        <div class="tagline">${tagline}</div>
        <div class="badge-row">
          <span class="badge">${safeOccasion}</span>
          <span class="badge">${escapePosterHtml(normalizeAutoImageCategory(category).replace(/^\w/, (m) => m.toUpperCase()))}</span>
          ${safeTime ? `<span class="badge">${safeTime}</span>` : ""}
        </div>
      </div>
    </div>

    <div class="main">
      <div class="hero">
        <div class="hero-top">
          <div class="hero-copy">
            <h1 class="title">${headline}</h1>
            <div class="ribbon">${ribbonText}</div>
            <p class="intro">We are delighted to announce that</p>
            <p class="highlight">${schoolName}</p>
            <p class="subline">${safeWriteup}</p>
          </div>
          <div class="hero-image">
            ${heroImage ? `<img src="${heroImage}" alt="${headline}" />` : ""}
          </div>
        </div>

        <div class="action-panel">
          ${actionItems
            .map(
              (item) => `
            <div class="action-row">
              <div class="action-icon">${item.icon}</div>
              <div class="action-text">${escapePosterHtml(item.text)}</div>
            </div>`
            )
            .join("")}
        </div>

        <div class="bottom-zone">
          <div class="footer-box">
            <strong>Generated Automatically</strong>
            <small>${address || " "} ${address && contact ? "|" : ""} ${contact || ""}</small>
            <small>${email ? `${email}` : ""}</small>
          </div>
          <div class="trophy-stack">
            <div class="medal-ribbon"></div>
            <div class="medal">1</div>
            <div class="trophy-icon">🏆</div>
            <div class="books">
              <div class="book one"></div>
              <div class="book two"></div>
              <div class="book three"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function generateAutoImagePoster({
  school,
  title,
  category,
  occasion,
  writeup,
  time,
  imageFile,
}) {
  const outputFileName = `auto-image-${Date.now()}-${Math.round(Math.random() * 1e6)}.png`;
  const outputPath = path.join(schoolPhotosDir, outputFileName);
  const heroImage = imageFile?.buffer ? bufferToDataUrl(imageFile.buffer, imageFile.mimetype) : "";
  const html = buildAutoImageHtml({
    school,
    title,
    category,
    occasion,
    writeup,
    time,
    heroImage,
  });

  await nodeHtmlToImage({
    output: outputPath,
    html,
    type: "png",
    transparent: false,
    waitUntil: "networkidle0",
    selector: "body",
    puppeteerArgs: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  return { outputPath, outputFileName };
}

async function ensureDailyAutoImages(schoolCode, now = new Date()) {
  const targetCount = AUTO_IMAGE_ROTATION_ITEMS_PER_DAY;
  const todayKey = getKolkataDateKey(now);
  const db = await getDatabaseConnection(schoolCode);
  await ensureSchoolPhotosTable(db);

  const [rows] = await db.query(
    `SELECT id, file_name, uploaded_at
     FROM school_photos
     WHERE school_code = ?
       AND COALESCE(is_hidden, 0) = 0
       AND LOWER(file_name) LIKE 'auto-image-%'
     ORDER BY uploaded_at DESC
     LIMIT 20`,
    [schoolCode]
  );

  const todaysRows = (Array.isArray(rows) ? rows : []).filter((row) =>
    getKolkataDateKey(row?.uploaded_at || now) === todayKey
  );

  const missingCount = Math.max(0, targetCount - todaysRows.length);
  if (missingCount === 0) {
    return {
      schoolCode,
      generated: 0,
      existingToday: todaysRows.length,
      missing: 0,
    };
  }

  let school = null;
  try {
    school = await getSchoolDetails(schoolCode);
  } catch (err) {
    console.warn("[AUTO-IMAGE][daily-generate] school lookup failed", {
      schoolCode,
      error: err?.message || String(err),
    });
  }

  const schoolName = String(school?.institute_name || school?.school_name || schoolCode || "School").trim();
  const plans = [
    {
      title: `${schoolName} Daily Update`,
      category: "admissions",
      occasion: "admission",
      writeup: "Fresh updates, new beginnings, and a warm message for parents and students.",
    },
    {
      title: `${schoolName} Spotlight`,
      category: "promotions",
      occasion: "curriculum",
      writeup: "A quick highlight of learning, growth, and the school experience today.",
    },
  ];

  let generated = 0;
  for (let index = 0; index < missingCount; index += 1) {
    const plan = plans[(todaysRows.length + index) % plans.length];
    try {
      const { outputFileName } = await generateAutoImagePoster({
        school: school || {
          institute_name: schoolName,
          tagline: "Where learning begins with care & values",
        },
        title: plan.title,
        category: plan.category,
        occasion: plan.occasion,
        writeup: plan.writeup,
        time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        imageFile: null,
      });

      await db.query(
        `INSERT INTO school_photos (school_code, lead_name, gallery_scope, file_name, file_path)
         VALUES (?, ?, ?, ?, ?)`,
        [
          schoolCode,
          plan.title,
          "auto",
          outputFileName,
          `/schoolPhotos/${outputFileName}`,
        ]
      );
      generated += 1;
    } catch (err) {
      console.error("[AUTO-IMAGE][daily-generate] generation failed", {
        schoolCode,
        index,
        error: err?.message || String(err),
      });
    }
  }

  return {
    schoolCode,
    generated,
    existingToday: todaysRows.length,
    missing: missingCount,
  };
}

async function ensureSchoolPhotosTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS school_photos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      school_code VARCHAR(100) NULL,
      lead_name VARCHAR(255) NULL,
      gallery_scope VARCHAR(20) NULL DEFAULT 'both',
      is_hidden TINYINT(1) NOT NULL DEFAULT 0,
      file_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Ensure lead_name column exists for older tables
  try {
    const [cols] = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_photos' AND COLUMN_NAME = 'lead_name'`
    );
    if (!cols.length) {
      await db.query(`ALTER TABLE school_photos ADD COLUMN lead_name VARCHAR(255) NULL`);
    }
  } catch (e) {
    console.error("Failed to ensure lead_name column in school_photos:", e.message || e);
  }
  try {
    const [cols] = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_photos' AND COLUMN_NAME = 'gallery_scope'`
    );
    if (!cols.length) {
      await db.query(`ALTER TABLE school_photos ADD COLUMN gallery_scope VARCHAR(20) NULL DEFAULT 'both'`);
    }
  } catch (e) {
    console.error("Failed to ensure gallery_scope column in school_photos:", e.message || e);
  }
  try {
    const [cols] = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_photos' AND COLUMN_NAME = 'is_hidden'`
    );
    if (!cols.length) {
      await db.query(`ALTER TABLE school_photos ADD COLUMN is_hidden TINYINT(1) NOT NULL DEFAULT 0`);
    }
  } catch (e) {
    console.error("Failed to ensure is_hidden column in school_photos:", e.message || e);
  }
}

async function ensureStudentTopperPostersTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS student_topper_posters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      school_code VARCHAR(100) NOT NULL,
      poster_type VARCHAR(20) NOT NULL DEFAULT 'single',
      student_name VARCHAR(255) NOT NULL,
      class_name VARCHAR(150) NULL,
      academic_year VARCHAR(50) NULL,
      rank_label VARCHAR(50) NULL,
      marks_percentage DECIMAL(6,2) NULL,
      photo_file_name VARCHAR(255) NULL,
      photo_file_path VARCHAR(500) NULL,
      batch_data JSON NULL,
      poster_file_name VARCHAR(255) NOT NULL,
      poster_file_path VARCHAR(500) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const requiredColumns = [
    ["poster_type", "VARCHAR(20) NOT NULL DEFAULT 'single'"],
    ["class_name", "VARCHAR(150) NULL"],
    ["academic_year", "VARCHAR(50) NULL"],
    ["rank_label", "VARCHAR(50) NULL"],
    ["marks_percentage", "DECIMAL(6,2) NULL"],
    ["photo_file_name", "VARCHAR(255) NULL"],
    ["photo_file_path", "VARCHAR(500) NULL"],
    ["batch_data", "JSON NULL"],
    ["poster_file_name", "VARCHAR(255) NOT NULL"],
    ["poster_file_path", "VARCHAR(500) NOT NULL"],
  ];

  for (const [column, definition] of requiredColumns) {
    try {
      const [cols] = await db.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_topper_posters' AND COLUMN_NAME = ?`,
        [column]
      );
      if (!cols.length) {
        await db.query(`ALTER TABLE student_topper_posters ADD COLUMN ${column} ${definition}`);
      }
    } catch (e) {
      console.error(`Failed to ensure ${column} column in student_topper_posters:`, e.message || e);
    }
  }

  try {
    const [indexes] = await db.query(
      `SELECT INDEX_NAME
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'student_topper_posters'
         AND INDEX_NAME = 'idx_student_topper_school_id'`
    );
    if (!indexes.length) {
      await db.query(
        `CREATE INDEX idx_student_topper_school_id ON student_topper_posters (school_code, id)`
      );
    }
  } catch (e) {
    console.error("Failed to ensure student_topper_posters index:", e.message || e);
  }
}

async function ensureAutoImageSettingsTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS auto_image_settings (
      school_code VARCHAR(100) PRIMARY KEY,
      digital_disabled TINYINT(1) NOT NULL DEFAULT 0,
      staff_disabled TINYINT(1) NOT NULL DEFAULT 0,
      auto_disabled TINYINT(1) NOT NULL DEFAULT 0
    )
  `);
  const columns = [
    "digital_disabled",
    "staff_disabled",
    "auto_disabled",
  ];
  for (const column of columns) {
    try {
      const [rows] = await db.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auto_image_settings' AND COLUMN_NAME = ?`,
        [column]
      );
      if (!rows.length) {
        await db.query(`ALTER TABLE auto_image_settings ADD COLUMN ${column} TINYINT(1) NOT NULL DEFAULT 0`);
      }
    } catch (err) {
      console.error(`Failed to ensure ${column} column in auto_image_settings:`, err.message || err);
    }
  }
}

function listPosterImageFiles() {
  const directories = [postersDir, path.join(__dirname, "../public/posters")];
  const seen = new Set();
  const items = [];

  directories.forEach((dir) => {
    try {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir)
        .filter((file) => /\.(png|jpe?g|webp|gif)$/i.test(file))
        .map((file) => {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          return { file, fullPath, mtime: stat.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);
      files.forEach(({ file }) => {
        const key = file.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        items.push({
          id: `preset-${file}`,
          file_name: file,
          file_path: `/posters/${encodeURIComponent(file)}`,
          gallery_scope: "auto",
          gallery_type: "preset",
        });
      });
    } catch (err) {
      console.error("Failed to list poster image files:", err.message || err);
    }
  });

  return items;
}

function listWelcomeCardTemplatePreviews() {
  try {
    return Array.from({ length: 8 }, (_, index) => {
      const id = index + 1;
      return {
        id: `welcome-${id}`,
        file_name: `welcomeCardTemplate${id}`,
        file_path: `/api/welcome-card-template/${id}`,
        gallery_scope: "auto",
        gallery_type: "template",
        media_type: "poster-html",
        template_group: "Welcome Card",
      };
    });
  } catch (err) {
    console.error("Failed to list welcome card template previews:", err.message || err);
    return [];
  }
}

function isWelcomeCardTemplateItem(item) {
  const rawId = String(item?.id ?? item?.photoId ?? "").trim().toLowerCase();
  const rawName = String(item?.file_name || item?.title || "").trim().toLowerCase();
  const rawPath = String(item?.file_path || "").trim().toLowerCase();
  const welcomeCardPattern = /(?:^|[^a-z0-9])welcomecard(?:[_\-\s]?)([1-8])(?:[^a-z0-9]|$)/i;
  return (
    welcomeCardPattern.test(rawId) ||
    welcomeCardPattern.test(rawName) ||
    welcomeCardPattern.test(rawPath) ||
    rawPath.includes("/api/welcome-card-template/")
  );
}

function listPosterTemplatePreviews() {
  const templatesDir = path.join(__dirname, "templates", "posters");
  try {
    if (!fs.existsSync(templatesDir)) return [];
    return fs
      .readdirSync(templatesDir)
      .filter((name) => name.toLowerCase().endsWith(".html"))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
      .map((name) => ({
        id: `template-${name}`,
        file_name: name,
        file_path: `/api/poster-template-preview/${encodeURIComponent(name)}`,
        gallery_scope: "auto",
        gallery_type: "template",
        media_type: "poster-html",
        template_group: "Poster",
      }));
  } catch (err) {
    console.error("Failed to list poster template previews:", err.message || err);
    return [];
  }
}

function listPosterAssetPreviews() {
  const assetsDir = path.join(__dirname, "templates", "posters", "assets");
  try {
    if (!fs.existsSync(assetsDir)) return [];

    return fs
      .readdirSync(assetsDir)
      .filter((name) => /\.(png|jpe?g|webp|gif|svg)$/i.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
      .map((name) => ({
        id: `poster-asset-${name}`,
        file_name: name,
        file_path: `/backend/templates/posters/assets/${encodeURIComponent(name)}`,
        gallery_scope: "auto",
        gallery_type: "preset",
        media_type: "image",
        template_group: "Poster Assets",
      }));
  } catch (err) {
    console.error("Failed to list poster asset previews:", err.message || err);
    return [];
  }
}

function listSchoolPhotos() {
  try {
    const files = fs.readdirSync(schoolPhotosDir);
    const imageFiles = files
      .filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f))
      .map((f) => {
        const full = path.join(schoolPhotosDir, f);
        const stat = fs.statSync(full);
        return { name: f, fullPath: full, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    return imageFiles;
  } catch (err) {
    console.error("Failed to list school photos:", err.message);
    return [];
  }
}

function getSchoolPhotoForDay(dayIndex) {
  const photos = listSchoolPhotos();
  if (!photos.length) return null;
  const idx = dayIndex % photos.length;
  return photos[idx].fullPath;
}

async function sendSchoolPhotoEmail(toEmail, school, imagePath) {
  if (!toEmail || !school?.email || !school?.email_app_key || !imagePath) return false;
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: school.email, pass: school.email_app_key }
  });

  await transporter.sendMail({
    from: `"${school.institute_name || school.name || "School"}" <${school.email}>`,
    to: toEmail,
    subject: "Welcome!",
    html: `
      <div style="text-align:center;">
        <h2>${school.institute_name || school.name || "School"}</h2>
        <img src="cid:schoolPhoto" style="max-width:600px;border-radius:12px" />
      </div>
    `,
    attachments: [
      {
        filename: path.basename(imagePath),
        path: imagePath,
        cid: "schoolPhoto"
      }
    ]
  });
  return true;
}

app.post(
  "/api/school-photos",
  schoolPhotosUploadMiddleware,
  async (req, res) => {
    const { schoolCode, lead_name } = req.body;
    const galleryScope =
      req.body?.galleryScope ??
      req.body?.scope ??
      req.query?.galleryScope ??
      req.query?.scope;
    if (!schoolCode) {
      return res.status(400).json({ error: "schoolCode is required" });
    }
    if (!req.files || req.files.length < 1) {
      return res.status(400).json({ error: "Upload 1 to 20 images/videos" });
    }
    if (req.files.length > 20) {
      return res.status(400).json({ error: "Maximum 20 files allowed" });
    }

    try {
      const db = await getDatabaseConnection(schoolCode);
      await ensureSchoolPhotosTable(db);
      const normalizedScope = String(galleryScope || "both").trim().toLowerCase();
      const finalScope = ["digital", "staff", "both"].includes(normalizedScope)
        ? normalizedScope
        : "both";

      const rows = req.files.map((f) => [
        schoolCode,
        lead_name || null,
        finalScope,
        f.filename,
        `/schoolPhotos/${f.filename}`
      ]);

      await db.query(
        "INSERT INTO school_photos (school_code, lead_name, gallery_scope, file_name, file_path) VALUES ?",
        [rows]
      );

      res.json({
        success: true,
        count: req.files.length,
        files: rows.map((r) => ({ file_name: r[2], file_path: r[3] }))
      });
    } catch (err) {
      console.error("School photo upload error:", err);
      res.status(500).json({ error: "Failed to upload photos" });
    }
  }
);

app.get("/api/school-photos", async (req, res) => {
  const { schoolCode } = req.query;
  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }
  try {
    const db = await getDatabaseConnection(schoolCode);
    await ensureSchoolPhotosTable(db);
    const [rows] = await db.query(
      "SELECT id, lead_name, gallery_scope, file_name, file_path, uploaded_at, is_hidden FROM school_photos WHERE school_code = ? AND COALESCE(is_hidden, 0) = 0 ORDER BY uploaded_at DESC",
      [schoolCode]
    );
    res.json(rows);
  } catch (err) {
    console.error("Fetch school photos error:", err);
    res.status(500).json({ error: "Failed to fetch photos" });
  }
});

app.get("/api/auto-image-settings", async (req, res) => {
  const schoolCode = String(req.query?.schoolCode || "").trim();
  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);
    await ensureAutoImageSettingsTable(db);
    const [rows] = await db.query(
      `SELECT digital_disabled, staff_disabled, auto_disabled
       FROM auto_image_settings
       WHERE school_code = ?`,
      [schoolCode]
    );
    const row = rows[0] || {};
    return res.json({
      digital: Boolean(Number(row.digital_disabled || 0)),
      staff: Boolean(Number(row.staff_disabled || 0)),
      auto: Boolean(Number(row.auto_disabled || 0)),
    });
  } catch (err) {
    console.error("Load auto image settings error:", err);
    return res.status(500).json({ error: "Failed to load auto image settings" });
  }
});

app.post("/api/auto-image-settings", async (req, res) => {
  const schoolCode = String(req.body?.schoolCode || "").trim();
  const scope = normalizeAutoImageScope(req.body?.scope || req.body?.galleryScope);
  const disabled = Boolean(req.body?.disabled);
  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  if (!["digital", "staff", "auto"].includes(scope)) {
    return res.status(400).json({ error: "Invalid scope" });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);
    await ensureAutoImageSettingsTable(db);
    const [rows] = await db.query(
      `SELECT school_code FROM auto_image_settings WHERE school_code = ?`,
      [schoolCode]
    );
    const column = scope === "digital"
      ? "digital_disabled"
      : scope === "staff"
        ? "staff_disabled"
        : "auto_disabled";
    if (rows.length > 0) {
      await db.query(
        `UPDATE auto_image_settings
         SET ${column} = ?
         WHERE school_code = ?`,
        [disabled ? 1 : 0, schoolCode]
      );
    } else {
      await db.query(
        `INSERT INTO auto_image_settings (school_code, digital_disabled, staff_disabled, auto_disabled)
         VALUES (?, ?, ?, ?)`,
        [
          schoolCode,
          scope === "digital" ? (disabled ? 1 : 0) : 0,
          scope === "staff" ? (disabled ? 1 : 0) : 0,
          scope === "auto" ? (disabled ? 1 : 0) : 0,
        ]
      );
    }

    const [updatedRows] = await db.query(
      `SELECT digital_disabled, staff_disabled, auto_disabled
       FROM auto_image_settings
       WHERE school_code = ?`,
      [schoolCode]
    );
    const row = updatedRows[0] || {};
    return res.json({
      success: true,
      digital: Boolean(Number(row.digital_disabled || 0)),
      staff: Boolean(Number(row.staff_disabled || 0)),
      auto: Boolean(Number(row.auto_disabled || 0)),
    });
  } catch (err) {
    console.error("Update auto image settings error:", err);
    return res.status(500).json({ error: "Failed to update auto image settings" });
  }
});

app.get("/api/auto-image-library", async (req, res) => {
  const schoolCode = String(req.query?.schoolCode || "").trim();
  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  try {
    console.log("[AUTO-IMAGE][library] request", { schoolCode });
    const db = await getDatabaseConnection(schoolCode);
    await ensureSchoolPhotosTable(db);
    const [rows] = await db.query(
      `SELECT id, lead_name, gallery_scope, file_name, file_path, uploaded_at, is_hidden
       FROM school_photos
       WHERE school_code = ? AND COALESCE(is_hidden, 0) = 0
       ORDER BY uploaded_at DESC`,
      [schoolCode]
    );

    const generatedItems = rows
      .filter((row) => String(row.file_name || "").trim().toLowerCase().startsWith("auto-image-"))
      .map((row) => ({
        id: row.id,
        file_name: row.file_name,
        file_path: row.file_path,
        title: row.lead_name || row.file_name,
        gallery_scope: "auto",
        gallery_type: "generated",
        uploaded_at: row.uploaded_at,
      }));

    const templateItems = [
      ...listWelcomeCardTemplatePreviews(),
      ...listPosterTemplatePreviews(),
    ];
    const welcomeCardItems = templateItems.filter((item) => isWelcomeCardTemplateItem(item));
    const visibleTemplateItems = templateItems.filter((item) => !isWelcomeCardTemplateItem(item));
    const merged = [...visibleTemplateItems, ...generatedItems];
    const seen = new Set();
    const data = merged.filter((item) => {
      const key = String(item.file_name || item.file_path || item.id || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log("[AUTO-IMAGE][library] response", {
      schoolCode,
      generatedCount: generatedItems.length,
      templateCount: visibleTemplateItems.length,
      removedWelcomeCards: welcomeCardItems.map((item) => item?.file_name || item?.title || item?.id || null),
      totalCount: data.length,
      sample: data.slice(0, 3).map((item) => ({
        id: item?.id ?? null,
        file_name: item?.file_name ?? null,
        gallery_type: item?.gallery_type ?? null,
      })),
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error("[AUTO-IMAGE][library] load error:", err);
    return res.status(500).json({ error: "Failed to load auto image library" });
  }
});

app.post("/api/auto-image/send-daily-whatsapp", async (req, res) => {
  const schoolCode = String(req.body?.schoolCode || req.query?.schoolCode || "").trim();
  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  try {
    console.log("[AUTO-IMAGE][manual-send] request", { schoolCode });
    const generationSummary = await ensureDailyAutoImages(schoolCode);
    const summary = await sendDailyAutoImagesToConnectedWhatsApp(schoolCode);
    console.log("[AUTO-IMAGE][manual-send] response", { generationSummary, summary });
    return res.json({
      success: true,
      generationSummary,
      ...summary,
    });
  } catch (err) {
    console.error("[AUTO-IMAGE][manual-send] failed:", err);
    return res.status(500).json({
      success: false,
      error: err?.message || "Failed to send daily auto images",
    });
  }
});

app.delete("/api/school-photos/:id", async (req, res) => {
  const { id } = req.params;
  const schoolCode = String(req.body?.schoolCode || req.query?.schoolCode || "").trim();
  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }
  if (!id) {
    return res.status(400).json({ error: "photoId is required" });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);
    await ensureSchoolPhotosTable(db);
    const [rows] = await db.query(
      "SELECT file_name FROM school_photos WHERE id = ? AND school_code = ?",
      [id, schoolCode]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Photo not found" });
    }

    const fileName = rows[0].file_name;
    const filePath = path.join(schoolPhotosDir, fileName);
    const isAutoImage = String(fileName || "").trim().toLowerCase().startsWith("auto-image-");

    if (isAutoImage) {
      await db.query(
        "UPDATE school_photos SET is_hidden = 1 WHERE id = ? AND school_code = ?",
        [id, schoolCode]
      );
      return res.json({ success: true, message: "Photo hidden successfully" });
    }

    await db.query("DELETE FROM school_photos WHERE id = ? AND school_code = ?", [id, schoolCode]);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkErr) {
        console.error("Failed to delete school photo file:", unlinkErr);
      }
    }

    res.json({ success: true, message: "Photo deleted successfully" });
  } catch (err) {
    console.error("Delete school photo error:", err);
    res.status(500).json({ error: "Failed to delete photo" });
  }
});

app.post("/api/auto-image/generate", autoImageUpload.single("image"), async (req, res) => {
  const schoolCode = String(req.body?.schoolCode || "").trim();
  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  const title = String(req.body?.title || req.body?.file_name || "Auto Image").trim();
  const category = normalizeAutoImageCategory(req.body?.category);
  const occasion = String(req.body?.occasion || "").trim();
  const writeup = String(req.body?.writeup || req.body?.description || "").trim();
  const time = String(req.body?.time || "").trim();
  const galleryScope = "auto";

  try {
    const school = await getSchoolDetails(schoolCode);
    const { outputFileName } = await generateAutoImagePoster({
      school,
      title,
      category,
      occasion,
      writeup,
      time,
      imageFile: req.file || null,
    });

    const db = await getDatabaseConnection(schoolCode);
    await ensureSchoolPhotosTable(db);
    const [result] = await db.query(
      `INSERT INTO school_photos (school_code, lead_name, gallery_scope, file_name, file_path)
       VALUES (?, ?, ?, ?, ?)`,
      [
        schoolCode,
        title || null,
        galleryScope,
        outputFileName,
        `/schoolPhotos/${outputFileName}`,
      ]
    );

    const [rows] = await db.query(
      `SELECT id, lead_name, gallery_scope, file_name, file_path, uploaded_at
       FROM school_photos
       WHERE id = ? AND school_code = ?`,
      [result.insertId, schoolCode]
    );

    return res.json({
      success: true,
      item: rows[0] || {
        id: result.insertId,
        lead_name: title || null,
        gallery_scope: galleryScope,
        file_name: outputFileName,
        file_path: `/schoolPhotos/${outputFileName}`,
      },
    });
  } catch (err) {
    console.error("Auto image generation error:", err);
    return res.status(500).json({
      error: err?.message || "Failed to generate auto image",
    });
  }
});

function mapStudentTopperPosterRow(row = {}) {
  const posterFilePath = String(row.poster_file_path || "").trim();
  let batchData = row.batch_data;
  if (typeof batchData === "string") {
    try {
      batchData = JSON.parse(batchData);
    } catch {
      batchData = null;
    }
  }
  return {
    id: row.id,
    school_code: row.school_code,
    poster_type: row.poster_type || "single",
    student_name: row.student_name,
    class_name: row.class_name,
    academic_year: row.academic_year,
    rank_label: row.rank_label,
    marks_percentage: row.marks_percentage,
    photo_file_name: row.photo_file_name,
    photo_file_path: row.photo_file_path,
    batch_data: batchData || null,
    poster_file_name: row.poster_file_name,
    poster_file_path: posterFilePath,
    poster_url: posterFilePath,
    download_url: `/api/student-topper-posters/${row.id}/download?schoolCode=${encodeURIComponent(String(row.school_code || ""))}`,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

app.get("/api/student-topper-posters", async (req, res) => {
  const schoolCode = String(req.query?.schoolCode || "").trim();
  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  try {
    console.log("[student-topper-posters] list request", { schoolCode });
    const db = await getDatabaseConnection(schoolCode);
    await ensureStudentTopperPostersTable(db);
    const [rows] = await db.query(
      `SELECT id, school_code, poster_type, student_name, class_name, academic_year, rank_label, marks_percentage,
              photo_file_name, photo_file_path, batch_data, poster_file_name, poster_file_path, created_at, updated_at
       FROM student_topper_posters
       WHERE school_code = ?
       ORDER BY id DESC
       LIMIT 20`,
      [schoolCode]
    );

    console.log("[student-topper-posters] list success", { schoolCode, count: rows.length });
    return res.json({ success: true, data: rows.map(mapStudentTopperPosterRow) });
  } catch (err) {
    console.error("Load student topper posters error:", err);
    return res.status(500).json({ error: "Failed to load student topper posters" });
  }
});

app.post("/api/student-topper-posters", autoImageUpload.single("photo"), async (req, res) => {
  const schoolCode = String(req.body?.schoolCode || "").trim();
  const studentName = String(req.body?.studentName || "").trim();
  const className = String(req.body?.className || "").trim();
  const academicYear = String(req.body?.academicYear || "").trim();
  const rankLabel = String(req.body?.rankLabel || req.body?.rank || "1").trim();
  const marksPercentage = normalizeStudentPercentage(req.body?.marksPercentage || req.body?.percentage);

  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }
  if (!studentName) {
    return res.status(400).json({ error: "studentName is required" });
  }
  if (!marksPercentage) {
    return res.status(400).json({ error: "marksPercentage is required" });
  }

  try {
    console.log("[student-topper-posters] single create request", {
      schoolCode,
      studentName,
      className,
      academicYear,
      rankLabel,
      hasPhoto: Boolean(req.file),
    });
    const school = await getSchoolDetails(schoolCode);
    const { outputFileName } = await generateStudentTopperPoster({
      school,
      studentName,
      marksPercentage,
      className,
      academicYear,
      rankLabel,
      photoFile: req.file || null,
    });

    const db = await getDatabaseConnection(schoolCode);
    await ensureStudentTopperPostersTable(db);

    const photoFileName = req.file?.filename || null;
    const photoFilePath = req.file?.filename ? `/schoolPhotos/${req.file.filename}` : null;
    const posterFilePath = `/schoolPhotos/${outputFileName}`;

    const [result] = await db.query(
      `INSERT INTO student_topper_posters (
        school_code,
        student_name,
        class_name,
        academic_year,
        rank_label,
        marks_percentage,
        photo_file_name,
        photo_file_path,
        poster_file_name,
        poster_file_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        schoolCode,
        studentName,
        className || null,
        academicYear || null,
        rankLabel || null,
        marksPercentage,
        photoFileName,
        photoFilePath,
        outputFileName,
        posterFilePath,
      ]
    );

    const [rows] = await db.query(
      `SELECT id, school_code, poster_type, student_name, class_name, academic_year, rank_label, marks_percentage,
              photo_file_name, photo_file_path, batch_data, poster_file_name, poster_file_path, created_at, updated_at
       FROM student_topper_posters
       WHERE id = ? AND school_code = ?`,
      [result.insertId, schoolCode]
    );

    return res.json({
      success: true,
      item: mapStudentTopperPosterRow(rows[0] || {
        id: result.insertId,
        school_code: schoolCode,
        student_name: studentName,
        class_name: className || null,
        academic_year: academicYear || null,
        rank_label: rankLabel || null,
        marks_percentage: marksPercentage,
        photo_file_name: photoFileName,
        photo_file_path: photoFilePath,
        batch_data: null,
        poster_file_name: outputFileName,
        poster_file_path: posterFilePath,
      }),
    });
  } catch (err) {
    console.error("Create student topper poster error:", err);
    return res.status(500).json({ error: err?.message || "Failed to create student topper poster" });
  }
});

app.post("/api/student-topper-posters/batch", studentTopperBatchUpload.array("photos", 8), async (req, res) => {
  const schoolCode = String(req.body?.schoolCode || "").trim();
  const title = String(req.body?.title || "Class Topper List").trim();
  const className = String(req.body?.className || "").trim();
  const academicYear = String(req.body?.academicYear || "").trim();

  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  let students = [];
  try {
    students = JSON.parse(String(req.body?.students || "[]"));
  } catch {
    students = [];
  }

  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: "students array is required" });
  }

  console.log("[student-topper-posters] batch create request", {
    schoolCode,
    title,
    className,
    academicYear,
    studentCount: students.length,
    photoCount: Array.isArray(req.files) ? req.files.length : 0,
  });
  const normalizedStudents = students.slice(0, 8).map((student = {}, index) => ({
    name: String(student?.name || "").trim(),
    marksPercentage: normalizeStudentPercentage(student?.marksPercentage || student?.percentage || ""),
    rankLabel: String(student?.rankLabel || student?.rank || index + 1).trim(),
    hasPhoto: Boolean(student?.hasPhoto),
  }));

  const files = Array.isArray(req.files) ? req.files : [];
  let photoIndex = 0;
  const combinedStudents = normalizedStudents.map((student) => {
    const nextFile = student.hasPhoto ? files[photoIndex++] : null;
    return {
      ...student,
      photoUrl: nextFile?.buffer ? bufferToDataUrl(nextFile.buffer, nextFile.mimetype) : "",
    };
  });

  if (combinedStudents.every((student) => !student.name && !student.marksPercentage)) {
    return res.status(400).json({ error: "Enter at least one student" });
  }

  try {
    const school = await getSchoolDetails(schoolCode);
    const { outputFileName } = await generateStudentTopperBatchPoster({
      school,
      title,
      className,
      academicYear,
      students: combinedStudents,
    });

    console.log("[student-topper-posters] batch poster generated", {
      schoolCode,
      outputFileName,
      studentCount: combinedStudents.length,
      photoCount: combinedStudents.filter((student) => Boolean(student.photoUrl)).length,
    });
    const db = await getDatabaseConnection(schoolCode);
    await ensureStudentTopperPostersTable(db);

    const posterFilePath = `/schoolPhotos/${outputFileName}`;
    const batchPayload = JSON.stringify(combinedStudents);

    const [result] = await db.query(
      `INSERT INTO student_topper_posters (
        school_code,
        poster_type,
        student_name,
        class_name,
        academic_year,
        rank_label,
        marks_percentage,
        photo_file_name,
        photo_file_path,
        batch_data,
        poster_file_name,
        poster_file_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        schoolCode,
        "batch",
        title || "Class Topper List",
        className || null,
        academicYear || null,
        null,
        null,
        null,
        null,
        batchPayload,
        outputFileName,
        posterFilePath,
      ]
    );

    const [rows] = await db.query(
      `SELECT id, school_code, poster_type, student_name, class_name, academic_year, rank_label, marks_percentage,
              photo_file_name, photo_file_path, batch_data, poster_file_name, poster_file_path, created_at, updated_at
       FROM student_topper_posters
       WHERE id = ? AND school_code = ?`,
      [result.insertId, schoolCode]
    );

    return res.json({
      success: true,
      item: mapStudentTopperPosterRow(rows[0] || {
        id: result.insertId,
        school_code: schoolCode,
        poster_type: "batch",
        student_name: title || "Class Topper List",
        class_name: className || null,
        academic_year: academicYear || null,
        rank_label: null,
        marks_percentage: null,
        photo_file_name: null,
        photo_file_path: null,
        batch_data: batchPayload,
        poster_file_name: outputFileName,
        poster_file_path: posterFilePath,
      }),
    });
  } catch (err) {
    console.error("Create student topper batch poster error:", err);
    return res.status(500).json({ error: err?.message || "Failed to create student topper batch poster" });
  }
});

app.get("/api/student-topper-posters/:id/download", async (req, res) => {
  const schoolCode = String(req.query?.schoolCode || "").trim();
  const id = Number(req.params.id);
  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid poster id" });
  }

  try {
    console.log("[student-topper-posters] download request", { schoolCode, id });
    const db = await getDatabaseConnection(schoolCode);
    await ensureStudentTopperPostersTable(db);
    const [rows] = await db.query(
      `SELECT poster_file_name, poster_file_path
       FROM student_topper_posters
       WHERE id = ? AND school_code = ?`,
      [id, schoolCode]
    );
    const row = rows[0];
    if (!row) {
      return res.status(404).json({ error: "Poster not found" });
    }

    const posterPath = path.join(schoolPhotosDir, path.basename(String(row.poster_file_name || "")));
    if (!fs.existsSync(posterPath)) {
      return res.status(404).json({ error: "Poster file missing" });
    }

    console.log("[student-topper-posters] download success", { schoolCode, id, posterFileName: row.poster_file_name });
    return res.download(posterPath, row.poster_file_name);
  } catch (err) {
    console.error("Download student topper poster error:", err);
    return res.status(500).json({ error: "Failed to download student topper poster" });
  }
});
const DAILY_LEAD_SEND_LIMIT = 30;
const DEFAULT_WHATSAPP_POSTER_GAP_MINUTES = 1;
const CAMPAIGN_WHATSAPP_MESSAGES = [
  "Daily poster from Campaigning Digital - Gallery",
  "Daily poster from Campaigning Staff - Gallery",
];
const AUTO_IMAGE_ROTATION_ITEMS_PER_DAY = 2;
const AUTO_IMAGE_ROTATION_WINDOW_DAYS = 3;
const AUTO_IMAGE_ROTATION_START_HOUR = 10;
const AUTO_IMAGE_ROTATION_START_MINUTE = 0;
const AUTO_IMAGE_ROTATION_BATCH_LIMIT = 10;

function getKolkataDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  return `${year}-${month}-${day}`;
}

async function getCampaignWhatsAppUsageForDate(db, sendDate) {
  const [rows] = await db.query(
    `
    SELECT COUNT(*) AS total
    FROM scheduled_messages
    WHERE send_date = ?
      AND channel IN ('whatsapp', 'wa', 'all')
      AND COALESCE(media_path, '') <> ''
    `,
    [sendDate]
  );
  return Number(rows?.[0]?.total || 0);
}

function addDaysToKolkataDate(dateStr, daysToAdd) {
  const raw = String(dateStr || "").trim();
  if (!raw) return "";
  const [year, month, day] = raw.split("-").map((part) => Number(part));
  const date = new Date(year || 1970, (month || 1) - 1, day || 1);
  date.setDate(date.getDate() + Number(daysToAdd || 0));
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addMinutesToSendTime(timeStr, minutesToAdd) {
  const value = String(timeStr || "").trim();
  if (!/^\d{2}:\d{2}:\d{2}$/.test(value)) return value;
  const [h, m, s] = value.split(":").map(Number);
  const base = new Date(1970, 0, 1, h || 0, m || 0, s || 0);
  base.setMinutes(base.getMinutes() + Number(minutesToAdd || 0));
  const hh = String(base.getHours()).padStart(2, "0");
  const mm = String(base.getMinutes()).padStart(2, "0");
  const ss = String(base.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

app.post("/api/school-photos/send", async (req, res) => {
  const {
    schoolCode,
    photoId,
    leadName,
    leadNames,
    fromDate,
    toDate,
    sendAt,
    sendTime,
    scheduleFromTime,
    scheduleToTime,
    leadFrom,
    leadTo,
    leadIds,
    channels,
    sendPoster,
    scheduleFromDate,
    scheduleToDate,
    galleryTarget,
    whatsappGapMinutes,
    dynamicAllLeads,
    posterMessage: customPosterMessage,
    message: customMessage,
    caption: customCaption,
    templateWriteup
  } = req.body || {};

  console.log("[GALLERY] Send request", {
    schoolCode,
    photoId,
    leadName,
    fromDate,
    toDate,
    sendAt,
    sendTime,
    scheduleFromTime,
    scheduleToTime,
    leadFrom,
    leadTo,
    leadIds,
    channels,
    sendPoster,
    scheduleFromDate,
    scheduleToDate,
    whatsappGapMinutes
  });

  if (!schoolCode) return res.status(400).json({ error: "schoolCode is required" });
  if (!photoId) return res.status(400).json({ error: "photoId is required" });
  if (!fromDate || !toDate) return res.status(400).json({ error: "fromDate and toDate are required" });

  try {
    const db = await getDatabaseConnection(schoolCode);

    // ✅ GET IMAGE
    const [photoRows] = await db.query(
      "SELECT file_name, gallery_scope FROM school_photos WHERE id = ? AND school_code = ?",
      [photoId, schoolCode]
    );

    if (!photoRows.length) {
      return res.status(404).json({ error: "Photo not found" });
    }

    const photoFile = photoRows[0].file_name;
    const requestedTarget = String(galleryTarget || "").trim().toLowerCase();
    const photoScope = String(photoRows?.[0]?.gallery_scope || "digital")
      .trim()
      .toLowerCase();
    const normalizedTarget = requestedTarget === "staff" || requestedTarget === "digital"
      ? requestedTarget
      : photoScope === "staff"
        ? "staff"
        : "digital";
    const fallbackPosterMessage =
      sendPoster === false
        ? "Daily advertisement"
        : normalizedTarget === "staff"
          ? "Daily poster from Campaigning Staff - Gallery"
          : "Daily poster from Campaigning Digital - Gallery";
    const providedPosterMessage = [
      templateWriteup,
      customPosterMessage,
      customCaption,
      customMessage
    ]
      .map((value) => String(value || "").trim())
      .find((value) => value.length > 0);
    const posterMessage = providedPosterMessage || fallbackPosterMessage;
    const imagePath = path.join(schoolPhotosDir, photoFile);

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: "Image file missing on server" });
    }

    console.log("✅ Image path:", imagePath);
    console.log("✅ Exists:", fs.existsSync(imagePath));

    const isDynamicAllLeads =
      String(dynamicAllLeads || "").toLowerCase() === "true" ||
      String(dynamicAllLeads || "") === "1" ||
      dynamicAllLeads === true;

    const normalizedLeadIds = Array.isArray(leadIds)
      ? leadIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
      : [];
    const effectiveLeadIds = isDynamicAllLeads ? [] : normalizedLeadIds;

    // ✅ CLEAN QUERY
    const buildLeadQuery = () => {
      const normalizedLeadName = isDynamicAllLeads
        ? ""
        : String(leadName || "").trim().toLowerCase();
      const normalizedLeadNames = isDynamicAllLeads
        ? []
        : (Array.isArray(leadNames)
          ? leadNames
            .map((name) => String(name || "").trim().toLowerCase())
            .filter((name) => name && name !== "all" && name !== "all leads")
          : []);
      const useLeadFilter =
        normalizedLeadNames.length > 0 ||
        (normalizedLeadName &&
          normalizedLeadName !== "all" &&
          normalizedLeadName !== "all leads");

      if (effectiveLeadIds.length > 0) {
        let sql = `
          SELECT
            id,
            full_name,
            mobile_number,
            email_id,
            lead_name,
            date
          FROM leads
          WHERE id IN (${effectiveLeadIds.map(() => "?").join(", ")})
        `;
        const params = [...effectiveLeadIds];

        // Fallback path for multi-select: include lead-name/date match too
        // so selection still works even if some ids are stale/missing.
        if (useLeadFilter) {
          sql += ` OR (date BETWEEN ? AND ?`;
          params.push(fromDate, toDate);
          if (normalizedLeadNames.length > 0) {
            sql += ` AND LOWER(TRIM(lead_name)) IN (${normalizedLeadNames.map(() => "?").join(", ")})`;
            params.push(...normalizedLeadNames);
          } else {
            sql += ` AND LOWER(TRIM(lead_name)) LIKE ?`;
            params.push(`%${normalizedLeadName}%`);
          }
          sql += `)`;
        }

        return {
          sql,
          params,
        };
      }

      let sql = `
        SELECT 
          id,
          full_name,
          mobile_number,
          email_id,
          lead_name,
          date
        FROM leads
        WHERE date BETWEEN ? AND ?
      `;

      const params = [fromDate, toDate];

      if (normalizedLeadNames.length > 0) {
        sql += ` AND LOWER(TRIM(lead_name)) IN (${normalizedLeadNames.map(() => "?").join(", ")})`;
        params.push(...normalizedLeadNames);
      } else if (useLeadFilter) {
        sql += ` AND LOWER(TRIM(lead_name)) LIKE ?`;
        params.push(`%${normalizedLeadName}%`);
      }

      return { sql, params };
    };

    const { sql, params } = buildLeadQuery();

    console.log("[GALLERY] Lead fetch query:", sql.trim().replace(/\s+/g, " "));
    console.log("[GALLERY] Lead fetch params:", params);

    const [rawLeads] = await db.query(sql, params);
    let leads = Array.isArray(rawLeads) ? rawLeads : [];

    if (effectiveLeadIds.length > 0) {
      const leadIdSet = new Set(effectiveLeadIds);
      leads = leads.filter((lead) => leadIdSet.has(Number(lead.id)));
    }

    const isGenericCampaignName = (value) => {
      const normalized = String(value || "").trim().toLowerCase();
      return (
        normalized === "campaign" ||
        normalized === "campaigning" ||
        normalized === "digital campaign" ||
        normalized === "digital"
      );
    };
    if (normalizedTarget === "staff") {
      leads = leads.filter((lead) => !isGenericCampaignName(lead?.lead_name));
    }

    const leadFromNumber = Number.isInteger(Number(leadFrom)) ? Number(leadFrom) : null;
    const leadToNumber = Number.isInteger(Number(leadTo)) ? Number(leadTo) : null;
    if (
      leadFromNumber !== null &&
      leadToNumber !== null &&
      leadFromNumber > 0 &&
      leadToNumber > 0 &&
      leadFromNumber > leadToNumber
    ) {
      return res.status(400).json({ error: "leadFrom should be less than or equal to leadTo" });
    }
    if (
      (leadFromNumber !== null && leadFromNumber > 0) ||
      (leadToNumber !== null && leadToNumber > 0)
    ) {
      const startIdx = Math.max((leadFromNumber || 1) - 1, 0);
      const endIdx = leadToNumber && leadToNumber > 0 ? leadToNumber : leads.length;
      leads = leads.slice(startIdx, endIdx);
    }

    const originalLeadCount = leads.length;
    if (!isDynamicAllLeads && leads.length > DAILY_LEAD_SEND_LIMIT) {
      leads = leads.slice(0, DAILY_LEAD_SEND_LIMIT);
    }

    console.log("✅ Leads found:", leads.length);

    await ensureScheduledMessageColumns(db);
    await ensureScheduledMessageRulesTable(db);

    const selectedChannels = Array.isArray(channels) && channels.length > 0
      ? channels
      : ["WhatsApp", "Mail"];

    const normalizedChannels = selectedChannels
      .map((channel) => String(channel || "").trim().toLowerCase())
      .filter((channel) => ["whatsapp", "mail", "gmail", "email", "all"].includes(channel));

    const finalChannels = normalizedChannels.length > 0 ? normalizedChannels : ["whatsapp", "mail"];

    let finalTime = "";
    if (sendTime) {
      finalTime = String(sendTime).trim();
    } else if (sendAt) {
      const [, atTimeRaw] = String(sendAt).split("T");
      if (atTimeRaw) finalTime = atTimeRaw.slice(0, 8);
    }
    if (!finalTime) {
      return res.status(400).json({ error: "send time is required" });
    }
    if (/^\d{2}:\d{2}$/.test(finalTime)) {
      finalTime = `${finalTime}:00`;
    }
    if (!/^\d{2}:\d{2}:\d{2}$/.test(finalTime)) {
      return res.status(400).json({ error: "Invalid send time format" });
    }
    const normalizeScheduleClock = (value) => {
      const raw = String(value || "").trim();
      if (!raw) return "";
      if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
      if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
      return "";
    };
    const normalizedScheduleFromTime =
      normalizeScheduleClock(scheduleFromTime) || finalTime;
    const normalizedScheduleToTime =
      normalizeScheduleClock(scheduleToTime) || normalizedScheduleFromTime;

    const nowInKolkata = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    const todayInKolkata = [
      nowInKolkata.getFullYear(),
      String(nowInKolkata.getMonth() + 1).padStart(2, "0"),
      String(nowInKolkata.getDate()).padStart(2, "0")
    ].join("-");

    const requestedScheduleFromDate = String(scheduleFromDate || fromDate || "").trim();
    const requestedScheduleToDate = String(scheduleToDate || toDate || "").trim();
    const normalizeScheduleDate = (value) => {
      const raw = String(value || "").trim();
      if (!raw) return "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
        const [first, second, year] = raw.split("/");
        const firstNum = Number(first);
        const secondNum = Number(second);
        if (firstNum > 12) {
          return `${year}-${second.padStart(2, "0")}-${first.padStart(2, "0")}`;
        }
        return `${year}-${first.padStart(2, "0")}-${second.padStart(2, "0")}`;
      }
      return raw;
    };
    const normalizedFromDate = normalizeScheduleDate(requestedScheduleFromDate);
    const normalizedToDate = normalizeScheduleDate(requestedScheduleToDate);
    const effectiveFromDate =
      normalizedFromDate && normalizedFromDate < todayInKolkata ? todayInKolkata : normalizedFromDate || todayInKolkata;
    console.log("[GALLERY] Date window resolved:", {
      requestedFromDate: fromDate,
      requestedToDate: toDate,
      requestedScheduleFromDate,
      requestedScheduleToDate,
      normalizedFromDate,
      normalizedToDate,
      todayInKolkata,
      effectiveFromDate,
      finalTime
    });
    if (!normalizedToDate || effectiveFromDate > normalizedToDate) {
      return res.status(400).json({
        error: "Selected range is in the past. Please choose today or a future date."
      });
    }

    const dateList = [];
    let cursor = new Date(`${effectiveFromDate}T00:00:00`);
    const end = new Date(`${normalizedToDate}T00:00:00`);
    while (cursor <= end) {
      const yyyy = cursor.getFullYear();
      const mm = String(cursor.getMonth() + 1).padStart(2, "0");
      const dd = String(cursor.getDate()).padStart(2, "0");
      dateList.push(`${yyyy}-${mm}-${dd}`);
      cursor.setDate(cursor.getDate() + 1);
    }
    let dynamicRuleId = null;
    if (isDynamicAllLeads) {
      const [ruleInsertResult] = await db.execute(
        `INSERT INTO scheduled_message_rules
         (dynamic_mode, media_path, message, channel_csv, send_time, schedule_from_date, schedule_to_date, schedule_from_time, schedule_to_time, lead_window_from, lead_window_to, gallery_target, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          normalizedTarget === "staff" ? "all_staff" : "all_leads",
          imagePath,
          posterMessage,
          finalChannels.join(","),
          finalTime,
          effectiveFromDate,
          normalizedToDate,
          normalizedScheduleFromTime,
          normalizedScheduleToTime,
          fromDate || effectiveFromDate,
          toDate || normalizedToDate,
          normalizedTarget
        ]
      );
      dynamicRuleId = Number(ruleInsertResult?.insertId || 0) || null;
      console.log("[GALLERY][RULE] Dynamic rule created", {
        schoolCode,
        dynamicRuleId,
        mode: normalizedTarget === "staff" ? "all_staff" : "all_leads",
        leadWindowFrom: fromDate || effectiveFromDate,
        leadWindowTo: toDate || normalizedToDate,
        scheduleFromDate: effectiveFromDate,
        scheduleToDate: normalizedToDate
      });
    }

    const insertSql = `
      INSERT INTO scheduled_messages
      (lead_id, phone, email, channel, message, send_date, send_time, sent, media_path, schedule_from_date, schedule_to_date, schedule_from_time, schedule_to_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
    `;

    const parsedGap = Number(whatsappGapMinutes);
    const whatsappGapMins =
      Number.isFinite(parsedGap) && parsedGap >= 0
        ? Math.floor(parsedGap)
        : DEFAULT_WHATSAPP_POSTER_GAP_MINUTES;
    console.log("[GALLERY][GAP] Effective settings", {
      schoolCode,
      dailyLimit: DAILY_LEAD_SEND_LIMIT,
      whatsappGapMins,
      baseSendTime: finalTime,
      leadsCount: leads.length
    });

    let scheduledCount = 0;
    let deletedPendingCount = 0;
    let dbInsertAttempts = 0;
    let dbInsertedRows = 0;
    const MAX_SCHEDULE_EXTENSION_DAYS = 3650;
    let leadCursor = 0;
    let dayIndex = 0;
    while (leadCursor < leads.length) {
      if (dayIndex > MAX_SCHEDULE_EXTENSION_DAYS) {
        return res.status(429).json({
          error: "Unable to find enough available WhatsApp slots for the selected leads."
        });
      }
      const date = addDaysToKolkataDate(effectiveFromDate, dayIndex);
      dayIndex += 1;
      if (leadCursor >= leads.length) break;
      const usedForDate = await getCampaignWhatsAppUsageForDate(db, date);
      const remainingForDate = Math.max(0, DAILY_LEAD_SEND_LIMIT - usedForDate);
      if (remainingForDate <= 0) {
        console.log("[GALLERY][LIMIT] Skipping date because limit reached", {
          schoolCode,
          date,
          usedForDate,
          dailyLimit: DAILY_LEAD_SEND_LIMIT
        });
        continue;
      }

      const dateLeads = leads.slice(leadCursor, leadCursor + remainingForDate);
      leadCursor += dateLeads.length;
      for (const [leadIndex, lead] of dateLeads.entries()) {
        const phone = lead.mobile_number || null;
        const email = lead.email_id || null;

        for (const channel of finalChannels) {
          const [deleteResult] = await db.execute(
            `DELETE FROM scheduled_messages
             WHERE lead_id = ?
               AND channel = ?
               AND sent = 0
               AND send_date BETWEEN ? AND ?
               AND media_path = ?`,
            [lead.id, channel, effectiveFromDate, normalizedToDate, imagePath]
          );
          deletedPendingCount += Number(deleteResult?.affectedRows || 0);
        }

        for (const channel of finalChannels) {
          const finalSendTimeForChannel =
            channel === "whatsapp"
              ? addMinutesToSendTime(finalTime, leadIndex * whatsappGapMins)
              : finalTime;
          if (channel === "whatsapp") {
            console.log("[GALLERY][GAP] Queue row", {
              schoolCode,
              leadId: lead.id,
              date,
              leadIndex,
              baseTime: finalTime,
              computedTime: finalSendTimeForChannel
            });
          }
          dbInsertAttempts += 1;
          const [insertResult] = await db.execute(insertSql, [
            lead.id,
            phone,
            email,
            channel,
            posterMessage,
            date,
            finalSendTimeForChannel,
            imagePath,
            effectiveFromDate,
            normalizedToDate,
            normalizedScheduleFromTime,
            normalizedScheduleToTime
          ]);
          const affectedRows = Number(insertResult?.affectedRows || 0);
          dbInsertedRows += affectedRows;
          if (dbInsertAttempts <= 10 || dbInsertAttempts % 50 === 0) {
            console.log("[GALLERY][DB-INSERT] scheduled_messages row inserted", {
              schoolCode,
              leadId: lead.id,
              channel,
              sendDate: date,
              sendTime: finalSendTimeForChannel,
              scheduleFromDate: effectiveFromDate,
              scheduleToDate: normalizedToDate,
              scheduleFromTime: normalizedScheduleFromTime,
              scheduleToTime: normalizedScheduleToTime,
              affectedRows,
              insertId: insertResult?.insertId || null,
              attemptNo: dbInsertAttempts
            });
          }
          scheduledCount += 1;
        }
      }
    }

    const [verifyRows] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM scheduled_messages
       WHERE sent = 0
         AND media_path = ?
         AND send_date BETWEEN ? AND ?
         AND schedule_from_date = ?
         AND schedule_to_date = ?`,
      [imagePath, effectiveFromDate, normalizedToDate, effectiveFromDate, normalizedToDate]
    );
    const dbVerifyCount = Number(verifyRows?.[0]?.total || 0);
    console.log("[GALLERY][DB-VERIFY] scheduled_messages pending rows in range", {
      schoolCode,
      imagePath,
      effectiveFromDate,
      normalizedToDate,
      dbInsertAttempts,
      dbInsertedRows,
      scheduledCount,
      dbVerifyCount
    });

    res.json({
      success: true,
      totalLeads: leads.length,
      requestedLeads: originalLeadCount,
      scheduled: scheduledCount,
      dynamicRuleCreated: isDynamicAllLeads,
      dynamicRuleId,
      deletedPendingCount,
      days: dateList.length,
      channels: finalChannels,
      sendTime: finalTime,
      whatsappGapMinutes: whatsappGapMins,
      effectiveFromDate,
      effectiveToDate: normalizedToDate,
      dynamicAllLeads: isDynamicAllLeads,
      dbInsertAttempts,
      dbInsertedRows,
      dbVerifyCount
    });
    console.log("[GALLERY] Scheduling completed:", {
      schoolCode,
      totalLeads: leads.length,
      days: dateList.length,
      channels: finalChannels,
      sendTime: finalTime,
      whatsappGapMinutes: whatsappGapMins,
      effectiveFromDate,
      effectiveToDate: normalizedToDate,
      dynamicRuleCreated: isDynamicAllLeads,
      dynamicRuleId,
      deletedPendingCount,
      scheduledCount
    });

  } catch (err) {
    console.error("❌ ERROR:", err);
    res.status(500).json({ error: "Failed to send image" });
  }
});

app.get("/api/frontdesk/metrics", async (req, res) => {
  const { schoolCode } = req.query;
  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);

    const [leadCounts] = await db.query(
      `
      SELECT
        COUNT(*) AS total_leads,
        SUM(CASE WHEN reg_no IS NOT NULL AND reg_no <> '' THEN 1 ELSE 0 END) AS registered,
        SUM(CASE WHEN test_date IS NOT NULL THEN 1 ELSE 0 END) AS exam_written,
        SUM(CASE WHEN LOWER(COALESCE(status, '')) = 'enrolled' THEN 1 ELSE 0 END) AS enrolled
      FROM leads
      `
    );

    const [admissionPaidRows] = await db.query(
      `
      SELECT COUNT(*) AS admission_paid
      FROM FeesDetails
      WHERE (
        Admission_paid > 0
        OR (fee_type = 'Admission Fee' AND amount_paid > 0)
      )
      AND StudentName IN (SELECT student_name FROM leads WHERE student_name IS NOT NULL)
      `
    );

    res.json({
      total_leads: Number(leadCounts?.[0]?.total_leads || 0),
      registered: Number(leadCounts?.[0]?.registered || 0),
      exam_written: Number(leadCounts?.[0]?.exam_written || 0),
      enrolled: Number(leadCounts?.[0]?.enrolled || 0),
      admission_paid: Number(admissionPaidRows?.[0]?.admission_paid || 0)
    });
  } catch (err) {
    console.error("FrontDesk metrics error:", err);
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

app.get("/api/frontdesk/send-counts", async (req, res) => {
  const { schoolCode } = req.query;
  const days = Math.min(90, Math.max(1, Number(req.query.days || 30)));
  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);
    await ensureScheduledMessageColumns(db);
    const nowInKolkata = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    const yyyy = nowInKolkata.getFullYear();
    const mm = String(nowInKolkata.getMonth() + 1).padStart(2, "0");
    const dd = String(nowInKolkata.getDate()).padStart(2, "0");
    const todayKolkata = `${yyyy}-${mm}-${dd}`;
    const fromDate = new Date(nowInKolkata);
    fromDate.setDate(fromDate.getDate() - (days - 1));
    const fromYyyy = fromDate.getFullYear();
    const fromMm = String(fromDate.getMonth() + 1).padStart(2, "0");
    const fromDd = String(fromDate.getDate()).padStart(2, "0");
    const fromDateKolkata = `${fromYyyy}-${fromMm}-${fromDd}`;

    const [rows] = await db.query(
      `
      SELECT
        SUM(
          CASE
            WHEN channel IN ('whatsapp', 'wa')
              AND whatsapp_sent = 1
            THEN 1
            WHEN channel = 'all' AND whatsapp_sent = 1 THEN 1
            ELSE 0
          END
        ) AS whatsapp_sent_count,
        SUM(
          CASE
            WHEN channel IN ('mail', 'gmail', 'email')
              AND email_sent = 1
            THEN 1
            WHEN channel = 'all' AND email_sent = 1 THEN 1
            ELSE 0
          END
        ) AS email_sent_count
      FROM scheduled_messages
      WHERE send_date BETWEEN ? AND ?
        AND message IN (
          'Daily poster from Campaigning Digital - Gallery',
          'Daily poster from Campaigning Staff - Gallery'
        )
      `
      ,
      [fromDateKolkata, todayKolkata]
    );

    const whatsappSentCount = Number(rows?.[0]?.whatsapp_sent_count || 0);
    const emailSentCount = Number(rows?.[0]?.email_sent_count || 0);
    const totalSentCount = whatsappSentCount + emailSentCount;

    res.json({
      fromDate: fromDateKolkata,
      date: todayKolkata,
      days,
      whatsappSentToday: whatsappSentCount,
      emailSentToday: emailSentCount,
      totalSentToday: totalSentCount,
      // Backward-compatible keys for existing frontend usage
      whatsappRemaining: Math.max(0, 30 - whatsappSentCount),
      emailRemaining: Math.max(0, 30 - emailSentCount),
      totalRemaining: Math.max(0, 30 - totalSentCount)
    });
  } catch (err) {
    console.error("FrontDesk send counts error:", err);
    res.status(500).json({ error: "Failed to fetch send counts" });
  }
});

app.get("/api/frontdesk/campaign-status", async (req, res) => {
  const { schoolCode } = req.query;
  const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
  const days = Math.min(90, Math.max(1, Number(req.query.days || 30)));
  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);
    await ensureScheduledMessageColumns(db);

    const nowInKolkata = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    const yyyy = nowInKolkata.getFullYear();
    const mm = String(nowInKolkata.getMonth() + 1).padStart(2, "0");
    const dd = String(nowInKolkata.getDate()).padStart(2, "0");
    const todayKolkata = `${yyyy}-${mm}-${dd}`;
    const fromDate = new Date(nowInKolkata);
    fromDate.setDate(fromDate.getDate() - (days - 1));
    const fromYyyy = fromDate.getFullYear();
    const fromMm = String(fromDate.getMonth() + 1).padStart(2, "0");
    const fromDd = String(fromDate.getDate()).padStart(2, "0");
    const fromDateKolkata = `${fromYyyy}-${fromMm}-${fromDd}`;
    const futureDate = new Date(nowInKolkata);
    futureDate.setDate(futureDate.getDate() + (days - 1));
    const futureYyyy = futureDate.getFullYear();
    const futureMm = String(futureDate.getMonth() + 1).padStart(2, "0");
    const futureDd = String(futureDate.getDate()).padStart(2, "0");
    const futureDateKolkata = `${futureYyyy}-${futureMm}-${futureDd}`;

    const [rows] = await db.query(
      `
      SELECT
        sm.id,
        sm.lead_id,
        sm.channel,
        sm.message,
        sm.send_date AS date,
        sm.send_time AS lead_time,
        sm.schedule_from_date,
        sm.schedule_to_date,
        sm.schedule_from_time,
        sm.schedule_to_time,
        sm.phone AS mobile_number,
        sm.email AS email_id,
        sm.sent,
        sm.email_sent,
        sm.whatsapp_sent,
        COALESCE(l.full_name, l.student_name, l.lead_name, 'Lead') AS full_name,
        l.lead_name,
        l.refer_by
      FROM scheduled_messages sm
      LEFT JOIN leads l ON l.id = sm.lead_id
      WHERE sm.send_date BETWEEN ? AND ?
        AND sm.message IN (
          'Daily poster from Campaigning Digital - Gallery',
          'Daily poster from Campaigning Staff - Gallery'
        )
        AND (
          (
            sm.channel IN ('whatsapp', 'wa')
            AND (
              sm.whatsapp_sent = 1
              OR (sm.sent = 1 AND (sm.whatsapp_sent = 0 OR sm.whatsapp_sent IS NULL))
            )
          )
          OR
          (
            sm.channel IN ('mail', 'gmail', 'email')
            AND (
              sm.email_sent = 1
              OR (sm.sent = 1 AND (sm.email_sent = 0 OR sm.email_sent IS NULL))
            )
          )
          OR
          (
            sm.channel = 'all'
            AND (sm.whatsapp_sent = 1 OR sm.email_sent = 1)
          )
        )
      ORDER BY sm.send_date DESC, sm.send_time DESC, sm.id DESC
      LIMIT ?
      `,
      [fromDateKolkata, todayKolkata, limit]
    );

    const normalized = (rows || []).map((row) => {
      const channel = String(row.channel || "").toLowerCase();
      let entry_type = channel;
      if (channel === "all") {
        if (Number(row.whatsapp_sent || 0) && Number(row.email_sent || 0)) entry_type = "whatsapp/mail";
        else if (Number(row.whatsapp_sent || 0)) entry_type = "whatsapp";
        else if (Number(row.email_sent || 0)) entry_type = "mail";
      } else if (channel === "gmail" || channel === "email") {
        entry_type = "mail";
      } else if (channel === "wa") {
        entry_type = "whatsapp";
      }

      return {
        id: row.id,
        lead_id: row.lead_id,
        full_name: row.full_name || "Lead",
        lead_name: row.lead_name || "",
        refer_by: row.refer_by || "",
        mobile_number: row.mobile_number || "",
        email_id: row.email_id || "",
        date: row.date,
        lead_time: row.lead_time || "",
        schedule_from_date: row.schedule_from_date || "",
        schedule_to_date: row.schedule_to_date || "",
        schedule_from_time: row.schedule_from_time || "",
        schedule_to_time: row.schedule_to_time || "",
        entry_type,
        campaign_scope: String(row.message || "").toLowerCase().includes("staff")
          ? "staff"
          : "digital",
      };
    });

    const [scheduledRows] = await db.query(
      `
      SELECT
        sm.id,
        sm.lead_id,
        sm.channel,
        sm.message,
        sm.send_date AS date,
        sm.send_time AS lead_time,
        sm.schedule_from_date,
        sm.schedule_to_date,
        sm.schedule_from_time,
        sm.schedule_to_time,
        sm.phone AS mobile_number,
        sm.email AS email_id,
        sm.sent,
        sm.email_sent,
        sm.whatsapp_sent,
        COALESCE(l.full_name, l.student_name, l.lead_name, 'Lead') AS full_name,
        l.lead_name,
        l.refer_by
      FROM scheduled_messages sm
      LEFT JOIN leads l ON l.id = sm.lead_id
      WHERE sm.send_date BETWEEN ? AND ?
        AND sm.message IN (
          'Daily poster from Campaigning Digital - Gallery',
          'Daily poster from Campaigning Staff - Gallery'
        )
      ORDER BY sm.send_date DESC, sm.send_time DESC, sm.id DESC
      LIMIT ?
      `,
      [fromDateKolkata, futureDateKolkata, Math.max(limit * 4, 1000)]
    );

    const normalizedScheduled = (scheduledRows || []).map((row) => {
      const channel = String(row.channel || "").toLowerCase();
      let entry_type = channel;
      if (channel === "all") {
        if (Number(row.whatsapp_sent || 0) && Number(row.email_sent || 0)) entry_type = "whatsapp/mail";
        else if (Number(row.whatsapp_sent || 0)) entry_type = "whatsapp";
        else if (Number(row.email_sent || 0)) entry_type = "mail";
      } else if (channel === "gmail" || channel === "email") {
        entry_type = "mail";
      } else if (channel === "wa") {
        entry_type = "whatsapp";
      }

      return {
        id: row.id,
        lead_id: row.lead_id,
        full_name: row.full_name || "Lead",
        lead_name: row.lead_name || "",
        refer_by: row.refer_by || "",
        mobile_number: row.mobile_number || "",
        email_id: row.email_id || "",
        date: row.date,
        lead_time: row.lead_time || "",
        schedule_from_date: row.schedule_from_date || "",
        schedule_to_date: row.schedule_to_date || "",
        schedule_from_time: row.schedule_from_time || "",
        schedule_to_time: row.schedule_to_time || "",
        entry_type,
        campaign_scope: String(row.message || "").toLowerCase().includes("staff")
          ? "staff"
          : "digital",
      };
    });

    const uniqueLeadCount = new Set(
      normalizedScheduled.map((row) =>
        row.lead_id != null && row.lead_id !== ""
          ? `lead:${row.lead_id}`
          : `row:${row.id}`
      )
    ).size;

    return res.json({
      success: true,
      date: todayKolkata,
      fromDate: fromDateKolkata,
      days,
      totalCount: uniqueLeadCount,
      total: normalized.length,
      rows: normalized,
      scheduledRows: normalizedScheduled,
    });
  } catch (err) {
    console.error("FrontDesk campaign status error:", err);
    return res.status(500).json({ error: "Failed to fetch campaign status" });
  }
});

app.get("/api/scheduler/health", async (req, res) => {
  try {
    const schoolCode = String(req.query.schoolCode || "").trim();
    const days = Math.max(1, Math.min(31, Number(req.query.days || 7)));

    if (!schoolCode) {
      return res.status(400).json({ error: "schoolCode is required" });
    }

    const db = await getDatabaseConnection(schoolCode);
    await ensureScheduledMessageColumns(db);

    const nowInKolkata = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    const yyyy = nowInKolkata.getFullYear();
    const mm = String(nowInKolkata.getMonth() + 1).padStart(2, "0");
    const dd = String(nowInKolkata.getDate()).padStart(2, "0");
    const hh = String(nowInKolkata.getHours()).padStart(2, "0");
    const mi = String(nowInKolkata.getMinutes()).padStart(2, "0");
    const ss = String(nowInKolkata.getSeconds()).padStart(2, "0");
    const nowDate = `${yyyy}-${mm}-${dd}`;
    const nowTime = `${hh}:${mi}:${ss}`;

    const [dailyRows] = await db.execute(
      `
      SELECT 
        send_date,
        channel,
        COUNT(*) AS total_rows,
        SUM(sent = 1) AS sent_rows,
        SUM(email_sent = 1) AS email_sent_rows,
        SUM(whatsapp_sent = 1) AS whatsapp_sent_rows,
        SUM(sent = 0) AS pending_rows
      FROM scheduled_messages
      WHERE send_date BETWEEN ? AND DATE_ADD(?, INTERVAL ? DAY)
      GROUP BY send_date, channel
      ORDER BY send_date ASC, channel ASC
      `,
      [nowDate, nowDate, days]
    );

    const [overdueRows] = await db.execute(
      `
      SELECT COUNT(*) AS overdue_pending
      FROM scheduled_messages
      WHERE sent = 0
        AND (send_date < ? OR (send_date = ? AND send_time < ?))
      `,
      [nowDate, nowDate, nowTime]
    );

    const [nextDueRows] = await db.execute(
      `
      SELECT id, lead_id, channel, send_date, send_time, sent, email_sent, whatsapp_sent
      FROM scheduled_messages
      WHERE sent = 0
      ORDER BY send_date ASC, send_time ASC, id ASC
      LIMIT 20
      `
    );

    return res.json({
      success: true,
      schoolCode,
      timezone: "Asia/Kolkata",
      nowDate,
      nowTime,
      daysWindow: days,
      overduePending: Number(overdueRows?.[0]?.overdue_pending || 0),
      dailySummary: dailyRows || [],
      nextDue: nextDueRows || []
    });
  } catch (err) {
    console.error("Scheduler health error:", err?.message || err);
    return res.status(500).json({ error: "Failed to fetch scheduler health" });
  }
});

app.get("/api/frontdesk/reports/leads", async (req, res) => {
  const {
    schoolCode,
    reportType = "all",
    leadName = "",
    fromDate = "",
    toDate = "",
    search = "",
    entryType = "",
    assignedTeacher = "",
    page = "1",
    limit = "50",
    sortBy = "date",
    sortDir = "DESC",
  } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 50));
  const offset = (safePage - 1) * safeLimit;

  const sortFieldMap = {
    id: "id",
    full_name: "full_name",
    lead_name: "lead_name",
    date: "date",
    lead_time: "lead_time",
    reg_no: "reg_no",
    entry_type: "entry_type",
    assigned_teacher_name: "assigned_teacher_name",
    followup_day: "followup_day",
  };
  const safeSortBy = sortFieldMap[String(sortBy)] || "date";
  const safeSortDir = String(sortDir).toUpperCase() === "ASC" ? "ASC" : "DESC";

  const where = [];
  const params = [];

  if (leadName) {
    where.push("(lead_name LIKE ? OR refer_by LIKE ?)");
    params.push(`%${leadName}%`, `%${leadName}%`);
  }

  if (fromDate) {
    where.push("date >= ?");
    params.push(fromDate);
  }

  if (toDate) {
    where.push("date <= ?");
    params.push(toDate);
  }

  if (entryType) {
    where.push("entry_type = ?");
    params.push(entryType);
  }

  if (assignedTeacher) {
    where.push("assigned_teacher_name LIKE ?");
    params.push(`%${assignedTeacher}%`);
  }

  if (search) {
    where.push(`(
      full_name LIKE ?
      OR student_name LIKE ?
      OR mobile_number LIKE ?
      OR email_id LIKE ?
      OR lead_name LIKE ?
      OR refer_by LIKE ?
      OR reg_no LIKE ?
      OR ticket_no LIKE ?
    )`);
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like, like, like);
  }

  const reportTypeKey = String(reportType).toLowerCase();
  switch (reportTypeKey) {
    case "registered":
      where.push("reg_no IS NOT NULL AND reg_no <> ''");
      break;
    case "digital":
      where.push("(lead_name IS NOT NULL AND lead_name <> '')");
      break;
    case "staff":
      where.push("(assigned_teacher_name IS NOT NULL AND assigned_teacher_name <> '')");
      break;
    case "automated":
      where.push("LOWER(TRIM(COALESCE(entry_type, ''))) <> 'manual'");
      break;
    case "followup":
      where.push("COALESCE(followup_day, 0) > 0");
      break;
    case "lead_profile":
      where.push("full_name IS NOT NULL AND full_name <> ''");
      break;
    case "enrolled":
      where.push("LOWER(COALESCE(status, '')) = 'enrolled'");
      break;
    case "timeline":
      where.push("date IS NOT NULL");
      break;
    case "all":
    default:
      break;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const db = await getDatabaseConnection(schoolCode);

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM leads ${whereSql}`,
      params
    );
    const total = Number(countRows?.[0]?.total || 0);

    const [rows] = await db.query(
      `
      SELECT
        id, full_name, occupation, mobile_number, email_id, address, dob, blood_group,
        lead_admission_for, entry_type, reg_no, ticket_no, date, lead_time, test_type, test_mode,
        test_date, counselling_required, counselling_date, counselling_time, assigned_teacher_id,
        assigned_teacher_name, teacher_decision, teacher_reason, teacher_reson, test_time, photo,
        student_photo, test_score, total_marks, test_status, student_name, last_name, issue_type,
        action, remarks, ticket_status, tc_document, aadhar_document, dob_document,
        appeared_document, father_id, mother_id, address_proof, mother_name, branch, refer_by, status,
        followup_day, lead_name
      FROM leads
      ${whereSql}
      ORDER BY ${safeSortBy} ${safeSortDir}, id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, safeLimit, offset]
    );

    res.json({
      success: true,
      reportType: reportTypeKey,
      total,
      page: safePage,
      limit: safeLimit,
      rows,
    });
  } catch (err) {
    console.error("FrontDesk reports leads error:", err);
    res.status(500).json({ error: "Failed to fetch reports leads data" });
  }
});





app.get("/api/student-transactions-dynamic", async (req, res) => {
  const { schoolCode, studentName, className, section } = req.query;

  if (!schoolCode) return res.status(400).json({ error: "School code missing" });

  let connection;
  try {
    const pool = getDatabaseConnection(schoolCode);
    connection = await pool.getConnection();

    const [feeTypeRows] = await connection.query(`
      SELECT fee_name
      FROM fee_type_master
      WHERE fee_name IS NOT NULL AND TRIM(fee_name) <> ''
      ORDER BY id ASC
    `);
    const dynamicFeeSelects = (Array.isArray(feeTypeRows) ? feeTypeRows : [])
      .map((item) => {
        const base = normalizeFeeColumnBase(item?.fee_name);
        if (!base) return null;
        return [
          `fd.\`${base}\` AS \`${base}\``,
          `fd.\`${base}_paid\` AS \`${base}_paid\``,
          `fd.\`${base}_due\` AS \`${base}_due\``,
          `fd.\`${base}_discount\` AS \`${base}_discount\``,
        ].join(",\n        ");
      })
      .filter(Boolean)
      .join(",\n        ");

    let sql = `
      SELECT
        fd.id,
        fd.StudentName,
        fd.Class_name,
        fd.section,
        fd.fee_type,
        fd.amount_paid,
        fd.paidDate,
        fd.receiptNumber,
        fd.paymentMode,
        fd.transaction_id,
        fd.CompleteFee,
        fd.Admission_fees,
        fd.Admission_paid,
        fd.Book_Fees,
        fd.books_paid,
        fd.Uniform_fees,
        fd.uniform_paid,
        fd.Exam_fees,
        fd.exam_paid,
        fd.Bus_fees,
        fd.bus_paid,
        fd.Saving_Fees,
        fd.Saving_paid,
        fd.stationary,
        fd.stationary_paid,
        fd.stationary_due,
        fd.sports,
        fd.sports_paid,
        fd.sports_due,
        fd.guides,
        fd.guides_paid,
        fd.guides_due,
        fd.belt,
        fd.belt_paid,
        fd.belt_due,
        fd.tie_fee,
        fd.tie_paid,
        fd.tie_due,
        fd.Others,
        fd.others_paid,
        fd.others_description,
        fd.Discount,
        fd.tuition_discount,
        fd.bus_discount,
        fd.fee_discount,
        ${dynamicFeeSelects ? `${dynamicFeeSelects},` : ""}
        fd.Paid_Amount,
        fd.Previous_Fee_Due,
        fd.Previous_Paid,
        fd.ResidentialCompleteFee,
        fd.RES_INST_1,
        fd.RES_INST_1_DATE,
        fd.RES_INST_2,
        fd.RES_INST_2_DATE,
        fd.RES_INST_3,
        fd.RES_INST_3_DATE,
        fd.RES_INST_4,
        fd.RES_INST_4_DATE,
        fd.RES_INST_5,
        fd.RES_INST_5_DATE,
        fd.created_at,
        mlc.id AS student_login_id,
        mlc.father_name,
        mlc.phone_no,
        mlc.admission_no,
        mlc.gender,
        mlc.email,
        mlc.address
      FROM FeesDetails fd
      LEFT JOIN management_login_creation mlc
        ON LOWER(TRIM(mlc.name)) = LOWER(TRIM(fd.StudentName))
       AND LOWER(TRIM(mlc.class_name)) = LOWER(TRIM(fd.Class_name))
       AND LOWER(TRIM(mlc.section)) = LOWER(TRIM(fd.section))
       AND (mlc.is_deleted = 0 OR mlc.is_deleted IS NULL)
      WHERE 1=1
    `;
    const params = [];

    if (studentName) {
      sql += " AND fd.StudentName = ?";
      params.push(studentName);
    }
    if (className && className !== "All") {
      sql += " AND fd.Class_name = ?";
      params.push(className);
    }
    if (section && section !== "All") {
      sql += " AND fd.section = ?";
      params.push(section);
    }

    sql += `
      AND (
        COALESCE(amount_paid, 0) > 0 OR
        COALESCE(Admission_paid, 0) > 0 OR
        COALESCE(books_paid, 0) > 0 OR
        COALESCE(uniform_paid, 0) > 0 OR
        COALESCE(exam_paid, 0) > 0 OR
        COALESCE(bus_paid, 0) > 0 OR
        COALESCE(Saving_paid, 0) > 0 OR
        COALESCE(stationary_paid, 0) > 0 OR
        COALESCE(sports_paid, 0) > 0 OR
        COALESCE(guides_paid, 0) > 0 OR
        COALESCE(belt_paid, 0) > 0 OR
        COALESCE(tie_paid, 0) > 0 OR
        COALESCE(others_paid, 0) > 0
      )
      ORDER BY id ASC
    `;

    const [rows] = await connection.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch student transactions" });
  } finally {
    if (connection) connection.release();
  }
});
app.post("/update-complete-feeData", async (req, res) => {
  const {
    schoolCode,
    id,
    Class_name,
    class_name,
    section,
    StudentName,
    studentName,
  } = req.body;

  try {
    if (!schoolCode) {
      return res.status(400).json({ success: false, message: "schoolCode is required" });
    }

    const pool = getDatabaseConnection(schoolCode);

    const fieldMap = {
      CompleteFee: "CompleteFee",
      StudentBooksFee: "Book_Fees",
      StudentExamFee: "Exam_fees",
      TuitionPaid: "Paid_Amount",
      BusFee: "Bus_fees",
      OtherFee: "Others",
      PreviousDue: "Previous_Fee_Due",
      ResidentialCompleteFee: "ResidentialCompleteFee",
      Admission_fees: "Admission_fees",
      Book_Fees: "Book_Fees",
      Uniform_fees: "Uniform_fees",
      Exam_fees: "Exam_fees",
      Bus_fees: "Bus_fees",
      Others: "Others",
      Admission_paid: "Admission_paid",
      books_paid: "books_paid",
      uniform_paid: "uniform_paid",
      exam_paid: "exam_paid",
      bus_paid: "bus_paid",
      others_paid: "others_paid",
      Paid_Amount: "Paid_Amount",
      Previous_Paid: "Previous_Paid",
      RES_INST_1: "RES_INST_1",
      RES_INST_2: "RES_INST_2",
      RES_INST_3: "RES_INST_3",
      RES_INST_4: "RES_INST_4",
      RES_INST_5: "RES_INST_5",
      RES_INST_1_DATE: "RES_INST_1_DATE",
      RES_INST_2_DATE: "RES_INST_2_DATE",
      RES_INST_3_DATE: "RES_INST_3_DATE",
      RES_INST_4_DATE: "RES_INST_4_DATE",
      RES_INST_5_DATE: "RES_INST_5_DATE",
      paymentMode: "paymentMode",
      transaction_id: "transaction_id",
      receiptNumber: "receiptNumber",
      paidDate: "paidDate",
    };

    const numericCols = new Set([
      "CompleteFee", "Book_Fees", "Exam_fees", "Paid_Amount", "Bus_fees", "Others",
      "Previous_Fee_Due", "ResidentialCompleteFee", "Admission_fees", "Uniform_fees",
      "Admission_paid", "books_paid", "uniform_paid", "exam_paid", "bus_paid",
      "others_paid", "Previous_Paid",
      "RES_INST_1", "RES_INST_2", "RES_INST_3", "RES_INST_4", "RES_INST_5"
    ]);

    const updateParts = [];
    const updateValues = [];

    Object.entries(fieldMap).forEach(([incoming, column]) => {
      if (Object.prototype.hasOwnProperty.call(req.body, incoming)) {
        let value = req.body[incoming];

        if (column === "paidDate" || /^RES_INST_[1-5]_DATE$/.test(column)) {
          value = value ? String(value).slice(0, 10) : null;
        } else if (numericCols.has(column)) {
          const num = Number(value);
          value = Number.isFinite(num) ? num : 0;
        }

        updateParts.push(`${column} = ?`);
        updateValues.push(value);
      }
    });

    if (updateParts.length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields provided to update" });
    }

    const resolvedClass = class_name || Class_name || null;
    const resolvedStudent = studentName || StudentName || null;

    let updateSql = "";
    let whereValues = [];

    if (id) {
      updateSql = `UPDATE FeesDetails SET ${updateParts.join(", ")} WHERE id = ?`;
      whereValues = [id];
    } else if (resolvedClass && section && resolvedStudent) {
      updateSql = `
        UPDATE FeesDetails
        SET ${updateParts.join(", ")}
        WHERE Class_name = ? AND section = ? AND StudentName = ?
      `;
      whereValues = [resolvedClass, section, resolvedStudent];
    } else {
      return res.status(400).json({
        success: false,
        message: "Provide id or (Class_name/class_name + section + StudentName/studentName)"
      });
    }

    const [updateResult] = await pool.query(updateSql, [...updateValues, ...whereValues]);

    if (!updateResult.affectedRows) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }

    return res.json({ success: true, message: "Record updated", affectedRows: updateResult.affectedRows });

  } catch (error) {
    console.error("Upsert Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.post('/api/create-login', async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      father_name,
      dob,
      address,
      admission_for,
      schoolCode,
      lead_id,
    } = req.body;

    if (!schoolCode) {
      return res.status(400).json({
        success: false,
        message: "School code is required."
      });
    }

    const schoolPool = getDatabaseConnection(schoolCode);

    const [statusColumnRows] = await schoolPool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'leads'
         AND COLUMN_NAME = 'status'`
    );
    if (!statusColumnRows.length) {
      await schoolPool.query(`ALTER TABLE leads ADD COLUMN status VARCHAR(50) NULL`);
    }

    const randomDigitsUsername = Math.floor(1000 + Math.random() * 9000);
    const randomDigitsPassword = Math.floor(1000 + Math.random() * 9000);

    const username = `${first_name.slice(0, 4).toLowerCase()}${randomDigitsUsername}`;
    const password = `${first_name.slice(0, 4).toLowerCase()}@${randomDigitsPassword}`;
    const name = `${first_name} ${last_name}`;
    const newjoinee = "yes";

    // ✅ 1️⃣ Insert FULL DATA into School DB
    await schoolPool.query(
      `INSERT INTO management_login_creation
       (username, password, user_type, name, gender, phone_no, email, designation, aadhar_no, father_name, class_name, section, class_teacher, school_name, address, teaches_to_1, dob, admission_no, schoolCode, newjoinee)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username,
        password,
        'student',
        name,
        'Not Specified',
        null,
        null,
        'Student',
        null,
        father_name,
        admission_for,
        'A',
        'Not Specified',
        'Your School Name',
        address,
        admission_for,
        dob,
        null,
        schoolCode,
        newjoinee
      ]
    );

    // ✅ 2️⃣ Insert LIMITED DATA into Quality DB
    await syncCampaignStaffToQuality({
      username,
      password,
      user_type: "teacher",
      name,
      gender: "Not Specified",
      phone_no: null,
      email: null,
      designation: null,
      school_name: null,
      schoolCode,
      newjoinee,
    });

    const leadIdNum = Number.parseInt(String(lead_id || ""), 10);
    if (Number.isFinite(leadIdNum) && leadIdNum > 0) {
      await schoolPool.query(
        `UPDATE leads
         SET status = 'enrolled'
         WHERE id = ?`,
        [leadIdNum]
      );
    } else {
      await schoolPool.query(
        `UPDATE leads
         SET status = 'enrolled'
         WHERE student_name = ?
           AND lead_admission_for = ?
         ORDER BY id DESC
         LIMIT 1`,
        [first_name, admission_for]
      );
    }

    res.status(200).json({
      success: true,
      message: "Login created successfully in both databases",
      data: { username, password }
    });

  } catch (error) {
    console.error("Error creating login:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create login"
    });
  }
});

async function ensureCampaignStaffFields(db) {
  const columnsToEnsure = [
    ["email", "VARCHAR(255) NULL"],
    ["school_name", "VARCHAR(255) NULL"],
    ["newjoinee", "VARCHAR(20) NULL"],
    ["is_deleted", "TINYINT(1) NOT NULL DEFAULT 0"],
    ["phone_no", "VARCHAR(20) NULL"],
    ["city", "VARCHAR(255) NULL"],
    ["area", "VARCHAR(255) NULL"],
    ["code", "VARCHAR(255) NULL"],
    ["from_date", "DATE NULL"],
    ["to_date", "DATE NULL"],
    ["assign_time", "TIME NULL"],
  ];

  for (const [columnName, columnType] of columnsToEnsure) {
    const [cols] = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'management_login_creation'
         AND COLUMN_NAME = ?`,
      [columnName]
    );
    if (!cols.length) {
      await db.query(`ALTER TABLE management_login_creation ADD COLUMN \`${columnName}\` ${columnType}`);
    }
  }
}

async function ensureProfileSyncFields(db) {
  const columnsToEnsure = [
    ["gender", "VARCHAR(50) NULL"],
    ["phone_no", "VARCHAR(20) NULL"],
    ["email", "VARCHAR(255) NULL"],
    ["photo", "LONGTEXT NULL"],
    ["username", "VARCHAR(255) NULL"],
    ["schoolCode", "VARCHAR(255) NULL"],
  ];

  for (const [columnName, columnType] of columnsToEnsure) {
    const [cols] = await db.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'management_login_creation'
         AND COLUMN_NAME = ?`,
      [columnName]
    );

    if (!cols.length) {
      await db.query(
        `ALTER TABLE management_login_creation ADD COLUMN \`${columnName}\` ${columnType}`
      );
    }
  }
}

const normalizeProfileField = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const cleaned = String(value).trim();
  return cleaned ? cleaned : null;
};

async function syncCampaignStaffToQuality(loginRow) {
  if (!loginRow?.username || !loginRow?.password || !loginRow?.schoolCode) {
    console.log("[QUALITY][syncCampaignStaffToQuality] skipped", {
      username: loginRow?.username || null,
      schoolCode: loginRow?.schoolCode || null,
      hasPassword: Boolean(loginRow?.password),
    });
    return;
  }

  console.log("[QUALITY][syncCampaignStaffToQuality] start", {
    username: loginRow.username,
    schoolCode: loginRow.schoolCode,
    passwordPreview: String(loginRow.password || "").slice(0, 3) + "***",
  });

  const columnsToEnsure = [
    ["username", "VARCHAR(255) NULL"],
    ["password", "VARCHAR(255) NULL"],
    ["schoolCode", "VARCHAR(255) NULL"],
  ];

  for (const [columnName, columnType] of columnsToEnsure) {
    const [cols] = await qualityPool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'management_login_creation'
         AND COLUMN_NAME = ?`,
      [columnName]
    );

    if (!cols.length) {
      await qualityPool.query(
        `ALTER TABLE management_login_creation ADD COLUMN \`${columnName}\` ${columnType}`
      );
    }
  }

  await qualityPool.query(
    `INSERT INTO management_login_creation
     (username, password, schoolCode)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       password = VALUES(password),
       schoolCode = VALUES(schoolCode)`,
    [
      loginRow.username,
      loginRow.password,
      loginRow.schoolCode,
    ]
  );

  const [afterInsertRows] = await qualityPool.query(
    `SELECT username, password, schoolCode
     FROM management_login_creation
     WHERE username = ?
     ORDER BY schoolCode DESC
     LIMIT 5`,
    [loginRow.username]
  );
  console.log("[QUALITY][syncCampaignStaffToQuality] after insert", {
    username: loginRow.username,
    rows: afterInsertRows,
  });

  const [updateResult] = await qualityPool.query(
    `UPDATE management_login_creation
     SET schoolCode = ?
     WHERE username = ?
       AND password = ?`,
    [
      loginRow.schoolCode,
      loginRow.username,
      loginRow.password,
    ]
  );

  console.log("[QUALITY][syncCampaignStaffToQuality] update result", {
    username: loginRow.username,
    schoolCode: loginRow.schoolCode,
    affectedRows: updateResult?.affectedRows ?? null,
    changedRows: updateResult?.changedRows ?? null,
  });

  const [finalRows] = await qualityPool.query(
    `SELECT username, password, schoolCode
     FROM management_login_creation
     WHERE username = ?
     ORDER BY schoolCode DESC
     LIMIT 5`,
    [loginRow.username]
  );
  console.log("[QUALITY][syncCampaignStaffToQuality] final rows", {
    username: loginRow.username,
    rows: finalRows,
  });
}

app.post("/api/campaigning/add-staff", async (req, res) => {
  try {
    const {
      schoolCode,
      full_name,
      mobile_number,
      email_id,
      city,
      area,
      code,
      from_date,
      to_date,
      assign_time,
    } = req.body || {};

    const normalizedSchoolCode = String(schoolCode || "").trim();
    const staffName = String(full_name || "").trim();
    const cleanedMobile = formatMobileForWhatsapp(mobile_number);
    const cleanedEmail = String(email_id || "").trim();

    if (!normalizedSchoolCode) {
      return res.status(400).json({ success: false, message: "schoolCode is required" });
    }
    if (!staffName) {
      return res.status(400).json({ success: false, message: "full_name is required" });
    }
    if (!cleanedMobile) {
      return res.status(400).json({ success: false, message: "mobile_number is required" });
    }

    const db = await getDatabaseConnection(normalizedSchoolCode);
    await ensureLeadStaffTable(db);

    const [duplicateRows] = await db.query(
      `SELECT id
       FROM \`Lead_staff\`
       WHERE schoolCode = ?
         AND mobile_number = ?
       LIMIT 1`,
      [normalizedSchoolCode, cleanedMobile]
    );
    if (duplicateRows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Staff already exists for this mobile number.",
      });
    }

    const seed = staffName.replace(/\s+/g, "").slice(0, 4).toLowerCase() || "staff";
    const username = `${seed}${Math.floor(1000 + Math.random() * 9000)}`;
    const password = `${seed}@${Math.floor(1000 + Math.random() * 9000)}`;
    const playStoreLink = "https://play.google.com/store/apps/details?id=com.cleezoclass&pcampaignid=web_share";
    const staffLoginMessage = [
      `Welcome to Cleezo Class.`,
      `Your staff login has been created successfully.`,
      `Username: ${username}`,
      `Password: ${password}`,
      ``,
      `Please install the app from this link and use it for campaigning and school updates:`,
      playStoreLink,
      ``,
      `Keep your credentials safe and change your password after first login if needed.`,
    ].join("\n");
    const schoolName = (await getSchoolDetails(normalizedSchoolCode))?.institute_name || null;
    const newjoinee = "yes";

    const loginRow = {
      username,
      password,
      user_type: "teacher",
      name: staffName,
      gender: "Not Specified",
      phone_no: cleanedMobile,
      email: cleanedEmail || null,
      designation: "Campaigning Staff",
      school_name: schoolName,
      schoolCode: normalizedSchoolCode,
      newjoinee,
    };

    console.log("[LEAD-STAFF][create] prepared loginRow", {
      schoolCode: normalizedSchoolCode,
      username,
      passwordPreview: String(password || "").slice(0, 3) + "***",
    });

    await ensureCampaignStaffFields(db);
    await ensureProfileSyncFields(db);

    const [result] = await db.query(
      `INSERT INTO \`Lead_staff\`
        (schoolCode, full_name, mobile_number, email_id, city, area, code, from_date, to_date, assign_time, qr_sent, qr_sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
      [
        normalizedSchoolCode,
        staffName,
        cleanedMobile,
        cleanedEmail || null,
        String(city || "").trim() || null,
        String(area || "").trim() || null,
        String(code || "").trim() || null,
        String(from_date || "").trim() || null,
        String(to_date || "").trim() || null,
        String(assign_time || "").trim() || null,
      ]
    );

    await db.query(
      `INSERT INTO management_login_creation
       (username, password, user_type, name, gender, phone_no, email, designation, school_name, schoolCode, newjoinee)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        loginRow.username,
        loginRow.password,
        loginRow.user_type,
        loginRow.name,
        loginRow.gender,
        loginRow.phone_no,
        loginRow.email,
        loginRow.designation,
        loginRow.school_name,
        loginRow.schoolCode,
        loginRow.newjoinee,
      ]
    );

    try {
      await syncCampaignStaffToQuality(loginRow);
    } catch (qualityErr) {
      console.warn("[CAMPAIGN-STAFF][login] Quality insert skipped/failed", {
        schoolCode: normalizedSchoolCode,
        error: qualityErr?.message || qualityErr,
      });
    }

    let whatsappSent = false;
    let whatsappError = null;
    try {
      await sendTextViaWhatsappBridge(normalizedSchoolCode, cleanedMobile, staffLoginMessage);
      whatsappSent = true;
      await db.query(
        `UPDATE \`Lead_staff\`
         SET qr_sent = 1, qr_sent_at = NOW()
         WHERE id = ? AND schoolCode = ?`,
        [result.insertId, normalizedSchoolCode]
      );
    } catch (sendErr) {
      whatsappError = sendErr?.message || String(sendErr);
      console.error("Failed to send staff credentials via WhatsApp:", sendErr);
    }

    return res.json({
      success: true,
      message: "Campaigning staff created successfully",
      data: {
        id: result.insertId,
        username,
        password,
        full_name: staffName,
        mobile_number: cleanedMobile,
        email_id: cleanedEmail || null,
        city: String(city || "").trim() || null,
        area: String(area || "").trim() || null,
        code: String(code || "").trim() || null,
        from_date: String(from_date || "").trim() || null,
        to_date: String(to_date || "").trim() || null,
        assign_time: String(assign_time || "").trim() || null,
        whatsapp_sent: whatsappSent,
        whatsapp_error: whatsappError,
        play_store_link: playStoreLink,
      },
    });
  } catch (error) {
    console.error("Failed to create Campaigning staff:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create Campaigning staff",
    });
  }
});

app.post('/pay-admission-fee', async (req, res) => {
  const { studentName, className, sectionName, schoolCode, admissionFee } = req.body;

  console.log("========== PAY ADMISSION FEE API ==========");
  console.log("Request Body:", req.body);

  if (!schoolCode) {
    console.log("❌ Missing schoolCode");
    return res.status(400).json({ success: false, message: "schoolCode is required" });
  }

  try {
    const db = getDatabaseConnection(schoolCode);
    console.log("✅ Connected to DB:", schoolCode);

    const query = `
      UPDATE FeesDetails
      SET Admission_fees = ?, 
          Admission_paid = ?, 
          updated_at = NOW()
      WHERE StudentName = ? 
      AND Class_name = ? 
      AND section = ?
    `;

    console.log("Executing Query With Values:");
    console.log({
      admissionFee,
      studentName,
      className,
      sectionName
    });

    const [result] = await db.query(query, [
      admissionFee,
      admissionFee,
      studentName,
      className,
      sectionName
    ]);

    console.log("Query Result:", result);
    console.log("Affected Rows:", result.affectedRows);

    if (result.affectedRows === 0) {
      console.log("⚠️ No rows updated. WHERE condition did not match.");
      return res.status(404).json({
        success: false,
        message: "No matching student record found."
      });
    }

    console.log("✅ Admission Fee updated successfully");

    res.json({
      success: true,
      message: "Admission Fee updated successfully.",
    });

  } catch (error) {
    console.error("❌ Error saving Admission Fee:", error);
    res.status(500).json({
      success: false,
      message: "Error saving Admission Fee.",
    });
  }
});

// app.post('/pay-admission-fee-lead', async (req, res) => {
//   const {
//     studentName,
//     className,
//     sectionName,
//     schoolCode,
//     admissionFee,
//     admissionPaid
//   } = req.body;

//   if (!schoolCode) {
//     return res.status(400).json({
//       success: false,
//       message: "schoolCode is required"
//     });
//   }

//   try {
//     const db = getDatabaseConnection(schoolCode);

//     const query = `
//       INSERT INTO FeesDetails
//       (StudentName, Class_name, section, Admission_fees, Admission_paid, created_at)
//       VALUES (?, ?, ?, ?, ?, NOW())
//     `;

//     const [result] = await db.query(query, [
//       studentName,
//       className,
//       sectionName,
//       admissionFee,
//       admissionPaid
//     ]);

//     res.json({
//       success: true,
//       message: "Admission Fee inserted successfully.",
//       insertedId: result.insertId
//     });

//   } catch (error) {
//     console.error("Insert Error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error inserting Admission Fee.",
//     });
//   }
// });
app.post('/pay-admission-fee-lead', async (req, res) => {
  const {
    studentName,
    className,
    sectionName,
    schoolCode,
    admissionFee,
    admissionPaid,
    advanceFee
  } = req.body;

  if (!schoolCode) {
    return res.status(400).json({
      success: false,
      message: "schoolCode is required"
    });
  }

  try {
    const db = getDatabaseConnection(schoolCode);

    const insertQueries = [];
    const insertValues = [];

    // ===============================
    // 1️⃣ Insert Admission Fee
    // ===============================
    if (Number(admissionPaid) > 0) {
      insertQueries.push(`
        INSERT INTO FeesDetails
        (StudentName, Class_name, section, amount_paid, fee_type, paidDate, created_at)
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      `);
      insertValues.push([studentName, className, sectionName, admissionPaid, "Admission Fee"]);
    }

    // ===============================
    // 2️⃣ Insert Advance / Upcoming Fee
    // ===============================
    if (Number(advanceFee) > 0) {
      insertQueries.push(`
        INSERT INTO FeesDetails
        (StudentName, Class_name, section, amount_paid, fee_type, paidDate, created_at)
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      `);
      insertValues.push([studentName, className, sectionName, advanceFee, "Upcoming Fee"]);
    }

    // Execute all inserts
    for (let i = 0; i < insertQueries.length; i++) {
      await db.query(insertQueries[i], insertValues[i]);
    }

    res.json({
      success: true,
      message: "Fees inserted successfully."
    });

  } catch (error) {
    console.error("Insert Error:", error);
    res.status(500).json({
      success: false,
      message: "Error inserting fees."
    });
  }
});

app.post("/expenses-superadmin", async (req, res) => {
  const { schoolCode, fromDate, toDate, expenseType, expenses } = req.body;

  if (!schoolCode || !Array.isArray(expenses) || expenses.length === 0) {
    return res.status(400).json({ message: "Invalid request data" });
  }

  // 🔥 USE schoolCode ONLY HERE
  const db = getDatabaseConnection(schoolCode);
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1️⃣ Insert report summary (NO schoolCode column)
    const [reportResult] = await connection.query(
      `
      INSERT INTO superadmin_expense_reports
      (from_date, to_date, expense_type)
      VALUES (?, ?, ?)
      `,
      [fromDate || null, toDate || null, expenseType || null]
    );

    const reportId = reportResult.insertId;

    // 2️⃣ Insert expense items
    const expenseValues = expenses.map((e) => [
      reportId,
      e.expense_date,
      e.expense_type,
      e.amount,
      e.description || null,
    ]);

    await connection.query(
      `
      INSERT INTO superadmin_expenses
      (report_id, expense_date, expense_type, amount, description)
      VALUES ?
      `,
      [expenseValues]
    );

    await connection.commit();

    res.status(201).json({
      message: "Expenses stored successfully",
      reportId,
    });
  } catch (err) {
    await connection.rollback();
    console.error("Insert expenses error:", err);
    res.status(500).json({ message: "Failed to save expenses" });
  } finally {
    connection.release();
  }
});
app.get("/expenses-superadmin", async (req, res) => {
  const { schoolCode, fromDate, toDate, expenseType } = req.query;

  if (!schoolCode) return res.status(400).json({ message: "School code missing" });

  const db = getDatabaseConnection(schoolCode);
  const connection = await db.getConnection();

  try {
    let query = `
      SELECT r.id AS report_id, r.from_date, r.to_date, r.expense_type AS report_type,
             e.id AS expense_id, e.expense_date, e.expense_type, e.amount, e.description
      FROM superadmin_expense_reports r
      JOIN superadmin_expenses e ON e.report_id = r.id
      WHERE 1=1
    `;

    const params = [];

    // Optional filters
    if (fromDate) {
      query += " AND e.expense_date >= ?";
      params.push(fromDate);
    }
    if (toDate) {
      query += " AND e.expense_date <= ?";
      params.push(toDate);
    }
    if (expenseType) {
      query += " AND e.expense_type = ?";
      params.push(expenseType);
    }

    query += " ORDER BY e.expense_date DESC";

    const [rows] = await connection.query(query, params);

    res.json({ success: true, expenses: rows });
  } catch (err) {
    console.error("Fetch expenses error:", err);
    res.status(500).json({ message: "Failed to fetch expenses" });
  } finally {
    connection.release();
  }
});
app.post('/api/superadmin/reports', async (req, res) => {
  try {
    console.log("Incoming report body:", req.body);

    const {
      report_type,
      student_name,
      student_class,
      section,
      chart_type,
      message,
      reported_by,
      schoolCode
    } = req.body;

    if (!report_type || !student_name || !student_class || !section || !reported_by || !schoolCode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const schoolPool = getDatabaseConnection(schoolCode);

    const [result] = await schoolPool.query(
      `INSERT INTO student_reports 
      (report_type, student_name, class, section, chart_type, message, reported_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [report_type, student_name, student_class, section, chart_type, message, reported_by]
    );

    res.status(200).json({ message: 'Report saved successfully', reportId: result.insertId });
  } catch (error) {
    console.error('Error saving report:', error);
    res.status(500).json({ error: 'Failed to save report' });
  }
});

// API Endpoint to Fetch Student Reports (for SuperAdmin Dashboard)
app.get('/api/superadmin/reports', async (req, res) => {
  try {
    const { schoolCode } = req.query; // Get schoolCode from query parameters

    if (!schoolCode) {
      return res.status(400).json({ error: 'schoolCode is required' });
    }

    // Get the school-specific database connection
    const schoolPool = getDatabaseConnection(schoolCode);

    // Fetch reports from the school-specific database
    const [reports] = await schoolPool.query(
      `SELECT * FROM student_reports ORDER BY created_at DESC`
    );

    res.status(200).json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});
app.post("/api/complaints", async (req, res) => {
  const { schoolCode, type, teacher, subject, classes, message } = req.body;

  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  if (!type || !message) {
    return res.status(400).json({ error: "Type and message are required" });
  }

  try {
    // Get school-specific connection
    const pool = getDatabaseConnection(schoolCode);
    const connection = await pool.getConnection();

    // Insert into complaints table (school-specific)
    const query = `
      INSERT INTO complaints (type, teacher, subject, classes, message, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;
    await connection.query(query, [
      type,
      teacher || null,
      subject || null,
      classes ? classes.join(", ") : null,
      message,
    ]);

    connection.release();

    res.status(200).json({ success: true, message: "Complaint/report sent successfully" });
  } catch (err) {
    console.error("Error saving complaint:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
app.get("/api/complaints", async (req, res) => {
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  try {
    const pool = getDatabaseConnection(schoolCode);
    const connection = await pool.getConnection();

    const query = `
      SELECT id, type, teacher, subject, classes, message, created_at
      FROM complaints
      ORDER BY created_at DESC
    `;

    const [rows] = await connection.query(query);
    connection.release();

    res.json(rows);
  } catch (err) {
    console.error("Error fetching complaints:", err);
    res.status(500).json({ error: "Failed to fetch complaints" });
  }
});

// --------------------------------------------
// TICKETS API
// --------------------------------------------
app.post("/api/tickets", async (req, res) => {
  try {
    const {
      schoolCode,
      ticket_type,
      teacher_id,
      teacher_name,
      student_id,
      student_name,
      class_name,
      section,
      title,
      description,
    } = req.body;

    if (!schoolCode || !ticket_type || !title || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const pool = getDatabaseConnection(schoolCode);

    await pool.query(
      `CREATE TABLE IF NOT EXISTS tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_type ENUM('teacher','student') NOT NULL,
        teacher_id VARCHAR(50) NULL,
        teacher_name VARCHAR(255) NULL,
        student_id VARCHAR(50) NULL,
        student_name VARCHAR(255) NULL,
        class_name VARCHAR(50) NULL,
        section VARCHAR(50) NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        status ENUM('open','closed') NOT NULL DEFAULT 'open',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    );

    const [existingCols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tickets'`,
      [schoolCode]
    );
    const existing = new Set(existingCols.map((c) => c.COLUMN_NAME));
    const alterStatements = [];

    if (!existing.has("ticket_type")) {
      alterStatements.push(
        "ADD COLUMN ticket_type ENUM('teacher','student') NOT NULL AFTER id"
      );
    }
    if (!existing.has("teacher_id")) alterStatements.push("ADD COLUMN teacher_id VARCHAR(50) NULL");
    if (!existing.has("teacher_name")) alterStatements.push("ADD COLUMN teacher_name VARCHAR(255) NULL");
    if (!existing.has("student_id")) alterStatements.push("ADD COLUMN student_id VARCHAR(50) NULL");
    if (!existing.has("student_name")) alterStatements.push("ADD COLUMN student_name VARCHAR(255) NULL");
    if (!existing.has("class_name")) alterStatements.push("ADD COLUMN class_name VARCHAR(50) NULL");
    if (!existing.has("section")) alterStatements.push("ADD COLUMN section VARCHAR(50) NULL");
    if (!existing.has("title")) alterStatements.push("ADD COLUMN title VARCHAR(255) NOT NULL");
    if (!existing.has("description")) alterStatements.push("ADD COLUMN description TEXT NOT NULL");
    if (!existing.has("status")) {
      alterStatements.push("ADD COLUMN status ENUM('open','closed') NOT NULL DEFAULT 'open'");
    }
    if (!existing.has("created_at")) {
      alterStatements.push("ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
    }

    if (alterStatements.length > 0) {
      await pool.query(`ALTER TABLE tickets ${alterStatements.join(", ")}`);
    }

    const [result] = await pool.query(
      `INSERT INTO tickets
      (ticket_type, teacher_id, teacher_name, student_id, student_name, class_name, section, title, description, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', NOW())`,
      [
        ticket_type,
        teacher_id || null,
        teacher_name || null,
        student_id || null,
        student_name || null,
        class_name || null,
        section || null,
        title,
        description,
      ]
    );

    return res.status(201).json({ message: "Ticket created", id: result.insertId });
  } catch (error) {
    console.error("Error creating ticket:", error);
    return res.status(500).json({ error: "Failed to create ticket" });
  }
});

app.get("/api/tickets", async (req, res) => {
  try {
    const { schoolCode, type, className, section } = req.query;

    if (!schoolCode) {
      return res.status(400).json({ error: "schoolCode is required" });
    }

    const pool = getDatabaseConnection(schoolCode);
    const filters = [];
    const values = [];

    if (type) {
      filters.push("ticket_type = ?");
      values.push(type);
    }
    if (className) {
      filters.push("class_name = ?");
      values.push(className);
    }
    if (section) {
      filters.push("section = ?");
      values.push(section);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `SELECT * FROM tickets ${whereClause} ORDER BY created_at DESC`,
      values
    );

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// --------------------------------------------
// TASK OF THE DAY API
// --------------------------------------------
app.post("/api/tasks", async (req, res) => {
  try {
    const { schoolCode, task_date, description } = req.body;

    if (!schoolCode || !task_date || !description) {
      return res.status(400).json({ error: "schoolCode, task_date, description are required" });
    }

    const pool = getDatabaseConnection(schoolCode);

    await pool.query(
      `CREATE TABLE IF NOT EXISTS tasks_of_the_day (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_date DATE NOT NULL,
        description TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    );

    const [existingCols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tasks_of_the_day'`,
      [schoolCode]
    );
    const existing = new Set(existingCols.map((c) => c.COLUMN_NAME));
    const alterStatements = [];
    if (!existing.has("task_date")) alterStatements.push("ADD COLUMN task_date DATE NOT NULL");
    if (!existing.has("description")) alterStatements.push("ADD COLUMN description TEXT NOT NULL");
    if (!existing.has("created_at")) {
      alterStatements.push("ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
    }
    if (alterStatements.length > 0) {
      await pool.query(`ALTER TABLE tasks_of_the_day ${alterStatements.join(", ")}`);
    }

    const [result] = await pool.query(
      `INSERT INTO tasks_of_the_day (task_date, description, created_at)
       VALUES (?, ?, NOW())`,
      [task_date, description]
    );

    return res.status(201).json({ message: "Task created", id: result.insertId });
  } catch (error) {
    console.error("Error creating task:", error);
    return res.status(500).json({ error: "Failed to create task" });
  }
});

app.get("/api/tasks", async (req, res) => {
  try {
    const { schoolCode, date } = req.query;
    if (!schoolCode) {
      return res.status(400).json({ error: "schoolCode is required" });
    }

    const pool = getDatabaseConnection(schoolCode);
    const filters = [];
    const values = [];

    if (date) {
      filters.push("task_date = ?");
      values.push(date);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `SELECT * FROM tasks_of_the_day ${whereClause} ORDER BY created_at DESC`,
      values
    );

    return res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return res.status(500).json({ error: "Failed to fetch tasks" });
  }
});


app.post("/chief/fee-report-to-superAdmin", async (req, res) => {
  const { schoolCode, reportType, fromDate, toDate, records } = req.body;

  try {
    if (!schoolCode || !records || !reportType) {
      return res.status(400).json({ message: "Missing required data" });
    }

    // Use schoolCode ONLY for DB connectivity
    const pool = getDatabaseConnection(schoolCode);
    const connection = await pool.getConnection();

    try {
      await connection.query(
        `INSERT INTO chief_fee_reports 
         (report_type, from_date, to_date, data)
         VALUES (?, ?, ?, ?)`,
        [reportType, fromDate, toDate, JSON.stringify(records)]
      );
    } finally {
      connection.release();
    }

    res.json({ message: "Report sent to Chief Dashboard successfully" });

  } catch (err) {
    console.error("Chief fee report error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
app.get("/chief/fee-reports", async (req, res) => {
  const { schoolCode } = req.query;

  try {
    if (!schoolCode) {
      return res.status(400).json({ message: "schoolCode required" });
    }

    const pool = getDatabaseConnection(schoolCode);
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.query(
        `SELECT id, report_type, from_date, to_date, created_at, data
         FROM chief_fee_reports
         ORDER BY created_at DESC`
      );

      res.json(rows);
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error("Fetch chief reports error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/chat-requests/pending", async (req, res) => {
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  let connection;
  try {
    const pool = getDatabaseConnection(schoolCode);
    connection = await pool.getConnection();

    const [rows] = await connection.query(
      "SELECT * FROM chat_requests WHERE status = 'pending' ORDER BY created_at DESC"
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching pending requests:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    if (connection) connection.release();
  }
});

app.put("/api/chat-requests/approve/:id", async (req, res) => {
  const { id } = req.params;
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  let connection;
  try {
    const pool = getDatabaseConnection(schoolCode);
    connection = await pool.getConnection();

    const [result] = await connection.query(
      "UPDATE chat_requests SET status = 'approved' WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    res.json({ message: "Chat request approved successfully" });
  } catch (err) {
    console.error("Approve error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    if (connection) connection.release();
  }
});

app.put("/api/chat-requests/reject/:id", async (req, res) => {
  const { id } = req.params;
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  let connection;
  try {
    const pool = getDatabaseConnection(schoolCode);
    connection = await pool.getConnection();

    const [result] = await connection.query(
      "UPDATE chat_requests SET status = 'rejected' WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    res.json({ message: "Chat request rejected successfully" });
  } catch (err) {
    console.error("Reject error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    if (connection) connection.release();
  }
});



const folderPath = path.join(__dirname, "asset/festival-images");
if (!fs.existsSync(folderPath)) {
  fs.mkdirSync(folderPath, { recursive: true });
}

// List of festival images with online URLs
const festivalImages = {
  "New Year": "new-year.jpg",
  "Makar Sankranti": "makar-sankranti.jpg",
  "Republic Day": "republic-day.jpeg",
  "Vasant Panchami": "vasant-panchami.jpg",
  "Maha Shivratri": "maha-shivratri.jpg",
  "Holi": "holi.jpg",
  "Ram Navami": "ram-navami.jpg",
  "International Women’s Day": "international-womens-day.jpg",
  "Good Friday": "good-friday.jpg",
  "Easter": "easter.jpg",
  "Baisakhi": "baisakhi.jpg",
  "Labour Day": "labour-day.jpg",
  "Buddha Purnima": "buddha-purnima.jpg",
  "World Environment Day": "world-environment-day.jpg",
  "International Yoga Day": "international-yoga-day.jpg",
  "Guru Purnima": "guru-purnima.jpg",
  "Raksha Bandhan": "raksha-bandhan.jpg",
  "Independence Day": "independence-day.jpg",
  "Janmashtami": "janmashtami.jpg",
  "Ganesh Chaturthi": "ganesh-chaturthi.jpg",
  "Teachers Day": "teachers-day.jpg",
  "Hindi Diwas": "hindi-diwas.jpg",
  "Onam": "onam.jpg",
  "Gandhi Jayanti": "gandhi-jayanti.jpg",
  "Dussehra": "dussehra.jpg",
  "Diwali": "diwali.jpg",
  "Karva Chauth": "karva-chauth.jpg",
  "Children's Day": "childrens-day.jpg",
  "Guru Nanak Jayanti": "guru-nanak-jayanti.jpg",
  "Chhath Puja": "chhath-puja.jpg",
  "Christmas": "christmas.jpg",
  "New Year Eve": "new-year-eve.jpg",
  "Ugadi": "ugadi.jpg",
  "Bihu": "bihu.jpg",
  "Vishu": "vishu.jpg",
  "Ganesh Visarjan": "ganesh-visarjan.jpg",
  "Rath Yatra": "rath-yatra.jpg",
  "Eid-ul-Fitr": "eid-ul-fitr.jpg",
  "Eid-ul-Adha": "eid-ul-adha.jpg"
};


async function generateFestivalPoster(festivalName, studentName, instituteName, schoolLogo) {
  let logoImageURL = "";

  if (schoolLogo && Buffer.isBuffer(schoolLogo)) {
    const ext = "png"; 
    logoImageURL = `data:image/${ext};base64,${schoolLogo.toString("base64")}`;
  }

  const imageFile = festivalImages[festivalName];
  if (!imageFile) return null;

  const bgImagePath = path.join(folderPath, imageFile);
  if (!fs.existsSync(bgImagePath)) return null;

  const imageBase64 = fs.readFileSync(bgImagePath).toString("base64");
  const imageExt = path.extname(bgImagePath).replace(".", "");
  const imageURL = `data:image/${imageExt};base64,${imageBase64}`;

  const htmlContent = `
<html>
  <head>
    <style>
      body {
        width:1000px;
        height:1700px;
        margin:0;
        display:flex;
        flex-direction:column;
        justify-content:space-between;
        align-items:center;
        font-family: Arial, sans-serif;
        text-align:center;
        background: url("${imageURL}") center/cover no-repeat;
        border-radius: 20px;
        padding: 40px;
        box-sizing: border-box;
      }

      .header {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 20px;
      }

      .logo {
        width: 90px;
        height: 90px;
        object-fit: contain;
      }

      .school-name {
        font-size: 32px;
        font-weight: bold;
        color: black;
        text-shadow: 1px 1px 3px white;
      }

      .content p {
        font-weight: bold;
        color: black;
        font-size: 26px;
        background: rgba(255,255,255,0.7);
        padding: 10px 20px;
        border-radius: 10px;
        margin: 10px 0;
      }
    </style>
  </head>

  <body>
    <div class="header">
      ${logoImageURL ? `<img src="${logoImageURL}" class="logo" />` : ""}
      <div class="school-name">${instituteName || ""}</div>
    </div>

    <div class="content">
      <p>Dear ${studentName}</p>
      <p>Wishing you a joyful and memorable ${festivalName}!</p>
    </div>
  </body>
</html>
`;

try {

  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/chromium-browser",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  });

  const buffer = await nodeHtmlToImage({
    html: htmlContent,
    encoding: "buffer",
    browser: browser
  });

  await browser.close();

  return buffer;

} catch (err) {
  console.error("Poster generation error:", err);
  return null;
}
}



// --- Send festival email ---
async function sendFestivalEmail(toEmail, festivalName, studentName, instituteName, schoolLogo) {
  console.log(`📨 Preparing email for ${studentName} (${toEmail})`);

const posterBuffer = await generateFestivalPoster(
  festivalName,
  studentName,
  instituteName,
  schoolLogo
);

  if (!posterBuffer) {
    console.log(`❌ Poster not generated for ${festivalName}, skipping email.`);
    return;
  }

  console.log("📎 Attaching poster for:", festivalName);

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: toEmail,
      subject: `${festivalName} Greetings!`,
      html: `
        <div style="text-align:center;">
          <h1>${festivalName} Greetings!</h1>
          <img src="cid:posterImage" style="width:400px;border-radius:10px"/>
        </div>
      `,
      attachments: [{
        filename: `${festivalName}.png`,
        content: posterBuffer,
        cid: "posterImage"
      }]
    });

    console.log(`✅ Email sent successfully to ${toEmail}`);
  } catch (err) {
    console.error(`❌ Failed sending email to ${toEmail}:`, err.message);
  }
}

// --- Send today's festivals ---
async function sendTodaysFestivalsNow() {
  console.log("🚀 Festival mail job started");

  console.log("🕒 Sending today's festivals at", new Date().toLocaleString());

  try {
    const [festivals] = await qualityPool.query(
      "SELECT * FROM school_festivals WHERE festival_date = CURDATE()"
    );

    console.log("🎯 Today's festivals:", festivals.map(f => f.festival_name));

    if (!festivals.length) {
      console.log("⚠️ No festivals today.");
      return;
    }

    const novaPool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: 'NOVA',
      waitForConnections: true,
      connectionLimit: 10,
    });

const [schools] = await novaPool.query(
  "SELECT institute_name, logo FROM Seller"
);
    console.log("🏫 Schools found:", schools.map(s => s.institute_name));

    for (const school of schools) {
      console.log(`🏫 Processing school: ${school.institute_name}`);

      const db = getDatabaseConnection(school.institute_name);
      const [students] = await db.query(
        "SELECT name, email FROM management_login_creation WHERE email IS NOT NULL"
      );

      console.log(`👨‍🎓 Students found: ${students.length}`);

      if (!students.length) continue;

      for (const festival of festivals) {
        console.log(`🎉 Processing festival: ${festival.festival_name}`);

        for (const student of students) {
          try {
            console.log(`📨 Sending to ${student.name} (${student.email})`);
await sendFestivalEmail(
  student.email,
  festival.festival_name,
  student.name,
  school.institute_name,
  school.logo
);
            console.log(`✅ Sent to ${student.email}`);
          } catch (err) {
            console.error(`❌ Error sending to ${student.email}:`, err.message);
          }
        }
      }
    }

    console.log("🎉 All festival emails processed successfully!");

  } catch (err) {
    console.error("🔥 Fatal error in festival job:", err.message);
  }
}


// --- Trigger immediately ---
sendTodaysFestivalsNow();


// --- Optional API to check today's festivals ---
app.get("/api/festivals/today", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM school_festivals WHERE festival_date = CURDATE()");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});












// ============================================================================//
app.put('/update-status/:id', async (req, res) => {
  console.log('Incoming body:', req.body);

  const eventId = req.params.id;
  const { status, schoolCode } = req.body;

  if (!status || !schoolCode) {
    return res.status(400).json({ message: 'Status and schoolCode are required' });
  }

  try {
    // ✅ Await the promise-based connection
    const connection = await mysql.createConnection({
      host: '162.215.210.38',
      user: 'root',
      password: 'NavyAtagsoLnovA@$000',
      database: schoolCode
    });

    // ✅ Use execute (prepared statement) for safety
    const [result] = await connection.execute(
      'UPDATE event_notification SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, eventId]
    );


    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json({ message: 'Event status updated successfully' });
  } catch (err) {
    console.error('Error updating event status:', err);
    res.status(500).json({ message: 'Database error', error: err.message });
  }
});
app.get("/track-records/:schoolCode", async (req, res) => {
  const { schoolCode } = req.params;

  // LOG 1: Initial Request
  console.log(`\n--- 📥 TRACKING REQUEST START ---`);
  console.log(`🕒 Timestamp: ${new Date().toLocaleString()}`);
  console.log(`🏫 Requested School Code: ${schoolCode}`);

  let connection;

  try {
    // LOG 2: Connection Attempt
    console.log(`🔌 Attempting to connect to database: [${schoolCode}]`);
    
    // Using your specific function directly
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();
    
    console.log(`✅ Successfully connected to: ${schoolCode}`);

    // LOG 3: Query Execution
    const query = `
      SELECT user_type, COUNT(*) as total 
      FROM management_login_creation 
      WHERE schoolCode = ? 
      GROUP BY user_type
    `;
    console.log(`📡 Running Query: Counting user types for schoolCode: ${schoolCode}`);

    const [counts] = await connection.query(query, [schoolCode]);

    // LOG 4: Database Results
    console.log(`📊 DB Results Found:`, counts);

    // Initial state for counts
    const stats = {
      teacher: 0,
      student: 0,
      management: 0,
      isStaffComplete: false,
      isStudentComplete: false,
      isManagementComplete: false
    };

    // LOG 5: Data Mapping
    counts.forEach(row => {
      const type = row.user_type.toLowerCase(); // Normalizing for the frontend
      console.log(`🔹 Processing: Type [${row.user_type}] -> Count [${row.total}]`);

      if (type === 'teacher') {
        stats.teacher = row.total;
        stats.isStaffComplete = row.total > 0;
      } else if (type === 'student') {
        stats.student = row.total;
        stats.isStudentComplete = row.total > 0;
      } else if (type === 'management') {
        stats.management = row.total;
        stats.isManagementComplete = row.total > 0;
      }
    });

    console.log(`📤 Final Stats Object to be sent:`, stats);
    console.log(`--- 🏁 TRACKING REQUEST SUCCESS ---`);

    return res.status(200).json({
      success: true,
      stats
    });

  } catch (error) {
    // LOG 6: Error Handling
    console.error(`❌ TRACKING ERROR for School [${schoolCode}]:`, error.message);
    return res.status(500).json({ 
        success: false, 
        message: "Failed to fetch record counts", 
        error: error.message 
    });
  } 

});
app.post('/api/leads/update-score', async (req, res) => {
  const { leadId, schoolCode, test_score, total_marks, test_status } = req.body;

  try {
    // ⬅️ JUST await the connection
    const dbConnection = await getDatabaseConnection(schoolCode);

    const sql = `
      UPDATE leads 
      SET test_score = ?, total_marks = ?, test_status = ?
      WHERE id = ?
    `;

    // ⬅️ mysql2/promise does NOT support callbacks
    await dbConnection.execute(sql, [
      test_score,
      total_marks,
      test_status,
      leadId
    ]);


    res.status(200).json({
      message: "Score saved to school-specific database"
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
async function getLeadById(db, leadId) {
  const [rows] = await db.execute(
    `SELECT 
        id,
        full_name,
        mobile_number,
        email_id,
        reg_no,
        ticket_no,
        lead_admission_for
     FROM leads
     WHERE id = ?
     LIMIT 1`,
    [leadId]
  );

  return rows[0];
}

async function resolveSchoolDatabaseOrThrow(schoolCode) {
  const school = await getSchoolDetails(schoolCode);
  if (!school) {
    throw new Error("School not found");
  }

  const resolvedDbName = String(school.database_name || "").trim();
  if (!resolvedDbName) {
    throw new Error(`Database not configured for school "${schoolCode}"`);
  }

  return {
    school,
    resolvedDbName,
    db: await getDatabaseConnection(resolvedDbName)
  };
}

app.post("/api/schedule-messages", async (req, res) => {
  const { schedule, schoolCode } = req.body;

  if (!schoolCode) return res.status(400).json({ error: "schoolCode is required" });
  if (!Array.isArray(schedule) || schedule.length === 0)
    return res.status(400).json({ error: "schedule is required" });

  let db;
  try {
    ({ db } = await resolveSchoolDatabaseOrThrow(schoolCode));
    await ensureScheduledMessageColumns(db);

    for (const item of schedule) {
      for (const channel of item.channels) {
        // Insert scheduled message
        await db.execute(
          `INSERT INTO scheduled_messages
           (lead_id, phone, email, channel, message, send_date, send_time, sent)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
          [
            item.leadId,
            item.phone,
            item.email,
            channel,
            item.message,
            item.date,
            item.time
          ]
        );
      }
    }

    res.json({ success: true, message: "Messages scheduled successfully!" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } 
});
const schoolCode = "CLEEZOCLASS"; // your school code for getSchoolDetails

function sanitizeDbName(name) {
  return String(name || "")
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

const DEFAULT_POSTER_MESSAGES = new Set([
  "Daily poster from Campaigning Digital - Gallery",
  "Daily poster from Campaigning Staff - Gallery",
  "Daily advertisement",
]);

function shouldSendPosterWriteup(message) {
  const text = String(message || "").trim();
  if (!text) return false;
  return !DEFAULT_POSTER_MESSAGES.has(text);
}

async function sendScheduledWhatsApp(schoolCode, phone, message, mediaPath = "", ctx = {}) {
  // quiet WhatsApp scheduler logs
  if (!phone) {
    console.warn(`[SCHEDULER][WA] Missing phone for schoolCode=${schoolCode}`, ctx);
    return false;
  }

  const cleanNumber = String(phone).replace(/\D/g, '');
  if (!cleanNumber) return false;
  const formattedNumber = cleanNumber.startsWith('91') ? cleanNumber : `91${cleanNumber}`;
  const chatId = `${formattedNumber}@c.us`;
  console.log("[SCHEDULER][WA] Attempt", {
    schoolCode,
    rowId: ctx?.rowId || null,
    leadId: ctx?.leadId || null,
    channel: ctx?.channel || "whatsapp",
    sendDate: ctx?.sendDate || null,
    sendTime: ctx?.sendTime || null,
    hasMedia: Boolean(mediaPath),
    numberPreview: formattedNumber.slice(-4)
  });

  const primaryKey = sanitizeDbName(schoolCode);
  const keyVariants = Array.from(
    new Set(
      [
        primaryKey,
        sanitizeDbName(String(schoolCode || "").replace(/_/g, " ")),
        sanitizeDbName(String(schoolCode || "").replace(/\s+/g, "")),
        sanitizeDbName(String(schoolCode || "").replace(/_/g, "")),
      ].filter(Boolean)
    )
  );

  let clientKey = "";
  let clientState = null;
  for (const key of keyVariants) {
    if (global.whatsappClients?.[key]?.client) {
      clientKey = key;
      clientState = global.whatsappClients[key];
      break;
    }
  }

  if (!clientState?.client && global.whatsappClients) {
    const normalizedRequested = primaryKey.replace(/_/g, "");
    const matchedKey = Object.keys(global.whatsappClients).find(
      (key) => key.replace(/_/g, "") === normalizedRequested
    );
    if (matchedKey) {
      clientKey = matchedKey;
      clientState = global.whatsappClients[matchedKey];
    }
  }

  if (!clientState || !clientState.client) {
    console.warn(
      `[SCHEDULER][WA] No local WhatsApp client for schoolCode=${schoolCode}, tried=${keyVariants.join(",")}. Using bridge fallback.`
    );
    try {
      if (mediaPath) {
        await sendPosterViaWhatsappBridge(schoolCode, formattedNumber, resolvePosterPath(mediaPath));
        if (shouldSendPosterWriteup(message)) {
          await sendTextViaWhatsappBridge(schoolCode, formattedNumber, String(message || "").trim());
        }
      } else {
        await sendTextViaWhatsappBridge(schoolCode, formattedNumber, message || "");
      }
      console.log("[SCHEDULER][WA] Bridge fallback success", {
        schoolCode,
        rowId: ctx?.rowId || null,
        leadId: ctx?.leadId || null,
        hasMedia: Boolean(mediaPath)
      });
      return true;
    } catch (bridgeErr) {
      console.error("[SCHEDULER][WA] Bridge fallback failed:", bridgeErr?.message || bridgeErr, ctx);
      return false;
    }
  }
  if (!clientState.ready) {
    console.warn(
      `[SCHEDULER][WA] Local client not ready for key=${clientKey || primaryKey}. Using bridge fallback.`
    );
    try {
      if (mediaPath) {
        await sendPosterViaWhatsappBridge(schoolCode, formattedNumber, resolvePosterPath(mediaPath));
        if (shouldSendPosterWriteup(message)) {
          await sendTextViaWhatsappBridge(schoolCode, formattedNumber, String(message || "").trim());
        }
      } else {
        await sendTextViaWhatsappBridge(schoolCode, formattedNumber, message || "");
      }
      console.log("[SCHEDULER][WA] Bridge fallback success (client not ready)", {
        schoolCode,
        rowId: ctx?.rowId || null,
        leadId: ctx?.leadId || null,
        hasMedia: Boolean(mediaPath)
      });
      return true;
    } catch (bridgeErr) {
      console.error("[SCHEDULER][WA] Bridge fallback failed:", bridgeErr?.message || bridgeErr, ctx);
      return false;
    }
  }

  try {
    if (mediaPath) {
      const sentPoster = await sendPosterWithRetry(
        schoolCode,
        formattedNumber,
        mediaPath
      );
      if (sentPoster) {
        if (shouldSendPosterWriteup(message)) {
          try {
            await clientState.client.sendMessage(chatId, String(message || "").trim());
          } catch (textErr) {
            console.warn("[SCHEDULER][WA] Local writeup send failed, trying bridge text", {
              schoolCode,
              rowId: ctx?.rowId || null,
              leadId: ctx?.leadId || null,
              error: textErr?.message || textErr
            });
            await sendTextViaWhatsappBridge(schoolCode, formattedNumber, String(message || "").trim());
          }
        }
        return true;
      }
    }
    await clientState.client.sendMessage(chatId, message || "");
    console.log("[SCHEDULER][WA] Local client send success", {
      schoolCode,
      key: clientKey || primaryKey,
      rowId: ctx?.rowId || null,
      leadId: ctx?.leadId || null,
      hasMedia: Boolean(mediaPath)
    });
    return true;
  } catch (err) {
    if (String(err.message || "").includes('invalid session') || String(err.message || "").includes('not logged in')) {
      const clearKey = clientKey || primaryKey;
      delete global.whatsappClients[clearKey];
    }
    console.error(`[SCHEDULER][WA] Send failed for key=${clientKey || primaryKey}:`, err.message, ctx);
    return false;
  }
}

async function sendScheduledEmail(school, msg, lead) {
  if (!school?.email || !school?.email_app_key || !msg?.email) return false;
  try {
    if (msg?.media_path) {
      const resolvedPath = resolvePosterPath(msg.media_path);
      const sentPhoto = await sendSchoolPhotoEmail(msg.email, school, resolvedPath);
      if (sentPhoto) return true;
    }
    await sendWelcomeEmail(msg.email, lead, school);
    return true;
  } catch (err) {
    return false;
  }
}

async function ensureScheduledMessageColumns(db) {
  try {
    await db.execute("ALTER TABLE scheduled_messages ADD COLUMN email_sent TINYINT(1) NOT NULL DEFAULT 0");
  } catch (err) {
    if (!String(err.message || "").includes("Duplicate column")) {
      console.warn("scheduled_messages email_sent check failed:", err.message);
    }
  }
  try {
    await db.execute("ALTER TABLE scheduled_messages ADD COLUMN whatsapp_sent TINYINT(1) NOT NULL DEFAULT 0");
  } catch (err) {
    if (!String(err.message || "").includes("Duplicate column")) {
      console.warn("scheduled_messages whatsapp_sent check failed:", err.message);
    }
  }
  try {
    await db.execute("ALTER TABLE scheduled_messages ADD COLUMN media_path VARCHAR(500) NULL");
  } catch (err) {
    if (!String(err.message || "").includes("Duplicate column")) {
      console.warn("scheduled_messages media_path check failed:", err.message);
    }
  }
  try {
    await db.execute("ALTER TABLE scheduled_messages ADD COLUMN schedule_from_time VARCHAR(32) NULL");
  } catch (err) {
    if (!String(err.message || "").includes("Duplicate column")) {
      console.warn("scheduled_messages schedule_from_time check failed:", err.message);
    }
  }
  try {
    await db.execute("ALTER TABLE scheduled_messages ADD COLUMN schedule_to_time VARCHAR(32) NULL");
  } catch (err) {
    if (!String(err.message || "").includes("Duplicate column")) {
      console.warn("scheduled_messages schedule_to_time check failed:", err.message);
    }
  }
  try {
    await db.execute("ALTER TABLE scheduled_messages ADD COLUMN schedule_from_date DATE NULL");
  } catch (err) {
    if (!String(err.message || "").includes("Duplicate column")) {
      console.warn("scheduled_messages schedule_from_date check failed:", err.message);
    }
  }
  try {
    await db.execute("ALTER TABLE scheduled_messages ADD COLUMN schedule_to_date DATE NULL");
  } catch (err) {
    if (!String(err.message || "").includes("Duplicate column")) {
      console.warn("scheduled_messages schedule_to_date check failed:", err.message);
    }
  }
}

async function ensureScheduledMessageRulesTable(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS scheduled_message_rules (
      id INT NOT NULL AUTO_INCREMENT,
      dynamic_mode VARCHAR(50) NOT NULL DEFAULT 'all_leads',
      media_path VARCHAR(500) NOT NULL,
      message TEXT NULL,
      channel_csv VARCHAR(255) NOT NULL,
      send_time VARCHAR(32) NOT NULL,
      schedule_from_date DATE NOT NULL,
      schedule_to_date DATE NOT NULL,
      schedule_from_time VARCHAR(32) NULL,
      schedule_to_time VARCHAR(32) NULL,
      lead_window_from DATE NULL,
      lead_window_to DATE NULL,
      gallery_target VARCHAR(32) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_smr_active_window (is_active, schedule_from_date, schedule_to_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function expandDynamicScheduledMessageRules(db, nowDate) {
  await ensureScheduledMessageRulesTable(db);
  await ensureScheduledMessageColumns(db);

  const [rules] = await db.execute(
    `SELECT id, dynamic_mode, media_path, message, channel_csv, send_time, schedule_from_date, schedule_to_date,
            schedule_from_time, schedule_to_time, lead_window_from, lead_window_to, gallery_target
     FROM scheduled_message_rules
     WHERE is_active = 1
       AND schedule_from_date <= ?
       AND schedule_to_date >= ?`,
    [nowDate, nowDate]
  );

  if (!Array.isArray(rules) || rules.length === 0) {
    return { rules: 0, inserted: 0 };
  }

  let insertedRows = 0;
  const isGenericCampaignName = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    return (
      normalized === "campaign" ||
      normalized === "campaigning" ||
      normalized === "digital campaign" ||
      normalized === "digital"
    );
  };

  for (const rule of rules) {
    const leadWindowFrom = String(rule.lead_window_from || rule.schedule_from_date || nowDate).trim();
    const leadWindowTo = String(rule.lead_window_to || rule.schedule_to_date || nowDate).trim();
    const channels = String(rule.channel_csv || "whatsapp,mail")
      .split(",")
      .map((value) => String(value || "").trim().toLowerCase())
      .filter((value) => value);
    const effectiveChannels = channels.length > 0 ? channels : ["whatsapp", "mail"];

    const [leadRows] = await db.execute(
      `SELECT id, mobile_number, email_id, lead_name, date
       FROM leads
       WHERE date BETWEEN ? AND ?`,
      [leadWindowFrom, leadWindowTo]
    );

    let targetLeads = Array.isArray(leadRows) ? leadRows : [];
    if (String(rule.dynamic_mode || "").toLowerCase() === "all_staff") {
      targetLeads = targetLeads.filter((lead) => !isGenericCampaignName(lead?.lead_name));
    }

    for (const lead of targetLeads) {
      for (const channel of effectiveChannels) {
        const [existingRows] = await db.execute(
          `SELECT id
           FROM scheduled_messages
           WHERE lead_id = ?
             AND channel = ?
             AND send_date = ?
             AND media_path = ?
           LIMIT 1`,
          [lead.id, channel, nowDate, rule.media_path]
        );
        if (Array.isArray(existingRows) && existingRows.length > 0) continue;

        const [insertResult] = await db.execute(
          `INSERT INTO scheduled_messages
           (lead_id, phone, email, channel, message, send_date, send_time, sent, media_path, schedule_from_date, schedule_to_date, schedule_from_time, schedule_to_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
          [
            lead.id,
            lead.mobile_number || null,
            lead.email_id || null,
            channel,
            rule.message || "Daily advertisement",
            nowDate,
            rule.send_time,
            rule.media_path,
            rule.schedule_from_date || nowDate,
            rule.schedule_to_date || nowDate,
            rule.schedule_from_time || rule.send_time,
            rule.schedule_to_time || rule.send_time
          ]
        );
        insertedRows += Number(insertResult?.affectedRows || 0);
      }
    }
  }

  return { rules: rules.length, inserted: insertedRows };
}

// Send scheduled messages every minute
cron.schedule("* * * * *", async () => {
  try {
    const novaPool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: "NOVA",
      waitForConnections: true,
      connectionLimit: 5
    });

    const [schools] = await novaPool.query(
      "SELECT institute_name, database_name FROM Seller"
    );

    console.log(`[SCHEDULER] Tick started for ${schools.length} schools`);
    for (const schoolRow of schools) {
      const instituteName = String(schoolRow.institute_name || "").trim();
      const dbNameFromSeller = String(schoolRow.database_name || "").trim();
      const schoolLookupKey = dbNameFromSeller || instituteName;
      if (!schoolLookupKey) continue;

      try {
        let school = null;
        try {
          school = await getSchoolDetails(schoolLookupKey);
        } catch (err) {
          school = null;
        }

        const resolvedDbName = String(school?.database_name || dbNameFromSeller || "").trim();
        if (!resolvedDbName) {
          console.warn(`[SCHEDULER][${instituteName || schoolLookupKey}] Skipping school because database_name could not be resolved`);
          continue;
        }

        const db = await getDatabaseConnection(resolvedDbName);
        await ensureScheduledMessageColumns(db);

      const nowInKolkata = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
      );
      const yyyy = nowInKolkata.getFullYear();
      const mm = String(nowInKolkata.getMonth() + 1).padStart(2, "0");
      const dd = String(nowInKolkata.getDate()).padStart(2, "0");
      const hh = String(nowInKolkata.getHours()).padStart(2, "0");
      const mi = String(nowInKolkata.getMinutes()).padStart(2, "0");
      const ss = String(nowInKolkata.getSeconds()).padStart(2, "0");
      const nowDate = `${yyyy}-${mm}-${dd}`;
      const nowTime = `${hh}:${mi}:${ss}`;

        const expansion = await expandDynamicScheduledMessageRules(db, nowDate);
        if (Number(expansion?.inserted || 0) > 0) {
          console.log(
            `[SCHEDULER][${resolvedDbName}] Dynamic expansion inserted ${expansion.inserted} rows from ${expansion.rules} rules for ${nowDate}`
          );
        }

        const [closePastResult] = await db.execute(
          "UPDATE scheduled_messages SET sent = 1 WHERE sent = 0 AND send_date < ?",
          [nowDate]
        );
        const closedPastRows = Number(closePastResult?.affectedRows || 0);
        if (closedPastRows > 0) {
          console.log(`[SCHEDULER][${resolvedDbName}] Closed past pending rows: ${closedPastRows}`);
        }

        const [messages] = await db.execute(
          `
          SELECT id, email, phone, channel, message, send_date, send_time, lead_id,
                 email_sent, whatsapp_sent, media_path
          FROM scheduled_messages
          WHERE sent = 0
            AND send_date = ?
            AND send_time <= ?
          ORDER BY send_date ASC, send_time ASC
          LIMIT 500
          `,
          [nowDate, nowTime]
        );

        console.log(
          `[SCHEDULER][${resolvedDbName}] Due rows at ${nowDate} ${nowTime}: ${messages.length}`
        );
        if (messages.length > 0) {
          console.log(
            `[SCHEDULER][${resolvedDbName}] Due sample rows:`,
            messages.slice(0, 10).map((m) => ({
              id: m.id,
              leadId: m.lead_id,
              channel: m.channel,
              sendDate: m.send_date,
              sendTime: m.send_time,
              sent: m.sent,
              whatsapp_sent: m.whatsapp_sent,
              email_sent: m.email_sent
            }))
          );
        }

        let processedRows = 0;
        let markedSentRows = 0;
        let successEmailRows = 0;
        let successWhatsAppRows = 0;
        let failedEmailRows = 0;
        let failedWhatsAppRows = 0;

        for (const msg of messages) {

        // quiet scheduler logs

        const channel = String(msg.channel || "").toLowerCase();

        const shouldEmail =
          channel === "mail" ||
          channel === "gmail" ||
          channel === "email" ||
          channel === "all";

        const shouldWhatsApp =
          channel === "whatsapp" ||
          channel === "wa" ||
          channel === "all";

        let sentEmail = Boolean(msg.email_sent);
        let sentWhatsApp = Boolean(msg.whatsapp_sent);

        if (shouldEmail && !sentEmail) {
          try {
            const lead = await getLeadById(db, msg.lead_id);
            sentEmail = await sendScheduledEmail(school, msg, lead);
            if (sentEmail) {
              successEmailRows += 1;
              await db.execute(
                "UPDATE scheduled_messages SET email_sent = 1 WHERE id = ?",
                [msg.id]
              );
              // quiet scheduler logs
            }
          } catch (err) {
            failedEmailRows += 1;
            console.error(
              `Scheduled email failed for ${resolvedDbName}:`,
              err.message
            );
          }
        }

        if (shouldWhatsApp && !sentWhatsApp) {
          try {
            sentWhatsApp = await sendScheduledWhatsApp(
              resolvedDbName,
              msg.phone,
              msg.message,
              msg.media_path,
              {
                rowId: msg.id,
                leadId: msg.lead_id,
                channel: msg.channel,
                sendDate: msg.send_date,
                sendTime: msg.send_time
              }
            );
            if (sentWhatsApp) {
              successWhatsAppRows += 1;
              await db.execute(
                "UPDATE scheduled_messages SET whatsapp_sent = 1 WHERE id = ?",
                [msg.id]
              );
              console.log(
                `[SCHEDULER][${resolvedDbName}] WhatsApp marked sent for row=${msg.id}, lead=${msg.lead_id}`
              );
            } else {
              failedWhatsAppRows += 1;
              console.warn(
                `[SCHEDULER][${resolvedDbName}] WhatsApp not sent for row=${msg.id}, lead=${msg.lead_id}`
              );
            }
          } catch (err) {
            failedWhatsAppRows += 1;
            console.error(`Scheduled WhatsApp failed for ${resolvedDbName}:`, err.message);
          }
        }

        const allRequestedSent =
          (!shouldEmail || sentEmail) && (!shouldWhatsApp || sentWhatsApp);

        if (allRequestedSent) {
          try {
            await db.execute(
              "UPDATE scheduled_messages SET sent = 1 WHERE id = ?",
              [msg.id]
            );
            markedSentRows += 1;

            // quiet scheduler logs

          } catch (err) {
            console.error("Failed updating scheduled message:", err.message);
          }

        } else {

          console.log(
            `[SCHEDULER][${resolvedDbName}] Row pending after tick row=${msg.id}, emailSent=${sentEmail}, whatsappSent=${sentWhatsApp}`
          );

        }
        processedRows += 1;
        }

        if (messages.length > 0) {
          console.log(`[SCHEDULER][${resolvedDbName}] Tick summary:`, {
            processedRows,
            markedSentRows,
            successEmailRows,
            failedEmailRows,
            successWhatsAppRows,
            failedWhatsAppRows
          });
        }
      } catch (schoolErr) {
        console.error(
          `[SCHEDULER][${dbNameFromSeller || instituteName || schoolLookupKey}] School-level tick failed:`,
          schoolErr?.message || schoolErr
        );
        continue;
      }
    }

  } catch (err) {

    console.error("Scheduled messages cron error:", err.message);

  }
});

// async function sendWelcomeEmail(toEmail, lead, school) {
//   if (!toEmail || !school.email || !school.email_app_key) {
//     console.log(`Missing email credentials for ${school.institute_name}`);
//     return;
//   }

//   // Use school's own email for sending
//   const transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//       user: school.email,         // school email from DB
//       pass: school.email_app_key  // school's app password from DB
//     }
//   });

//   // Check if the logo is a Base64 string
//   const isBase64 = school.logo && school.logo.startsWith('data:image');
//   let attachments = [];
//   let logoSrc = school.logo || ""; // default for external URLs or empty

//   if (isBase64) {
//     // Extract the base64 content
//     const parts = school.logo.split(';base64,');
//     const content = parts[1];
    
//     // Create an attachment and CID reference
//     logoSrc = 'cid:schoolLogo';
//     attachments.push({
//       filename: 'logo.png',
//       content: content,
//       encoding: 'base64',
//       cid: 'schoolLogo' // must match src in HTML
//     });
//   }

//   // Generate HTML content
//   const htmlContent = generateWelcomeCardHTML(lead, { ...school, logo: logoSrc });

//   // Send the email
//   await transporter.sendMail({
//     from: `"${school.institute_name} Admin" <${school.email}>`, // FROM school email
//     to: toEmail,
//     subject: `Welcome to ${school.institute_name}!`,
//     html: htmlContent,
//     attachments
//   });

//   console.log(`✅ Email sent from ${school.email} to ${toEmail}`);
// }
async function sendWelcomeEmail(toEmail, lead, school) {
  const safeLead = lead && typeof lead === "object" ? { ...lead } : {};
  if (!safeLead.full_name) {
    safeLead.full_name =
      safeLead.student_name || safeLead.lead_name || safeLead.name || "Parent";
  }
  if (!Array.isArray(safeLead.features)) {
    safeLead.features = [];
  }

  const safeSchool = school && typeof school === "object" ? { ...school } : {};
  if (!Array.isArray(safeSchool.features)) {
    safeSchool.features = [];
  }

  if (!toEmail || !safeSchool.email || !safeSchool.email_app_key) return;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: safeSchool.email,
      pass: safeSchool.email_app_key
    }
  });

  // 🔥 RANDOM TEMPLATE SELECTION
  const templateKeys = Object.keys(templates);
  const randomKey = templateKeys[Math.floor(Math.random() * templateKeys.length)];

  // quiet email template logs

  const generateHTML = templates[randomKey];

  if (!generateHTML) return;

  // Logo handling
  const isBase64 = safeSchool.logo && safeSchool.logo.startsWith('data:image');
  let attachments = [];
  let logoSrc = safeSchool.logo || "";

  if (isBase64) {
    const parts = safeSchool.logo.split(';base64,');
    const content = parts[1];

    logoSrc = 'cid:schoolLogo';

    attachments.push({
      filename: 'logo.png',
      content: content,
      encoding: 'base64',
      cid: 'schoolLogo'
    });
  }

  let htmlContent = "";
  htmlContent = generateHTML(safeLead, { ...safeSchool, logo: logoSrc });

  await transporter.sendMail({
    from: `"${safeSchool.institute_name || "School"} Admin" <${safeSchool.email}>`,
    to: toEmail,
    subject: `Welcome to ${safeSchool.institute_name || "School"}!`,
    html: htmlContent,
    attachments
  });

}
async function sendPosterEmail(toEmail, lead, school, posterPath) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: school.email,
      pass: school.email_app_key
    }
  });

  await transporter.sendMail({
    from: `"${school.institute_name}" <${school.email}>`,
    to: toEmail,
    subject: `Admissions Open - ${school.institute_name}`,
    html: `
      <h3>Hello ${lead.full_name},</h3>
      <p>Here is today’s special update from us 🎉</p>
    `,
    attachments: [
      {
        filename: "marketing_poster.png",
        path: posterPath
      }
    ]
  });
}

// cron.schedule("* * * * *", async () => {
//   const startTime = new Date();
//   console.log("=================================================");
//   console.log("📅 CRON STARTED AT:", startTime.toISOString());
//   console.log("🚀 Running daily marketing poster job");
//   console.log("=================================================");

//   try {
//     const schoolCodes = await getAllSchoolCodes();
//     console.log("🏫 Total Schools Found:", schoolCodes.length);

//     for (const schoolCode of schoolCodes) {

//       console.log("-------------------------------------------------");
//       console.log("🏫 Processing School Code:", schoolCode);

//       const db = await getDatabaseConnection(schoolCode);
//       console.log("✅ Database connected for:", schoolCode);

//       const [leads] = await db.execute(`
//         SELECT * FROM leads 
//         WHERE DATEDIFF(CURDATE(), date) <= 30
//       `);

//       console.log(`📊 Leads found (last 30 days): ${leads.length}`);

//       if (leads.length === 0) {
//         console.log("⚠ No eligible leads for this school");
//         continue;
//       }

//       const school = await getSchoolDetails(schoolCode);
//       console.log("🏫 School Name:", school?.institute_name);

//       for (const lead of leads) {

//         if (!lead.email_id) {
//           console.log(`⛔ Skipping Lead ID ${lead.id} (No email)`);
//           continue;
//         }

//         console.log(`📩 Processing Lead ID: ${lead.id}`);
//         console.log(`👤 Lead Name: ${lead.full_name}`);
//         console.log(`📧 Email: ${lead.email_id}`);

//         try {

//           console.log("🖼 Generating poster...");
//           const posterPath = await generateMarketingPoster(lead, school);
//           console.log("✅ Poster generated at:", posterPath);

//           console.log("📤 Sending email...");
//           await sendPosterEmail(
//             lead.email_id,
//             lead,
//             school,
//             posterPath
//           );

//           console.log("✅ Email sent successfully to:", lead.email_id);

//         } catch (leadError) {
//           console.error(`❌ Error processing Lead ID ${lead.id}:`, leadError);
//         }
//       }

//       console.log("✔ Completed school:", schoolCode);
//     }

//   } catch (err) {
//     console.error("🔥 CRON GLOBAL ERROR:", err);
//   }

//   const endTime = new Date();
//   console.log("=================================================");
//   console.log("🏁 CRON FINISHED AT:", endTime.toISOString());
//   console.log("⏱ Total Duration:",
//     (endTime - startTime) / 1000,
//     "seconds"
//   );
//   console.log("=================================================\n");

// });



app.post("/api/book-demo", async (req, res) => {
  try {
    const {
      schoolName,
      name,
      email,
      mobile,
      city,
      date,
      timeslot,
      message,
    } = req.body;

    if (!name || !email || !date || !timeslot) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing",
      });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS, // Gmail App Password
      },
    });

    const mailOptions = {
      from: `"Cleezo Demo Booking" <${process.env.MAIL_USER}>`,
      to: "sales@cleezoclass.com",
      subject: "📅 New Demo Booking Request",
      html: `
        <h2>New Demo Booking</h2>
        <p><b>School:</b> ${schoolName || "-"}</p>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Mobile:</b> ${mobile || "-"}</p>
        <p><b>City:</b> ${city || "-"}</p>
        <p><b>Date:</b> ${date}</p>
        <p><b>Time Slot:</b> ${timeslot}</p>
        <p><b>Message:</b> ${message || "-"}</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: "Demo booked successfully",
    });
  } catch (error) {
    console.error("Mail error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send email",
    });
  }
});
// POST /api/save-topic
// POST /api/save-topic
app.post('/api/save-topic', async (req, res) => {
  const { schoolCode, teacherName, subject, chapter, topic } = req.body;
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  if (!schoolCode || !teacherName || !subject || !chapter || !topic) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  let connection;
  try {
    // Create a connection to the specific school database dynamically
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();

    const query = `
      INSERT INTO topic_of_the_day (date, teacher_name, subject, chapter, topic_name)
      VALUES (?, ?, ?, ?, ?)
    `;

    await connection.execute(query, [today, teacherName, subject, chapter, topic]);
    res.json({ success: true });
  } catch (err) {
    console.error('DB Save Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }

});


app.get('/calculated-salary/:teacherId', async (req, res) => {
  const { teacherId } = req.params;
  const { schoolCode, month } = req.query;

  console.log("📌 Received /calculated-salary request");
  console.log("Teacher ID:", teacherId);
  console.log("School Code:", schoolCode);
  console.log("Month:", month);

  if (!teacherId || !month || !schoolCode) {
    console.warn("⚠️ Missing required fields");
    return res.status(400).json({ message: "Missing required fields" });
  }

  let db;
  try {
    db = await getDatabaseConnection(schoolCode);
    console.log("✅ Database connection established for school:", schoolCode);
  } catch (err) {
    console.error("❌ DB connection error:", err);
    return res.status(500).json({ error: "Database connection failed" });
  }

  try {
    // Query for requested month
    const query = `
      SELECT 
        base_salary,
        deductions,
        bonuses,
        final_salary,
        salary_month,
        status,
        payment_date
      FROM bizpulse_teacher_calculated_salary
      WHERE teacher_id = ?
        AND LOWER(salary_month) = LOWER(?)
      ORDER BY payment_date DESC
      LIMIT 1
    `;
    console.log("📌 Executing SQL query:", query);
    console.log("📌 Query parameters:", [teacherId, month]);

    const [results] = await db.query(query, [teacherId, month]);

    if (!results || results.length === 0) {
      console.warn("⚠️ No salary found for requested month. Returning zeros.");

      // Return a default object with zero values
      return res.json({
        base_salary: 0,
        deductions: 0,
        bonuses: 0,
        final_salary: 0,
        salary_month: month,
        status: "pending",
        payment_date: null
      });
    }

    // Salary found for requested month
    console.log("💰 Returning salary for requested month:", results[0]);
    return res.json(results[0]);

  } catch (err) {
    console.error("❌ Salary fetch error:", err);
    res.status(500).json({ error: "Something went wrong!" });
  }
});


app.get('/totalexpensesData', async (req, res) => {
  console.log('Received request for total expenses value');
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: 'Missing schoolCode in query' });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);

    const query = `SELECT * FROM Accountant`;
    console.log('Executing SQL query:', query);

    const [rows] = await db.query(query);

    // Convert numeric fields
    rows.forEach(row => {
      row.paid_amount = parseFloat(row.paid_amount);
      row.balance_amount = parseFloat(row.balance_amount);
      row.price = parseFloat(row.price);
    });


    res.json(rows);
    console.log('Sent total expenses data to frontend:', rows);
  } catch (err) {
    console.error('Error executing SQL query:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Students by name API
app.get("/api/studentsByName", async (req, res) => {
  const { schoolCode, name } = req.query;

  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  try {
    // If schoolCode is provided, use school-specific database
    const connection = schoolCode
      ? await getDatabaseConnection(schoolCode)
      : await mysql.createConnection({
          host: '162.215.210.38',
          user: 'root',
          password: 'NavyAtagsoLnovA@$000',
          database: 'NOVA' // default database if schoolCode not provided
        });

    const query = `
      SELECT id, name, class_name, section, father_name, gender, phone_no
      FROM management_login_creation
      WHERE name LIKE ? AND is_deleted = 0
    `;
    const params = [`%${name}%`];

    const [rows] = await connection.execute(query, params);

    res.json({ students: rows });
  } catch (err) {
    console.error("Error fetching students by name:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Helper function to format currency
const formatCurrency = (value) => {
  return (value === null || value === undefined) ? '0.00' : parseFloat(value).toFixed(2);
};

// =======================================================
// API 1: Fetch Aggregate Fee Summary (Dashboard Boxes)
// =======================================================
// =======================================================
// API 1: Fetch Aggregate Fee Summary (Dashboard Boxes)
// =======================================================
app.get('/api/fee-summary', async (req, res) => {
  const { schoolCode, month } = req.query;

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("[FeeSummary] Incoming Request");
  console.log("Params:", { schoolCode, month });
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (!schoolCode || !month) {
    console.warn("[FeeSummary] ❌ Missing schoolCode or month");
    return res.status(400).json({
      message: "schoolCode and month are required"
    });
  }

  try {
    // 1️⃣ Connect to DB
    const db = await getDatabaseConnection(schoolCode);
    console.log("[FeeSummary] ✅ Database connection established");

    // 2️⃣ Total rows check
    const [[rowCount]] = await db.execute(
      `SELECT COUNT(*) AS totalRows FROM FeesDetails`
    );
    console.log("[FeeSummary] Total rows in FeesDetails:", rowCount.totalRows);

    // 3️⃣ Sample rows (sanity check)
    const [sampleRows] = await db.execute(`
      SELECT 
        id,
        created_at,
        Paid_Amount,
        Final_Amount,
        Admission_paid,
        books_paid,
        uniform_paid,
        bus_paid
      FROM FeesDetails
      ORDER BY created_at DESC
      LIMIT 5
    `);
    console.log("[FeeSummary] Sample rows:", sampleRows);

    // 4️⃣ Rows matching month
    const [matchedRows] = await db.execute(
      `
      SELECT id, created_at, Paid_Amount, Final_Amount
      FROM FeesDetails
      WHERE DATE_FORMAT(created_at, '%Y-%m') = ?
      `,
      [month]
    );

    console.log(
      `[FeeSummary] Rows matching month ${month}:`,
      matchedRows.length
    );

    if (matchedRows.length === 0) {
      console.warn("[FeeSummary] ⚠️ No rows found for selected month");
    }

    // 5️⃣ Aggregation query
   const sql = `
  SELECT
    SUM(
      IFNULL(Paid_Amount, 0) +
      IFNULL(Installment1_Paid, 0) +
      IFNULL(Installment2_Paid, 0) +
      IFNULL(Installment3_Paid, 0) +
      IFNULL(Installment4_Paid, 0) +
      IFNULL(Installment5_Paid, 0) +
      IFNULL(Admission_paid, 0) +
      IFNULL(books_paid, 0) +
      IFNULL(uniform_paid, 0) +
      IFNULL(bus_paid, 0) +
      IFNULL(exam_paid, 0) +
      IFNULL(others_paid, 0)
    ) AS totalPaid,

    SUM(IFNULL(Final_Amount, 0)) AS totalExpected,

    SUM(IFNULL(Admission_paid, 0)) AS totalAdmissionPaid,

    SUM(
      IFNULL(books_paid, 0) +
      IFNULL(uniform_paid, 0) +
      IFNULL(exam_paid, 0) +
      IFNULL(others_paid, 0)
    ) AS totalBooksUniformPaid,

    SUM(IFNULL(bus_paid, 0)) AS totalBusPaid,

    SUM(
      IFNULL(Installment1_Paid, 0) +
      IFNULL(Installment2_Paid, 0) +
      IFNULL(Installment3_Paid, 0) +
      IFNULL(Installment4_Paid, 0) +
      IFNULL(Installment5_Paid, 0)
    ) AS totalPaidTuitionFee

  FROM FeesDetails
  WHERE DATE_FORMAT(created_at, '%Y-%m') = ?;
`;

    console.log("[FeeSummary] ▶ Running aggregation query");
    const [results] = await db.execute(sql, [month]);

    console.log("[FeeSummary] Aggregation result:", results);

    const totals = results[0] || {};

    // 6️⃣ Safe calculations
    const totalPaid = Number(totals.totalPaid) || 0;
    const totalExpected = Number(totals.totalExpected) || 0;
    const totalDue = Math.max(totalExpected - totalPaid, 0);

    console.log("[FeeSummary] Calculations:", {
      totalPaid,
      totalExpected,
      totalDue
    });

    // 7️⃣ Final response
    const response = {
      totalPaid: formatCurrency(totalPaid),
      totalDue: formatCurrency(totalDue),
      totalAdmissionPaid: formatCurrency(totals.totalAdmissionPaid || 0),
      totalBooksUniformPaid: formatCurrency(totals.totalBooksUniformPaid || 0),
      totalBusPaid: formatCurrency(totals.totalBusPaid || 0),
      totalPaidTuitionFee: formatCurrency(totals.totalPaidTuitionFee || 0),
    };

    console.log("[FeeSummary] ✅ Response sent:", response);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    res.json(response);

  } catch (err) {
    console.error("[FeeSummary] 🔥 Error occurred:", {
      message: err.message,
      stack: err.stack
    });

    res.status(500).json({
      message: "Database connection or query error",
      error: err.message
    });
  }
});


app.get('/api/fee-summary-chief', async (req, res) => {
  const { schoolCode, fromDate, toDate } = req.query;

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("[FeeSummary] Incoming Request");
  console.log("Params:", { schoolCode, fromDate, toDate });
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (!schoolCode || !fromDate || !toDate) {
    return res.status(400).json({
      message: "schoolCode, fromDate, and toDate are required"
    });
  }

  try {
    // 1️⃣ DB connection
    const db = await getDatabaseConnection(schoolCode);
    console.log("[FeeSummary] ✅ Database connected");

    // 2️⃣ Aggregation query (FIXED LOGIC)
    const sql = `
      SELECT
        /* TOTAL PAID */
        SUM(
          IFNULL(Paid_Amount, 0) +
          IFNULL(Installment1_Paid, 0) +
          IFNULL(Installment2_Paid, 0) +
          IFNULL(Installment3_Paid, 0) +
          IFNULL(Installment4_Paid, 0) +
          IFNULL(Installment5_Paid, 0) +
          IFNULL(Admission_paid, 0) +
          IFNULL(books_paid, 0) +
          IFNULL(uniform_paid, 0) +
          IFNULL(bus_paid, 0) +
          IFNULL(exam_paid, 0) +
          IFNULL(others_paid, 0)
        ) AS totalPaid,

        /* EXPECTED = COMPLETE FEE */
        SUM(IFNULL(CompleteFee, 0)) AS totalExpected,

        /* DUE = COMPLETE FEE - PAID */
        SUM(
          IFNULL(CompleteFee, 0) -
          (
            IFNULL(Paid_Amount, 0) +
            IFNULL(Installment1_Paid, 0) +
            IFNULL(Installment2_Paid, 0) +
            IFNULL(Installment3_Paid, 0) +
            IFNULL(Installment4_Paid, 0) +
            IFNULL(Installment5_Paid, 0) +
            IFNULL(Admission_paid, 0) +
            IFNULL(books_paid, 0) +
            IFNULL(uniform_paid, 0) +
            IFNULL(bus_paid, 0) +
            IFNULL(exam_paid, 0) +
            IFNULL(others_paid, 0)
          )
        ) AS totalDue,

        /* BREAKDOWNS */
        SUM(IFNULL(Admission_paid, 0)) AS totalAdmissionPaid,

        SUM(
          IFNULL(books_paid, 0) +
          IFNULL(uniform_paid, 0) +
          IFNULL(exam_paid, 0) +
          IFNULL(others_paid, 0)
        ) AS totalBooksUniformPaid,

        SUM(IFNULL(bus_paid, 0)) AS totalBusPaid,

        SUM(
          IFNULL(Installment1_Paid, 0) +
          IFNULL(Installment2_Paid, 0) +
          IFNULL(Installment3_Paid, 0) +
          IFNULL(Installment4_Paid, 0) +
          IFNULL(Installment5_Paid, 0)
        ) AS totalPaidTuitionFee

      FROM FeesDetails
      WHERE DATE(created_at) BETWEEN ? AND ?;
    `;

    console.log("[FeeSummary] ▶ Running aggregation query");
    const [rows] = await db.execute(sql, [fromDate, toDate]);

    const totals = rows[0] || {};

    // 3️⃣ Safe numbers
    const response = {
      totalPaid: formatCurrency(totals.totalPaid || 0),
      totalExpected: formatCurrency(totals.totalExpected || 0),
      totalDue: formatCurrency(Math.max(totals.totalDue || 0, 0)),
      totalAdmissionPaid: formatCurrency(totals.totalAdmissionPaid || 0),
      totalBooksUniformPaid: formatCurrency(totals.totalBooksUniformPaid || 0),
      totalBusPaid: formatCurrency(totals.totalBusPaid || 0),
      totalPaidTuitionFee: formatCurrency(totals.totalPaidTuitionFee || 0),
    };

    console.log("[FeeSummary] ✅ Response:", response);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    res.json(response);

  } catch (err) {
    console.error("[FeeSummary] 🔥 Error:", err);
    res.status(500).json({
      message: "Database error",
      error: err.message
    });
  }
});


// =======================================================
// API 2: Fetch Monthly Chart Data
// =======================================================
app.get('/api/fee-chart-data', async (req, res) => {
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ message: "schoolCode is required" });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);

    const sql = `
      SELECT
        DATE_FORMAT(updated_at, '%Y-%m') AS month_label,

        /* TOTAL PAID */
        SUM(
          IFNULL(Paid_Amount, 0) +
          IFNULL(Installment1_Paid, 0) +
          IFNULL(Installment2_Paid, 0) +
          IFNULL(Installment3_Paid, 0) +
          IFNULL(Installment4_Paid, 0) +
          IFNULL(Installment5_Paid, 0) +
          IFNULL(Admission_paid, 0) +
          IFNULL(books_paid, 0) +
          IFNULL(uniform_paid, 0) +
          IFNULL(bus_paid, 0) +
          IFNULL(exam_paid, 0) +
          IFNULL(others_paid, 0)
        ) AS TotalPaid,

        /* EXPECTED (DUE) = COMPLETE FEE - PAID */
        SUM(
          IFNULL(CompleteFee, 0) -
          (
            IFNULL(Paid_Amount, 0) +
            IFNULL(Installment1_Paid, 0) +
            IFNULL(Installment2_Paid, 0) +
            IFNULL(Installment3_Paid, 0) +
            IFNULL(Installment4_Paid, 0) +
            IFNULL(Installment5_Paid, 0) +
            IFNULL(Admission_paid, 0) +
            IFNULL(books_paid, 0) +
            IFNULL(uniform_paid, 0) +
            IFNULL(bus_paid, 0) +
            IFNULL(exam_paid, 0) +
            IFNULL(others_paid, 0)
          )
        ) AS TotalExpected

      FROM FeesDetails
      WHERE updated_at IS NOT NULL
        AND updated_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)

      GROUP BY month_label
      ORDER BY month_label;
    `;

    const [results] = await db.execute(sql);

    const chartData = results.map(row => ({
      month_label: row.month_label,
      TotalPaid: Number(row.TotalPaid) || 0,
      TotalExpected: Math.max(Number(row.TotalExpected) || 0, 0)
    }));

    res.json(chartData);

  } catch (err) {
    console.error("Chart data error:", err);
    res.status(500).json({
      message: "Database connection or query error",
      error: err.message
    });
  }
});


// =======================================================
// API 3: Detailed Fee Records
// =======================================================
app.get('/fee-records', async (req, res) => {
  const { schoolCode, type, month } = req.query;

  console.log("📥 Incoming /api/fee-records request:", {
    schoolCode,
    type,
    month
  });

  if (!schoolCode || !type || !month) {
    console.log("❌ Missing Required Params");
    return res.status(400).send({ message: 'schoolCode, type, and month are required.' });
  }

  try {
    console.log("🔌 Connecting to DB for school:", schoolCode);
    const db = await getDatabaseConnection(schoolCode);
    console.log("✅ DB Connected");

    let sql = '';
    let queryParams = [month];

    console.log("🔍 Report Type Requested:", type);

    // ⭐ Common formula for Total Paid including installments
    const TOTAL_PAID_FORMULA = `
      (
        IFNULL(Paid_Amount,0) +
        IFNULL(Installment1_Paid,0) +
        IFNULL(Installment2_Paid,0) +
        IFNULL(Installment3_Paid,0) +
        IFNULL(Installment4_Paid,0) +
        IFNULL(Installment5_Paid,0)
      )
    `;

    switch (type) {

      // ---------------------------------------------
      // 1. Highly Unpaid List
      // ---------------------------------------------
      case 'HighlyUnpaidList':
        sql = `
          SELECT StudentName, Class_name, Final_Amount,
          ${TOTAL_PAID_FORMULA} AS Total_Paid
          FROM FeesDetails
          WHERE Final_Amount > 0 
            AND ${TOTAL_PAID_FORMULA} < (Final_Amount * 0.1)
            AND DATE_FORMAT(created_at, '%Y-%m') = ?
        `;
        break;

      // ---------------------------------------------
      // 2. Bus Fees Pending
      // ---------------------------------------------
      case 'BusFeesPendingList':
        sql = `
          SELECT StudentName, Class_name, Bus_fees, bus_paid 
          FROM FeesDetails
          WHERE Bus_fees > 0 AND bus_paid < Bus_fees
            AND DATE_FORMAT(created_at, '%Y-%m') = ?
        `;
        break;

      // ---------------------------------------------
      // 3. Tuition Paid Report
      // ---------------------------------------------
case 'TuitionPaidReport':
    sql = `
      SELECT 
        StudentName, 
        Class_name,
        ${TOTAL_PAID_FORMULA} AS Total_Paid,
        Paid_Amount AS TuitionPaid,
        updated_at
      FROM FeesDetails
      WHERE DATE_FORMAT(updated_at, '%Y-%m') = ?
        AND Paid_Amount > 0
    `;
    break;

      // ---------------------------------------------
      // 4. Books + Uniform Paid
      // ---------------------------------------------
      case 'BooksUniformPaidReport':
        sql = `
          SELECT StudentName, Class_name, books_paid, uniform_paid, updated_at
          FROM FeesDetails
          WHERE DATE_FORMAT(updated_at, '%Y-%m') = ? 
            AND (books_paid > 0 OR uniform_paid > 0)
        `;
        break;

      // ---------------------------------------------
      // 5. Bus Paid Report
      // ---------------------------------------------
      case 'BusPaidReport':
        sql = `
          SELECT StudentName, Class_name, bus_paid, updated_at
          FROM FeesDetails
          WHERE DATE_FORMAT(updated_at, '%Y-%m') = ? 
            AND bus_paid > 0
        `;
        break;

      // ---------------------------------------------
      // 6. Admission Paid Report
      // ---------------------------------------------
      case 'AdmissionPaidReport':
        sql = `
          SELECT StudentName, Class_name, Admission_paid, updated_at
          FROM FeesDetails
          WHERE DATE_FORMAT(updated_at, '%Y-%m') = ? 
            AND Admission_paid > 0
        `;
        break;

      // ---------------------------------------------
      // 7. Total Paid List
      // ---------------------------------------------
      case 'TotalPaidList':
        sql = `
          SELECT 
            StudentName, 
            Class_name,
            exam_paid,books_paid,Admission_paid,uniform_paid,bus_paid,
            Final_Amount AS Total_Expected,
            ${TOTAL_PAID_FORMULA} AS Total_Paid
          FROM FeesDetails
          WHERE DATE_FORMAT(updated_at, '%Y-%m') = ? 
            AND ${TOTAL_PAID_FORMULA} >= Final_Amount AND Final_Amount > 0
        `;
        break;

      // ---------------------------------------------
      // 8. Total Due List
      // ---------------------------------------------
      case 'TotalDueList':
        sql = `
          SELECT 
            StudentName, 
            Class_name, exam_paid,books_paid,Admission_paid,uniform_paid,bus_paid,
            Final_Amount AS Total_Expected,
            ${TOTAL_PAID_FORMULA} AS Total_Paid,
            (Final_Amount - ${TOTAL_PAID_FORMULA}) AS Due_Amount
          FROM FeesDetails
          WHERE DATE_FORMAT(updated_at, '%Y-%m') = ? 
            AND ${TOTAL_PAID_FORMULA} < Final_Amount AND Final_Amount > 0
        `;
        break;

      // ---------------------------------------------
      // 9. All Fees Status Report
      // ---------------------------------------------
      case 'AllFeesStatusReport':
        sql = `
          SELECT 
            StudentName, 
            Class_name,
            Final_Amount AS Total_Expected,
            ${TOTAL_PAID_FORMULA} AS Total_Paid,
            Admission_fees,
            Admission_paid,
            (Admission_fees - Admission_paid) AS Admission_Due,
            (Book_Fees + Uniform_fees) AS Books_Uniform_Expected,
            (books_paid + uniform_paid) AS Books_Uniform_Paid,
            ((Book_Fees + Uniform_fees) - (books_paid + uniform_paid)) AS Books_Uniform_Due,
            Bus_fees AS Bus_Expected,
            bus_paid AS Bus_Paid,
            (Bus_fees - bus_paid) AS Bus_Due
          FROM FeesDetails
          WHERE DATE_FORMAT(updated_at, '%Y-%m') = ?
        `;
        break;

      default:
        console.log("❌ Invalid report type:", type);
        return res.status(404).send({ message: 'Invalid report type.' });
    }

    console.log("📘 SQL Prepared:", sql);
    console.log("📘 Query Params:", queryParams);

    const [results] = await db.execute(sql, queryParams);
    console.log(`📊 Query returned ${results.length} rows`);

    const formattedResults = results.map(row => {
      const newRow = {};

      for (const [key, value] of Object.entries(row)) {
        if (
          typeof value === 'object' &&
          value !== null &&
          key.toLowerCase().match(/amount|fee|paid|due|expected/)
        ) {
          newRow[key] = formatCurrency(value);
        } else if (key.toLowerCase().includes('date') && value) {
          newRow[key] = value.toISOString().split('T')[0];
        } else {
          newRow[key] = value;
        }
      }
      return newRow;
    });

    console.log("📦 Sending formatted results");
    res.json(formattedResults);

  } catch (err) {
    console.error("🔥 Fee records error:", err);
    res.status(500).send({ message: "Database connection or query error." });
  }
});
// app.get('/api/fee-records', async (req, res) => {
//   const { schoolCode, type, fromDate, toDate } = req.query;

//   console.log("📥 Incoming /api/fee-records request:", {
//     schoolCode,
//     type,
//     fromDate,
//     toDate
//   });

//   if (!schoolCode || !type || !fromDate || !toDate) {
//     return res.status(400).json({
//       message: 'schoolCode, type, fromDate, and toDate are required.'
//     });
//   }

//   try {
//     const db = await getDatabaseConnection(schoolCode);
//     console.log("✅ DB Connected");

//     let sql = "";
//     const queryParams = [fromDate, toDate];

//     // ⭐ TOTAL PAID (ALL PAYMENT SOURCES)
//     const TOTAL_PAID_FORMULA = `
//       (
//         IFNULL(Paid_Amount,0) +
//         IFNULL(Installment1_Paid,0) +
//         IFNULL(Installment2_Paid,0) +
//         IFNULL(Installment3_Paid,0) +
//         IFNULL(Installment4_Paid,0) +
//         IFNULL(Installment5_Paid,0) +
//         IFNULL(Admission_paid,0) +
//         IFNULL(books_paid,0) +
//         IFNULL(uniform_paid,0) +
//         IFNULL(bus_paid,0) +
//         IFNULL(exam_paid,0) +
//         IFNULL(others_paid,0)
//       )
//     `;

//     // ⭐ TOTAL EXPECTED (BASE FEE)
//     const TOTAL_EXPECTED_FORMULA = `
//       IFNULL(CompleteFee,0)
//     `;

//     // ⭐ FINAL AMOUNT (DUE)
//     const FINAL_AMOUNT_FORMULA = `
//       (${TOTAL_EXPECTED_FORMULA} - ${TOTAL_PAID_FORMULA})
//     `;

//     // ⭐ DATE FILTER
//     const getDateFilter = () => `
//       DATE(created_at) BETWEEN ? AND ?
//     `;

//     switch (type) {

//       // 🔴 STUDENTS WITH VERY LOW PAYMENT
//       case "HighlyUnpaidList":
//         sql = `
//           SELECT 
//             StudentName,
//             Class_name,
//             ${TOTAL_EXPECTED_FORMULA} AS Total_Expected,
//             ${TOTAL_PAID_FORMULA} AS Total_Paid,
//             ${FINAL_AMOUNT_FORMULA} AS Due_Amount
//           FROM FeesDetails
//           WHERE ${getDateFilter()}
//             AND ${FINAL_AMOUNT_FORMULA} > 0
//             AND ${TOTAL_PAID_FORMULA} < (${TOTAL_EXPECTED_FORMULA} * 0.1)
//         `;
//         break;

//       // 🚌 BUS FEES PENDING
//       case "BusFeesPendingList":
//         sql = `
//           SELECT 
//             StudentName,
//             Class_name,
//             Bus_fees,
//             bus_paid,
//             (Bus_fees - bus_paid) AS Bus_Due
//           FROM FeesDetails
//           WHERE ${getDateFilter()}
//             AND Bus_fees > 0
//             AND bus_paid < Bus_fees
//         `;
//         break;

//       // 🎓 TUITION PAID ONLY
//       case "TuitionPaidReport":
//         sql = `
//           SELECT 
//             StudentName,
//             Class_name,
//             ${TOTAL_PAID_FORMULA} AS Total_Paid,
//             (
//               ${TOTAL_PAID_FORMULA}
//               - IFNULL(Admission_paid,0)
//               - IFNULL(books_paid,0)
//               - IFNULL(uniform_paid,0)
//               - IFNULL(bus_paid,0)
//               - IFNULL(exam_paid,0)
//               - IFNULL(others_paid,0)
//             ) AS TuitionPaid,
//             created_at
//           FROM FeesDetails
//           WHERE ${getDateFilter()}
//             AND (
//               ${TOTAL_PAID_FORMULA}
//               - IFNULL(Admission_paid,0)
//               - IFNULL(books_paid,0)
//               - IFNULL(uniform_paid,0)
//               - IFNULL(bus_paid,0)
//               - IFNULL(exam_paid,0)
//               - IFNULL(others_paid,0)
//             ) > 0
//         `;
//         break;

//       // 📚 BOOKS & UNIFORM PAID
//       case "BooksUniformPaidReport":
//         sql = `
//           SELECT 
//             StudentName,
//             Class_name,
//             books_paid,
//             uniform_paid,
//             created_at
//           FROM FeesDetails
//           WHERE ${getDateFilter()}
//             AND (books_paid > 0 OR uniform_paid > 0)
//         `;
//         break;

//       // 🚌 BUS PAID
//       case "BusPaidReport":
//         sql = `
//           SELECT 
//             StudentName,
//             Class_name,
//             bus_paid,
//             created_at
//           FROM FeesDetails
//           WHERE ${getDateFilter()}
//             AND bus_paid > 0
//         `;
//         break;

//       // 🏫 ADMISSION PAID
//       case "AdmissionPaidReport":
//         sql = `
//           SELECT 
//             StudentName,
//             Class_name,
//             Admission_paid,
//             created_at
//           FROM FeesDetails
//           WHERE ${getDateFilter()}
//             AND Admission_paid > 0
//         `;
//         break;

//       // ✅ FULLY PAID STUDENTS
//       case "TotalPaidList":
//         sql = `
//           SELECT 
//             StudentName,
//             Class_name,
//             ${TOTAL_EXPECTED_FORMULA} AS Total_Expected,
//             ${TOTAL_PAID_FORMULA} AS Total_Paid
//           FROM FeesDetails
//           WHERE ${getDateFilter()}
//             AND ${FINAL_AMOUNT_FORMULA} <= 0
//             AND ${TOTAL_EXPECTED_FORMULA} > 0
//         `;
//         break;

//       // ❌ FEES DUE STUDENTS
//       case "TotalDueList":
//         sql = `
//           SELECT 
//             StudentName,
//             Class_name,
//             ${TOTAL_EXPECTED_FORMULA} AS Total_Expected,
//             ${TOTAL_PAID_FORMULA} AS Total_Paid,
//             ${FINAL_AMOUNT_FORMULA} AS Due_Amount
//           FROM FeesDetails
//           WHERE ${getDateFilter()}
//             AND ${FINAL_AMOUNT_FORMULA} > 0
//             AND ${TOTAL_EXPECTED_FORMULA} > 0
//         `;
//         break;

//       // 📊 COMPLETE FEES STATUS
//       case "AllFeesStatusReport":
//         sql = `
//           SELECT 
//             StudentName,
//             Class_name,
//             ${TOTAL_EXPECTED_FORMULA} AS Total_Expected,
//             ${TOTAL_PAID_FORMULA} AS Total_Paid,
//             ${FINAL_AMOUNT_FORMULA} AS Final_Amount,

//             Admission_fees,
//             Admission_paid,
//             (Admission_fees - Admission_paid) AS Admission_Due,

//             (Book_Fees + Uniform_fees) AS Books_Uniform_Expected,
//             (books_paid + uniform_paid) AS Books_Uniform_Paid,
//             ((Book_Fees + Uniform_fees) - (books_paid + uniform_paid)) AS Books_Uniform_Due,

//             Bus_fees AS Bus_Expected,
//             bus_paid AS Bus_Paid,
//             (Bus_fees - bus_paid) AS Bus_Due,

//             created_at,
//             paidDate
//           FROM FeesDetails
//           WHERE ${getDateFilter()}
//         `;
//         break;

//       default:
//         return res.status(404).json({ message: "Invalid report type." });
//     }

//     console.log("📘 SQL:", sql);
//     console.log("📘 Params:", queryParams);

//     const [results] = await db.execute(sql, queryParams);

//     // 💰 FORMAT RESPONSE
//     const formatted = results.map(row => {
//       const out = {};
//       for (const [key, val] of Object.entries(row)) {
//         if (
//           val !== null &&
//           key.toLowerCase().match(/amount|fee|paid|due|expected/)
//         ) {
//           out[key] = formatCurrency(val);
//         } else if (key.toLowerCase().includes("date") && val) {
//           out[key] = val.toISOString().split("T")[0];
//         } else {
//           out[key] = val;
//         }
//       }
//       return out;
//     });

//     res.json(formatted);

//   } catch (err) {
//     console.error("🔥 Fee records error:", err);
//     res.status(500).json({ message: "Database error." });
//   }
// });
app.get("/api/fee-records-alldata", async (req, res) => {
  const { schoolCode, type } = req.query;

  if (!schoolCode || !type) {
    return res.status(400).json({
      message: "schoolCode and type are required."
    });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);
    const dynamicFeeColumns = await getActiveDynamicFeeColumns(db, schoolCode);

    let sql = "";

    switch (type) {
// 🟣 COMPLETE FEE SUMMARY REPORT
case "CompleteFeeSummaryReport":
  const completeDynamicSelectSql = dynamicFeeColumns
    .flatMap(({ base, feeColumn, paidColumn }) => [
      `
      COALESCE(
        (
          SELECT MAX(IFNULL(c.${feeColumn},0))
          FROM FeesDetails c
          WHERE c.Class_name = s.Class_name
            AND c.section = s.section
            AND c.StudentName IS NULL
        ),
        MAX(IFNULL(s.${feeColumn},0)),
        0
      ) AS \`${base}\``,
      `MAX(IFNULL(s.${paidColumn},0)) AS \`${base}_paid\``,
    ])
    .join(",\n");

  sql = `
    SELECT 
      s.Class_name,
      s.section,
      s.StudentName,

      -- Class-wise CompleteFee
      (
        SELECT MAX(IFNULL(c.CompleteFee,0))
        FROM FeesDetails c
        WHERE c.Class_name = s.Class_name
          AND c.section = s.section
          AND c.StudentName IS NULL
      ) AS CompleteFee,

      -- Student-wise (if any)
      MAX(IFNULL(s.Book_Fees,0)) AS StudentBooksFee,
      MAX(IFNULL(s.Exam_fees,0)) AS StudentExamFee,

      -- Tuition = Class Complete - (Class Books + Class Exam)
      (
        (
          SELECT MAX(IFNULL(c.CompleteFee,0))
          FROM FeesDetails c
          WHERE c.Class_name = s.Class_name
            AND c.section = s.section
            AND c.StudentName IS NULL
        )
        -
        (
          IFNULL(
            (
              SELECT MAX(IFNULL(c.Book_Fees,0))
              FROM FeesDetails c
              WHERE c.Class_name = s.Class_name
                AND c.section = s.section
                AND c.StudentName IS NULL
            ),0
          )
          +
          IFNULL(
            (
              SELECT MAX(IFNULL(c.Exam_fees,0))
              FROM FeesDetails c
              WHERE c.Class_name = s.Class_name
                AND c.section = s.section
                AND c.StudentName IS NULL
            ),0
          )
        )
      ) AS TuitionFee,

      MAX(IFNULL(s.Bus_fees,0)) AS BusFee,
      MAX(IFNULL(s.Previous_Fee_Due,0)) AS PreviousDue,
      MAX(IFNULL(s.ResidentialCompleteFee,0)) AS ResidentialCompleteFee,
      MAX(IFNULL(s.Others,0)) AS OtherFee
      ${completeDynamicSelectSql ? `,\n${completeDynamicSelectSql}` : ""}

    FROM FeesDetails s
    WHERE s.StudentName IS NOT NULL
    GROUP BY s.Class_name, s.section, s.StudentName
    ORDER BY s.Class_name, s.section, s.StudentName;
  `;
  break;
  
  
  case "PreviousPaidPendingReport":
        sql = `
          SELECT 
            StudentName,
            Class_name,
            section,
            paidDate AS Payment_Date,
            IFNULL(Previous_Paid,0) AS Previous_Paid,
            IFNULL(Previous_Fee_Due,0) AS Previous_Pending
          FROM FeesDetails
          WHERE StudentName IS NOT NULL
            AND (
              IFNULL(Previous_Paid,0) > 0
              OR IFNULL(Previous_Fee_Due,0) > 0
            )
          ORDER BY StudentName, paidDate
        `;
        break;

      // 🟢 BUS FEE PAYMENT (ONLY IF AMOUNT EXISTS)
      case "BusFeePaymentReport":
        sql = `
          SELECT 
            StudentName,
            Class_name,
            section,
            IFNULL(Bus_fees,0) AS Bus_Fee,
            IFNULL(bus_paid,0) AS Bus_Paid,
            IFNULL(CompleteFee,0) AS CompleteFee,
            IFNULL(ResidentialCompleteFee,0) AS Residential_Amount,
            (
              IFNULL(RES_INST_1,0) +
              IFNULL(RES_INST_2,0) +
              IFNULL(RES_INST_3,0) +
              IFNULL(RES_INST_4,0) +
              IFNULL(RES_INST_5,0)
            ) AS Residential_Paid,
            paidDate AS Bus_Payment_Date,
            (IFNULL(Bus_fees,0) - IFNULL(bus_paid,0)) AS Bus_Pending
          FROM FeesDetails
          WHERE StudentName IS NOT NULL
            AND (
              IFNULL(Bus_fees,0) > 0
              OR IFNULL(bus_paid,0) > 0
              OR IFNULL(ResidentialCompleteFee,0) > 0
              OR IFNULL(RES_INST_1,0) > 0
              OR IFNULL(RES_INST_2,0) > 0
              OR IFNULL(RES_INST_3,0) > 0
              OR IFNULL(RES_INST_4,0) > 0
              OR IFNULL(RES_INST_5,0) > 0
            )
          ORDER BY StudentName, paidDate
        `;
        break;

      default:
        return res.status(404).json({ message: "Invalid report type." });
    }

    const [results] = await db.execute(sql);
    res.json(results);

  } catch (err) {
    console.error("🔥 New API error:", err);
    res.status(500).json({ message: "Database error." });
  }
});
app.get('/api/fee-records', async (req, res) => {
  const { schoolCode, type, fromDate, toDate } = req.query;

  console.log("📥 Incoming /api/fee-records request:", {
    schoolCode,
    type,
    fromDate,
    toDate
  });

  if (!schoolCode || !type || !fromDate || !toDate) {
    return res.status(400).json({
      message: 'schoolCode, type, fromDate, and toDate are required.'
    });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);
    const dynamicFeeColumns = await getActiveDynamicFeeColumns(db, schoolCode);
    const dynamicPaidFormula = buildSqlSum(dynamicFeeColumns.map((item) => item.paidColumn));
    const dynamicTotalPaidFragment = dynamicFeeColumns.length ? ` + ${dynamicPaidFormula}` : "";
    const dynamicPaidSelectSql = buildDynamicFeeSelectSql(dynamicFeeColumns, {
      includeFee: true,
      includePaid: true,
      includeDue: true,
    });
    console.log("✅ DB Connected");

    let sql = "";
    const queryParams = [fromDate, toDate];

    // ⭐ TOTAL PAID (ALL SOURCES)
    const TOTAL_PAID_FORMULA = `
      (
        IFNULL(Paid_Amount,0) +
        IFNULL(Installment1_Paid,0) +
        IFNULL(Installment2_Paid,0) +
        IFNULL(Installment3_Paid,0) +
        IFNULL(Installment4_Paid,0) +
        IFNULL(Installment5_Paid,0) +
        IFNULL(Admission_paid,0) +
        IFNULL(books_paid,0) +
        IFNULL(uniform_paid,0) +
        IFNULL(bus_paid,0) +
        IFNULL(exam_paid,0) +
        IFNULL(others_paid,0)
        ${dynamicTotalPaidFragment}
      )
    `;

    // ⭐ TOTAL EXPECTED (with fallback for zero)
    const TOTAL_EXPECTED_FORMULA = `
      COALESCE(
        NULLIF(CompleteFee, 0),
        (SELECT CompleteFee 
         FROM FeesDetails AS t2 
         WHERE t2.StudentName IS NULL AND t2.Class_name = FeesDetails.Class_name 
         LIMIT 1)
      )
    `;

    // ⭐ FINAL AMOUNT (DUE)
    const FINAL_AMOUNT_FORMULA = `(${TOTAL_EXPECTED_FORMULA} - ${TOTAL_PAID_FORMULA})`;

    // ⭐ EFFECTIVE DATE (created_at → updated_at fallback)
const EFFECTIVE_DATE = `DATE(paidDate)`;

    // ⭐ DATE FILTER (USED EVERYWHERE)
    const getDateFilter = () => `${EFFECTIVE_DATE} BETWEEN ? AND ?`;

    switch (type) {

      // 🔴 HIGHLY UNPAID
      case "HighlyUnpaidList":
        sql = `
          SELECT 
            StudentName,
            Class_name,
            ${TOTAL_EXPECTED_FORMULA} AS Total_Expected,
            ${TOTAL_PAID_FORMULA} AS Total_Paid,
            ${FINAL_AMOUNT_FORMULA} AS Due_Amount,
            COALESCE(created_at, updated_at) AS record_date
          FROM FeesDetails
          WHERE ${getDateFilter()}
            AND ${FINAL_AMOUNT_FORMULA} > 0
            AND ${TOTAL_PAID_FORMULA} < (${TOTAL_EXPECTED_FORMULA} * 0.1)
        `;
        break;

      // 🚌 BUS FEES PENDING
      case "BusFeesPendingList":
        sql = `
          SELECT 
            StudentName,
            Class_name,
            Bus_fees,
            bus_paid,
            (Bus_fees - bus_paid) AS Bus_Due,
            COALESCE(created_at, updated_at) AS record_date
          FROM FeesDetails
          WHERE ${getDateFilter()}
            AND Bus_fees > 0
            AND bus_paid < Bus_fees
        `;
        break;

      // 🎓 TUITION PAID
      case "TuitionPaidReport":
        sql = `
          SELECT 
            StudentName,
            Class_name,
            ${TOTAL_PAID_FORMULA} AS Total_Paid,
            (
              ${TOTAL_PAID_FORMULA}
              - IFNULL(Admission_paid,0)
              - IFNULL(books_paid,0)
              - IFNULL(uniform_paid,0)
              - IFNULL(bus_paid,0)
              - IFNULL(exam_paid,0)
              - IFNULL(others_paid,0)
            ) AS TuitionPaid,
            COALESCE(created_at, updated_at) AS record_date
          FROM FeesDetails
          WHERE ${getDateFilter()}
            AND (
              ${TOTAL_PAID_FORMULA}
              - IFNULL(Admission_paid,0)
              - IFNULL(books_paid,0)
              - IFNULL(uniform_paid,0)
              - IFNULL(bus_paid,0)
              - IFNULL(exam_paid,0)
              - IFNULL(others_paid,0)
            ) > 0
        `;
        break;

      // 📚 BOOKS + UNIFORM
      case "BooksUniformPaidReport":
        sql = `
          SELECT 
            StudentName,
            Class_name,
            books_paid,
            uniform_paid,
            COALESCE(created_at, updated_at) AS record_date
          FROM FeesDetails
          WHERE ${getDateFilter()}
            AND (books_paid > 0 OR uniform_paid > 0)
        `;
        break;

      // 🚌 BUS PAID
      case "BusPaidReport":
        sql = `
          SELECT 
            StudentName,
            Class_name,
            bus_paid,
            COALESCE(created_at, updated_at) AS record_date
          FROM FeesDetails
          WHERE ${getDateFilter()}
            AND bus_paid > 0
        `;
        break;

      // 🏫 ADMISSION PAID
      case "AdmissionPaidReport":
        sql = `
          SELECT 
            StudentName,
            Class_name,
            Admission_paid,
            COALESCE(created_at, updated_at) AS record_date
          FROM FeesDetails
          WHERE ${getDateFilter()}
            AND Admission_paid > 0
        `;
        break;

      // ✅ FULLY PAID
case "TotalPaidList":
  sql = `
SELECT 
  StudentName,
  Class_name,
  section,
  exam_paid,
  books_paid,
  Admission_paid,
  uniform_paid,
  bus_paid,
  ${dynamicPaidSelectSql ? `${dynamicPaidSelectSql},` : ""}

  COALESCE(Installment1_Paid, 0) +
  COALESCE(Installment2_Paid, 0) +
  COALESCE(Installment3_Paid, 0) +
  COALESCE(Installment4_Paid, 0) +
  COALESCE(Installment5_Paid, 0) AS Tuition_Fee,

  ${TOTAL_EXPECTED_FORMULA} AS Total_Expected,
  ${TOTAL_PAID_FORMULA} AS Total_Paid,
  ${FINAL_AMOUNT_FORMULA} AS Due_Amount,

  paidDate AS record_date

FROM FeesDetails

WHERE ${getDateFilter()}
  AND ${TOTAL_PAID_FORMULA} > 0
ORDER BY paidDate ASC
  `;
  break;
      // ❌ FEES DUE
case "TotalDueList":

  const TOTAL_PAID_FORMULA1 = `
    (
      IFNULL(s.Paid_Amount,0) +
      IFNULL(s.Installment1_Paid,0) +
      IFNULL(s.Installment2_Paid,0) +
      IFNULL(s.Installment3_Paid,0) +
      IFNULL(s.Installment4_Paid,0) +
      IFNULL(s.Installment5_Paid,0) +
      IFNULL(s.Admission_paid,0) +
      IFNULL(s.books_paid,0) +
      IFNULL(s.uniform_paid,0) +
      IFNULL(s.bus_paid,0) +
      IFNULL(s.exam_paid,0) +
      IFNULL(s.others_paid,0)
    )
  `;

  sql = `
    SELECT 
      s.StudentName,
      s.Class_name,
      s.section,

      -- Individual dues
      GREATEST(0, t.Admission_fees - s.Admission_paid) AS Admission_Due,
      GREATEST(0, t.Bus_fees - s.bus_paid) AS Bus_Due,
      GREATEST(0, t.Book_Fees - s.books_paid) AS Book_Due,
      GREATEST(0, t.Exam_fees - s.exam_paid) AS Exam_Due,
      GREATEST(0, t.Others - s.others_paid) AS Others_Due,

      -- Tuition due
      GREATEST(
        0,
        (t.CompleteFee - (t.Admission_fees + t.Exam_fees + t.Book_Fees + t.Uniform_fees + t.Bus_fees + t.Others)) 
        - CASE 
            WHEN COALESCE(s.Installment1_Paid,0) + COALESCE(s.Installment2_Paid,0) +
                 COALESCE(s.Installment3_Paid,0) + COALESCE(s.Installment4_Paid,0) +
                 COALESCE(s.Installment5_Paid,0) = 0
              THEN COALESCE(s.Paid_Amount,0)
            ELSE 
              COALESCE(s.Installment1_Paid,0) + COALESCE(s.Installment2_Paid,0) +
              COALESCE(s.Installment3_Paid,0) + COALESCE(s.Installment4_Paid,0) +
              COALESCE(s.Installment5_Paid,0)
          END
      ) AS Tuition_Due,

      -- Total Paid
      ${TOTAL_PAID_FORMULA1} AS Total_Paid,

      -- Total Due
      (
        GREATEST(0, t.Admission_fees - s.Admission_paid) +
        GREATEST(0, t.Bus_fees - s.bus_paid) +
        GREATEST(0, t.Book_Fees - s.books_paid) +
        GREATEST(0, t.Exam_fees - s.exam_paid) +
        GREATEST(0, t.Others - s.others_paid) +
        GREATEST(
          0,
          (t.CompleteFee - (t.Admission_fees + t.Exam_fees + t.Book_Fees + t.Uniform_fees + t.Bus_fees + t.Others)) 
          - CASE 
              WHEN COALESCE(s.Installment1_Paid,0) + COALESCE(s.Installment2_Paid,0) +
                   COALESCE(s.Installment3_Paid,0) + COALESCE(s.Installment4_Paid,0) +
                   COALESCE(s.Installment5_Paid,0) = 0
                THEN COALESCE(s.Paid_Amount,0)
              ELSE 
                COALESCE(s.Installment1_Paid,0) + COALESCE(s.Installment2_Paid,0) +
                COALESCE(s.Installment3_Paid,0) + COALESCE(s.Installment4_Paid,0) +
                COALESCE(s.Installment5_Paid,0)
            END
        )
      ) AS Total_Due,

      -- ✅ Student Paid Date Only
      s.paidDate AS record_date

    FROM FeesDetails s
    JOIN FeesDetails t
      ON s.Class_name = t.Class_name 
      AND t.StudentName IS NULL

    WHERE s.StudentName IS NOT NULL
      AND (
        GREATEST(0, t.Admission_fees - s.Admission_paid) +
        GREATEST(0, t.Bus_fees - s.bus_paid) +
        GREATEST(0, t.Book_Fees - s.books_paid) +
        GREATEST(0, t.Exam_fees - s.exam_paid) +
        GREATEST(0, t.Others - s.others_paid) +
        GREATEST(
          0,
          (t.CompleteFee - (t.Admission_fees + t.Exam_fees + t.Book_Fees + t.Uniform_fees + t.Bus_fees + t.Others)) 
          - CASE 
              WHEN COALESCE(s.Installment1_Paid,0) + COALESCE(s.Installment2_Paid,0) +
                   COALESCE(s.Installment3_Paid,0) + COALESCE(s.Installment4_Paid,0) +
                   COALESCE(s.Installment5_Paid,0) = 0
                THEN COALESCE(s.Paid_Amount,0)
              ELSE 
                COALESCE(s.Installment1_Paid,0) + COALESCE(s.Installment2_Paid,0) +
                COALESCE(s.Installment3_Paid,0) + COALESCE(s.Installment4_Paid,0) +
                COALESCE(s.Installment5_Paid,0)
            END
        )
      ) > 0
  `;

  console.log("📘 TotalDueList SQL:", sql);
  break;

case "AllFeesStatusReport":
  sql = `
    SELECT 
      StudentName,
      Class_name,
      receiptNumber,

      ${TOTAL_EXPECTED_FORMULA} AS Total_Expected,
      ${TOTAL_PAID_FORMULA} AS Total_Paid,
      ${FINAL_AMOUNT_FORMULA} AS Final_Amount,

      Admission_fees,
      Admission_paid,
      (Admission_fees - Admission_paid) AS Admission_Due,

      (Book_Fees + Uniform_fees) AS Books_Uniform_Expected,
      (books_paid + uniform_paid) AS Books_Uniform_Paid,
      ((Book_Fees + Uniform_fees) - (books_paid + uniform_paid)) AS Books_Uniform_Due,

      Bus_fees AS Bus_Expected,
      bus_paid AS Bus_Paid,
      (Bus_fees - bus_paid) AS Bus_Due,
      ${dynamicPaidSelectSql ? `${dynamicPaidSelectSql},` : ""}

      paidDate AS record_date
    FROM FeesDetails
    WHERE paidDate BETWEEN '${fromDate}' AND '${toDate}'
  `;

  console.log("📊 AllFeesStatusReport SQL:");
  console.log(sql);
  break;

  case "PreviousPaidPendingReport":

sql = `
  SELECT 
    StudentName,
    Class_name,
    section,
    paidDate AS Payment_Date,

    IFNULL(Previous_Paid,0) AS Previous_Paid,
    IFNULL(Previous_Fee_Due,0) AS Previous_Pending

  FROM FeesDetails
  WHERE ${getDateFilter()}
    AND StudentName IS NOT NULL
  ORDER BY StudentName, paidDate
`;

break;
case "BusFeePaymentReport":

sql = `
  SELECT 
    StudentName,
    Class_name,
    section,

    Bus_fees AS Bus_Fee,
    bus_paid AS Bus_Paid,
    IFNULL(CompleteFee,0) AS CompleteFee,
    IFNULL(ResidentialCompleteFee,0) AS Residential_Amount,
    (
      IFNULL(RES_INST_1,0) +
      IFNULL(RES_INST_2,0) +
      IFNULL(RES_INST_3,0) +
      IFNULL(RES_INST_4,0) +
      IFNULL(RES_INST_5,0)
    ) AS Residential_Paid,
    paidDate AS Bus_Payment_Date,

    (IFNULL(Bus_fees,0) - IFNULL(bus_paid,0)) AS Bus_Pending

  FROM FeesDetails
  WHERE ${getDateFilter()}
    AND StudentName IS NOT NULL
    AND (
      bus_paid > 0
      OR IFNULL(ResidentialCompleteFee,0) > 0
      OR IFNULL(RES_INST_1,0) > 0
      OR IFNULL(RES_INST_2,0) > 0
      OR IFNULL(RES_INST_3,0) > 0
      OR IFNULL(RES_INST_4,0) > 0
      OR IFNULL(RES_INST_5,0) > 0
    )

  ORDER BY StudentName, paidDate
`;

break;
      default:
        return res.status(404).json({ message: "Invalid report type." });
    }

    console.log("📘 SQL:", sql);
    console.log("📘 Params:", queryParams);

    const [results] = await db.execute(sql, queryParams);

    // 💰 FORMAT RESPONSE
const formatted = results.map(row => {
  const out = {};
  for (const [key, val] of Object.entries(row)) {
    if (
      val !== null &&
      key.toLowerCase().match(/amount|fee|paid|due|expected/)
    ) {
      out[key] = formatCurrency(val);
    } else if (
      val !== null &&
      key.toLowerCase().includes("date")
    ) {
      // ✅ Check if it's a valid date before formatting
      const dateVal = new Date(val);
      out[key] = isNaN(dateVal.getTime()) ? null : dateVal.toISOString().split("T")[0];
    } else {
      out[key] = val;
    }
  }
  return out;
});


    res.json(formatted);

  } catch (err) {
    console.error("🔥 Fee records error:", err);
    res.status(500).json({ message: "Database error." });
  }
});






app.get('/api/totalexpenses', async (req, res) => {
    const { schoolCode } = req.query;

    if (!schoolCode) {
        return res.status(400).json({ message: "School code is required." });
    }

    let connection;
    try {
        // 1. Connect to selected school's database
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();

        // 2. No schoolCode filter inside query (as requested)
        const query = `
            SELECT 
                id, 
                person_name, 
                description, 
                mobile_number, 
                expense_name, 
                price, 
                payment_mode, 
                paid_amount, 
                balance_amount, 
                expense_date, 
                expense_type, 
                created_at, 
                updated_at
            FROM Accountant;
        `;

        const [results] = await connection.execute(query);

        return res.json(results);

    } catch (error) {
        console.error("Error fetching expense data:", error);
        return res.status(500).json({
            message: "Error fetching expense data from database.",
            error: error.message
        });

    }

});



// module.exports = router;
app.get('/api/salaryTotals', async (req, res) => {
    const { schoolCode, month } = req.query;

    if (!schoolCode || !month) {
        return res.status(400).json({ error: 'Missing required parameters: schoolCode or month.' });
    }

    let connection;
    try {
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();

        const SQL = `
            SELECT
                COALESCE(SUM(CASE WHEN c.status = 'paid' THEN c.final_salary END), 0) AS totalPaid,
                COALESCE(SUM(CASE WHEN c.status = 'pending' THEN c.final_salary END), 0) AS totalPending
            FROM
                bizpulse_teacher_calculated_salary c
            INNER JOIN
                management_login_creation t ON c.teacher_id = t.id
            WHERE
                c.salary_month = ?;
        `;

        const [rows] = await connection.execute(SQL, [month]);

        const paid = parseFloat(rows[0].totalPaid);
        const pending = parseFloat(rows[0].totalPending);

        res.json({
            totalPaidSalary: paid,
            totalPendingSalary: pending,
            grandTotal: paid + pending
        });

    } catch (error) {
        console.error(`Error fetching salary totals for ${schoolCode}`, error);
        res.status(500).json({ error: 'Failed to calculate salary totals.', details: error.message });
    } 

});



/**
 * API 2: GET /api/salaryLedger
 * Retrieves the detailed list of paid salary records (the ledger) for the school.
 * @param {string} schoolCode - Used to connect to the specific school database.
 */
app.get('/api/salaryLedger', async (req, res) => {
    const { schoolCode, month } = req.query;

    if (!schoolCode) {
        return res.status(400).json({ error: 'Missing required parameter: schoolCode.' });
    }

    let connection;
    try {
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();

        let params = [];
        let monthFilter = "";

        if (month) {
            monthFilter = "WHERE c.salary_month = ?";
            params.push(month);
        }

        const SQL = `
            SELECT
                c.salary_calc_id,
                c.teacher_id,
                t.name AS teacher_name,
                c.base_salary,
                c.deductions,
                c.bonuses,
                c.final_salary,
                c.salary_month,
                c.status,
                c.payment_date
            FROM
                bizpulse_teacher_calculated_salary c
            INNER JOIN
                management_login_creation t ON c.teacher_id = t.id
            ${monthFilter}
            ORDER BY
                c.payment_date DESC;
        `;

        const [results] = await connection.execute(SQL, params);

        res.json(results);

    } catch (error) {
        console.error(`Error fetching salary ledger for ${schoolCode}`, error);
        res.status(500).json({ error: 'Failed to fetch salary ledger.', details: error.message });
    }
});



const NUM_PERIODS = 10;
const NUM_TEACHES_TO = 12;

app.post('/api/class-stats', async (req, res) => {
  const { classId, sectionId, schoolCode } = req.body;

  if (!schoolCode) return res.status(400).send("schoolCode is required.");

  const db = await getDatabaseConnection(schoolCode);

  const unionParts = [];
  const unionParams = [];

  for (let i = 1; i <= NUM_PERIODS; i++) {
    unionParts.push(`
      SELECT class_id, section_id, period_${i}_subject AS subject
      FROM UniqueTimetable
      WHERE class_id = ? AND section_id = ? AND period_${i}_subject IS NOT NULL
    `);
    unionParams.push(classId, sectionId);
  }

  const unionSql = unionParts.join(" UNION ALL ");

  const teacherJoin = `
    m.designation = subject_periods.subject
    AND (
      subject_periods.class_id = m.teaches_to_1 OR
      subject_periods.class_id = m.teaches_to_2 OR
      subject_periods.class_id = m.teaches_to_3 OR
      subject_periods.class_id = m.teaches_to_4 OR
      subject_periods.class_id = m.teaches_to_5 OR
      subject_periods.class_id = m.teaches_to_6 OR
      subject_periods.class_id = m.teaches_to_7 OR
      subject_periods.class_id = m.teaches_to_8 OR
      subject_periods.class_id = m.teaches_to_9 OR
      subject_periods.class_id = m.teaches_to_10 OR
      subject_periods.class_id = m.teaches_to_11 OR
      subject_periods.class_id = m.teaches_to_12
    )
    AND subject_periods.section_id = m.section
  `;

  const sql = `
    SELECT
      subject_periods.subject,
      COUNT(*) AS periodsPerWeek,
      MAX(m.name) AS teacherName
    FROM (${unionSql}) AS subject_periods
    LEFT JOIN management_login_creation m 
      ON ${teacherJoin}
    GROUP BY subject_periods.subject
    ORDER BY periodsPerWeek DESC;
  `;

  try {
    const [results] = await db.execute(sql, unionParams);
    res.json(results);
  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).send("Error fetching class statistics.");
  }
});

app.post('/api/subject-classes', async (req, res) => {
  const { subjectName, schoolCode } = req.body;

  if (!schoolCode) return res.status(400).send("schoolCode is required.");

  const db = await getDatabaseConnection(schoolCode);

  const unionParts = [];
  const unionParams = [];

  for (let i = 1; i <= NUM_PERIODS; i++) {
    unionParts.push(`
      SELECT class_id, section_id, period_${i}_subject AS subject
      FROM UniqueTimetable
      WHERE period_${i}_subject = ?
    `);
    unionParams.push(subjectName);
  }

  const unionSql = unionParts.join(" UNION ALL ");

  const sql = `
    SELECT 
      T.class_id,
      T.section_id,
      COUNT(*) AS periodsPerWeek,
      MAX(m.name) AS teacherName
    FROM (${unionSql}) AS T
    LEFT JOIN management_login_creation m 
      ON m.designation = T.subject 
      AND T.section_id = m.section
    GROUP BY T.class_id, T.section_id
    ORDER BY T.class_id, T.section_id;
  `;

  try {
    const [results] = await db.execute(sql, unionParams);
    res.json(results);
  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).send("Error fetching subject classes.");
  }
});

// Fetch Teachers for a Class and Section
app.post('/api/class-teachers', async (req, res) => {
  const { schoolCode } = req.body;

  if (!schoolCode) return res.status(400).send("schoolCode is required.");

  const db = await getDatabaseConnection(schoolCode);

  try {
    const sql = `
      SELECT name
      FROM management_login_creation
      WHERE user_type = 'teacher'
    `;

    const [results] = await db.execute(sql);

    
    res.json(results.map(r => r.name));
  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).send("Error fetching teachers.");
  }
});



// ===================================================================
//  B) TEACHER SCHEDULE (FETCH ALL PERIODS OF A TEACHER)
//     - Clean implementation retained
// ===================================================================
app.post('/api/teacher-schedule', async (req, res) => {
  const { teacherName, schoolCode } = req.body;

  if (!schoolCode) return res.status(400).send("schoolCode is required.");

  const db = await getDatabaseConnection(schoolCode);

  try {
    const [teacherResult] = await db.execute(
      `SELECT designation FROM management_login_creation WHERE name = ?`,
      [teacherName]
    );

    if (teacherResult.length === 0) {

      return res.json({ message: "Teacher not found." });
    }

    const subject = teacherResult[0].designation;

    const params = Array(NUM_PERIODS).fill(subject);

    const periodChecks = Array.from({ length: NUM_PERIODS }, (_, i) =>
      `period_${i + 1}_subject = ?`
    ).join(' OR ');

    const sql = `
      SELECT *
      FROM UniqueTimetable
      WHERE ${periodChecks}
      ORDER BY FIELD(day, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday');
    `;

    const [schedule] = await db.execute(sql, params);


    
    res.json(schedule);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching teacher schedule.");
  }
});



// ===================================================================
//  C) SUBJECT-CLASSES  (WHICH CLASSES TEACH THIS SUBJECT?)
//     - REFACTORED to use dynamic UNION ALL generation
// ===================================================================


// Fetch Subjects for a Class and Section
app.post('/api/class-subjects', async (req, res) => {
  const { classId, sectionId, schoolCode } = req.body;

  if (!schoolCode) return res.status(400).send("schoolCode is required.");

  const db = await getDatabaseConnection(schoolCode);

  try {
    const sql = `
      SELECT DISTINCT period_1_subject AS subject FROM UniqueTimetable WHERE class_id=? AND section_id=? AND period_1_subject IS NOT NULL
      UNION SELECT DISTINCT period_2_subject FROM UniqueTimetable WHERE class_id=? AND section_id=? AND period_2_subject IS NOT NULL
      UNION SELECT DISTINCT period_3_subject FROM UniqueTimetable WHERE class_id=? AND section_id=? AND period_3_subject IS NOT NULL
      UNION SELECT DISTINCT period_4_subject FROM UniqueTimetable WHERE class_id=? AND section_id=? AND period_4_subject IS NOT NULL
      UNION SELECT DISTINCT period_5_subject FROM UniqueTimetable WHERE class_id=? AND section_id=? AND period_5_subject IS NOT NULL
      UNION SELECT DISTINCT period_6_subject FROM UniqueTimetable WHERE class_id=? AND section_id=? AND period_6_subject IS NOT NULL
      UNION SELECT DISTINCT period_7_subject FROM UniqueTimetable WHERE class_id=? AND section_id=? AND period_7_subject IS NOT NULL
      UNION SELECT DISTINCT period_8_subject FROM UniqueTimetable WHERE class_id=? AND section_id=? AND period_8_subject IS NOT NULL
      UNION SELECT DISTINCT period_9_subject FROM UniqueTimetable WHERE class_id=? AND section_id=? AND period_9_subject IS NOT NULL
      UNION SELECT DISTINCT period_10_subject FROM UniqueTimetable WHERE class_id=? AND section_id=? AND period_10_subject IS NOT NULL
    `;

    const params = Array(10).fill([classId, sectionId]).flat();

    const [results] = await db.execute(sql, params);
    

    res.json(results.map(r => r.subject));
  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).send("Error fetching subjects.");
  }
});


// INSERT invigilator assignment
app.post("/assign-invigilator", async (req, res) => {
  const { schoolCode, class_name, teacher_name } = req.body;

  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }
  if (!class_name || !teacher_name) {
    return res.status(400).json({ error: "class_name and teacher_name are required" });
  }

  let db;
  try {
    db = await getDatabaseConnection(schoolCode);

    const sql = `
      INSERT INTO invigilator_assignments (class_name, teacher_name)
      VALUES (?, ?)
    `;

    const [result] = await db.execute(sql, [class_name, teacher_name]);

    res.json({
      message: "Invigilator assigned successfully",
      assignment_id: result.insertId,
    });

  } catch (err) {
    console.error("Error inserting assignment:", err);
    res.status(500).json({ error: "Failed to assign invigilator" });
  } 
});

// --- Get classes with pending marks ---
app.get('/api/pending-classes', async (req, res) => {
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  let db;
  try {
    db = await getDatabaseConnection(schoolCode);

    const sql = `
      SELECT DISTINCT mlc.class_name, mlc.section
      FROM management_login_creation mlc
      WHERE mlc.user_type = 'student'
      AND NOT EXISTS (
        SELECT 1
        FROM academic_performance_of_student aps
        WHERE aps.class_name = mlc.class_name
          AND aps.section = mlc.section
      )
    `;

    const [rows] = await db.execute(sql);
    res.json(rows);

  } catch (err) {
    console.error("Error fetching pending classes:", err);
    res.status(500).json({ error: "Server error" });
  } 
});

app.get("/top-students", async (req, res) => {
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: "Missing schoolCode" });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);

    const [rows] = await db.query(
      "SELECT id,created_at,subject,student_name, student_class, score FROM evaluations WHERE score > 35 ORDER BY score DESC"
    );

    res.json(rows);
  } catch (error) {
    console.error("Error fetching top students:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

app.get("/students-details", async (req, res) => {
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  try {
    // Create school-specific DB connection
    const db = await getDatabaseConnection(schoolCode);

    const query = `
      SELECT 
        id,
        name,
        gender,
        phone_no,
        father_name,
        class_name,
        section,
        school_name,
        address
      FROM management_login_creation
      WHERE user_type = 'student'
        AND is_deleted = 0
    `;

    // Run the query
    const [results] = await db.query(query);

    // Close the connection
    

    // Send response
    return res.json({
      totalStudents: results.length,
      students: results,
    });

  } catch (err) {
    console.error("Error fetching students:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

// SSC Syllabus Subjects - Used as the "standardized" subject list
const sscSyllabusSubjects = [
  "Mathematics", "Physics", "Chemistry", "Biology", "English", "Social Studies",
  "Computer Science", "Physical Education", "Art", "Music", "Economics",
  "Geography", "History", "Civics", "Hindi", "Telugu", "Sanskrit", "Urdu",
  "Maths", "Evs", "P.E.T", "Science", "Soical", "Physical Science", "Robotics"
];

// Helper function to standardize a subject name for reliable comparison
const standardizeSubject = (subject) => {
  if (!subject) return null;
  return String(subject).toLowerCase().trim().replace(/[^a-z0-9]/g, '');
};

// Helper function to map teacher designations to subjects
const getSubjectFromDesignation = (designation) => {
  if (!designation) return null;
  
  const designationMap = {
    'maths': 'Maths',
    'mathematics': 'Maths', 
    'telugu': 'Telugu',
    'english': 'English',
    'science': 'Science',
    'physical science': 'Physical Science',
    'social': 'Soical',
    'soical': 'Soical',
    'evs': 'Evs',
    'p.e.t': 'P.E.T',
    'physical education': 'P.E.T',
    'evs': 'EVS'
  };
  
  const standardizedDesignation = standardizeSubject(designation);
  return designationMap[standardizedDesignation] || designation;
};

app.get('/api/class-wise-subjects-without-teachers', async (req, res) => {
  const schoolCode = req.query.schoolCode;

  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  console.log("🏫 Using Database:", schoolCode);

  let connection;

  try {
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();

    const [timetableRows] = await connection.query(`
      SELECT
        class_id, section_id,
        period_1_subject, period_2_subject, period_3_subject,
        period_4_subject, period_5_subject, period_6_subject,
        period_7_subject, period_8_subject, period_9_subject,
        period_10_subject
      FROM UniqueTimetable
    `);

    const [teacherRows] = await connection.query(`
      SELECT
        teaches_to_1, teaches_to_2, teaches_to_3, teaches_to_4,
        teaches_to_5, teaches_to_6, teaches_to_7, teaches_to_8,
        teaches_to_9, teaches_to_10, teaches_to_11, teaches_to_12,
        designation
      FROM management_login_creation
      WHERE user_type = 'teacher'
    `);

    const teacherClassSubjectMap = {};
    
    teacherRows.forEach(teacher => {
      const teacherSubject = getSubjectFromDesignation(teacher.designation);
      if (!teacherSubject) return;
      
      for (let i = 1; i <= 12; i++) {
        const classKey = `teaches_to_${i}`;
        const classId = teacher[classKey];
        
        if (classId && classId !== '') {
          if (!teacherClassSubjectMap[classId]) {
            teacherClassSubjectMap[classId] = {};
          }
          teacherClassSubjectMap[classId][standardizeSubject(teacherSubject)] = true;
        }
      }
    });

    // Standardize SSC Syllabus subjects for comparison
    const standardizedSscSubjects = sscSyllabusSubjects
      .map(standardizeSubject)
      .filter(Boolean);

    const classSectionMap = new Map();

    timetableRows.forEach(row => {
      const classId = row.class_id;
      const sectionId = row.section_id;
      const classKey = `${classId}-${sectionId}`;
      
      const teachersForThisClass = teacherClassSubjectMap[classId] || {};
      
      if (!classSectionMap.has(classKey)) {
        classSectionMap.set(classKey, {
          class: classId,
          section: sectionId,
          uniqueSubjects: new Map()
        });
      }

      const classEntry = classSectionMap.get(classKey);
      const periods = 10;

      for (let i = 1; i <= periods; i++) {
        const periodKey = `period_${i}_subject`;
        const originalSubject = row[periodKey];

        if (originalSubject && originalSubject !== 'Free Period') {
          const standardizedSubject = standardizeSubject(originalSubject);

          if (standardizedSscSubjects.includes(standardizedSubject)) {
            const hasTeacher = teachersForThisClass[standardizedSubject];
            
            if (!hasTeacher) {
              if (!classEntry.uniqueSubjects.has(standardizedSubject)) {
                classEntry.uniqueSubjects.set(standardizedSubject, {
                  subject: originalSubject,
                  class: classId,
                  section: sectionId,
                  periods: [i]
                });
              } else {
                const existingSubject = classEntry.uniqueSubjects.get(standardizedSubject);
                if (!existingSubject.periods.includes(i)) {
                  existingSubject.periods.push(i);
                }
              }
            }
          }
        }
      }
    });

    const finalResult = Array.from(classSectionMap.values()).map(entry => ({
      class: entry.class,
      section: entry.section,
      subjectsWithoutTeacher: Array.from(entry.uniqueSubjects.values()).map(subjectInfo => ({
        subject: subjectInfo.subject,
        class: subjectInfo.class,
        section: subjectInfo.section,
        periods: subjectInfo.periods.sort((a, b) => a - b)
          .map(p => `Period ${p}`)
          .join(', ')
      }))
    }));

    res.json({ 
      result: finalResult,
      debug: {
        teacherMap: teacherClassSubjectMap,
        totalTimetableRows: timetableRows.length,
        totalTeacherRows: teacherRows.length,
        db: schoolCode
      }
    });

  } catch (error) {
    console.error('Database/Processing Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  } 
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
const pdfParse = require('pdf-parse');

// Logic to generate a question when a real one isn't found in the text



app.post('/QuestionPaper', async (req, res) => {
    const { subject, grade, fileCode, topics, selectedQuestionCounts } = req.body;

    try {
        const SYLLABUS_BASE = '/var/www/work/CRM/syllabus';
        const folderPath = path.join(SYLLABUS_BASE, subject, grade);
        const files = fs.readdirSync(folderPath);
        const searchNumber = fileCode.replace(/\s/g, "").replace(/gegp/gi, ""); 
        const targetFile = files.find(f => f.includes(searchNumber) && f.endsWith('.pdf'));

        if (!targetFile) return res.status(404).json({ error: "Source PDF not found" });

        const data = await pdfParse(fs.readFileSync(path.join(folderPath, targetFile)));

        // 🔥 FIX: We now call the function here. This removes the "never read" warning.
        const finalQuestions = extractQuestionsFromText(data.text, topics, selectedQuestionCounts);

        res.json({ success: true, questions: finalQuestions });
    } catch (err) {
        console.error("Server Error:", err);
        res.status(500).json({ error: err.message });
    }
});

function extractQuestionsFromText(text, selectedTopics = [], counts = {}) {
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    const grouped = { 'MCQ': [], 'Short Answer': [], 'Long Answer': [] };

    let isInsideTopic = false;
    let topicContent = "";

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 1. BOUNDARY: Detect Topic Heading
        const headingMatch = line.match(/^(\d+(\.\d+)?)\s+([A-Z].+)$/);
        if (headingMatch) {
            const title = headingMatch[3].trim();
            if (selectedTopics.some(t => title.toLowerCase().includes(t.toLowerCase()))) {
                isInsideTopic = true;
                continue;
            } else if (isInsideTopic && line.match(/^\d+(\.0)?\s+/)) {
                isInsideTopic = false; break; 
            }
        }

        if (isInsideTopic) {
            topicContent += line + " ";

            // 2. EXTRACTION: Catch "1.", "(a)", or "a)"
            const questionMatch = line.match(/^(\d+[.)]|[(][a-d][)]|[a-d][.)])\s*(.+)$/); 

            if (questionMatch) {
                let questionText = questionMatch[2].trim();
                
                // --- JUNK FILTER ---
                // Prevents fragments like "So the n" or "Page 5"
                if (questionText.length < 10 || questionText.includes("Prakash")) continue;

                const options = [];
                for (let j = 1; j <= 4 && i + j < lines.length; j++) {
                    const optMatch = lines[i + j].match(/^[(]([a-d])[)]\s*(.+)$/) || 
                                     lines[i + j].match(/^([a-d])[.)]\s*(.+)$/);
                    if (optMatch) options.push(optMatch[2].trim());
                    else break;
                }

                if (options.length >= 2) {
                    grouped['MCQ'].push({ questionText, options, correct_answer: 0 });
                    i += options.length; 
                } else {
                    const targetType = questionText.length > 80 ? 'Long Answer' : 'Short Answer';
                    grouped[targetType].push({ questionText });
                }
            }
        }
    }

    // 4. GENERATION: Fill the gaps using DYNAMIC MATH OPTIONS
    ['MCQ', 'Short Answer', 'Long Answer'].forEach(type => {
        const target = parseInt(counts[type]) || 0;
        
        while (grouped[type].length < target) {
            if (type === 'MCQ' && grouped['Short Answer'].length > 0) {
                // Take a real math expression found in the PDF
                const item = grouped['Short Answer'].shift();
                
                // 🔥 CALLING THE DYNAMIC GENERATOR HERE
                const rawOptions = generateMathOptions(item.questionText);
                
                // Shuffle so the correct answer isn't always (a)
                const shuffled = [...rawOptions].sort(() => Math.random() - 0.5);

                grouped['MCQ'].push({
                    questionText: `Simplify or identify the correct form of: ${item.questionText}`,
                    options: shuffled,
                    correct_answer: shuffled.indexOf(item.questionText) 
                });
            } else {
                // Fallback to general concept templates
                const gen = generateQuestionsFromText(topicContent, type);
                grouped[type].push({
                    questionText: gen.q || gen,
                    options: gen.options || null,
                    correct_answer: gen.correct !== undefined ? gen.correct : 0
                });
            }
        }
    });

    return finalizeQuestionList(grouped, counts);
}

// Your helper to create math variations
function generateMathOptions(questionText) {
    const original = questionText;
    
    // Distractor 1: Swap signs
    const d1 = original.replace(/\+/g, '___TEMP___').replace(/-/g, '+').replace(/___TEMP___/g, '-');
    
    // Distractor 2: Increment numbers
    const d2 = original.replace(/\d+/g, (n) => parseInt(n) + 2);
    
    // Distractor 3: Simplified logic or variation
    const d3 = original.replace(/\d+/g, (n) => Math.abs(parseInt(n) - 1)) || "None of the above";

    let options = [...new Set([original, d1, d2, d3])];
    while (options.length < 4) {
        options.push(`Expression variant ${options.length + 1}`);
    }
    return options;
}

function generateQuestionsFromText(topicText, type, extractedQuestion = null) {
    const stopWords = ["Friday", "Figure", "Prakash", "Ganita", "Grade", "Example", "Write", "Strike"];
    
    // If we are transforming an existing math problem into an MCQ
    if (type === 'MCQ' && extractedQuestion) {
        const original = extractedQuestion;

        // Generate Dynamic Distractors
        // 1. Swap signs (+ to -, - to +)
        const d1 = original.replace(/\+/g, '___').replace(/-/g, '+').replace(/___/g, '-');
        
        // 2. Change coefficients (e.g., 3a becomes 5a)
        const d2 = original.replace(/\d+/g, (n) => parseInt(n) + 2);
        
        // 3. Common error: combining unlike terms or simplified version
        const d3 = original.includes('(') 
            ? original.replace(/[()]/g, '') // Remove parentheses without distributing
            : original.replace(/\d+/g, (n) => Math.abs(parseInt(n) - 1));

        // Combine, shuffle, and find correct index
        const options = [...new Set([original, d1, d2, d3])];
        while (options.length < 4) options.push("None of the above");
        
        const shuffled = options.sort(() => Math.random() - 0.5);

        return {
            q: `Which of the following is the correct form/evaluation of: ${original}?`,
            options: shuffled,
            correct: shuffled.indexOf(original)
        };
    }

    // Fallback for non-math concepts (Conceptual questions)
    const concepts = topicText.match(/[A-Z][a-z]{5,}/g) || ["mathematical logic"];
    const cleanConcepts = [...new Set(concepts)].filter(c => !stopWords.includes(c));
    const concept = cleanConcepts[Math.floor(Math.random() * cleanConcepts.length)] || "the topic";

    const templates = {
        'MCQ': [
            { 
                q: `What is the primary characteristic of ${concept}?`, 
                options: [`It is a fundamental identity`, `It represents a variable change`, `It is a constant value`, `None of the above`],
                correct: 0 
            }
        ],
        'Short Answer': [`Describe the significance of ${concept} in your own words.`],
        'Long Answer': [`Explain the logical reasoning behind ${concept} with a step-by-step example.`]
    };

    const choice = templates[type][Math.floor(Math.random() * templates[type].length)];
    return type === 'MCQ' ? choice : { q: choice };
}
function finalizeQuestionList(grouped, counts) {
    const finalPaper = [];
    const marks = { 'MCQ': 1, 'Short Answer': 3, 'Long Answer': 5 };

    ['MCQ', 'Short Answer', 'Long Answer'].forEach(type => {
        const selected = shuffleArray(grouped[type]).slice(0, parseInt(counts[type]) || 0);
        if (selected.length > 0) {
            finalPaper.push({ heading: `${type} Questions`, type: 'section' });
            selected.forEach((q, idx) => {
                finalPaper.push({
                    question_no: idx + 1,
                    question_type: type,
                    question_text: q.questionText,
                    options: q.options || null,
                    correct_answer: q.correct_answer,
                    marks: marks[type]
                });
            });
        }
    });
    return finalPaper;
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
/**
 * Finalizes the question paper by selecting the required number of questions 
 * from each category and assigning marks.
 */

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

app.get('/subjects/:classes/:board', async (req, res) => {
  const classLevel = req.params.classes;  // Class level (1 to 10)
  const board = req.params.board; // Board (SSC, CBSE, etc.)
  const schoolCode = req.query.schoolCode; // school code from query ?schoolCode=NOVA

  console.log('--- /subjects API Called ---');
  console.log('Class Level:', classLevel);
  console.log('Board:', board);
  console.log('School Code:', schoolCode);

  // Validate required params
  if (!schoolCode) {
    console.error('❌ Missing school code in query parameters.');
    return res.status(400).json({ error: 'Missing school code in query parameters.' });
  }

  if (isNaN(classLevel) || classLevel < 1 || classLevel > 10) {
    console.error('❌ Invalid class level:', classLevel);
    return res.status(400).json({ error: 'Invalid class level. Please select a class between 1 and 10.' });
  }

  if (!['ssc', 'cbse'].includes(board.toLowerCase())) {
    console.error('❌ Invalid board:', board);
    return res.status(400).json({ error: 'Invalid board. Please select either "ssc" or "cbse".' });
  }

  // Construct SQL query
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

  try {
    console.log('🔗 Connecting to school database:', schoolCode);
    const db = await getDatabaseConnection(schoolCode);
    console.log('✅ Database connection successful.');

    console.log('🧾 Running SQL query for class:', classLevel);
    const [results] = await db.execute(query, Array(10).fill(classLevel));
    console.log('✅ Query executed successfully. Rows fetched:', results.length);

    
    console.log('🔒 Database connection closed.');

    const subjects = results.map(row => row.subject);
    console.log('📚 Subjects:', subjects);

    res.json(subjects);

  } catch (err) {
    console.error('❌ Error fetching subjects:', err.message);
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
});
// Update route with multer

app.delete('/admissions/:id', async (req, res) => {
  const { id } = req.params;
  const { schoolCode } = req.query;

  // Validate required inputs
  if (!schoolCode) {
    return res.status(400).send('schoolCode is required');
  }

  try {
    const db = await getDatabaseConnection(schoolCode);

    // Delete from leads table
    const [result] = await db.query('DELETE FROM leads WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      
      return res.status(404).send('Lead record not found');
    }

    
    res.send('✅ Lead record deleted successfully');
  } catch (err) {
    console.error('Error deleting lead:', err);
    res.status(500).send('❌ Error deleting record');
  }
});

// 🔹 Route to get admission data
app.get("/newadmissions", async (req, res) => {
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: "Missing schoolCode" });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);
    const [rows] = await db.query("SELECT * FROM leads ORDER BY id DESC");
    res.json(rows);
  } catch (error) {
    console.error("Error fetching admissions:", error);
    res.status(500).json({ error: "Database connection failed" });
  }
});
// ✅ API: Get attendance list (by schoolCode + optional leavetype)
app.get("/list-of-irregulars", async (req, res) => {
  const { schoolCode, leavetype } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode is required" });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);

    let sql = "SELECT * FROM attendance_frontend";
    const params = [];

    if (leavetype) {
      sql += " WHERE leavetype = ?";
      params.push(leavetype);
    }

    const [rows] = await db.query(sql, params);
    
    res.json(rows);
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});
// 🔹 API to fetch leave requests
app.get("/leave-requests-list", async (req, res) => {
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: "Missing schoolCode" });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);
    const [rows] = await db.query("SELECT * FROM student_leave_requests ORDER BY id DESC");
    res.json(rows);
  } catch (error) {
    console.error("Error fetching leave requests:", error);
    res.status(500).json({ error: "Failed to fetch leave requests" });
  }
});
// ✅ API: Get list of irregular teachers (absent > 5 days in a month)
app.get("/teacher-list-of-irregulars", async (req, res) => {
  const { schoolCode, month, year } = req.query;

  console.log("🟢 [API CALL] /teacher-list-of-irregulars");
  console.log("➡️ Received query params==========================================:", { schoolCode, month, year });

  if (!schoolCode) {
    console.warn("⚠️ Missing schoolCode in request");
    return res.status(400).json({ error: "schoolCode is required" });
  }

  try {
    console.log("🔗 Connecting to database for school:", schoolCode);
    const db = await getDatabaseConnection(schoolCode);

    // Default to current month/year if not provided
    const currentDate = new Date();
    const selectedMonth = month || currentDate.getMonth() + 1;
    const selectedYear = year || currentDate.getFullYear();

    console.log(`📅 Using Month: ${selectedMonth}, Year: ${selectedYear}`);

    const sql = `
      SELECT 
        m.id AS teacher_id,
        m.name AS teacher_name,
        m.username,
        m.designation,
        COUNT(CASE WHEN t.status = 'absent' THEN 1 END) AS total_absent_days
      FROM management_login_creation m
      LEFT JOIN teachers_attendance t 
        ON m.username = t.username
        AND MONTH(t.date) = ?
        AND YEAR(t.date) = ?
      WHERE m.user_type = 'teacher'
      GROUP BY m.id, m.name, m.username, m.designation
      HAVING total_absent_days > 5
      ORDER BY total_absent_days DESC;
    `;

    console.log("🧠 Executing SQL query...");
    const [rows] = await db.query(sql, [selectedMonth, selectedYear]);
    console.log(`✅ Query successful — ${rows.length} irregular teachers found`);

    
    console.log("🔒 Database connection closed.");

    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching irregulars:", err.message);
    console.error("📛 Stack Trace:", err.stack);
    res.status(500).json({ error: "Server error" });
  }
});
// ✅ API: Get list of latecomer teachers (less than 8 working hours)
app.get("/api/teacher-list-of-latecomers", async (req, res) => {
  const { schoolCode, month, year } = req.query;

  console.log("🟢 [API CALL] /teacher-list-of-latecomers");
  console.log("➡️ Received query params:", { schoolCode, month, year });

  if (!schoolCode) {
    console.warn("⚠️ Missing schoolCode in request");
    return res.status(400).json({ error: "schoolCode is required" });
  }

  try {
    console.log("🔗 Connecting to database for school:", schoolCode);
    const db = await getDatabaseConnection(schoolCode);

    // Default month/year if not provided
    const currentDate = new Date();
    const selectedMonth = month || currentDate.getMonth() + 1;
    const selectedYear = year || currentDate.getFullYear();

    console.log(`📅 Using Month: ${selectedMonth}, Year: ${selectedYear}`);
    console.log("🧠 Executing SQL query for latecomers...");

    const sql = `
      SELECT 
        m.id AS teacher_id,
        m.name AS teacher_name,
        t.date,
        TIME_FORMAT(t.entry_time, '%H:%i') AS entry_time,
        TIME_FORMAT(t.exit_time, '%H:%i') AS exit_time,
        t.working_hours
      FROM management_login_creation m
      LEFT JOIN teachers_attendance t 
        ON m.username = t.username
        AND MONTH(t.date) = ?
        AND YEAR(t.date) = ?
      WHERE m.user_type = 'teacher'
        AND t.entry_time IS NOT NULL 
        AND t.exit_time IS NOT NULL 
        AND t.working_hours < 8
      ORDER BY t.date DESC;
    `;

    const [rows] = await db.query(sql, [selectedMonth, selectedYear]);
    console.log(`✅ Query successful — ${rows.length} latecomers found`);

    
    console.log("🔒 Database connection closed.");

    res.json(rows);
  } catch (error) {
    console.error("❌ Error fetching latecomers:", error.message);
    console.error("📛 Stack Trace:", error.stack);
    res.status(500).json({ error: "Failed to fetch latecomers" });
  }
});

// -----------------------------
// API: Get list of irregular teachers (absent > 5 days in a month)
// -----------------------------
app.get("/teacher-list-of-irregulars-time", async (req, res) => {
  const { schoolCode, month } = req.query;

  if (!schoolCode) return res.status(400).json({ error: "schoolCode is required" });
  if (!month) return res.status(400).json({ error: "month is required in YYYY-MM format" });

  // Extract year and month
  const [selectedYear, selectedMonth] = month.split("-");

  try {
    const db = await getDatabaseConnection(schoolCode);

    const sql = `
      SELECT 
        m.id AS teacher_id,
        m.name AS teacher_name,
        m.username,
        m.designation,
        COUNT(CASE WHEN t.status = 'absent' THEN 1 END) AS total_absent_days
      FROM management_login_creation m
      LEFT JOIN teachers_attendance t 
        ON m.username = t.username
        AND MONTH(t.date) = ?
        AND YEAR(t.date) = ?
      WHERE m.user_type = 'teacher'
      GROUP BY m.id, m.name, m.username, m.designation
      HAVING total_absent_days > 5
      ORDER BY total_absent_days DESC;
    `;

    const [rows] = await db.query(sql, [selectedMonth, selectedYear]);
    

    res.json(rows);
  } catch (err) {
    console.error("Error fetching irregulars:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// -----------------------------
// API: Get list of latecomer teachers (less than 8 working hours)
// -----------------------------
app.get("/teacher-list-of-latecomers-time", async (req, res) => {
  const { schoolCode, month } = req.query;

  if (!schoolCode) return res.status(400).json({ error: "schoolCode is required" });
  if (!month) return res.status(400).json({ error: "month is required in YYYY-MM format" });

  const [selectedYear, selectedMonth] = month.split("-");

  try {
    const db = await getDatabaseConnection(schoolCode);

    const sql = `
      SELECT 
        m.id AS teacher_id,
        m.name AS teacher_name,
        t.date,
        TIME_FORMAT(t.entry_time, '%H:%i') AS entry_time,
        TIME_FORMAT(t.exit_time, '%H:%i') AS exit_time,
        t.working_hours
      FROM management_login_creation m
      LEFT JOIN teachers_attendance t 
        ON m.username = t.username
        AND MONTH(t.date) = ?
        AND YEAR(t.date) = ?
      WHERE m.user_type = 'teacher'
        AND t.entry_time IS NOT NULL 
        AND t.exit_time IS NOT NULL 
        AND t.working_hours < 8
      ORDER BY t.date DESC;
    `;

    const [rows] = await db.query(sql, [selectedMonth, selectedYear]);
    

    res.json(rows);
  } catch (err) {
    console.error("Error fetching latecomers:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 API to fetch leave requests
app.get("/teacher-leave-requests-list", async (req, res) => {
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: "Missing schoolCode" });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);
    const [rows] = await db.query("SELECT * FROM teacher_leave_requests ORDER BY id DESC");
    res.json(rows);
  } catch (error) {
    console.error("Error fetching leave requests:", error);
    res.status(500).json({ error: "Failed to fetch leave requests" });
  }
});
app.get('/admissions', async (req, res) => {
  const schoolCode = req.query.schoolCode;

  if (!schoolCode) {
    return res.status(400).send('schoolCode is required');
  }

  try {
    // Get a connection for the specific school
    const db = await getDatabaseConnection(schoolCode);

    const query = `
     SELECT * FROM leads ORDER BY id DESC
    `;

    // Execute the query using the connection
    const [results] = await db.query(query);

    // Close the connection
    

    res.json(results);
  } catch (err) {
    console.error('Error fetching admissions:', err);
    res.status(500).send('Error fetching data');
  }
});




// Middleware to ensure a database connection is available
const ensureDB = async (req, res, next) => {
  const { schoolCode } = req.body || req.query;
  if (!schoolCode) {
    console.log("⚠️ DB middleware: schoolCode is required");
    return res.status(400).json({ message: "schoolCode is required" });
  }
  try {
    req.db = await getDatabaseConnection(schoolCode);
    next();
  } catch (err) {
    console.error("❌ Error creating database connection:", err);
    res.status(500).json({ message: "Failed to connect to database" });
  }
};

// Helper function to close a database connection
const closeDB = (db) => {
};


// Helper Functions
function normalizeClass(name) {
  if (!name) return "";
  return String(name).trim().toLowerCase().replace(/^class\s*/, "");
}

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
}}

function getAvailableTeacher(periodSubject, assignedTeachers, relevantTeachers) {
  for (const teacherData of relevantTeachers) {
    if (teacherData.subject === periodSubject && !assignedTeachers.has(teacherData.teacher)) {
      return teacherData.teacher;
    }
  }
  return null;
}

async function getTeacherSubjects(db) {
  const sql = `
    SELECT name AS teacher_name, designation AS subject,
           teaches_to_1, teaches_to_2, teaches_to_3, teaches_to_4, teaches_to_5
    FROM management_login_creation
    WHERE user_type = 'teacher';
  `;
  try {
    const [rows] = await db.query(sql);
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

function shuffleArray(array) {
  return array.sort(() => Math.random() - 0.5);
}

function formatTime(minutes) {
  let hours = Math.floor(minutes / 60);
  let mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function calculateEndTime(startTime, duration) {
  let [hours, minutes] = startTime.split(":").map(Number);
  minutes += duration;
  if (minutes >= 60) {
    hours += Math.floor(minutes / 60);
    minutes %= 60;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

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
        startTime: breakStart,
        endTime: breakEnd,
      });
    }
  }
  return timetable;
}

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
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

  `;

  for (let class_id in weeklyTimetable) {
    for (let section in weeklyTimetable[class_id]) {
      for (let day in weeklyTimetable[class_id][section]) {
        const timetable = weeklyTimetable[class_id][section][day];
        if (!timetable || timetable.length === 0) continue;

        const section_id = timetable[0]?.section || "Unknown";

        // Ensure all 10 periods are present, even if "Free Period"
        const formattedTimetable = Array.from({ length: 10 }, (_, i) => ({
          subject: timetable[i]?.subject || "Free Period",
          from_time: timetable[i]?.from_time || "00:00",
          to_time: timetable[i]?.to_time || "00:00"
        }));

        // Flatten the values array correctly
        const values = [
          class_id, section_id, day,
          "09:30 AM",
          lunchBreakTimeMap?.[class_id]?.[section_id]?.[day] || "12:30 PM",
          "03:00 PM", "05:00 PM",
          ...formattedTimetable.flatMap(p => [p.subject, p.from_time, p.to_time])
        ];

        // Log the values array to debug
        console.log("Values array length:", values.length);
        console.log("Values:", values);

        try {
          await db.query(query, values);
        } catch (err) {
          console.error(`❌ Error saving timetable for ${class_id}, Section ${section_id}, Day ${day}:`, err);
          throw err;
        }
      }
    }
  }
}

app.post('/generatetimetable', ensureDB, async (req, res) => {
  const db = req.db;
  try {
    let {
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

    if (!classes || classes.length === 0) {
      return res.status(400).json({ message: "Classes required" });
    }

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const teacherSubjects = await getTeacherSubjects(db);

    if (!teacherSubjects || teacherSubjects.length === 0) {
      return res.status(400).json({ message: "No teacher subjects found" });
    }

    // Add Nursery–UKG
    const nurserySubjects = [
      { class_id: "Nursery", subject: "Telugu", teacher: "Revathi" },
      { class_id: "Nursery", subject: "Maths", teacher: "Satish" },
      { class_id: "Nursery", subject: "Physical Science", teacher: "Reshma" },
      { class_id: "Nursery", subject: "English", teacher: "Madhavi" },
      { class_id: "Nursery", subject: "Social", teacher: "Raghuram" },
      { class_id: "Nursery", subject: "EVS", teacher: "Srinu" },
      { class_id: "Nursery", subject: "Science", teacher: "Ramesh" }
    ];
    const lkgSubjects = [
      { class_id: "LKG", subject: "Telugu", teacher: "Revathi" },
      { class_id: "LKG", subject: "Maths", teacher: "Ramesh" },
      { class_id: "LKG", subject: "Physical Science", teacher: "Reshma" },
      { class_id: "LKG", subject: "English", teacher: "Madhavi" },
      { class_id: "LKG", subject: "Social", teacher: "Raghuram" },
      { class_id: "LKG", subject: "EVS", teacher: "Srinu" },
      { class_id: "LKG", subject: "Science", teacher: "Ramesh" }
    ];
    const ukgSubjects = [
      { class_id: "UKG", subject: "Telugu", teacher: "Revathi" },
      { class_id: "UKG", subject: "Maths", teacher: "Satish" },
      { class_id: "UKG", subject: "Physical Science", teacher: "Reshma" },
      { class_id: "UKG", subject: "English", teacher: "Madhavi" },
      { class_id: "UKG", subject: "Social", teacher: "Raghuram" },
      { class_id: "UKG", subject: "EVS", teacher: "Srinu" },
      { class_id: "UKG", subject: "Science", teacher: "Ramesh" }
    ];
    teacherSubjects.push(...nurserySubjects, ...lkgSubjects, ...ukgSubjects);

    // Classes 1-5
    const class1Subjects = [
      { class_id: 1, subject: "Telugu", teacher: "Revathi" },
      { class_id: 1, subject: "Maths", teacher: "Satish" },
      { class_id: 1, subject: "English", teacher: "Madhavi" },
      { class_id: 1, subject: "EVS", teacher: "Srinu" },
      { class_id: 1, subject: "Rhymes", teacher: "Ramesh" },
      { class_id: 1, subject: "Drawing", teacher: "Reshma" },
      { class_id: 1, subject: "P.E.T", teacher: "Raghuram" }
    ];
    const class2Subjects = [
      { class_id: 2, subject: "Telugu", teacher: "Revathi" },
      { class_id: 2, subject: "Maths", teacher: "Satish" },
      { class_id: 2, subject: "English", teacher: "Madhavi" },
      { class_id: 2, subject: "EVS", teacher: "Srinu" },
      { class_id: 2, subject: "Science", teacher: "Ramesh" },
      { class_id: 2, subject: "Drawing", teacher: "Reshma" },
      { class_id: 2, subject: "P.E.T", teacher: "Raghuram" }
    ];
    const class3Subjects = [
      { class_id: 3, subject: "Telugu", teacher: "Revathi" },
      { class_id: 3, subject: "Maths", teacher: "Satish" },
      { class_id: 3, subject: "Physical Science", teacher: "Reshma" },
      { class_id: 3, subject: "English", teacher: "Madhavi" },
      { class_id: 3, subject: "Social", teacher: "Raghuram" },
      { class_id: 3, subject: "EVS", teacher: "Srinu" },
      { class_id: 3, subject: "Science", teacher: "Ramesh" }
    ];
    const class4Subjects = [
      { class_id: 4, subject: "Telugu", teacher: "Revathi" },
      { class_id: 4, subject: "Maths", teacher: "Satish" },
      { class_id: 4, subject: "Science", teacher: "Ramesh" },
      { class_id: 4, subject: "English", teacher: "Madhavi" },
      { class_id: 4, subject: "Social", teacher: "Raghuram" },
      { class_id: 4, subject: "EVS", teacher: "Srinu" },
      { class_id: 4, subject: "Physical Science", teacher: "Reshma" }
    ];
    const class5Subjects = [
      { class_id: 5, subject: "Telugu", teacher: "Revathi" },
      { class_id: 5, subject: "Maths", teacher: "Satish" },
      { class_id: 5, subject: "Science", teacher: "Suresh" },
      { class_id: 5, subject: "English", teacher: "Madhavi" },
      { class_id: 5, subject: "Social", teacher: "Raghuram" },
      { class_id: 5, subject: "EVS", teacher: "Srinu" },
      { class_id: 5, subject: "Physical Science", teacher: "Reshma" }
    ];

    // Class 6-10 mapping
    const subjectTeacherMap = [
      { subject: "Telugu", teacher: "Revathi" },
      { subject: "Maths", teacher: "Karthik" },
      { subject: "Science", teacher: "Suresh" },
      { subject: "English", teacher: "Madhavi" },
      { subject: "Social", teacher: "Raghuram" },
      { subject: "EVS", teacher: "Srinu" },
      { subject: "P.E.T", teacher: "Ramesh" }
    ];
    teacherSubjects.push(
      ...class1Subjects,
      ...class2Subjects,
      ...class3Subjects,
      ...class4Subjects,
      ...class5Subjects
    );
    for (let classId = 6; classId <= 10; classId++) {
      subjectTeacherMap.forEach(st => {
        teacherSubjects.push({ class_id: classId, subject: st.subject, teacher: st.teacher });
      });
    }

    let weeklyTimetable = {};
    for (const classObj of classes) {
      const { class_name, sections } = classObj;
      weeklyTimetable[class_name] = {};
      const sectionLabels = Array.from({ length: sections }, (_, i) => String.fromCharCode(65 + i));
      const relevantTeachers = teacherSubjects.filter(ts => String(ts.class_id) === String(class_name));
      const uniqueSubjects = [...new Map(
        relevantTeachers
          .filter(ts => ts && ts.subject && ts.teacher)
          .map(ts => [ts.subject, ts])
      ).values()];
      const periodTimes = calculatePeriodTimes(
        startTime, periodDuration, numberOfPeriods,
        morningIntervalDuration, morningIntervalAfter,
        lunchIntervalDuration, lunchIntervalAfter,
        afternoonIntervalDuration, afternoonIntervalAfter
      );
      if (uniqueSubjects.length === 0) {
        console.warn(`⚠️ No subject mapping found for class ${class_name}. Skipping timetable generation for this class.`);
        continue;
      }
      for (const section of sectionLabels) {
        const sectionKey = `Section ${section}`;
        weeklyTimetable[class_name][sectionKey] = {};
        const fixedSubjectForSection = shuffleArray([...uniqueSubjects])[0];
        if (!fixedSubjectForSection) {
          console.warn(`⚠️ No fixed subject found for class ${class_name}, ${sectionKey}. Skipping this section.`);
          continue;
        }
        for (const day of days) {
          weeklyTimetable[class_name][sectionKey][day] = [];
          let dailySubjects = shuffleArray(uniqueSubjects.filter(s => s.subject !== fixedSubjectForSection.subject));
          let subjectIndex = 0;
          for (const slot of periodTimes) {
            if (slot.type === "break") {
              weeklyTimetable[class_name][sectionKey][day].push({
                interval: slot.name, teacher: "N/A",
                from_time: slot.startTime, to_time: slot.endTime, section
              });
              continue;
            }
            let subject, teacher;
            if (slot.period === 1) {
              subject = fixedSubjectForSection.subject;
              teacher = fixedSubjectForSection.teacher;
            } else {
              if (subjectIndex >= dailySubjects.length) {
                dailySubjects = shuffleArray(uniqueSubjects.filter(s => s.subject !== fixedSubjectForSection.subject));
                subjectIndex = 0;
              }
              const subjectEntry = dailySubjects[subjectIndex];
              if (!subjectEntry) {
                subject = fixedSubjectForSection.subject;
                teacher = fixedSubjectForSection.teacher;
              } else {
                subject = subjectEntry.subject;
                teacher = subjectEntry.teacher;
              }
              subjectIndex++;
            }
            weeklyTimetable[class_name][sectionKey][day].push({
              period: slot.period, subject, teacher,
              from_time: slot.startTime, to_time: slot.endTime, section
            });
          }
          if (customActivities && Array.isArray(customActivities)) {
            customActivities.forEach(({ activity, day: actDay, period: actPeriod, className, section }) => {
              const normalizedDay = actDay.charAt(0).toUpperCase() + actDay.slice(1).toLowerCase();
              if (normalizeClass(class_name) === normalizeClass(className) && sectionKey === `Section ${section}` && day === normalizedDay) {
                const slotIndex = weeklyTimetable[class_name][sectionKey][day].findIndex(p => p.period === Number(actPeriod));
                if (slotIndex !== -1) {
                  const randomTeacher = teacherSubjects.length > 0
                    ? teacherSubjects[Math.floor(Math.random() * teacherSubjects.length)].teacher
                    : "Custom";
                  weeklyTimetable[class_name][sectionKey][day][slotIndex].subject = activity;
                  weeklyTimetable[class_name][sectionKey][day][slotIndex].teacher = randomTeacher;
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
          lunchBreakTimeMap[class_id][section][day] = lunchBreak ? lunchBreak.from_time : "12:30 PM";
        }
      }
    }

    await saveWeeklyTimetable(db, weeklyTimetable, lunchBreakTimeMap);
    res.json({ message: "Weekly timetable generated successfully", weeklyTimetable });
  } catch (error) {
    console.error("❌ Error generating timetable:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
});

app.get("/getteacher", ensureDB, async (req, res) => {
  try {
    const sql = `
      SELECT id, name AS teacher_name, designation AS subject,
             teaches_to_1, teaches_to_2, teaches_to_3, teaches_to_4, teaches_to_5
      FROM management_login_creation
      WHERE user_type = 'teacher';
    `;
    const [teachers] = await req.db.query(sql);
    if (!teachers || teachers.length === 0) {
      return res.status(404).json({ message: "No teachers found" });
    }
    res.json(teachers);
  } catch (error) {
    console.error("Error fetching teachers:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.post('/school-init', ensureDB, async (req, res) => {
  try {
    const [tables] = await req.db.query('SHOW TABLES');
    res.json({
      message: `✅ Connected to ${req.body.schoolCode}`,
      tables: tables.map(t => Object.values(t)[0])
    });
  } catch (err) {
    console.error('❌ Error initializing school database:', err.message);
    res.status(500).json({ message: 'Failed to initialize school database', error: err.message });
  }
});





app.post("/api/teachers/getEventsData", async (req, res) => {
  const { schoolCode } = req.body;
  if (!schoolCode) {
    return res.status(400).json({
      status: false,
      message: "schoolCode is required",
    });
  }
  let connection;
  try {
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();
    const [results] = await connection.execute(
      `SELECT * FROM TEACHER_EVENT_DETAILS`
    );
    if (results && results.length > 0) {
      return res.status(200).json({
        status: true,
        message: "Data found successfully",
        data: results,
      });
    } else {
      return res.status(404).json({
        status: false,
        message: "No data found",
        data: [],
      });
    }
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
    });
  } 
});

 
app.get('/api/student-bill-history', async (req, res) => {
  const { schoolCode, studentName, className, section } = req.query;

  if (!schoolCode || !studentName || !className || !section) {
    return res.status(400).json({ error: 'Missing required student details.' });
  }

  let db;
  try {
    db = await getDatabaseConnection(schoolCode);

    // FIX: The SQL query now correctly filters by the student's name, class, and section.
    // Note: We are assuming the student's name column in 'bills_uploads' is 'StudentName'.
    // If it is named something else (e.g., 'student_name'), change it here.
    const sql = `
      SELECT
        image_path,
        receiptNumber
      FROM
        bills_uploads
      WHERE
        regn_no = ?;
    `;

    // The parameters now correctly match the three placeholders (?) in the SQL query.
    const [bills] = await db.query(sql, [studentName, className, section]);

    const formattedBills = bills.map(bill => ({
      image_path: bill.image_path,
      receiptNumber: bill.receiptNumber || 'N/A'
    }));
    console.log(`Found ${formattedBills.length} bills for student ${studentName}. Sending:`, formattedBills);
    res.json(formattedBills);

  } catch (err) {
    console.error("!!! DB ERROR in /api/student-bill-history:", err);
    res.status(500).json({
        error: 'Database query failed for student bill history',
        details: err.message
    });
  } 
});

app.get('/api/receipt-fee-details', async (req, res) => {
  const { schoolCode, receiptNumber } = req.query;

  if (!schoolCode || !receiptNumber) {
    return res.status(400).json({
      error: 'schoolCode and receiptNumber are required'
    });
  }

  let db;
  try {
    db = await getDatabaseConnection(schoolCode);
    const [rows] = await db.query(
      `SELECT *
       FROM FeesDetails
       WHERE receiptNumber = ?
       ORDER BY created_at ASC, id ASC`,
      [receiptNumber]
    );

    return res.json({
      receiptNumber,
      rows
    });
  } catch (err) {
    console.error('Error in /api/receipt-fee-details:', err);
    return res.status(500).json({
      error: 'Failed to fetch receipt fee details',
      details: err.message
    });
  }
});


// =========================================================================== 
 
 app.post("/classes", async (req, res) => {
  const { classesUpTo, schoolCode } = req.body;

  if (!classesUpTo || !schoolCode) {
    return res.status(400).send({ message: "Missing required fields" });
  }

  const db = await getDatabaseConnection(schoolCode);
  const classesCount = parseInt(classesUpTo, 10);
  const values = [];
  for (let i = 1; i <= classesCount; i++) values.push([i]);

  try {
    // ✅ Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        class_number INT NOT NULL
      )
    `);

    // ✅ Clear old classes
    await db.query("DELETE FROM classes");

    // ✅ Insert new classes
    await db.query("INSERT INTO classes (class_number) VALUES ?", [values]);

    res.send({ message: "Classes replaced" });
  } catch (err) {
    console.error("Error inserting classes:", err);
    res.status(500).send(err);
  } 
});
 
 
 
 
 
app.post("/rooms", async (req, res) => {
  const { roomsUpTo, benches, schoolCode } = req.body;

  if (!roomsUpTo || !benches || !schoolCode) {
    return res.status(400).send({ message: "Missing required fields" });
  }

  // Get a connection to the dynamic DB based on schoolCode
  const db = await getDatabaseConnection(schoolCode);

  const roomsCount = parseInt(roomsUpTo, 10);
  const values = [];
  for (let i = 1; i <= roomsCount; i++) values.push([i, benches]);

  try {
    // Create table if it doesn't exist in this DB
    await db.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_number INT NOT NULL,
        benches INT NOT NULL
      )
    `);

    // Delete all existing rooms in this DB
    await db.query("DELETE FROM rooms");

    // Insert new rooms
    await db.query(
      "INSERT INTO rooms (room_number, benches) VALUES " +
      values.map(() => "(?, ?)").join(", "),
      values.flat()
    );

    res.send({ message: "Rooms replaced successfully" });
  } catch (err) {
    res.status(500).send(err);
  } 
}); 
 
 
 
 
 
app.get("/rooms", async (req, res) => {
  const { schoolCode } = req.query;
  const db = await getDatabaseConnection(schoolCode);

  try {
    const [results] = await db.query("SELECT * FROM rooms");
    res.send(results);
  } catch (err) {
    res.status(500).send(err);
  } 
});
 
 
 
 
app.get("/classes", async (req, res) => {
  const { schoolCode } = req.query;
  const db = await getDatabaseConnection(schoolCode);

  try {
    const [results] = await db.query("SELECT * FROM classes");
    res.send(results);
  } catch (err) {
    res.status(500).send(err);
  } 
}); 
 
 
 
 
 
 
 
 
 
 
app.post("/students", async (req, res) => {
  const { name, classNumber, hallTicket, schoolCode } = req.body;

  if (!name || !classNumber || !hallTicket || !schoolCode) {
    return res.status(400).send({ message: "Missing required fields" });
  }

  const db = await getDatabaseConnection(schoolCode);

  try {
    // ✅ Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        class_number INT NOT NULL,
        hall_ticket VARCHAR(50) NOT NULL UNIQUE
      )
    `);

    // ✅ Insert new student
    await db.query(
      "INSERT INTO students (name, class_number, hall_ticket) VALUES (?, ?, ?)",
      [name, classNumber, hallTicket]
    );

    res.send({ message: "Student added" });
  } catch (err) {
    console.error("Error inserting student:", err);
    res.status(500).send(err);
  } 
});
 
 
 
 
 
app.get("/get-room-details/:roomNumber", async (req, res) => {
  const { roomNumber } = req.params;
  const { schoolCode } = req.query;
  const db = await getDatabaseConnection(schoolCode);

  try {
    const [results] = await db.query(
      "SELECT * FROM seat_assignments WHERE roomNumber = ?",
      [roomNumber]
    );
    res.json(results.length > 0 ? results[0] : null);
  } catch (err) {
    res.status(500).send(err);
  } 
});
 
 
 
 
 
 
 
app.post("/assign-seats", async (req, res) => {
  console.log("Incoming request body:", req.body); // Log the entire request body

  const { roomNumber, benchCount, seatA, seatB, seatC, seatingType, selectedPattern, schoolCode } = req.body;

  // Debug: Check which required fields are missing
  if (!roomNumber || !benchCount || !schoolCode) {
    console.log("Validation failed. Missing fields:", {
      roomNumber: !roomNumber ? "Missing" : "Present",
      benchCount: !benchCount ? "Missing" : "Present",
      schoolCode: !schoolCode ? "Missing" : "Present",
    });
    return res.status(400).send({ message: "Missing required fields: roomNumber, benchCount, or schoolCode" });
  }

  let db;
  try {
    console.log("Attempting to connect to database for schoolCode:", schoolCode);
    db = await getDatabaseConnection(schoolCode);
    console.log("Database connection established");

    // Ensure table exists
    console.log("Creating/verifying seat_assignments table");
    await db.query(`
      CREATE TABLE IF NOT EXISTS seat_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        roomNumber INT NOT NULL,
        benchCount INT NOT NULL,
        seatA VARCHAR(20),
        seatB VARCHAR(20),
        seatC VARCHAR(20),
        seatingType VARCHAR(50),
        selectedPattern VARCHAR(50)
      )
    `);
    console.log("Table creation/verification successful");

    // Insert seat assignment
    const sql = `INSERT INTO seat_assignments
      (roomNumber, benchCount, seatA, seatB, seatC, seatingType, selectedPattern)
      VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const values = [roomNumber, benchCount, seatA, seatB, seatC, seatingType, selectedPattern];
    console.log("Executing SQL:", sql, "with values:", values);

    await db.query(sql, values);
    console.log("Seat assignment saved successfully");
    res.status(200).send("Seat assignment saved successfully!");
  } catch (err) {
    console.error("Error details:", err.message, err.stack);
    res.status(500).send(`Error saving seat assignment: ${err.message}`);
  } 
});

 
 
 
app.get("/studentsseat", async (req, res) => {
  console.log("Query params:", req.query); // Log the incoming query params
  const { class: classNumber, schoolCode } = req.query;

  if (!schoolCode) {
    console.log("Missing schoolCode");
    return res.status(400).send({ message: "Missing schoolCode" });
  }

  let db;
  try {
    db = await getDatabaseConnection(schoolCode);
    console.log("Database connection established");

    let sql = "SELECT name, class_name, id FROM management_login_creation WHERE user_type = 'student' ORDER BY class_name, id";
    let params = [];

    if (classNumber) {
      sql = "SELECT name, class_name, id FROM management_login_creation WHERE class_name = ? AND user_type = 'student' ORDER BY id";
      params.push(classNumber);
    }

    console.log("Executing SQL:", sql, "with params:", params);
    const [results] = await db.query(sql, params);
    console.log("Query results:", results);
    res.send(results);
  } catch (err) {
    console.error("Error details:", err.message, err.stack);
    res.status(500).json({ status: false, mess: `Internal Server error: ${err.message}` });
  } 
});

 
 
app.put("/rooms/:roomNumber", async (req, res) => {
  const { roomNumber } = req.params;
  const { benches, schoolCode } = req.body;
  console.log(schoolCode)
  const db = await getDatabaseConnection(schoolCode);

  try {
    await db.query("UPDATE rooms SET benches = ? WHERE room_number = ?", [benches, roomNumber]);
    res.send({ message: "Room benches updated successfully!" });
  } catch (err) {
    res.status(500).json({message:"Error updating benches", error:err.message});
  } 
});
 
app.post("/api/teacherS/saveEvents", async (req, res) => {
  const { name, type, date, imageUrl, description, schoolCode } = req.body;
  let connection;

  try {
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();

    // Create table if not exists
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS TEACHER_EVENT_DETAILS (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        type VARCHAR(255),
        date DATE,
        imageUrl VARCHAR(500),
        description TEXT,
        schoolCode VARCHAR(50)
      )
    `;

    await connection.query(createTableQuery);

    // Insert data
    const insertQuery = `
      INSERT INTO TEACHER_EVENT_DETAILS (name, type, date, imageUrl, description, schoolCode)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await connection.query(insertQuery, [
      name,
      type,
      date,
      imageUrl,
      description,
      schoolCode,
    ]);

    res.status(200).json({ status: "true", message: "Event saved successfully!" });
  } catch (err) {
    console.error("Error saving event:", err);
    res.status(500).json({ status: "false", message: "Internal Server Error" });
  } 
});
app.get('/api/student-leavesapprovalrequest', async (req, res) => {
  // Destructure all expected query parameters
  const { schoolCode, date, class: className, section, status } = req.query;

  // 1. Validate that the required schoolCode was provided.
  if (!schoolCode) {
    return res.status(400).json({ error: 'schoolCode is a required parameter' });
  }

  // Use the provided date or default to today
  const targetDate = date ? date : new Date().toISOString().slice(0, 10);

  let connection;
  try {
    // 2. Get the database connection specific to the school.
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();

    // 3. Start building the SQL query and parameters dynamically
      let sql = `
        SELECT ID, name, class, section, leavetype, submission_time
        FROM attendance_frontend
        WHERE DATE(date) = ?
    `;
    const queryParams = [targetDate];

    // Add class filter if provided
    if (className && className !== 'all') {
      sql += ` AND class = ?`;
      queryParams.push(className);
    }

    // Add section filter if provided
    if (section && section !== 'all') {
      sql += ` AND section = ?`;
      queryParams.push(section);
    }

    // Add status filter if provided
    if (status && status !== 'all') {
      sql += ` AND status = ?`;
      queryParams.push(status);
    }

    sql += ` ORDER BY submission_time DESC`;

    // 4. Execute the final, dynamically built query.
    const [results] = await connection.query(sql, queryParams);
   
    // 5. Send the successful results back to the frontend.
    res.json({
      success: true,
      data: results,
      count: results.length
    });

  } catch (err) {
    // 6. If any error occurs, log it on the server for debugging.
    console.error("Database error in /api/student-leavesapprovalrequest:", err);
   
    // 7. Send a clear error message back to the frontend.
    res.status(500).json({
      success: false,
      error: 'Database query failed while fetching student leave requests.',
      details: err.message
    });
  } 
});
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'public/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log(`[LOG] Created upload directory: ${uploadDir}`);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = uniqueSuffix + path.extname(file.originalname);
    console.log(`[LOG] Generating filename for upload: ${filename}`);
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB

  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      console.log(`[LOG] File accepted: ${file.originalname} (${file.mimetype})`);
      cb(null, true);
    } else {
      console.warn(`[WARN] File rejected: ${file.originalname} (${file.mimetype})`);
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

app.put("/api/profile/users/:id", upload.single("photo"), async (req, res) => {
  const userId = String(req.params.id || "").trim();
  const schoolCode = String(req.query.schoolCode || req.body.schoolCode || "").trim();

  if (!userId) {
    return res.status(400).json({ success: false, message: "User id is required." });
  }

  if (!schoolCode) {
    return res.status(400).json({ success: false, message: "schoolCode is required." });
  }

  try {
    const schoolDb = await getDatabaseConnection(schoolCode);

    await ensureProfileSyncFields(schoolDb);
    await ensureProfileSyncFields(qualityPool);

    const [schoolUserRows] = await schoolDb.query(
      `SELECT id, username, schoolCode
       FROM management_login_creation
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    if (!schoolUserRows.length) {
      return res.status(404).json({ success: false, message: "User not found in school DB." });
    }

    const schoolUser = schoolUserRows[0];

    const nextPhoto =
      req.file
        ? `/uploads/${req.file.filename}`
        : Object.prototype.hasOwnProperty.call(req.body, "photoPath")
          ? normalizeProfileField(req.body.photoPath)
          : Object.prototype.hasOwnProperty.call(req.body, "photo")
            ? normalizeProfileField(req.body.photo)
            : undefined;

    const nextPhone = Object.prototype.hasOwnProperty.call(req.body, "phone_no")
      ? normalizeProfileField(req.body.phone_no)
      : Object.prototype.hasOwnProperty.call(req.body, "phone")
        ? normalizeProfileField(req.body.phone)
        : undefined;

    const updates = {
      gender: Object.prototype.hasOwnProperty.call(req.body, "gender")
        ? normalizeProfileField(req.body.gender)
        : undefined,
      phone_no: nextPhone,
      email: Object.prototype.hasOwnProperty.call(req.body, "email")
        ? normalizeProfileField(req.body.email)
        : undefined,
      photo: nextPhoto,
    };

    const definedEntries = Object.entries(updates).filter(([, value]) => value !== undefined);

    if (!definedEntries.length) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update: gender, phone_no/phone, email, or photo.",
      });
    }

    const setClause = definedEntries.map(([key]) => `\`${key}\` = ?`).join(", ");
    const setValues = definedEntries.map(([, value]) => value);

    await schoolDb.query(
      `UPDATE management_login_creation
       SET ${setClause}
       WHERE id = ?`,
      [...setValues, userId]
    );

    let qualityMatched = 0;
    let qualityUpdated = false;

    if (schoolUser.username) {
      const [qualityMatchRows] = await qualityPool.query(
        `SELECT id
         FROM management_login_creation
         WHERE username = ? AND schoolCode = ?
         LIMIT 1`,
        [schoolUser.username, schoolCode]
      );

      qualityMatched = qualityMatchRows.length;

      if (qualityMatched > 0) {
        await qualityPool.query(
          `UPDATE management_login_creation
           SET ${setClause}
           WHERE username = ? AND schoolCode = ?`,
          [...setValues, schoolUser.username, schoolCode]
        );
        qualityUpdated = true;
      }
    }

    const [updatedSchoolRows] = await schoolDb.query(
      `SELECT id, name, username, gender, phone_no, email, designation, photo, schoolCode
       FROM management_login_creation
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    return res.json({
      success: true,
      message: qualityUpdated
        ? "Profile updated in both school DB and Quality DB."
        : "Profile updated in school DB. Matching Quality DB row was not found.",
      data: updatedSchoolRows[0] || null,
      qualityMatched,
      qualityUpdated,
    });
  } catch (error) {
    console.error("Failed to sync profile update across school DB and Quality DB:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update profile details.",
      error: error.message,
    });
  }
});

const bulkCsvStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'public/uploads/bulk-leads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log(`[LOG] Created upload directory: ${uploadDir}`);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `bulk-${uniqueSuffix}${path.extname(file.originalname) || ".csv"}`;
    cb(null, filename);
  }
});

const uploadCsv = multer({
  storage: bulkCsvStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isCsv =
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.toLowerCase().endsWith(".csv");
    if (isCsv) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"), false);
    }
  }
});

// POST route to insert a report letter
app.post(
  "/report/insert-letter",
  upload.single("letterFile"),
  async (req, res) => {
    try {
      // Log for debugging
      console.log("Received req.body:", req.body);
      console.log("Received req.file:", req.file);

      // Ensure schoolCode exists
      const schoolCode = req.body.schoolCode;
      if (!schoolCode) {
        return res
          .status(400)
          .json({ message: "schoolCode is required in form data" });
      }

      // Get DB connection for this school
      const db = getDatabaseConnection(schoolCode);

      // Extract other fields
      const { classSection, reportDate, reportType, letterType } = req.body;
      const filePath = req.file ? req.file.filename : null;

      // Validate required fields
      if (!classSection || !reportDate || !reportType || !letterType) {
        return res.status(400).json({
          message:
            "classSection, reportDate, reportType, and letterType are required",
        });
      }

      // Insert into report_letters table
      const sql = `
        INSERT INTO report_letters 
        (class_section, report_date, report_type, letter_type, file_path)
        VALUES (?, ?, ?, ?, ?)
      `;
      const [result] = await db.execute(sql, [
        classSection,
        reportDate,
        reportType,
        letterType,
        filePath,
      ]);

      res.json({
        message: "Letter submitted successfully",
        id: result.insertId,
        uploadedFile: filePath,
      });
    } catch (err) {
      console.error("❌ Error inserting report letter:", err);
      res.status(500).json({ message: "Database Error", error: err.message });
    }
  }
);
app.put(
  '/admissions/:id',
  upload.fields([
    { name: 'student_photo', maxCount: 1 },
    { name: 'tc_document', maxCount: 1 },
    { name: 'aadhar_document', maxCount: 1 },
    { name: 'dob_document', maxCount: 1 },
    { name: 'appeared_document', maxCount: 1 },
    { name: 'father_id', maxCount: 1 },
    { name: 'mother_id', maxCount: 1 },
    { name: 'address_proof', maxCount: 1 },
  ]),
  async (req, res) => {
    const { id } = req.params;
    const { schoolCode } = req.query;

    if (!schoolCode) return res.status(400).send('schoolCode is required');

    try {
      const db = await getDatabaseConnection(schoolCode);

      const updatedData = { ...req.body };

      // --- 1️⃣ Convert date fields to MySQL format ---
      const dateFields = ['dob', 'date', 'test_date', 'counselling_date'];
      dateFields.forEach((field) => {
        if (updatedData[field]) {
          // Convert ISO string to YYYY-MM-DD
          updatedData[field] = updatedData[field].includes('T')
            ? updatedData[field].split('T')[0]
            : updatedData[field];
        } else {
          // Use null for empty dates
          updatedData[field] = null;
        }
      });

      // --- 2️⃣ Handle uploaded files ---
      if (req.files) {
        Object.keys(req.files).forEach((field) => {
          if (req.files[field][0]) {
            updatedData[field] = `/uploads/${req.files[field][0].filename}`;
          }
        });
      }

      // --- 3️⃣ Clean empty strings to null for MySQL ---
      Object.keys(updatedData).forEach((key) => {
        if (updatedData[key] === '') updatedData[key] = null;
      });

      // --- 4️⃣ Build dynamic SQL safely ---
      const fields = Object.keys(updatedData).map((k) => `${k} = ?`).join(', ');
      const values = Object.values(updatedData);

      if (fields) {
        const query = `UPDATE leads SET ${fields} WHERE id = ?`;
        await db.query(query, [...values, id]);
      }

      
      res.send('✅ Admission record updated successfully');
    } catch (err) {
      console.error('Error updating admission:', err);
      res.status(500).send('❌ Error updating record');
    }
  }
);



// File fields to upload
const fileFields = [
  { name: 'tc_document', maxCount: 1 },
  { name: 'aadhar_document', maxCount: 1 },
  { name: 'dob_document', maxCount: 1 },
  { name: 'appeared_document', maxCount: 1 },
  { name: 'father_id', maxCount: 1 },
  { name: 'mother_id', maxCount: 1 },
  { name: 'address_proof', maxCount: 1 },
];
app.post('/enrollment', upload.fields(fileFields), async (req, res) => {
  try {
    console.log("========== /enrollment API CALLED ==========");

    console.log("Raw req.body:", req.body);
    console.log("Raw req.files:", req.files);

    const data = req.body;
    const files = req.files || {};
    const schoolCode = data.schoolCode;

    console.log("SchoolCode received:", schoolCode);

    if (!schoolCode) {
      console.error("❌ School code missing in request");
      return res.status(400).json({ error: 'School code is required' });
    }

    const db = await getDatabaseConnection(schoolCode);
    console.log(`✅ Connected to DB for school: ${schoolCode}`);

    // ---------- Handle files safely ----------
    const fileData = {};
    if (files && fileFields) {
      fileFields.forEach(field => {
        if (files[field.name] && files[field.name][0]) {
          fileData[field.name] = files[field.name][0].filename;
          console.log(`File received for ${field.name}:`, fileData[field.name]);
        }
      });
    }

    const leadId = data.id;
    console.log("Lead ID received:", leadId);

    // ---------- Common field mapping ----------
    const mappedData = {
      student_name: data.first_name || null,
      last_name: data.last_name || null,
      full_name: data.father_name || null,
      mother_name: data.mother_name || null,
      dob: data.dob || null,
      blood_group: data.blood_group || null,
      lead_admission_for: data.admission_for || null,
      branch: data.branch || null,
      address: data.address || null,
      ...fileData
    };

    console.log("Mapped data to save:", mappedData);

    let savedLeadId;

    if (leadId) {
      // ---------- UPDATE ----------
      console.log("🔄 Updating existing lead...");

      const [updateResult] = await db.query(
        'UPDATE leads SET ? WHERE id = ?',
        [mappedData, leadId]
      );

      console.log("Update result:", updateResult);

      savedLeadId = leadId;
    } else {
      // ---------- INSERT ----------
      console.log("🆕 Inserting new lead...");

      const insertData = {
        ...mappedData,
        entry_type: 'manual'
      };

      const [insertResult] = await db.query(
        'INSERT INTO leads SET ?',
        insertData
      );

      console.log("Insert result:", insertResult);

      savedLeadId = insertResult.insertId;
    }

    // ---------- FETCH THE SAVED ROW ----------
    console.log("📥 Fetching saved lead from DB, ID:", savedLeadId);

    const [rows] = await db.query(
      'SELECT * FROM leads WHERE id = ?',
      [savedLeadId]
    );

    if (!rows.length) {
      console.error("❌ Lead not found after save!");
      return res.status(500).json({ error: "Lead saved but not found" });
    }

    const savedLead = rows[0];
    console.log("✅ Final saved lead data:", savedLead);

    // ---------- SEND FULL DATA TO FRONTEND ----------
    return res.json({
      message: leadId ? "Lead updated successfully" : "Lead inserted successfully",
      lead: savedLead
    });

  } catch (err) {
    console.error("🔥 Error in /enrollment API:", err);
    return res.status(500).json({ error: err.message });
  }
});



function generateNumbers() {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 90000) + 10000;
  return {
    reg_no: `REG${year}${random}`,
    ticket_no: `TIC${year}${random}`,
  };
}
app.post("/api/send-poster-email", async (req, res) => {
  const { reg_no, email } = req.body;
  if (!reg_no || !email) return res.status(400).json({ error: "Missing parameters" });

  const posterPath = path.join(__dirname, "../public/posters", `school_poster_${reg_no}.png`);

  try {
    await sendWelcomeEmail(email, { posterPath }); // Your existing function
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to send email" });
  }
});
function scheduleDailyPoster(schoolCode, mobile_number, posterData) {
  let dayCount = 0;
  const waNumber = formatMobileForWhatsapp(mobile_number) || mobile_number;

  console.log(`[CRON] Daily poster scheduled for ${waNumber} at 09:30 Asia/Kolkata (30 days)`);

  // Schedule job every day at 9:30 AM
  const task = cron.schedule("30 9 * * *", async () => {
    try {
      console.log(`[CRON] Poster job tick ${new Date().toISOString()} for ${waNumber} (day ${dayCount + 1})`, {
        schoolCode
      });
      if (dayCount >= 30) {
        task.stop(); // stop after 30 days
        console.log(`✅ 30-day poster schedule completed for ${waNumber}`);
        return;
      }

      const school = await getSchoolDetails(schoolCode);
      const photoPath = getSchoolPhotoForDay(dayCount);
      const posterPath = photoPath || await generatePoster(posterData, school);

      const result = await sendPosterViaWhatsappBridge(schoolCode, waNumber, posterPath);
      console.log("[WA-POSTER] Sent", {
        schoolCode,
        waNumber,
        day: dayCount + 1,
        result
      });

      dayCount++;

    } catch (err) {
      console.error("❌ Failed to send daily poster:", {
        schoolCode,
        waNumber,
        error: err?.message || err
      });
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" // your timezone
  });

  task.start();
}
function scheduleDailyEmail(toEmail, lead, school) {
  let dayCount = 0;

  const task = cron.schedule("30 9 * * *", async () => { // Every day 9:30 AM
    try {
      if (dayCount >= 30) {
        task.stop();
        return;
      }

      const photoPath = getSchoolPhotoForDay(dayCount);
      if (photoPath) {
        await sendSchoolPhotoEmail(toEmail, school, photoPath);
      } else {
        await sendWelcomeEmail(toEmail, lead, school);
      }

      dayCount++;
    } catch (err) {
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  task.start();
}
const formatMobileForWhatsapp = (num) => {
  const cleaned = String(num || "").replace(/\D/g, "");
  if (!cleaned) return "";
  if (cleaned.length === 10) return `91${cleaned}`;
  if (cleaned.length === 12 && cleaned.startsWith("91")) return cleaned;
  if (cleaned.length === 11 && cleaned.startsWith("0")) return `91${cleaned.slice(-10)}`;
  if (cleaned.length > 10) {
    const lastTen = cleaned.slice(-10);
    if (lastTen.length === 10) return `91${lastTen}`;
  }
  return cleaned;
};

function getAutoImageRotationAnchor(now = new Date()) {
  const anchor = new Date(now);
  anchor.setHours(AUTO_IMAGE_ROTATION_START_HOUR, AUTO_IMAGE_ROTATION_START_MINUTE, 0, 0);
  if (now < anchor) {
    anchor.setDate(anchor.getDate() - 1);
  }
  return anchor;
}

function getAutoImageRotationItems(items, now = new Date()) {
  const list = Array.isArray(items) ? items : [];
  const anchor = getAutoImageRotationAnchor(now);
  const anchorKey = getKolkataDateKey(anchor);
  const windowItems = list.filter((item) => {
    const itemKey = getKolkataDateKey(item?.uploaded_at || now);
    if (!itemKey || !anchorKey) return false;
    const dayDiff = getDaysBetweenDateKeys(itemKey, anchorKey);
    return dayDiff >= 0 && dayDiff < AUTO_IMAGE_ROTATION_WINDOW_DAYS;
  });
  const sourceItems = windowItems.length > 0 ? windowItems : list;
  const newestBatch = [...sourceItems]
    .sort((a, b) => {
      const aTime = new Date(a?.uploaded_at || 0).getTime();
      const bTime = new Date(b?.uploaded_at || 0).getTime();
      return bTime - aTime;
    })
    .slice(0, AUTO_IMAGE_ROTATION_BATCH_LIMIT)
    .sort((a, b) => {
      const aTime = new Date(a?.uploaded_at || 0).getTime();
      const bTime = new Date(b?.uploaded_at || 0).getTime();
      return aTime - bTime;
    });

  if (newestBatch.length === 0) return [];

  return [...newestBatch]
    .sort((a, b) => {
      const aTime = new Date(a?.uploaded_at || 0).getTime();
      const bTime = new Date(b?.uploaded_at || 0).getTime();
      return bTime - aTime;
    })
    .slice(0, AUTO_IMAGE_ROTATION_ITEMS_PER_DAY * AUTO_IMAGE_ROTATION_WINDOW_DAYS);
}

function getConnectedWhatsAppState(schoolCode) {
  const primaryKey = sanitizeDbName(schoolCode);
  const keyVariants = Array.from(
    new Set(
      [
        primaryKey,
        sanitizeDbName(String(schoolCode || "").replace(/_/g, " ")),
        sanitizeDbName(String(schoolCode || "").replace(/\s+/g, "")),
        sanitizeDbName(String(schoolCode || "").replace(/_/g, "")),
      ].filter(Boolean)
    )
  );

  let clientKey = "";
  let clientState = null;
  for (const key of keyVariants) {
    if (global.whatsappClients?.[key]?.client) {
      clientKey = key;
      clientState = global.whatsappClients[key];
      break;
    }
  }

  if (!clientState?.client && global.whatsappClients) {
    const normalizedRequested = primaryKey.replace(/_/g, "");
    const matchedKey = Object.keys(global.whatsappClients).find(
      (key) => key.replace(/_/g, "") === normalizedRequested
    );
    if (matchedKey) {
      clientKey = matchedKey;
      clientState = global.whatsappClients[matchedKey];
    }
  }

  return { clientKey, clientState };
}

const normalizeLeadMobile = (num) => {
  const cleaned = String(num || "").replace(/\D/g, "");
  if (!cleaned) return "";
  if (cleaned.length === 12 && cleaned.startsWith("91")) return cleaned.slice(-10);
  if (cleaned.length === 11 && cleaned.startsWith("0")) return cleaned.slice(-10);
  if (cleaned.length > 10) return cleaned.slice(-10);
  return cleaned;
};

const normalizeLeadComparableText = (value) =>
  String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

const normalizeLeadComparableDate = (value) =>
  String(value ?? "").trim().slice(0, 10);

const findExactLeadDuplicate = async (db, payload) => {
  const normalizedMobile = normalizeLeadMobile(payload.mobile_number);
  const mobileClause = normalizedMobile
    ? `(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(mobile_number, ''), '+', ''), '-', ''), ' ', ''), '(', ''), ')', '') = ?
        OR RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(mobile_number, ''), '+', ''), '-', ''), ' ', ''), '(', ''), ')', ''), 10) = ?
      )`
    : "1=1";

  const exactMatchSql = `
    SELECT
      id,
      full_name,
      student_name,
      mobile_number,
      email_id,
      address,
      lead_admission_for,
      entry_type,
      refer_by
    FROM leads
    WHERE LOWER(TRIM(COALESCE(full_name, ''))) = ?
      AND LOWER(TRIM(COALESCE(student_name, ''))) = ?
      AND LOWER(TRIM(COALESCE(email_id, ''))) = ?
      AND LOWER(TRIM(COALESCE(address, ''))) = ?
      AND LOWER(TRIM(COALESCE(lead_admission_for, ''))) = ?
      AND LOWER(TRIM(COALESCE(entry_type, 'manual'))) = ?
      AND ${mobileClause}
    ORDER BY id DESC
    LIMIT 1
  `;

  const queryParams = [
    normalizeLeadComparableText(payload.full_name),
    normalizeLeadComparableText(payload.student_name),
    normalizeLeadComparableText(payload.email_id),
    normalizeLeadComparableText(payload.address),
    normalizeLeadComparableText(payload.lead_admission_for),
    normalizeLeadComparableText(payload.entry_type || "manual"),
  ];

  if (normalizedMobile) {
    queryParams.push(normalizedMobile, normalizedMobile);
  }

  const [rows] = await db.query(exactMatchSql, queryParams);

  return rows[0] || null;
};

const maskMobile = (num) => {
  const digits = String(num || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 4) return digits;
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
};

const runAsync = (label, fn) => {
  Promise.resolve()
    .then(fn)
    .catch((err) => console.error(`[${label}]`, err?.message || err));
};

// Bridge WhatsApp sending to the dedicated WhatsApp server (crmbackend).
// The WhatsApp session lives in that process, not in this API process.
const WHATSAPP_BRIDGE_HOST = process.env.WHATSAPP_BRIDGE_HOST || "127.0.0.1";
const WHATSAPP_BRIDGE_PORT = Number(process.env.WHATSAPP_BRIDGE_PORT || 3020);
const WHATSAPP_BRIDGE_TIMEOUT_MS = Number(process.env.WHATSAPP_BRIDGE_TIMEOUT_MS || 30000);

const postJsonToWhatsappBridge = (pathName, payload) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify(payload || {});
    console.log("[WA-BRIDGE] Request", {
      path: pathName,
      host: WHATSAPP_BRIDGE_HOST,
      port: WHATSAPP_BRIDGE_PORT,
      payloadKeys: Object.keys(payload || {})
    });
    const req = https.request(
      {
        hostname: WHATSAPP_BRIDGE_HOST,
        port: WHATSAPP_BRIDGE_PORT,
        method: "POST",
        path: pathName,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: WHATSAPP_BRIDGE_TIMEOUT_MS,
        rejectUnauthorized: false, // bridge cert may not match localhost
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let parsed = {};
          try {
            parsed = data ? JSON.parse(data) : {};
          } catch (_) {
            // keep parsed as {}
          }

          if (res.statusCode && res.statusCode >= 400) {
            const msg = parsed?.message || parsed?.error || `WhatsApp bridge HTTP ${res.statusCode}`;
            const err = new Error(msg);
            err.statusCode = res.statusCode;
            err.response = parsed;
            console.error("[WA-BRIDGE] Error response", {
              path: pathName,
              statusCode: res.statusCode,
              message: msg
            });
            return reject(err);
          }

          console.log("[WA-BRIDGE] Response OK", {
            path: pathName,
            statusCode: res.statusCode
          });
          return resolve(parsed);
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("WhatsApp bridge timeout")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });

const sendPosterViaWhatsappBridge = async (schoolCode, number, posterPath) => {
  console.log("[WA-POSTER] Bridge send requested", {
    schoolCode,
    numberPreview: number ? String(number).slice(-4) : null,
    posterPath
  });

  const payload = {
    schoolCode,
    schoolId: schoolCode,
    number,
    phone: number,
    mobile: number,
    posterPath,
    imagePath: posterPath,
    mediaPath: posterPath,
    filePath: posterPath,
  };

  const candidatePaths = [
    "/api/whatsapp/send-poster",
    "/api/whatsapp/send-messagewhatsapp",
    "/api/whatsapp/send-image",
    "/api/whatsapp/send-media",
    "/whatsapp/send-poster",
    "/whatsapp/send-messagewhatsapp",
    "/whatsapp/send-image",
    "/whatsapp/send-media"
  ];

  let lastErr;
  for (const pathName of candidatePaths) {
    try {
      const response = await postJsonToWhatsappBridge(pathName, payload);
      console.log("[WA-POSTER] Bridge send success", {
        schoolCode,
        numberPreview: number ? String(number).slice(-4) : null,
        path: pathName
      });
      return response;
    } catch (err) {
      lastErr = err;
      if (Number(err?.statusCode || 0) === 404) {
        console.warn("[WA-POSTER] Bridge endpoint not found, trying next", {
          path: pathName
        });
        continue;
      }
      console.error("[WA-POSTER] Bridge send failed", {
        path: pathName,
        error: err?.message || err
      });
      throw err;
    }
  }
  throw lastErr || new Error("No supported WhatsApp media endpoint found on bridge");
};

const sendTextViaWhatsappBridge = async (schoolCode, number, message) => {
  const payload = {
    schoolId: schoolCode,
    schoolCode,
    number,
    message: message || ""
  };
  const candidatePaths = [
    "/api/whatsapp/send-messagetext",
    "/whatsapp/send-messagetext"
  ];

  let lastErr;
  for (const pathName of candidatePaths) {
    try {
      const response = await postJsonToWhatsappBridge(pathName, payload);
      console.log("[WA-TEXT] Bridge send success", {
        schoolCode,
        numberPreview: number ? String(number).slice(-4) : null,
        path: pathName
      });
      return response;
    } catch (err) {
      lastErr = err;
      if (Number(err?.statusCode || 0) === 404) {
        console.warn("[WA-TEXT] Bridge endpoint not found, trying next", {
          path: pathName
        });
        continue;
      }
      console.error("[WA-TEXT] Bridge send failed", {
        path: pathName,
        error: err?.message || err
      });
      throw err;
    }
  }
  throw lastErr || new Error("No supported WhatsApp text endpoint found on bridge");
};

app.post("/api/posters/send-generated", async (req, res) => {
  try {
    const { schoolCode, leads, sendDate, sendTime, sendAt, galleryTarget, whatsappGapMinutes } = req.body || {};
    console.log("[POSTER-BATCH] Incoming request", {
      schoolCode,
      leadCount: Array.isArray(leads) ? leads.length : 0,
      sendDate,
      sendTime,
      sendAt,
      whatsappGapMinutes,
      leadPreview: Array.isArray(leads)
        ? leads.slice(0, 3).map((lead) => ({
            id: lead?.id ?? null,
            name: lead?.full_name ?? lead?.student_name ?? lead?.lead_name ?? null,
            mobile: lead?.mobile_number ?? null
          }))
        : []
    });
    if (!schoolCode) {
      return res.status(400).json({ error: "schoolCode required" });
    }
    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: "leads required" });
    }

    let finalDate = String(sendDate || "").trim();
    let finalTime = String(sendTime || "").trim();
    if (!finalTime && sendAt) {
      const [atDateRaw, atTimeRaw] = String(sendAt).split("T");
      if (!finalDate && atDateRaw) finalDate = atDateRaw.trim();
      if (atTimeRaw) finalTime = atTimeRaw.slice(0, 8).trim();
    }
    if (finalTime && /^\d{2}:\d{2}$/.test(finalTime)) {
      finalTime = `${finalTime}:00`;
    }
    if (finalTime && !/^\d{2}:\d{2}:\d{2}$/.test(finalTime)) {
      return res.status(400).json({ error: "Invalid send time format" });
    }
    if (finalDate && !/^\d{4}-\d{2}-\d{2}$/.test(finalDate)) {
      return res.status(400).json({ error: "Invalid send date format" });
    }

    const { school, db } = await resolveSchoolDatabaseOrThrow(schoolCode);
    await ensureScheduledMessageColumns(db);
    const normalizedGalleryTarget =
      String(galleryTarget || "digital").trim().toLowerCase() === "staff"
        ? "staff"
        : "digital";
    const posterMessage =
      normalizedGalleryTarget === "staff"
        ? "Daily poster from Campaigning Staff - Gallery"
        : "Daily poster from Campaigning Digital - Gallery";

    const galleryBatchSize = DAILY_LEAD_SEND_LIMIT;
    const normalizedLeads = Array.isArray(leads) ? leads.filter(Boolean) : [];
    if (normalizedLeads.length === 0) {
      return res.status(400).json({ error: "leads required" });
    }

    if (!global.posterBatchOffsets) {
      global.posterBatchOffsets = {};
    }
    const offsetKey = String(schoolCode || "").trim();
    const currentOffset = Number(global.posterBatchOffsets[offsetKey] || 0);
    let batchSize = Math.min(galleryBatchSize, normalizedLeads.length);
    const start = currentOffset % normalizedLeads.length;
    const end = start + batchSize;
    let selectedLeads =
      end <= normalizedLeads.length
        ? normalizedLeads.slice(start, end)
        : normalizedLeads.slice(start).concat(normalizedLeads.slice(0, end - normalizedLeads.length));

    global.posterBatchOffsets[offsetKey] = (start + batchSize) % normalizedLeads.length;

    console.log("[POSTER-BATCH] Selected batch", {
      schoolCode,
      totalLeads: normalizedLeads.length,
      batchSize,
      start,
      end,
      selectedCount: selectedLeads.length,
      selectedPreview: selectedLeads.slice(0, 5).map((lead) => ({
        id: lead?.id ?? null,
        name: lead?.full_name ?? lead?.student_name ?? lead?.lead_name ?? null,
        mobile: lead?.mobile_number ?? null
      }))
    });

    const parsedGap = Number(whatsappGapMinutes);
    const whatsappGapMins =
      Number.isFinite(parsedGap) && parsedGap >= 0
        ? Math.floor(parsedGap)
        : DEFAULT_WHATSAPP_POSTER_GAP_MINUTES;
    const dailySendDate = finalDate || getKolkataDateKey();
    const dailyUsedCount = await getCampaignWhatsAppUsageForDate(db, dailySendDate);
    const dailyRemainingCount = Math.max(0, DAILY_LEAD_SEND_LIMIT - dailyUsedCount);
    if (dailyRemainingCount <= 0) {
      return res.status(429).json({
        error: `Daily WhatsApp limit of ${DAILY_LEAD_SEND_LIMIT} has already been reached for ${dailySendDate}.`
      });
    }
    if (selectedLeads.length > dailyRemainingCount) {
      selectedLeads = selectedLeads.slice(0, dailyRemainingCount);
      batchSize = selectedLeads.length;
    }
    global.posterBatchOffsets[offsetKey] = (start + batchSize) % normalizedLeads.length;
    const scheduleFromTime = finalTime || null;
    const scheduleToTime = finalTime || null;
    console.log("[POSTER-BATCH][GAP] Effective settings", {
      schoolCode,
      dailyLimit: DAILY_LEAD_SEND_LIMIT,
      whatsappGapMins,
      baseSendTime: finalTime,
      batchCount: selectedLeads.length
    });

    let sent = 0;
    let failed = 0;
    let scheduled = 0;
    const errors = [];

    console.log("[POSTER-BATCH] Rotating poster batch", {
      schoolCode,
      totalLeads: normalizedLeads.length,
      batchSize,
      start,
      nextOffset: global.posterBatchOffsets[offsetKey]
    });

    for (const [leadIndex, lead] of selectedLeads.entries()) {
      try {
        const posterPath = await generatePoster(lead, school);
        const waNumber =
          formatMobileForWhatsapp(lead.mobile_number) || lead.mobile_number;
        if (!waNumber) {
          throw new Error("mobile_number missing");
        }

        if (finalDate && finalTime) {
          const staggeredTime = addMinutesToSendTime(finalTime, leadIndex * whatsappGapMins);
          console.log("[POSTER-BATCH][GAP] Queue row", {
            schoolCode,
            leadId: lead?.id || null,
            date: finalDate,
            leadIndex,
            baseTime: finalTime,
            computedTime: staggeredTime
          });
          await db.execute(
            `INSERT INTO scheduled_messages
             (lead_id, phone, email, channel, message, send_date, send_time, sent, media_path, schedule_from_time, schedule_to_time)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
            [
              lead?.id || null,
              lead.mobile_number || null,
              lead.email_id || null,
              "whatsapp",
              posterMessage,
              finalDate,
              staggeredTime,
              posterPath,
              scheduleFromTime,
              scheduleToTime
            ]
          );
          scheduled += 1;
        } else {
          await sendPosterViaWhatsappBridge(schoolCode, waNumber, posterPath);
          const nowInKolkata = new Date(
            new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
          );
          const yyyy = nowInKolkata.getFullYear();
          const mm = String(nowInKolkata.getMonth() + 1).padStart(2, "0");
          const dd = String(nowInKolkata.getDate()).padStart(2, "0");
          const hh = String(nowInKolkata.getHours()).padStart(2, "0");
          const mi = String(nowInKolkata.getMinutes()).padStart(2, "0");
          const ss = String(nowInKolkata.getSeconds()).padStart(2, "0");
          await db.execute(
            `INSERT INTO scheduled_messages
             (lead_id, phone, email, channel, message, send_date, send_time, sent, email_sent, whatsapp_sent, media_path, schedule_from_time, schedule_to_time)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 1, ?, ?, ?)`,
            [
              lead?.id || null,
              lead.mobile_number || null,
              lead.email_id || null,
              "whatsapp",
              posterMessage,
              `${yyyy}-${mm}-${dd}`,
              `${hh}:${mi}:${ss}`,
              posterPath,
              scheduleFromTime || sendTime || null,
              scheduleToTime || null
            ]
          );
          sent += 1;
        }
      } catch (err) {
        failed += 1;
        errors.push({
          lead: lead?.full_name || lead?.reg_no || "unknown",
          error: err?.message || String(err)
        });
      }
    }

    return res.json({
      sent,
      failed,
      scheduled,
      totalLeads: normalizedLeads.length,
      batchSize,
      batchStart: start,
      batchSizeRequested: galleryBatchSize,
      sendDate: finalDate || null,
      sendTime: finalTime || null,
      whatsappGapMinutes: whatsappGapMins,
      errors
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Failed to send posters" });
  }
});

const ensureWhatsAppSession = (schoolCode) =>
  new Promise((resolve, reject) => {
    if (sessions[schoolCode]) return resolve(sessions[schoolCode]);
    createSession(schoolCode, (err, client) => {
      if (err) return reject(err);
      resolve(client);
    });
  });

const waitForWhatsAppReady = async (schoolCode, timeoutMs = 30000) => {
  if (readySessions[schoolCode]) return true;
  const client = await ensureWhatsAppSession(schoolCode);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    const onReady = () => {
      cleanup();
      resolve(true);
    };
    const onDisconnected = () => {
      cleanup();
      resolve(false);
    };
    const cleanup = () => {
      clearTimeout(timer);
      client.off("ready", onReady);
      client.off("disconnected", onDisconnected);
    };

    client.on("ready", onReady);
    client.on("disconnected", onDisconnected);
  });
};

let sendPosterRaw;
try {
  const external = require("/var/www/cleezoclass/WhatsappBackend");
  sendPosterRaw = external?.sendPoster;
} catch (err) {
  console.warn("[WA] External sendPoster not available:", err?.message || err);
  sendPosterRaw = undefined;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const resolvePosterPath = (posterPath) => {
  if (!posterPath) return "";
  const asString = String(posterPath);
  return path.isAbsolute(asString) ? asString : path.resolve(asString);
};

function ensureWhatsAppAckLogging(clientState, schoolCode, recipientNumber) {
  if (!clientState?.client || clientState.__autoImageAckLoggerAttached) return;
  clientState.__autoImageAckLoggerAttached = true;

  clientState.client.on("message_ack", (message, ack) => {
    const messageId = message?.id?._serialized || message?.id || null;
    const fromMe = Boolean(message?.fromMe);
    const chatId = String(message?.to || message?.from || message?.chatId || "").trim();
    console.log("[AUTO-IMAGE][ack]", {
      schoolCode,
      recipientNumber,
      messageId,
      ack,
      fromMe,
      chatId: chatId || null,
    });
  });
}

async function sendPosterViaConnectedWhatsApp(schoolCode, mobileNumber, posterPath) {
  const primaryKey = sanitizeDbName(schoolCode);
  const keyVariants = Array.from(
    new Set(
      [
        primaryKey,
        sanitizeDbName(String(schoolCode || "").replace(/_/g, " ")),
        sanitizeDbName(String(schoolCode || "").replace(/\s+/g, "")),
        sanitizeDbName(String(schoolCode || "").replace(/_/g, "")),
      ].filter(Boolean)
    )
  );

  let clientKey = "";
  let clientState = null;
  for (const key of keyVariants) {
    if (global.whatsappClients?.[key]?.client) {
      clientKey = key;
      clientState = global.whatsappClients[key];
      break;
    }
  }
  if (!clientState?.client && global.whatsappClients) {
    const normalizedRequested = primaryKey.replace(/_/g, "");
    const matchedKey = Object.keys(global.whatsappClients).find(
      (key) => key.replace(/_/g, "") === normalizedRequested
    );
    if (matchedKey) {
      clientKey = matchedKey;
      clientState = global.whatsappClients[matchedKey];
    }
  }

  if (!clientState?.client) {
    console.warn(
      `[WA-POSTER] No local WhatsApp client for schoolCode=${schoolCode}, tried=${keyVariants.join(",")}`
    );
    throw new Error(`WhatsApp client not initialized for ${primaryKey}. Scan QR first.`);
  }
  if (!clientState.ready) {
    // Give the client a little time to become ready (common right after QR scan)
    const timeoutMs = 60000;
    const start = Date.now();
    while (!clientState.ready && Date.now() - start < timeoutMs) {
      await sleep(2000);
    }
    if (!clientState.ready) {
      throw new Error(`WhatsApp not ready for ${clientKey || primaryKey} (timed out waiting ready).`);
    }
  }

  const waNumber = formatMobileForWhatsapp(mobileNumber);
  if (!waNumber) throw new Error("Invalid WhatsApp number");

  const absPosterPath = resolvePosterPath(posterPath);
  if (!absPosterPath || !fs.existsSync(absPosterPath)) {
    throw new Error(`Poster file not found: ${absPosterPath || posterPath}`);
  }

  // Lazy-require: whatsapp-web.js is used by `routes/dashboardupload.js`
  const { MessageMedia } = require("whatsapp-web.js");
  const chatId = `${waNumber}@c.us`;
  const media = MessageMedia.fromFilePath(absPosterPath);
  return await clientState.client.sendMessage(chatId, media);
}

async function sendImageUrlViaConnectedWhatsApp(
  schoolCode,
  mobileNumber,
  imageUrl,
  caption = ""
) {
  const primaryKey = sanitizeDbName(schoolCode);
  const keyVariants = Array.from(
    new Set(
      [
        primaryKey,
        sanitizeDbName(String(schoolCode || "").replace(/_/g, " ")),
        sanitizeDbName(String(schoolCode || "").replace(/\s+/g, "")),
        sanitizeDbName(String(schoolCode || "").replace(/_/g, "")),
      ].filter(Boolean)
    )
  );

  let clientKey = "";
  let clientState = null;
  for (const key of keyVariants) {
    if (global.whatsappClients?.[key]?.client) {
      clientKey = key;
      clientState = global.whatsappClients[key];
      break;
    }
  }
  if (!clientState?.client && global.whatsappClients) {
    const normalizedRequested = primaryKey.replace(/_/g, "");
    const matchedKey = Object.keys(global.whatsappClients).find(
      (key) => key.replace(/_/g, "") === normalizedRequested
    );
    if (matchedKey) {
      clientKey = matchedKey;
      clientState = global.whatsappClients[matchedKey];
    }
  }

  if (!clientState?.client) {
    console.warn(
      `[WA-IMG] No local WhatsApp client for schoolCode=${schoolCode}, tried=${keyVariants.join(",")}`
    );
    throw new Error(`WhatsApp client not initialized for ${primaryKey}. Scan QR first.`);
  }

  if (!clientState.ready) {
    const timeoutMs = 60000;
    const start = Date.now();
    while (!clientState.ready && Date.now() - start < timeoutMs) {
      await sleep(2000);
    }
    if (!clientState.ready) {
      throw new Error(`WhatsApp not ready for ${clientKey || primaryKey} (timed out waiting ready).`);
    }
  }

  const waNumber = formatMobileForWhatsapp(mobileNumber);
  if (!waNumber) throw new Error("Invalid WhatsApp number");
  if (!imageUrl) throw new Error("Image URL required");

  const { MessageMedia } = require("whatsapp-web.js");
  const chatId = `${waNumber}@c.us`;
  const media = await MessageMedia.fromUrl(imageUrl, {
    unsafeMime: true,
    filename: "admission-qr.png",
  });

  return await clientState.client.sendMessage(chatId, media, {
    caption: caption || "",
  });
}

async function fetchDailyAutoImageRotationRows(schoolCode, now = new Date()) {
  const db = await getDatabaseConnection(schoolCode);
  await ensureSchoolPhotosTable(db);
  const [rows] = await db.query(
      `SELECT id, lead_name, gallery_scope, file_name, file_path, uploaded_at, is_hidden
       FROM school_photos
       WHERE school_code = ? AND COALESCE(is_hidden, 0) = 0
       ORDER BY uploaded_at DESC`,
      [schoolCode]
    );

  const generatedItems = (Array.isArray(rows) ? rows : [])
    .filter((row) => String(row.file_name || "").trim().toLowerCase().startsWith("auto-image-"))
    .map((row) => ({
      id: row.id,
      file_name: row.file_name,
      file_path: row.file_path,
      title: row.lead_name || row.file_name,
      gallery_scope: "auto",
      gallery_type: "generated",
      uploaded_at: row.uploaded_at,
    }));

  const selected = getAutoImageRotationItems(generatedItems, now);
  console.log("[AUTO-IMAGE][rotation] selected items", {
    schoolCode,
    now: now.toISOString(),
    totalGenerated: generatedItems.length,
    selectedCount: selected.length,
    selectedFiles: selected.map((item) => item?.file_name || item?.title || item?.id || null),
  });
  return selected;
}

async function sendDailyAutoImagesToConnectedWhatsApp(schoolCode, now = new Date()) {
  console.log("[AUTO-IMAGE][send] start", { schoolCode, now: now.toISOString() });
  saveAutoImageSendStatus(schoolCode, {
    status: "sending",
    sent: 0,
    failed: 0,
    skipped: false,
    reason: null,
    senderNumber: null,
    recipientNumber: null,
    total: 0,
  });

  let school = null;
  try {
    school = await getSchoolDetails(schoolCode);
  } catch (err) {
    console.warn("[AUTO-IMAGE][send] school details lookup failed", {
      schoolCode,
      error: err?.message || String(err),
    });
  }

  const recipientNumberRaw = String(
    school?.institute_contact_number || school?.contact_number || school?.mobile_number || ""
  ).trim();
  const recipientNumber = formatMobileForWhatsapp(recipientNumberRaw) || recipientNumberRaw;

  const connected = getConnectedWhatsAppState(schoolCode);
  console.log("[AUTO-IMAGE][send] connected state", {
    schoolCode,
    hasClient: Boolean(connected.clientState?.client),
    ready: Boolean(connected.clientState?.ready),
    connectedNumber: connected.clientState?.number || connected.clientState?.client?.info?.wid?.user || null,
  });
  if (!recipientNumber) {
    console.warn("[AUTO-IMAGE][send] skipped: school contact number missing", {
      schoolCode,
      connectedNumber: connected.clientState?.number || connected.clientState?.client?.info?.wid?.user || null,
    });
    const skippedSummary = {
      schoolCode,
      status: "skipped",
      sent: 0,
      skipped: true,
      reason: "School contact number missing",
      recipientNumber: null,
      senderNumber: null,
    };
    saveAutoImageSendStatus(schoolCode, skippedSummary);
    return skippedSummary;
  }

  const connectedNumber = String(
    connected.clientState.number ||
      connected.clientState.client?.info?.wid?.user ||
      ""
  ).trim();
  if (!connected.clientState?.client || !connected.clientState.ready) {
    console.warn("[AUTO-IMAGE][send] skipped: whatsapp not ready", { schoolCode });
    const skippedSummary = {
      schoolCode,
      status: "skipped",
      sent: 0,
      skipped: true,
      reason: "WhatsApp not ready",
      recipientNumber,
      senderNumber: connectedNumber || null,
    };
    saveAutoImageSendStatus(schoolCode, skippedSummary);
    return skippedSummary;
  }

  if (!connectedNumber) {
    console.warn("[AUTO-IMAGE][send] skipped: connected number missing", { schoolCode });
    const skippedSummary = {
      schoolCode,
      status: "skipped",
      sent: 0,
      skipped: true,
      reason: "Connected WhatsApp number missing",
      recipientNumber,
      senderNumber: null,
    };
    saveAutoImageSendStatus(schoolCode, skippedSummary);
    return skippedSummary;
  }

  ensureWhatsAppAckLogging(connected.clientState, schoolCode, connectedNumber);
  console.log("[AUTO-IMAGE][send] recipient resolved", {
    schoolCode,
    senderNumber: connectedNumber,
    recipientNumber,
    note: "Messages will be sent from the connected WhatsApp session to the institute contact number.",
  });

  const items = await fetchDailyAutoImageRotationRows(schoolCode, now);
  console.log("[AUTO-IMAGE][send] rotation items", {
    schoolCode,
    total: items.length,
    sample: items.slice(0, 3).map((item) => ({
      id: item?.id ?? null,
      file_name: item?.file_name ?? null,
      file_path: item?.file_path ?? null,
    })),
  });
  if (!items.length) {
    console.warn("[AUTO-IMAGE][send] skipped: no auto images available", { schoolCode });
    const skippedSummary = {
      schoolCode,
      status: "skipped",
      sent: 0,
      skipped: true,
      reason: "No auto images available",
    };
    saveAutoImageSendStatus(schoolCode, skippedSummary);
    return skippedSummary;
  }

  let sent = 0;
  const errors = [];
  try {
    const introMessage = "This is your today's auto images.";
    const chatId = `${recipientNumber}@c.us`;
    const introResult = await connected.clientState.client.sendMessage(chatId, introMessage);
    console.log("[AUTO-IMAGE][send] intro message sent", {
      schoolCode,
      senderNumber: connectedNumber,
      recipientNumber,
      message: introMessage,
      messageId: introResult?.id?._serialized || introResult?.id || null,
      ack: introResult?.ack ?? null,
    });
  } catch (err) {
    console.error("[AUTO-IMAGE][send] intro message failed", {
      schoolCode,
      senderNumber: connectedNumber,
      recipientNumber,
      error: err?.message || String(err),
    });
  }
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const rawPath = String(item?.file_path || "").trim();
    const imageUrl = rawPath.startsWith("http")
      ? rawPath
      : `https://cleezoclass.com:4000${rawPath.startsWith("/") ? rawPath : `/${rawPath}`}`;
    const caption = [
      `Daily auto image ${index + 1} of ${items.length}`,
      String(item?.file_name || item?.title || "").trim(),
    ]
      .filter(Boolean)
      .join(" - ");

    try {
      const sendResult = await sendImageUrlViaConnectedWhatsApp(schoolCode, recipientNumber, imageUrl, caption);
      console.log("[AUTO-IMAGE][send] image sent", {
        schoolCode,
        senderNumber: connectedNumber,
        recipientNumber,
        index: index + 1,
        total: items.length,
        fileName: item?.file_name || null,
        messageId: sendResult?.id?._serialized || sendResult?.id || null,
        ack: sendResult?.ack ?? null,
      });
      sent += 1;
    } catch (err) {
      console.error("[AUTO-IMAGE][send] image failed", {
        schoolCode,
        senderNumber: connectedNumber,
        recipientNumber,
        index: index + 1,
        total: items.length,
        fileName: item?.file_name || null,
        error: err?.message || String(err),
      });
      errors.push({
        fileName: item?.file_name || null,
        error: err?.message || String(err),
      });
    }
  }

  console.log("[AUTO-IMAGE][send] complete", {
    schoolCode,
    senderNumber: connectedNumber,
    recipientNumber,
    total: items.length,
    sent,
    failed: Math.max(items.length - sent, 0),
  });
  const finalSummary = {
    schoolCode,
    status: sent > 0 ? (errors.length ? "partial" : "success") : "failed",
    senderNumber: connectedNumber,
    recipientNumber,
    total: items.length,
    sent,
    failed: Math.max(items.length - sent, 0),
    errors,
  };
  saveAutoImageSendStatus(schoolCode, finalSummary);
  return finalSummary;
}

const downloadUrlToFile = (fileUrl, destinationPath) =>
  new Promise((resolve, reject) => {
    const client = String(fileUrl).startsWith("https://") ? https : http;
    const req = client.get(fileUrl, (resp) => {
      if (
        resp.statusCode &&
        resp.statusCode >= 300 &&
        resp.statusCode < 400 &&
        resp.headers.location
      ) {
        return resolve(downloadUrlToFile(resp.headers.location, destinationPath));
      }

      if (!resp.statusCode || resp.statusCode >= 400) {
        return reject(new Error(`Failed to download image: HTTP ${resp.statusCode || "ERR"}`));
      }

      const stream = fs.createWriteStream(destinationPath);
      stream.on("finish", () => {
        stream.close(() => resolve(destinationPath));
      });
      stream.on("error", reject);
      resp.on("error", reject);
      resp.pipe(stream);
    });

    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Image download timeout")));
  });

async function sendAdmissionQrWithFallback(
  schoolCode,
  teacherPhone,
  qrImageUrl,
  caption
) {
  console.log("[Campaigning][AdmissionQR] sendAdmissionQrWithFallback:start", {
    schoolCode,
    phonePreview: teacherPhone ? String(teacherPhone).slice(-4) : null,
  });
  try {
    const result = await sendImageUrlViaConnectedWhatsApp(
      schoolCode,
      teacherPhone,
      qrImageUrl,
      caption
    );
    console.log("[Campaigning][AdmissionQR] local-send:success", {
      schoolCode,
      phonePreview: teacherPhone ? String(teacherPhone).slice(-4) : null,
    });
    return result;
  } catch (err) {
    const msg = String(err?.message || "").toLowerCase();
    console.warn("[Campaigning][AdmissionQR] local-send:failed", {
      schoolCode,
      phonePreview: teacherPhone ? String(teacherPhone).slice(-4) : null,
      error: err?.message || String(err),
    });
    const canFallback =
      msg.includes("not initialized") ||
      msg.includes("scan qr") ||
      msg.includes("not ready") ||
      msg.includes("session");

    if (!canFallback) throw err;

    const waNumber = formatMobileForWhatsapp(teacherPhone) || teacherPhone;
    if (!waNumber) throw new Error("Invalid WhatsApp number");

    const tempFilePath = path.join(
      os.tmpdir(),
      `admission-qr-${Date.now()}-${Math.random().toString(36).slice(2)}.png`
    );

    await downloadUrlToFile(qrImageUrl, tempFilePath);
    try {
      await sendPosterViaWhatsappBridge(schoolCode, waNumber, tempFilePath);
      if (caption) {
        try {
          await sendTextViaWhatsappBridge(schoolCode, waNumber, caption);
        } catch (textErr) {
          console.warn("[Campaigning][AdmissionQR] bridge-caption:failed", {
            schoolCode,
            phonePreview: teacherPhone ? String(teacherPhone).slice(-4) : null,
            error: textErr?.message || String(textErr),
          });
        }
      }
      console.log("[Campaigning][AdmissionQR] bridge-send:success", {
        schoolCode,
        phonePreview: teacherPhone ? String(teacherPhone).slice(-4) : null,
      });
      return { bridged: true };
    } finally {
      setTimeout(() => {
        fs.promises.unlink(tempFilePath).catch(() => {});
      }, 10 * 60 * 1000);
    }
  }
}

app.post("/api/campaigning/send-admission-qr-teachers", async (req, res) => {
  try {
    const { schoolCode, teachers = [] } = req.body || {};
    const normalizedSchoolCode = String(schoolCode || "").trim();
    const invalidSchoolCode =
      !normalizedSchoolCode ||
      normalizedSchoolCode.toLowerCase() === "null" ||
      normalizedSchoolCode.toLowerCase() === "undefined";
    console.log("[Campaigning][AdmissionQR] request:received", {
      schoolCode: normalizedSchoolCode,
      teachersCount: Array.isArray(teachers) ? teachers.length : 0,
    });

    if (invalidSchoolCode) {
      console.warn("[Campaigning][AdmissionQR] request:missing-schoolCode");
      return res.status(400).json({ success: false, message: "schoolCode is required" });
    }
    if (!Array.isArray(teachers) || teachers.length === 0) {
      console.warn("[Campaigning][AdmissionQR] request:empty-teachers", { schoolCode });
      return res.status(400).json({ success: false, message: "teachers list is required" });
    }

    const safeSchoolCode = encodeURIComponent(normalizedSchoolCode);
    const playStoreLink = "https://play.google.com/store/apps/details?id=com.cleezoclass&pcampaignid=web_share";

    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const teacher of teachers) {
      try {
        const teacherName = String(
          teacher?.teacher_name || teacher?.name || "Teacher"
        ).trim();
        const teacherPhone = teacher?.phone_no || teacher?.phone || "";
        console.log("[Campaigning][AdmissionQR] teacher:processing", {
          schoolCode: normalizedSchoolCode,
          teacherName,
          phonePreview: teacherPhone ? String(teacherPhone).slice(-4) : null,
        });
        const caption =
          `Hi ${teacherName},\n` +
          `Please install the Cleezo Class app from the Play Store and use it for campaigning, communication, and daily school updates.\n` +
          `Play Store: ${playStoreLink}\n` +
          `Once installed, you can stay connected and complete campaigning work more smoothly.`;

        const waNumber = formatMobileForWhatsapp(teacherPhone) || teacherPhone;
        if (!waNumber) {
          throw new Error("Invalid WhatsApp number");
        }
        await sendTextViaWhatsappBridge(normalizedSchoolCode, waNumber, caption);
        sent += 1;
        console.log("[Campaigning][AdmissionQR] teacher:sent", {
          schoolCode: normalizedSchoolCode,
          teacherName,
          phonePreview: teacherPhone ? String(teacherPhone).slice(-4) : null,
        });
      } catch (err) {
        failed += 1;
        console.error("[Campaigning][AdmissionQR] teacher:failed", {
          schoolCode: normalizedSchoolCode,
          teacher: String(teacher?.teacher_name || teacher?.name || "Unknown"),
          phonePreview: teacher?.phone_no || teacher?.phone
            ? String(teacher?.phone_no || teacher?.phone).slice(-4)
            : null,
          error: err?.message || String(err),
        });
        errors.push({
          teacher: String(teacher?.teacher_name || teacher?.name || "Unknown"),
          phone: String(teacher?.phone_no || teacher?.phone || ""),
          error: err?.message || String(err),
        });
      }
    }

    console.log("[Campaigning][AdmissionQR] request:completed", {
      schoolCode: normalizedSchoolCode,
      sent,
      failed,
    });
    return res.json({
      success: true,
      sent,
      failed,
      playStoreLink,
      errors,
    });
  } catch (err) {
    console.error("[Campaigning][SendAdmissionQR]", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Failed to send admission QR",
    });
  }
});

async function ensureLeadStaffTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS \`Lead_staff\` (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      schoolCode VARCHAR(100) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      mobile_number VARCHAR(20) NOT NULL,
      email_id VARCHAR(255) NULL,
      city VARCHAR(255) NULL,
      area VARCHAR(255) NULL,
      code VARCHAR(255) NULL,
      from_date DATE NULL,
      to_date DATE NULL,
      assign_time TIME NULL,
      qr_sent TINYINT(1) NOT NULL DEFAULT 0,
      qr_sent_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_lead_staff_school (schoolCode),
      INDEX idx_lead_staff_mobile (mobile_number)
    )
  `);
}

async function sendStaffInviteToLeadStaff(schoolCode, mobileNumber, leadName, credentials = {}) {
  const playStoreLink = "https://play.google.com/store/apps/details?id=com.cleezoclass&pcampaignid=web_share";
  const username = String(credentials.username || "").trim();
  const password = String(credentials.password || "").trim();
  const caption = [
    `Hi ${String(leadName || "User").trim() || "User"},`,
    `Your staff account is ready.`,
    ``,
    `Username: ${username || "Not provided"}`,
    `Password: ${password || "Not provided"}`,
    ``,
    `Install the Cleezo Class app from the Play Store:`,
    playStoreLink,
    ``,
    `Please sign in using the above credentials and keep them secure.`,
  ].join("\n");

  return sendTextViaWhatsappBridge(schoolCode, mobileNumber, caption);
}

app.get("/api/lead-staff", async (req, res) => {
  try {
    const schoolCode = String(req.query.schoolCode || "").trim();
    if (!schoolCode) {
      return res.status(400).json({ success: false, message: "schoolCode is required" });
    }

    const db = await getDatabaseConnection(schoolCode);
    await ensureLeadStaffTable(db);

    const [rows] = await db.query(
      `SELECT *
       FROM \`Lead_staff\`
       WHERE schoolCode = ?
       ORDER BY id DESC`,
      [schoolCode]
    );

    return res.json({ success: true, leads: rows });
  } catch (error) {
    console.error("Failed to fetch Lead_staff:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch Lead_staff",
    });
  }
});

app.post("/api/lead-staff", async (req, res) => {
  try {
    const {
      schoolCode,
      full_name,
      mobile_number,
      email_id,
      city,
      area,
      code,
      from_date,
      to_date,
      assign_time,
    } = req.body || {};

    const normalizedSchoolCode = String(schoolCode || "").trim();
    const staffName = String(full_name || "").trim();
    const cleanedMobile = formatMobileForWhatsapp(mobile_number);

    if (!normalizedSchoolCode) {
      return res.status(400).json({ success: false, message: "schoolCode is required" });
    }
    if (!staffName) {
      return res.status(400).json({ success: false, message: "full_name is required" });
    }
    if (!cleanedMobile) {
      return res.status(400).json({ success: false, message: "mobile_number is required" });
    }

    const db = await getDatabaseConnection(normalizedSchoolCode);
    await ensureLeadStaffTable(db);

    const cleanedEmail = String(email_id || "").trim() || null;
    const seed = staffName.replace(/\s+/g, "").slice(0, 4).toLowerCase() || "staff";
    const username = `${seed}${Math.floor(1000 + Math.random() * 9000)}`;
    const password = `${seed}@${Math.floor(1000 + Math.random() * 9000)}`;
    const schoolName = (await getSchoolDetails(normalizedSchoolCode))?.institute_name || null;
    const newjoinee = "yes";

    const loginRow = {
      username,
      password,
      user_type: "teacher",
      name: staffName,
      gender: "Not Specified",
      phone_no: cleanedMobile,
      email: cleanedEmail,
      designation: "Campaigning Staff",
      school_name: schoolName,
      schoolCode: normalizedSchoolCode,
      newjoinee,
    };

    await ensureCampaignStaffFields(db);
    await ensureProfileSyncFields(db);

    const [result] = await db.query(
      `INSERT INTO \`Lead_staff\`
       (schoolCode, full_name, mobile_number, email_id, city, area, code, from_date, to_date, assign_time, qr_sent, qr_sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
      [
        normalizedSchoolCode,
        staffName,
        cleanedMobile,
        cleanedEmail,
        String(city || "").trim() || null,
        String(area || "").trim() || null,
        String(code || "").trim() || null,
        String(from_date || "").trim() || null,
        String(to_date || "").trim() || null,
        String(assign_time || "").trim() || null,
      ]
    );

    await db.query(
      `INSERT INTO management_login_creation
       (username, password, user_type, name, gender, phone_no, email, designation, school_name, schoolCode, newjoinee)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        loginRow.username,
        loginRow.password,
        loginRow.user_type,
        loginRow.name,
        loginRow.gender,
        loginRow.phone_no,
        loginRow.email,
        loginRow.designation,
        loginRow.school_name,
        loginRow.schoolCode,
        loginRow.newjoinee,
      ]
    );

    try {
      await syncCampaignStaffToQuality(loginRow);
    } catch (qualityErr) {
      console.warn("[LEAD-STAFF][login] Quality insert skipped/failed", {
        schoolCode: normalizedSchoolCode,
        error: qualityErr?.message || qualityErr,
      });
    }

    let qrSent = false;
    let qrError = null;
    try {
      await sendStaffInviteToLeadStaff(normalizedSchoolCode, cleanedMobile, staffName, {
        username: loginRow.username,
        password: loginRow.password,
      });
      qrSent = true;
      await db.query(
        `UPDATE \`Lead_staff\`
         SET qr_sent = 1, qr_sent_at = NOW()
         WHERE id = ? AND schoolCode = ?`,
        [result.insertId, normalizedSchoolCode]
      );
    } catch (sendErr) {
      qrError = sendErr?.message || String(sendErr);
      console.error("Failed to send staff invite to Lead_staff user:", sendErr);
    }

    return res.json({
      success: true,
      message: "Lead_staff user created successfully",
      data: {
        id: result.insertId,
        schoolCode: normalizedSchoolCode,
        full_name: staffName,
        mobile_number: cleanedMobile,
        email_id: String(email_id || "").trim() || null,
        city: String(city || "").trim() || null,
        area: String(area || "").trim() || null,
        code: String(code || "").trim() || null,
        from_date: String(from_date || "").trim() || null,
        to_date: String(to_date || "").trim() || null,
        assign_time: String(assign_time || "").trim() || null,
        qr_sent: qrSent,
        qr_error: qrError,
        username,
        password,
        play_store_link: "https://play.google.com/store/apps/details?id=com.cleezoclass&pcampaignid=web_share",
      },
    });
  } catch (error) {
    console.error("Failed to create Lead_staff user:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create Lead_staff user",
    });
  }
});

app.put("/api/lead-staff/:id", async (req, res) => {
  try {
    const requestedId = Number(req.params.id);
    const schoolCode = String(req.query.schoolCode || req.body?.schoolCode || "").trim();
    const staffName = String(req.body?.full_name || "").trim();
    const cleanedMobile = formatMobileForWhatsapp(req.body?.mobile_number);
    const emailId = String(req.body?.email_id || "").trim() || null;
    const city = String(req.body?.city || "").trim() || null;
    const area = String(req.body?.area || "").trim() || null;
    const code = String(req.body?.code || "").trim() || null;
    const fromDate = String(req.body?.from_date || "").trim() || null;
    const toDate = String(req.body?.to_date || "").trim() || null;
    const assignTime = String(req.body?.assign_time || "").trim() || null;

    if (!requestedId) {
      return res.status(400).json({ success: false, message: "Valid id is required" });
    }
    if (!schoolCode) {
      return res.status(400).json({ success: false, message: "schoolCode is required" });
    }
    if (!staffName) {
      return res.status(400).json({ success: false, message: "full_name is required" });
    }
    if (!cleanedMobile) {
      return res.status(400).json({ success: false, message: "mobile_number is required" });
    }

    const db = await getDatabaseConnection(schoolCode);
    await ensureLeadStaffTable(db);

    const [existingRows] = await db.query(
      `SELECT *
       FROM \`Lead_staff\`
       WHERE id = ? AND schoolCode = ?
       LIMIT 1`,
      [requestedId, schoolCode]
    );

    if (existingRows.length > 0) {
      const [duplicateRows] = await db.query(
        `SELECT id
         FROM \`Lead_staff\`
         WHERE schoolCode = ? AND mobile_number = ? AND id <> ?
         LIMIT 1`,
        [schoolCode, cleanedMobile, requestedId]
      );
      if (duplicateRows.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Another user already exists in Lead_staff for this mobile number.",
        });
      }

      await db.query(
        `UPDATE \`Lead_staff\`
         SET full_name = ?,
             mobile_number = ?,
             email_id = ?,
             city = ?,
             area = ?,
             code = ?,
             from_date = ?,
             to_date = ?,
             assign_time = ?
         WHERE id = ? AND schoolCode = ?`,
        [
          staffName,
          cleanedMobile,
          emailId,
          city,
          area,
          code,
          fromDate,
          toDate,
          assignTime,
          requestedId,
          schoolCode,
        ]
      );

      const [rows] = await db.query(
        `SELECT *
         FROM \`Lead_staff\`
         WHERE id = ? AND schoolCode = ?
         LIMIT 1`,
        [requestedId, schoolCode]
      );

      return res.json({
        success: true,
        message: "Lead_staff user updated successfully",
        data: rows[0] || null,
      });
    }

    const [duplicateRows] = await db.query(
      `SELECT id
       FROM \`Lead_staff\`
       WHERE schoolCode = ? AND mobile_number = ?
       LIMIT 1`,
      [schoolCode, cleanedMobile]
    );
    if (duplicateRows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "User already exists in Lead_staff for this mobile number.",
      });
    }

    const [insertResult] = await db.query(
      `INSERT INTO \`Lead_staff\`
       (schoolCode, full_name, mobile_number, email_id, city, area, code, from_date, to_date, assign_time, qr_sent, qr_sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
      [
        schoolCode,
        staffName,
        cleanedMobile,
        emailId,
        city,
        area,
        code,
        fromDate,
        toDate,
        assignTime,
      ]
    );

    const seed = staffName.replace(/\s+/g, "").slice(0, 4).toLowerCase() || "staff";
    const username = `${seed}${Math.floor(1000 + Math.random() * 9000)}`;
    const password = `${seed}@${Math.floor(1000 + Math.random() * 9000)}`;
    const playStoreLink = "https://play.google.com/store/apps/details?id=com.cleezoclass&pcampaignid=web_share";
    const staffLoginMessage = [
      `Welcome to Cleezo Class.`,
      `Your staff login has been created successfully.`,
      `Username: ${username}`,
      `Password: ${password}`,
      ``,
      `Please install the app from this link and use it for campaigning and school updates:`,
      playStoreLink,
      ``,
      `Keep your credentials safe and change your password after first login if needed.`,
    ].join("\n");

    let qrSent = false;
    let qrError = null;
    try {
      await sendStaffInviteToLeadStaff(schoolCode, cleanedMobile, staffName, {
        username,
        password,
      });
      qrSent = true;
      await db.query(
        `UPDATE \`Lead_staff\`
         SET qr_sent = 1, qr_sent_at = NOW()
         WHERE id = ? AND schoolCode = ?`,
        [insertResult.insertId, schoolCode]
      );
    } catch (sendErr) {
      qrError = sendErr?.message || String(sendErr);
      console.error("Failed to send staff invite while auto-creating Lead_staff user:", sendErr);
    }

    const [rows] = await db.query(
      `SELECT *
       FROM \`Lead_staff\`
      WHERE id = ? AND schoolCode = ?
      LIMIT 1`,
      [insertResult.insertId, schoolCode]
    );

    return res.status(201).json({
      success: true,
      message: "Lead_staff user was missing and has been created successfully",
      created: true,
      data: rows[0]
        ? {
            ...rows[0],
            qr_sent: qrSent,
            qr_error: qrError,
            username,
            password,
            play_store_link: playStoreLink,
            invite_message: staffLoginMessage,
          }
        : {
            id: insertResult.insertId,
            schoolCode,
            full_name: staffName,
            mobile_number: cleanedMobile,
            email_id: emailId,
            city,
            area,
            code,
            from_date: fromDate,
            to_date: toDate,
            assign_time: assignTime,
            qr_sent: qrSent,
            qr_error: qrError,
            username,
            password,
            play_store_link: playStoreLink,
            invite_message: staffLoginMessage,
          },
    });
  } catch (error) {
    console.error("Failed to update Lead_staff user:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update Lead_staff user",
    });
  }
});

app.delete("/api/lead-staff/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const schoolCode = String(req.query.schoolCode || "").trim();
    if (!schoolCode) {
      return res.status(400).json({ success: false, message: "schoolCode is required" });
    }

    const db = await getDatabaseConnection(schoolCode);
    await ensureLeadStaffTable(db);

    const [result] = await db.query(
      `DELETE FROM \`Lead_staff\`
       WHERE id = ? AND schoolCode = ?`,
      [id, schoolCode]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Lead_staff record not found" });
    }

    return res.json({ success: true, message: "Lead_staff record deleted" });
  } catch (error) {
    console.error("Failed to delete Lead_staff user:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete Lead_staff user",
    });
  }
});

async function sendPosterWithRetry(schoolCode, mobileNumber, posterPath, retries = 6, delayMs = 5000) {
  console.log("[WA-RETRY] Start", {
    schoolCode,
    mobileNumberPreview: mobileNumber ? String(mobileNumber).slice(-4) : null,
    posterPath
  });
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      // Prefer the WhatsApp session created via `/api/whatsapp/qr` (global.whatsappClients)
      return await sendPosterViaConnectedWhatsApp(schoolCode, mobileNumber, posterPath);
    } catch (err) {
      lastErr = err;
      console.log("[WA-RETRY] Attempt failed", {
        attempt: i + 1,
        error: err?.message || err
      });
      const msg = String(err?.message || "");
      // No amount of retry helps if user hasn't scanned QR / client doesn't exist in this process
      if (msg.toLowerCase().includes("not initialized") || msg.toLowerCase().includes("scan qr")) {
        try {
          console.log("[WA-RETRY] Trying bridge fallback for poster send");
          const waNumber = formatMobileForWhatsapp(mobileNumber) || mobileNumber;
          const absPosterPath = resolvePosterPath(posterPath);
          return await sendPosterViaWhatsappBridge(schoolCode, waNumber, absPosterPath);
        } catch (bridgeErr) {
          lastErr = bridgeErr;
          console.log("[WA-RETRY] Bridge fallback failed", {
            error: bridgeErr?.message || bridgeErr
          });
          throw bridgeErr;
        }
      }
      if (msg.toLowerCase().includes("not ready") || msg.toLowerCase().includes("session")) {
        console.warn("⚠ WhatsApp not ready yet");
        await sleep(delayMs);
        continue;
      }
      // Fallback to older/external sendPoster implementation (if present)
      if (typeof sendPosterRaw === "function") {
        try {
          const waNumber = formatMobileForWhatsapp(mobileNumber) || mobileNumber;
          const absPosterPath = resolvePosterPath(posterPath);
          return await sendPosterRaw(schoolCode, waNumber, absPosterPath);
        } catch (err2) {
          lastErr = err2;
          const msg2 = String(err2?.message || "");
          if (msg2.toLowerCase().includes("not ready") || msg2.toLowerCase().includes("session")) {
            console.warn("⚠ WhatsApp not ready yet");
            await sleep(delayMs);
            continue;
          }
        }
      }

      throw lastErr;
    }
  }
  throw lastErr || new Error("WhatsApp send failed");
}

app.post("/api/add-lead", upload.single("photo"), async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`\n--- [${timestamp}] NEW REQUEST RECEIVED ---`);

  try {
    console.log("[DEBUG] req.body:", req.body);
    console.log("[DEBUG] req.file:", req.file);

    const { schoolCode, updateType } = req.body;

    /* -------------------- SCHOOL CODE CHECK -------------------- */
    if (!schoolCode) {
      return res.status(400).json({
        success: false,
        error: "School Code is required"
      });
    }

    /* -------------------- DB CONNECTION -------------------- */
    const db = await getDatabaseConnection(schoolCode);
    console.log("[INFO] Database connected");

    /* -------------------- ASSIGN TEACHER CASE -------------------- */
    if (updateType === "ASSIGN_TEACHER") {
      const {
        lead_id,
        assigned_teacher_id,
        assigned_teacher_name,
        test_date,
        test_time,
        test_mode,
        counselling_required,
        counselling_date,
        counselling_time
      } = req.body;

      const updateSql = `
        UPDATE leads
        SET assigned_teacher_id=?, assigned_teacher_name=?, test_date=?, test_time=?,
            test_mode=?, counselling_required=?, counselling_date=?, counselling_time=?
        WHERE id=?
      `;

      await db.execute(updateSql, [
        assigned_teacher_id || null,
        assigned_teacher_name || null,
        test_date || null,
        test_time || null,
        test_mode || null,
        counselling_required || "No",
        counselling_date || null,
        counselling_time || null,
        lead_id
      ]);

      return res.json({
        success: true,
        message: "Teacher assigned successfully"
      });
    }

    // Ensure older lead tables have the optional fields this route now uses.
    try {
      const columnsToEnsure = [
        ["lead_name", "VARCHAR(255) NULL"],
        ["city", "VARCHAR(255) NULL"],
        ["area", "VARCHAR(255) NULL"],
        ["code", "VARCHAR(255) NULL"],
        ["interest_status", "VARCHAR(100) NULL"],
      ];
      for (const [columnName, columnType] of columnsToEnsure) {
        const [cols] = await db.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'leads' AND COLUMN_NAME = ?`,
          [schoolCode, columnName]
        );
        if (!cols.length) {
          await db.query(`ALTER TABLE leads ADD COLUMN ${columnName} ${columnType}`);
        }
      }
    } catch (e) {
      console.error("Failed to ensure lead columns in /api/add-lead:", e.message || e);
    }

    /* -------------------- NEW LEAD DATA -------------------- */
    const {
      full_name,
      student_name,
      lead_name,
      mobile_number,
      email_id,
      occupation,
      address,
      city,
      area,
      code,
      dob,
      gender,
      lead_admission_for,
      interest_status,
      entry_type = "manual",
        refer_by          // 👈 ADD THIS

    } = req.body;

    const student_photo = req.file ? req.file.filename : null;
    const rawLeadName = (lead_name || "").toString().trim();
    const effectiveLeadName = (lead_name || student_name || full_name || "").toString().trim();
    const allowDuplicateContact = !rawLeadName;

    const normalizedMobile = normalizeLeadMobile(mobile_number);
    console.log("[ADD-LEAD] Normalized input", {
      schoolCode,
      full_name: full_name || null,
      student_name: student_name || null,
      refer_by: refer_by || null,
      rawMobileMasked: maskMobile(mobile_number),
      normalizedMobileMasked: maskMobile(normalizedMobile),
      email: email_id || null,
      entry_type: entry_type || null,
    });

    const allowDuplicateSubmission = ["1", "true", "yes"].includes(
      String(req.body.allow_duplicate || req.body.force_duplicate || "").trim().toLowerCase()
    );

    const exactDuplicateLead = await findExactLeadDuplicate(db, {
      full_name,
      student_name,
      occupation,
      mobile_number,
      email_id,
      address,
      dob,
      lead_admission_for,
      interest_status,
      entry_type,
    });

    if (exactDuplicateLead && !allowDuplicateSubmission) {
      console.warn("[ADD-LEAD] Exact duplicate lead found", {
        schoolCode,
        duplicateLeadId: exactDuplicateLead.id || null,
        normalizedMobileMasked: maskMobile(normalizedMobile),
        email: email_id || null,
      });
      return res.status(409).json({
        success: false,
        duplicate: true,
        error: "You already have submitted this lead. Do you want to submit it again?",
        existingLead: {
          id: exactDuplicateLead.id,
          full_name: exactDuplicateLead.full_name,
          mobile_number: exactDuplicateLead.mobile_number,
          email_id: exactDuplicateLead.email_id,
        },
      });
    }

    // ✅ DUPLICATE CHECK (single upload)
    if (!allowDuplicateContact) {
      if (normalizedMobile) {
        const [dup] = await db.query(
          `SELECT id
           FROM leads
           WHERE mobile_number = ?
              OR mobile_number = ?
              OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(mobile_number, '+', ''), '-', ''), ' ', ''), '(', ''), ')', '') = ?
              OR RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(mobile_number, '+', ''), '-', ''), ' ', ''), '(', ''), ')', ''), 10) = ?
           LIMIT 1`,
          [normalizedMobile, `91${normalizedMobile}`, normalizedMobile, normalizedMobile]
        );
        if (dup.length > 0) {
          console.warn("[ADD-LEAD] Duplicate mobile found", {
            schoolCode,
            normalizedMobileMasked: maskMobile(normalizedMobile),
            duplicateLeadId: dup[0]?.id || null,
          });
          return res.status(400).json({
            success: false,
            error: "Duplicate lead (mobile number already exists)."
          });
        }
      }
      if (email_id) {
        const [dupEmail] = await db.query(
          "SELECT id FROM leads WHERE email_id = ? LIMIT 1",
          [email_id]
        );
        if (dupEmail.length > 0) {
          console.warn("[ADD-LEAD] Duplicate email found", {
            schoolCode,
            email: email_id,
            duplicateLeadId: dupEmail[0]?.id || null,
          });
          return res.status(400).json({
            success: false,
            error: "Duplicate lead (email already exists)."
          });
        }
      }
    } else {
      console.log("[ADD-LEAD] lead_name missing, duplicate mobile/email allowed", {
        schoolCode,
        lead_name: lead_name || null,
        normalizedMobileMasked: maskMobile(normalizedMobile),
        email: email_id || null,
      });
    }

    /* -------------------- MANDATORY FIELD VALIDATION -------------------- */
    const requiredFields = {
      full_name: "Full Name",
      student_name: "Student Name",
      mobile_number: "Mobile Number",
      lead_admission_for: "Admission For",
    };

    const missingFields = [];

    for (const field in requiredFields) {
      if (!req.body[field] || req.body[field].toString().trim() === "") {
        missingFields.push(requiredFields[field]);
      }
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Kindly provide: ${missingFields.join(", ")}`
      });
    }

    /* -------------------- EXTRA VALIDATIONS -------------------- */

// Mobile number validation
if (!/^[6-9]\d{9}$/.test(normalizedMobile)) {
  console.warn("[ADD-LEAD] Invalid mobile rejected", {
    schoolCode,
    rawMobileMasked: maskMobile(mobile_number),
    normalizedMobileMasked: maskMobile(normalizedMobile),
  });
  return res.status(400).json({
    success: false,
    error: "Please enter a valid 10-digit mobile number"
  });
}

   

    /* -------------------- SAFE NULL HANDLER -------------------- */
    const safe = (v) => (v === undefined || v === "" ? null : v);

    /* -------------------- GENERATE REG & TICKET -------------------- */
    const { reg_no, ticket_no } = generateNumbers();

    /* -------------------- INSERT QUERY -------------------- */
    const sql = `
  INSERT INTO leads
  (
    lead_name,
    student_name,
    full_name,
    occupation,
    mobile_number,
    email_id,
    address,
    city,
    area,
    code,
    dob,
    refer_by,         
    lead_admission_for,
    interest_status,
    entry_type,
    reg_no,
    ticket_no,
    student_photo,
    date,
    lead_time
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+05:30')), TIME(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+05:30')))
`;

const [result] = await db.execute(sql, [
  safe(effectiveLeadName),
  safe(student_name),
  safe(full_name),
  safe(occupation),
  safe(normalizedMobile),
  safe(email_id),
  safe(address),
  safe(city),
  safe(area),
  safe(code),
  safe(dob),
  safe(refer_by),          // 👈 8th position
  safe(lead_admission_for),
  safe(interest_status),
  safe(entry_type),
  reg_no,
  ticket_no,
  safe(student_photo)
]);
console.log("[ADD-LEAD] Insert success", {
  schoolCode,
  leadId: result?.insertId || null,
  reg_no,
  ticket_no,
  normalizedMobileMasked: maskMobile(normalizedMobile),
  email: email_id || null,
});
console.log("[ADD-LEAD] Auto poster send skipped (single upload)", {
  schoolCode,
  leadId: result?.insertId || null,
  reg_no,
  mobile_number: maskMobile(normalizedMobile),
  lead_name: effectiveLeadName || null,
});
    /* -------------------- SUCCESS RESPONSE -------------------- */
    return res.json({
      success: true,
      id: result.insertId,
      reg_no,
      ticket_no,
      full_name,
      student_name,
      lead_name: effectiveLeadName,
      mobile_number,
      student_photo,dob,
      interest_status,
      refer_by,
      email_id,
    });

  } catch (err) {
    console.error("[ERROR]", err);
    return res.status(500).json({
      success: false,
      error: "Something went wrong. Please try again."
    });
  }
});

app.post("/api/check-duplicate-lead", async (req, res) => {
  try {
    const {
      schoolCode,
      full_name,
      student_name,
      occupation,
      mobile_number,
      email_id,
      address,
      dob,
      lead_admission_for,
      interest_status,
      entry_type = "manual",
    } = req.body || {};

    if (!schoolCode) {
      return res.status(400).json({
        success: false,
        error: "School Code is required",
      });
    }

    const db = await getDatabaseConnection(schoolCode);
    const matchedLead = await findExactLeadDuplicate(db, {
      full_name,
      student_name,
      occupation,
      mobile_number,
      email_id,
      address,
      dob,
      lead_admission_for,
      interest_status,
      entry_type,
    });

    if (!matchedLead) {
      return res.json({ success: true, duplicate: false });
    }

    return res.json({
      success: true,
      duplicate: true,
      lead: {
        id: matchedLead.id,
        full_name: matchedLead.full_name,
        mobile_number: matchedLead.mobile_number,
        email_id: matchedLead.email_id,
        refer_by: matchedLead.refer_by || null,
      },
    });
  } catch (err) {
    console.error("Duplicate lead check failed:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to check duplicate lead",
    });
  }
});

function parseCsvContent(content) {
  const rows = [];
  let row = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && (char === "," || char === "\n")) {
      row.push(current.trim());
      current = "";
      if (char === "\n") {
        if (row.some((cell) => cell.length > 0)) rows.push(row);
        row = [];
      }
      continue;
    }

    if (!inQuotes && char === "\r") {
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length) {
    row.push(current.trim());
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }
  return rows;
}

function normalizeDob(raw) {
  if (!raw) return null;
  const value = String(raw).trim();
  if (!value) return null;

  const toIsoDate = (d) => {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // Already in ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  // Excel serial date (common in CSV exported from spreadsheets)
  if (/^\d{4,6}$/.test(value)) {
    const serial = Number(value);
    if (Number.isFinite(serial) && serial > 0) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel epoch
      excelEpoch.setUTCDate(excelEpoch.getUTCDate() + serial);
      const iso = excelEpoch.toISOString().split("T")[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    }
  }

  // Accept DD/MM/YYYY or D/M/YYYY or MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
    const parts = value.split("/").map((p) => p.trim());
    let a = parseInt(parts[0], 10);
    let b = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    if (!y || !a || !b) return null;

    // If first part > 12, treat as DD/MM
    let day = a;
    let month = b;
    if (a <= 12 && b <= 12) {
      // ambiguous: default to DD/MM to match common local format
      day = a;
      month = b;
    } else if (a <= 12 && b > 12) {
      // likely MM/DD
      day = b;
      month = a;
    }

    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  // Accept DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(value)) {
    const parts = value.split("-").map((p) => p.trim());
    const day = parts[0].padStart(2, "0");
    const month = parts[1].padStart(2, "0");
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }

  // Accept DD.MM.YYYY
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(value)) {
    const parts = value.split(".").map((p) => p.trim());
    const day = parts[0].padStart(2, "0");
    const month = parts[1].padStart(2, "0");
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }

  // Fallback: native parser for strings like "23 Mar 2012", "Mar 23, 2012"
  const parsed = new Date(value);
  const isoFallback = toIsoDate(parsed);
  if (isoFallback) return isoFallback;

  return null;
}

app.post("/api/leads/bulk-upload", uploadCsv.single("file"), async (req, res) => {
  try {
    const { schoolCode, lead_name, scheduleDaily, previewOnly, refer_by: referByFromBody } = req.body;
    if (!schoolCode) {
      return res.status(400).json({ error: "schoolCode is required" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "CSV file is required" });
    }

    const db = await getDatabaseConnection(schoolCode);
    // Ensure older lead tables have the optional fields this route now uses.
    try {
      const columnsToEnsure = [
        ["lead_name", "VARCHAR(255) NULL"],
        ["city", "VARCHAR(255) NULL"],
        ["area", "VARCHAR(255) NULL"],
        ["code", "VARCHAR(255) NULL"],
      ];
      for (const [columnName, columnType] of columnsToEnsure) {
        const [cols] = await db.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'leads' AND COLUMN_NAME = ?`,
          [schoolCode, columnName]
        );
        if (!cols.length) {
          await db.query(`ALTER TABLE leads ADD COLUMN ${columnName} ${columnType}`);
        }
      }
    } catch (e) {
      console.error("Failed to ensure lead columns:", e.message || e);
    }
    const content = fs.readFileSync(req.file.path, "utf8");
    const rows = parseCsvContent(content);

    if (!rows.length) {
      return res.status(400).json({ error: "CSV is empty" });
    }

    const headerRow = rows[0].map((h) => h.toLowerCase());
    const dataRows = rows.slice(1);

    const requiredHeaderGroups = [
      ["mobile_number", "mobile number", "mobile", "phone", "phone_number"],
    ];
    const normalizeHeaderKey = (value) =>
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const normalizedHeaderSet = new Set(headerRow.map((header) => normalizeHeaderKey(header)));
    const missingHeaders = requiredHeaderGroups
      .filter((group) => !group.some((candidate) => normalizedHeaderSet.has(normalizeHeaderKey(candidate))))
      .map((group) => group[0]);
    if (missingHeaders.length) {
      return res.status(400).json({
        error: `Missing required headers: ${missingHeaders.join(", ")}`
      });
    }

    const headerIndexByNormalizedKey = new Map();
    headerRow.forEach((header, index) => {
      const normalized = normalizeHeaderKey(header);
      if (normalized && !headerIndexByNormalizedKey.has(normalized)) {
        headerIndexByNormalizedKey.set(normalized, index);
      }
    });

    const getValue = (row, key) => {
      const idx = headerRow.indexOf(key);
      if (idx >= 0) return row[idx];
      const fallbackIdx = headerIndexByNormalizedKey.get(normalizeHeaderKey(key));
      return fallbackIdx != null ? row[fallbackIdx] : "";
    };

    const getFirstValue = (row, keys) => {
      for (const key of keys) {
        const value = String(getValue(row, key) || "").trim();
        if (value) return value;
      }
      return "";
    };

    let inserted = 0;
    let skipped = 0;
    const duplicateEntries = [];
    const seenMobiles = new Set();
    const seenEmails = new Set();
    const enableDailySchedule =
      scheduleDaily == null
        ? true
        : String(scheduleDaily || "").toLowerCase() === "true" ||
          String(scheduleDaily || "").toLowerCase() === "1" ||
          String(scheduleDaily || "").toLowerCase() === "yes";
    const isPreviewOnly =
      String(previewOnly || "").toLowerCase() === "true" ||
      String(previewOnly || "").toLowerCase() === "1" ||
      String(previewOnly || "").toLowerCase() === "yes";
    let queued = 0;
    console.log("[BULK-LEAD] Upload start", {
      schoolCode,
      rows: dataRows.length,
      scheduleDaily: enableDailySchedule,
      lead_name: lead_name || null,
    });

    for (const row of dataRows) {
      const student_name = getFirstValue(row, [
        "student_name",
        "student name",
        "student",
      ]);
      const full_name = getFirstValue(row, [
        "full_name",
        "full name",
        "parent_name",
        "parent name",
        "lead_name",
        "lead name",
        "name",
      ]);
      const occupation = getFirstValue(row, ["occupation", "profession"]);
      const mobile_number = getFirstValue(row, [
        "mobile_number",
        "mobile number",
        "mobile",
        "phone",
        "phone_number",
      ]);
      const normalizedMobile = normalizeLeadMobile(mobile_number);
      const email_id = getFirstValue(row, ["email_id", "email id", "email"]);
      const address = getFirstValue(row, ["address"]);
      const city = getFirstValue(row, ["city"]);
      const area = getFirstValue(row, ["area"]);
      const code = getFirstValue(row, ["code", "postal_code", "pincode", "pin"]);
      const dobRaw = getFirstValue(row, ["dob", "date_of_birth", "date of birth"]);
      const dob = normalizeDob(dobRaw);
      const lead_admission_for = getFirstValue(row, [
        "lead_admission_for",
        "lead admission for",
        "admission_for",
        "admission for",
        "class",
      ]);
      const refer_by = getFirstValue(row, ["refer_by", "refer by", "reference"]);
      const effectiveReferBy =
        String(refer_by || "").trim() ||
        String(referByFromBody || "").trim() ||
        "Campaign";
      const effectiveFullName =
        String(full_name || "").trim() ||
        String(student_name || "").trim() ||
        (normalizedMobile ? `Lead ${normalizedMobile}` : "Lead");

      if (!normalizedMobile) {
        console.warn("[BULK-LEAD] Skip missing required", {
          schoolCode,
          full_name: full_name || null,
          effectiveFullName: effectiveFullName || null,
          student_name: student_name || null,
          rawMobileMasked: maskMobile(mobile_number),
          normalizedMobileMasked: maskMobile(normalizedMobile),
          lead_admission_for: lead_admission_for || null,
          dobRaw: dobRaw || null,
          dob: dob || null,
          reason: "mobile_number is required",
        });
        skipped++;
        continue;
      }

      if (!/^[6-9]\d{9}$/.test(String(normalizedMobile).trim())) {
        console.warn("[BULK-LEAD] Skip invalid mobile", {
          schoolCode,
          full_name: effectiveFullName,
          rawMobileMasked: maskMobile(mobile_number),
          normalizedMobileMasked: maskMobile(normalizedMobile),
        });
        skipped++;
        continue;
      }

      const { reg_no, ticket_no } = generateNumbers();

      const sql = `
        INSERT INTO leads
        (
          lead_name,
          student_name,
          full_name,
          occupation,
          mobile_number,
          email_id,
          address,
          city,
          area,
          code,
          dob,
          refer_by,
          lead_admission_for,
          entry_type,
          reg_no,
          ticket_no,
          student_photo,
          date,
          lead_time
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+05:30')), TIME(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+05:30')))
      `;

      const mobileKey = String(normalizedMobile || "").trim();
      const emailKey = String(email_id || "").trim().toLowerCase();
      if (mobileKey && seenMobiles.has(mobileKey)) {
        console.warn("[BULK-LEAD] Skip duplicate mobile in same file", {
          schoolCode,
          full_name: effectiveFullName,
          normalizedMobileMasked: maskMobile(normalizedMobile),
        });
        duplicateEntries.push({
          mobile_number: normalizedMobile,
          full_name: effectiveFullName || null,
          email_id: email_id || null,
          reason: "Duplicate mobile in uploaded file",
        });
        skipped++;
        continue;
      }
      if (emailKey && seenEmails.has(emailKey)) {
        console.warn("[BULK-LEAD] Skip duplicate email in same file", {
          schoolCode,
          full_name: effectiveFullName,
          email: email_id || null,
        });
        duplicateEntries.push({
          mobile_number: normalizedMobile || null,
          full_name: effectiveFullName || null,
          email_id: email_id || null,
          reason: "Duplicate email in uploaded file",
        });
        skipped++;
        continue;
      }
      seenMobiles.add(mobileKey);
      if (emailKey) seenEmails.add(emailKey);

      const [dup] = await db.query(
        `SELECT id
         FROM leads
         WHERE mobile_number = ?
            OR mobile_number = ?
            OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(mobile_number, '+', ''), '-', ''), ' ', ''), '(', ''), ')', '') = ?
            OR RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(mobile_number, '+', ''), '-', ''), ' ', ''), '(', ''), ')', ''), 10) = ?
            OR email_id = ?
         LIMIT 1`,
        [normalizedMobile, `91${normalizedMobile}`, normalizedMobile, normalizedMobile, email_id || null]
      );
      if (dup.length > 0) {
        console.warn("[BULK-LEAD] Skip duplicate in DB", {
          schoolCode,
          full_name: effectiveFullName,
          normalizedMobileMasked: maskMobile(normalizedMobile),
          email: email_id || null,
          duplicateLeadId: dup[0]?.id || null,
        });
        duplicateEntries.push({
          mobile_number: normalizedMobile,
          full_name: effectiveFullName || null,
          email_id: email_id || null,
          reason: "Already exists in your school's leads",
          duplicateLeadId: dup[0]?.id || null,
        });
        skipped++;
        continue;
      }

      if (isPreviewOnly) {
        inserted++;
        continue;
      }

      await db.execute(sql, [
        lead_name || null,
        student_name || null,
        effectiveFullName || null,
        occupation || null,
        normalizedMobile || null,
        email_id || null,
        address || null,
        city || null,
        area || null,
        code || null,
        dob || null,
        effectiveReferBy,
        lead_admission_for || null,
        "manual",
        reg_no,
        ticket_no,
        null
      ]);
      console.log("[BULK-LEAD] Row inserted", {
        schoolCode,
        full_name: effectiveFullName,
        normalizedMobileMasked: maskMobile(normalizedMobile),
        email: email_id || null,
        reg_no,
        ticket_no,
      });

      console.log("[BULK-LEAD] Auto poster send skipped (bulk upload row)", {
        schoolCode,
        reg_no,
        mobile_number: maskMobile(normalizedMobile),
        email: email_id || null,
        lead_name: lead_name || null,
      });

      inserted++;
    }

    console.log("[BULK-LEAD] Upload complete", {
      schoolCode,
      inserted,
      skipped,
      queued,
      scheduleDaily: enableDailySchedule,
    });
    return res.json({
      success: true,
      inserted,
      skipped,
      duplicateEntries,
      previewOnly: isPreviewOnly,
      queuedPosterJobs: queued,
      scheduleDaily: enableDailySchedule
    });
  } catch (err) {
    console.error("Bulk upload error:", err);
    return res.status(500).json({ error: "Bulk upload failed" });
  }
});

app.post('/upload-photo-teacherdatainsertion', upload.single('photo'), async (req, res) => {
  console.log('--- Upload Photo Request Received ---');
  console.log('Request body fields:', req.body);
  console.log('Request file:', req.file);

  let connection;
  try {
    const { schoolCode, teacherId } = req.body;

    if (!schoolCode || !teacherId) {
      console.error('Validation Error: schoolCode and teacherId are required in form data');
      return res.status(400).json({ error: 'schoolCode and teacherId are required in form data' });
    }
    if (!req.file) {
      console.error('Validation Error: No photo file uploaded');
      return res.status(400).json({
        error: 'No photo file uploaded',
        details: {
          receivedFields: Object.keys(req.body),
          receivedFiles: req.file ? req.file : 'none',
          contentType: req.get('Content-Type'),
          multerError: req.file ? 'none' : 'Multer did not process any file'
        }
      });
    }

    // File is already saved to public/uploads/ by multer
    const photoPath = `uploads/${req.file.filename}`;

    console.log('Attempting database connection for schoolCode:', schoolCode);
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();
    console.log('Database connection established');

    console.log('Attempting database update for schoolCode:', schoolCode, 'and teacherId:', teacherId);
    const [result] = await connection.execute(
      `UPDATE management_login_creation
       SET photo = ?
       WHERE schoolCode = ? AND id = ?`,
      [photoPath, schoolCode, teacherId]
    );

    console.log('Database update result:', result);

    if (result.affectedRows === 0) {
      console.error('Database Error: No user found with schoolCode:', schoolCode, 'and id:', teacherId);
      return res.status(404).json({
        error: 'User with provided schoolCode and ID not found',
        schoolCode: schoolCode,
        teacherId: teacherId
      });
    }

    console.log('Upload successful for schoolCode:', schoolCode, 'and teacherId:', teacherId);
    res.json({
      success: true,
      message: 'Photo uploaded successfully',
      photoPath: `/${photoPath}`, // Provide a path for the frontend
      fileDetails: {
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        encoding: req.file.encoding
      }
    });
  } catch (error) {
    console.error('Error during photo upload:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to upload photo',
      details: error.message,
    });
  } 
});


app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ 
      error: 'File upload error',
      details: err.message 
    });
  }
  res.status(500).json({ error: 'Something went wrong!' });
});







app.get('/api/otherincome/totalsincome', async (req, res) => {
    const { schoolCode } = req.query;
    
    if (!schoolCode) {
        return res.status(400).json({
            success: false,
            message: 'School code is required'
        });
    }

    let connection;
    try {
        // Get connection using the promise-based version
        connection = await mysql.createConnection({
            host: '162.215.210.38',
            user: 'root',
            password: 'NavyAtagsoLnovA@$000',
            database: schoolCode
        });

        const query = `
            SELECT
                COALESCE(SUM(investment_amount), 0) AS total_investment,
                COALESCE(SUM(other_amount), 0) AS total_other,
                COALESCE(SUM(donation_amount), 0) AS total_donation,
                COALESCE(SUM(investment_amount + other_amount + donation_amount), 0) AS grand_total
            FROM school_income
        `;

        const [results] = await connection.query(query);
        
        res.json({
            success: true,
            data: results[0] || {
                total_investment: 0,
                total_other: 0,
                total_donation: 0,
                grand_total: 0
            }
        });
    } catch (err) {
        console.error('Error fetching income totals:', err);
        
        if (err.code === 'ER_BAD_DB_ERROR') {
            return res.status(404).json({
                success: false,
                message: 'School database not found'
            });
        }
        
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch income totals',
            error: err.message
        });
    } 
});
// NOVA database connection pool
const novaPool = mysql.createPool({
  host: '162.215.210.38',
  user: 'root',
  password: 'NavyAtagsoLnovA@$000',
  database: 'NOVA', // Connect to NOVA database
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
const sslOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/cleezoclass.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/cleezoclass.com/fullchain.pem')
};

// Socket.IO Setup
const httpsServer = https.createServer(sslOptions, app);
const io = new Server(httpsServer, { cors: { origin: "*" } });
notificationIo = io;
// Function to get a connection from the NOVA pool
async function getNovaConnection() {
  return await novaPool.getConnection();
}
app.post('/api/logincredentials', async (req, res, next) => {
  const { username, password, emailOnly } = req.body;
  const isEmailLogin = String(username || "").includes("@");
  const isEmailOnlyLogin =
    emailOnly === true || String(emailOnly).toLowerCase() === "true" || isEmailLogin;
  console.log('[LOGIN ATTEMPT]', { username, emailOnly: isEmailOnlyLogin });
console.log("BODY:", req.body);
  if (!username || (!isEmailOnlyLogin && !password)) {
    return res.status(400).json({
      message: isEmailOnlyLogin
        ? 'Email is required'
        : 'Username and password are required',
    });
  }

  try {
    if (isEmailOnlyLogin && !isEmailLogin) {
      return res.status(400).json({
        message: 'Please enter a valid email address',
      });
    }

    const [colRows] = await qualityPool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'management_login_creation'`
    );
    const columnSet = new Set(
      colRows.map((r) => String(r.COLUMN_NAME || '').toLowerCase())
    );
    const hasCol = (name) => columnSet.has(String(name).toLowerCase());
    const hasEmailColumn = hasCol('email');
    const hasUsernameColumn = hasCol('username');
    const hasNameColumn = hasCol('name');
    const loginUserCol = hasUsernameColumn ? 'username' : hasNameColumn ? 'name' : null;

    if (!loginUserCol) {
      return res.status(500).json({
        message: 'Login column not found in management_login_creation',
        code: 'LOGIN_COLUMN_MISSING'
      });
    }

    if ((isEmailLogin || isEmailOnlyLogin) && !hasEmailColumn) {
      return res.status(404).json({
        message:
          'Your email is not provided. Please login with the school provided username and password.',
        code: 'EMAIL_NOT_FOUND'
      });
    }

    // First, verify credentials in Quality database
    const selectFields = [
      `${loginUserCol} AS username`,
      'password',
      hasCol('user_type') ? 'user_type' : null,
      hasCol('schoolCode') ? 'schoolCode' : null,
      hasEmailColumn ? 'email' : null
    ]
      .filter(Boolean)
      .join(', ');

    let whereClause;
    let params;
    if (isEmailOnlyLogin) {
      whereClause = `LOWER(TRIM(email)) = LOWER(TRIM(?))`;
      params = [username];
    } else if (isEmailLogin) {
      whereClause = `LOWER(TRIM(email)) = LOWER(TRIM(?)) AND password = ?`;
      params = [username, password];
    } else if (hasEmailColumn) {
      whereClause = `(LOWER(TRIM(${loginUserCol})) = LOWER(TRIM(?)) OR LOWER(TRIM(email)) = LOWER(TRIM(?))) AND password = ?`;
      params = [username, username, password];
    } else {
      whereClause = `LOWER(TRIM(${loginUserCol})) = LOWER(TRIM(?)) AND password = ?`;
      params = [username, password];
    }

    const [users] = await qualityPool.query(
      `SELECT ${selectFields}
       FROM management_login_creation
       WHERE ${whereClause}
       LIMIT 1`,
      params
    );

    if (users.length === 0) {
      if ((isEmailLogin || isEmailOnlyLogin) && hasEmailColumn) {
        const [emailExists] = await qualityPool.query(
          `SELECT 1
           FROM management_login_creation
           WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))
           LIMIT 1`,
          [username]
        );

        if (emailExists.length === 0) {
          return res.status(404).json({
            message:
              'Your email is not provided. Please login with the school provided username and password.',
            code: 'EMAIL_NOT_FOUND'
          });
        }
      }

      return res.status(401).json({
        message: isEmailOnlyLogin
          ? 'Unable to login with email. Please use username and password.'
          : 'Invalid credentials'
      });
    }

    const user = users[0];
    let role;
    let designation = null;
    let isDirector = false;
    let name = null;
    const loginIdentifier = user.username || user.email || username;

    // Connect to the school-specific database to get designation
    const schoolDbConn = await getDatabaseConnection(user.schoolCode);

    try {
      const [schoolColRows] = await schoolDbConn.query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'management_login_creation'`
      );
      const schoolColumnSet = new Set(
        schoolColRows.map((r) => String(r.COLUMN_NAME || '').toLowerCase())
      );
      const schoolHasCol = (name) => schoolColumnSet.has(String(name).toLowerCase());
      const schoolHasEmail = schoolHasCol('email');
      const schoolHasUsername = schoolHasCol('username');
      const schoolHasName = schoolHasCol('name');
      const schoolLoginCol = schoolHasUsername ? 'username' : schoolHasName ? 'name' : null;

      if (schoolLoginCol) {
        const schoolWhere = schoolHasEmail
          ? `(LOWER(TRIM(${schoolLoginCol})) = LOWER(TRIM(?)) OR LOWER(TRIM(email)) = LOWER(TRIM(?)))`
          : `LOWER(TRIM(${schoolLoginCol})) = LOWER(TRIM(?))`;

        const [schoolUser] = await schoolDbConn.query(
          `SELECT designation, name
           FROM management_login_creation
           WHERE ${schoolWhere}
           LIMIT 1`,
          schoolHasEmail ? [loginIdentifier, loginIdentifier] : [loginIdentifier]
        );

        if (schoolUser.length > 0) {
          designation = schoolUser[0].designation?.toLowerCase();
          name = schoolUser[0].name;
        }
      }

    } finally {
      // no need to close connection if using pool
    }

    console.log('[ROLE CHECK]', {
      user_type: user.user_type,
      designation: designation,
    });

    if (user.user_type?.toLowerCase() === 'teacher') {
      role = 'teacher';
    } else {
      role = designation || 'management';
      if (role === 'director') {
        isDirector = true;
      }
    }

    return res.json({
      success: true,
      message: 'Login successful',
      username: user.username,
      role,
      name,
      user_type: user.user_type || null,
      schoolCode: user.schoolCode,
      isDirector
    });

  } catch (error) {
    console.error('[LOGIN ERROR]', error);
    next(error); // ⬅️ Forward to global error handler
  }
});

const verifyGoogleCredential = (idToken) =>
  new Promise((resolve, reject) => {
    if (!idToken) return reject(new Error("Missing Google credential"));
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    https
      .get(url, (resp) => {
        let data = "";
        resp.on("data", (chunk) => (data += chunk));
        resp.on("end", () => {
          try {
            const parsed = JSON.parse(data || "{}");
            if (parsed.error || parsed.error_description) {
              return reject(new Error(parsed.error_description || parsed.error));
            }
            resolve(parsed);
          } catch {
            reject(new Error("Invalid Google token response"));
          }
        });
      })
      .on("error", reject);
  });

app.post('/api/logincredentials/google', async (req, res, next) => {
  const { credential } = req.body || {};
  try {
    const googleUser = await verifyGoogleCredential(credential);
    const email = String(googleUser?.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Google email not available" });
    }

    const [colRows] = await qualityPool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'management_login_creation'`
    );
    const columnSet = new Set(colRows.map((r) => String(r.COLUMN_NAME || '').toLowerCase()));
    const hasCol = (name) => columnSet.has(String(name).toLowerCase());
    const hasEmailColumn = hasCol('email');
    const hasUsernameColumn = hasCol('username');
    const hasNameColumn = hasCol('name');
    const loginUserCol = hasUsernameColumn ? 'username' : hasNameColumn ? 'name' : null;

    if (!loginUserCol) {
      return res.status(500).json({
        message: 'Login column not found in management_login_creation',
        code: 'LOGIN_COLUMN_MISSING'
      });
    }

    if (!hasEmailColumn) {
      return res.status(404).json({
        message:
          'Your email is not provided. Please login with the school provided username and password.',
        code: 'EMAIL_NOT_FOUND'
      });
    }

    const [users] = await qualityPool.query(
      `SELECT ${loginUserCol} AS username, user_type, schoolCode, email
       FROM management_login_creation
       WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))
       LIMIT 1`,
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        message:
          'Your email is not provided. Please login with the school provided username and password.',
        code: 'EMAIL_NOT_FOUND'
      });
    }

    const user = users[0];
    let role;
    let designation = null;
    let isDirector = false;
    let name = null;
    const loginIdentifier = user.username || user.email || email;

    const schoolDbConn = await getDatabaseConnection(user.schoolCode);
    try {
      const [schoolColRows] = await schoolDbConn.query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'management_login_creation'`
      );
      const schoolColumnSet = new Set(
        schoolColRows.map((r) => String(r.COLUMN_NAME || '').toLowerCase())
      );
      const schoolHasCol = (n) => schoolColumnSet.has(String(n).toLowerCase());
      const schoolHasEmail = schoolHasCol('email');
      const schoolHasUsername = schoolHasCol('username');
      const schoolHasName = schoolHasCol('name');
      const schoolLoginCol = schoolHasUsername ? 'username' : schoolHasName ? 'name' : null;

      if (schoolLoginCol) {
        const schoolWhere = schoolHasEmail
          ? `(LOWER(TRIM(${schoolLoginCol})) = LOWER(TRIM(?)) OR LOWER(TRIM(email)) = LOWER(TRIM(?)))`
          : `LOWER(TRIM(${schoolLoginCol})) = LOWER(TRIM(?))`;

        const [schoolUser] = await schoolDbConn.query(
          `SELECT designation, name
           FROM management_login_creation
           WHERE ${schoolWhere}
           LIMIT 1`,
          schoolHasEmail ? [loginIdentifier, loginIdentifier] : [loginIdentifier]
        );

        if (schoolUser.length > 0) {
          designation = schoolUser[0].designation?.toLowerCase();
          name = schoolUser[0].name;
        }
      }
    } finally {
      // pool-managed
    }

    if (String(user.user_type || "").toLowerCase() === 'teacher') {
      role = 'teacher';
    } else {
      role = designation || 'management';
      if (role === 'director') isDirector = true;
    }

    return res.json({
      success: true,
      message: 'Login successful',
      username: user.username,
      role,
      name,
      user_type: user.user_type || null,
      schoolCode: user.schoolCode,
      isDirector
    });
  } catch (error) {
    console.error('[GOOGLE LOGIN ERROR]', error);
    next(error);
  }
});


app.get('/api/getpaidinstallment/:studentId', async (req, res) => {
  const { studentId } = req.params;
  const { schoolCode } = req.query;

  if (!studentId || !schoolCode) {
    return res.status(400).json({
      message: 'studentId and schoolCode are required'
    });
  }

  let connection;
  try {
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();

    // Fetch only paid amounts and dates if needed
    const [rows] = await connection.execute(
      `SELECT
         Installment1_Paid,
         Installment2_Paid,
         Installment3_Paid,
         Installment4_Paid,
         Installment5_Paid,
         paidDate
       FROM FeesDetails
       WHERE login_id = ?
       LIMIT 1`,
      [studentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: 'No fee record found for this student'
      });
    }

    res.json({
      success: true,
      installments: {
        installment1: rows[0].Installment1_Paid,
        installment2: rows[0].Installment2_Paid,
        installment3: rows[0].Installment3_Paid,
        installment4: rows[0].Installment4_Paid,
        installment5: rows[0].Installment5_Paid
      },
      paidDate: rows[0].paidDate
    });

  } catch (err) {
    console.error('❌ Error fetching paid installments:', err);
    res.status(500).json({
      message: 'Internal server error',
      error: err.message
    });
  } 
});

// GET - Most Recent Expenses
// GET - Most Recent Expenses (Corrected with JOIN)
// ✅ NEW AND CORRECTED: Fetches expenses for a specific date
// This replaces the old /api/expenses/today endpoint.
// GET - Expenses for a specific date (This replaces the old /api/expenses/today)
app.get('/api/edited-bills', async (req, res) => {
  // We now require the username of the person logged in to find their name.
  const { schoolCode, username } = req.query;

  // Validate that both required parameters were sent from the frontend.
  if (!schoolCode || !username) {
    return res.status(400).json({ error: 'schoolCode and username are required parameters' });
  }

  let db;
  try {
    db = await getDatabaseConnection(schoolCode);

    // --- STEP 1: Find the full name of the logged-in user ---
    // We query the management table to get the 'name' corresponding to the 'username'.
    const userQuery = `
      SELECT name
      FROM management_login_creation
      WHERE username = ?;
    `;
    const [userResults] = await db.query(userQuery, [username, schoolCode]);

    // If the user isn't found, we can't proceed.
    if (userResults.length === 0) {
      return res.status(404).json({ error: 'Editor user not found in the system.' });
    }
    // Store the editor's name. From your screenshot, if username is 'nova9150', this will be 'NOVA'.
    const editorName = userResults[0].name;

    // --- STEP 2: Find all bills that have been edited ---
    // An edited bill is one where 'edit_reason' is not empty.
    // We select from the bills_uploads table directly.
    const billsQuery = `
      SELECT id, studentName, receiptNumber, edit_reason
      FROM bills_uploads ;
    `;
    const [billsResults] = await db.query(billsQuery, [schoolCode]);

    // --- STEP 3: Combine the results ---
    // We add the editor's name (found in Step 1) to every edited bill record.
    const finalResults = billsResults.map(bill => ({
      id: bill.id,
      studentName: bill.studentName,
      receiptNumber: bill.receiptNumber,
      edit_reason: bill.edit_reason,
      editorName: editorName // Assigning the logged-in user's name to every row
    }));

    // Send the final, combined data to the frontend.
    res.json(finalResults);

  } catch (error) {
    // Log the detailed database error for debugging.
    console.error("!!! DATABASE QUERY FAILED:", error);
   
    res.status(500).json({
        error: 'Failed to retrieve edited bills data. Check server logs for details.',
        details: { message: error.message, code: error.code }
    });
  } 
});

app.post('/api/bill/log-edit-reason', async (req, res) => {
  // --- Get schoolCode from the query parameter ---
  const { schoolCode } = req.query;
  console.log("here is schoolCODE",schoolCode)

  // 1. --- DATA VALIDATION ---
  // Destructure the rest of the data from the request body.
  const {
    receiptNumber,
    studentName,
    className,
    section,
    imagePath,
    regn_no,
    editReason
  } = req.body;

  // Ensure the schoolCode from the query exists.
  if (!schoolCode) {
    return res.status(400).json({
      success: false,
      message: 'Bad Request: Missing schoolCode query parameter.'
    });
  }

  // Ensure all required data has been sent from the client body.
  if (!receiptNumber || !studentName || !className || !section || !imagePath || !regn_no || !editReason) {
    return res.status(400).json({
      success: false,
      message: 'Bad Request: Missing required fields in the body for logging the bill edit.'
    });
  }

  let db;
  try {
    // 2. --- DATABASE CONNECTION ---
    // Get the database connection specific to the school.
    db = await getDatabaseConnection(schoolCode);

    // 3. --- DATABASE QUERY ---
    // SQL query to insert a new row with the edited bill's data.
    const query = `
      INSERT INTO bills_uploads (
        receiptNumber,
        studentName,
        class,
        section,
        image_path,
        regn_no,
        edit_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?);
    `;

    // An array of values to be safely inserted into the query.
    const values = [
      receiptNumber,
      studentName,
      className,
      section,
      imagePath,
      regn_no,
      editReason
    ];

    // 4. --- EXECUTE AND RESPOND ---
    // Execute the insert query.
    const [results] = await db.query(query, values);

    // Check if the insert was successful. `insertId` will be greater than 0.
    if (results.insertId) {
      // If the insert is successful, send a 201 Created response.
      res.status(201).json({
        success: true,
        message: 'Edited bill details have been logged successfully.',
        recordId: results.insertId
      });
    } else {
      // ✅ Instead of throw, pass error to middleware
      const err = new Error('Failed to insert the record for an unknown reason.');
      err.status = 500;
      return next(err); 
    }

  } catch (error) {
    // Handle any potential database errors.
    console.error("Database error while logging edited bill:", error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error: Could not log the edited bill.'
    });

  } 
});

// ✅ CORRECTED AND FINAL /api/income/details ENDPOINT
// ✅ NEW AND CORRECTED: Fetches detailed income records based on your exact requirements.

// Make sure you have the 'cors' package installed (`npm install cors`)
// and configured in your main server file.
// const cors = require('cors');
// const app = express();
// app.use(cors()); // This should be near the top

app.get('/api/income/details', async (req, res) => {
  const { schoolCode, class: className, section, startDate, endDate } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: 'schoolCode is a required parameter' });
  }

  let db;
  try {
    db = await getDatabaseConnection(schoolCode);

    // Start with the base query. The `1 = 1` is a trick to make
    // appending `AND` clauses easier.
    let sql = `
      SELECT
        StudentName,
        Class_name,
        section,
        paymentMode,
        Paid_Amount,
        Final_Amount,
        (Final_Amount - Paid_Amount) AS Balance,
        login_id
      FROM
        FeesDetails
      WHERE 1 = 1
    `;
   
    const queryParams = [];

    // IMPORTANT: Make sure the column name 'created_at' matches your database table.
    // If it's 'payment_date', change it here.
    const dateColumn = 'created_at';

    if (startDate && endDate) {
      sql += ` AND DATE(${dateColumn}) BETWEEN ? AND ?`;
      queryParams.push(startDate, endDate);
    } else if (startDate) {
      sql += ` AND DATE(${dateColumn}) = ?`;
      queryParams.push(startDate);
    }

    if (className) {
      sql += ' AND Class_name = ?';
      queryParams.push(className);
    }

    if (section) {
      sql += ' AND section = ?';
      queryParams.push(section);
    }
   
    // Always filter for paid amounts
    sql += ' AND Paid_Amount > 0';

    // Add the final ordering clause
    sql += ` ORDER BY ${dateColumn} DESC`;
   
    console.log("Executing SQL:", sql); // For debugging
    console.log("With Params:", queryParams); // For debugging

    const [results] = await db.query(sql, queryParams);
   
    const formattedResults = results.map(row => ({
      StudentName: row.StudentName,
      Class: row.Class_name,
      Section: row.section,
      PaymentMode: row.paymentMode || 'N/A',
      Amount: row.Paid_Amount,
      Balance: row.Balance,
      login_id: row.login_id
    }));

    res.json(formattedResults);

  } catch (err) {
    // This is the error that gets sent to the frontend.
    console.error("!!! FATAL DB ERROR in /api/income/details:", err);
    res.status(500).json({
        error: 'Database query failed for detailed income',
        details: err.message // Send back the error detail for easier debugging
    });
  } 
});

// GET - Most Recent Expenses
// GET - Most Recent Expenses (Corrected with JOIN)
// ✅ NEW AND CORRECTED: Fetches expenses for a specific date
// This replaces the old /api/expenses/today endpoint.
// GET - Expenses for a specific date (This replaces the old /api/expenses/today)
app.get('/api/expenses/by-date', async (req, res) => {
console.log('Received request for bill expenses data');

  const { startDate, endDate, date, schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: 'schoolCode is a required parameter' });
  }

  let db;
  try {
    db = await getDatabaseConnection(schoolCode);

    // This query selects the exact columns you need from the 'bills' table.
    let query = `
      SELECT
        id,
        bill_type,
        amount,
        date,
        image_path
      FROM bills
      WHERE schoolCode = ?
    `;

    const params = [schoolCode];

    // This logic correctly handles a date range or a single date.
    if (startDate && endDate) {
      query += ` AND DATE(date) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    } else if (date) {
      query += ` AND DATE(date) = ?`;
      params.push(date);
    }
   
    query += ` ORDER BY date DESC`;

    console.log('Executing SQL query:', query, 'with params:', params);

    const [results] = await db.query(query, params);
   
    // The server is now sending the correct data.
    res.json(results);

  } catch (error) {
    console.error('Database operation failed:', error.message);
    res.status(500).json({ error: 'Failed to retrieve bill expenses data' });
  } 
});

// GET - Latecomers & Requests (These remain as safe templates)
// GET - Recent Teacher Attendance
app.get('/api/latecomers/today', async (req, res) => {
    const { schoolCode } = req.query;
    if (!schoolCode) return res.status(400).json({ error: 'schoolCode is a required parameter' });
    let db;
    try {
        db = await getDatabaseConnection(schoolCode);

        // ✅ UPDATED SQL QUERY to select all the required columns
          const sql = `
              SELECT
                  t.id,
                  m.name,
                  t.date,
                  t.time,
                  t.entry_time AS Login_time
              FROM
                  teachers_attendance t
              JOIN
                  management_login_creation m
                  ON t.teacher_id = m.id
              WHERE
                  m.schoolCode = ?
              ORDER BY
                  t.date DESC, t.time DESC
              LIMIT 15
          `;
       
        const [results] = await db.query(sql);
        res.json(results);

    } catch (err) {
        console.warn("DB NOTE: Query for latecomers failed. The 'teachers_attendance' table may not exist or has changed.", err.message);
        res.json([]);
    } 
});


app.get('/api/latecomer-details', async (req, res) => {
    const { schoolCode, username, date } = req.query;

    if (!schoolCode || !username || !date) {
        return res.status(400).json({ error: 'schoolCode, username, and date are required parameters' });
    }

    let db;
    try {
        db = await getDatabaseConnection(schoolCode);

        // This query counts entries for a specific user in a given month and year
        // where their actual entry time was later than their scheduled punch-in time.
        const sql = `
            SELECT COUNT(*) AS late_count
            FROM teachers_attendance
            WHERE username = ?
              AND MONTH(date) = MONTH(?)
              AND YEAR(date) = YEAR(?)
              AND entry_time > time
        `;

        const [results] = await db.query(sql, [username, date, date]);

        res.json({
            success: true,
            lateCount: results[0].late_count || 0,
        });

    } catch (err) {
        console.error("DB ERROR in /api/latecomer-details:", err.message);
        res.status(500).json({ success: false, error: 'Database query failed for latecomer details' });
    } 
});


app.get('/api/leave-requests/all', async (req, res) => {
    const { schoolCode } = req.query;
    if (!schoolCode) {
        return res.status(400).json({ error: 'schoolCode is a required parameter' });
    }

    let db;
    try {
        db = await getDatabaseConnection(schoolCode);

        // ✅ FIXED SQL QUERY: Corrected column names and ordering
        const sql = `
            SELECT
                teacher_id,
                teacher_name,
                leave_start_date,
                leave_end_date,
                reason,
                status
            FROM
                teacher_leave_requests
            ORDER BY
                leave_start_date DESC
        `;
       
        const [results] = await db.query(sql);

        // ✅ FIXED DATA MAPPING: Formats the data to match what the frontend table needs
        const allLeaveRequests = results.map(req => ({
            teacherId: req.teacher_id,
            teacherName: req.teacher_name,
            // Combine start and end dates into one string
            leaveDates: `${new Date(req.leave_start_date).toLocaleDateString('en-GB')} - ${new Date(req.leave_end_date).toLocaleDateString('en-GB')}`,
            reason: req.reason,
            status: req.status
        }));
       
        // Send the correctly formatted data
        res.json(allLeaveRequests);

    } catch (err) {
        console.error("DB ERROR in /api/leave-requests/all:", err.message);
        // Provide a more specific error message
        res.status(500).json({ error: 'Database query failed for leave requests' });
    } 
});


const ensureExpenseRequestTableExists = async (db) => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS expense_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      expense_name VARCHAR(255) NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      previous_graduate TEXT,
      status VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await db.query(createTableQuery);
    console.log("✅ 'expense_requests' table is ready.");
  } catch (err) {
    console.error("❌ Error creating or verifying 'expense_requests' table:", err);
    throw err;
  }
};

// 1. FIXED ENDPOINT: Create a new expense request
app.post('/api/expense-request', async (req, res) => {
  const { expenseName, amount, previousGraduate, schoolCode } = req.body;

  if (!schoolCode || !expenseName || !amount) {
    return res.status(400).json({ message: 'schoolCode, expenseName, and amount are required.' });
  }

  let db;
  try {
    db = await getDatabaseConnection(schoolCode);
    await ensureExpenseRequestTableExists(db);

    const status = 'Pending';
    const insertQuery = `
      INSERT INTO expense_requests (expense_name, amount, previous_graduate, status)
      VALUES (?, ?, ?, ?);
    `;
    const params = [expenseName, amount, previousGraduate || null, status];
    const [result] = await db.query(insertQuery, params);

    // CRITICAL FIX: The line below causes a server error because 'io' is not defined.
    // It has been commented out to allow requests to be saved successfully.
    // io.emit('new_expense_request', newRequestForNotification);

    res.status(201).json({
        message: 'Expense request submitted and is now pending approval.',
        id: result.insertId
    });

  } catch (err) {
    console.error("❌ Failed to process expense request:", err);
    res.status(500).json({ message: 'Failed to create expense request due to a server error.' });
  } 
});


// 2. CORRECTED ENDPOINT: Get all expense requests (for the modal view with date filter)
app.get('/api/expense-requests', async (req, res) => {
    const { schoolCode } = req.query; // Get schoolCode from query parameter

    if (!schoolCode) {
        return res.status(400).json({ message: 'A schoolCode is required to fetch requests.' });
    }

    let db;
    try {
        db = await getDatabaseConnection(schoolCode);
        await ensureExpenseRequestTableExists(db); // Ensure table exists before querying

        // CORRECTED QUERY: Fetches ALL requests and orders them by the most recent.
        // It's limited to the last 50 requests for performance.
        const [allRequests] = await db.query(
          "SELECT * FROM expense_requests ORDER BY created_at DESC LIMIT 50"
        );
        res.status(200).json(allRequests);

    } catch (err) {
        console.error("❌ Failed to fetch expense requests:", err);
        res.status(500).json({ message: 'Failed to fetch expense requests.' });
    } 
});

// 3. NEW ENDPOINT: Get only PENDING expense requests (for the main dashboard view)
app.get('/api/expense-requests/pending', async (req, res) => {
    const { schoolCode } = req.query;

    if (!schoolCode) {
        return res.status(400).json({ message: 'A schoolCode is required.' });
    }

    let db;
    try {
        db = await getDatabaseConnection(schoolCode);
        await ensureExpenseRequestTableExists(db);

        const [pendingRequests] = await db.query(
          "SELECT * FROM expense_requests WHERE status = 'Pending' ORDER BY created_at DESC"
        );
        res.status(200).json(pendingRequests);
    } catch (err) {
        console.error("❌ Failed to fetch pending expense requests:", err);
        res.status(500).json({ message: 'Failed to fetch pending requests.' });
    } 
});


// 4. CORRECTED ENDPOINT: Update the status of a specific expense request
app.put('/api/expense-request/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, schoolCode } = req.body;

    if (!schoolCode) {
        return res.status(400).json({ message: 'A schoolCode is required to update the request.' });
    }
    if (!status || !['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ message: 'A valid status ("Approved" or "Rejected") is required.' });
    }

    let db;
    try {
        db = await getDatabaseConnection(schoolCode);
       
        const updateQuery = 'UPDATE expense_requests SET status = ? WHERE id = ?';
        const [result] = await db.query(updateQuery, [status, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Request not found with that ID.' });
        }

        res.status(200).json({ message: `Request has been successfully ${status}.` });

    } catch (err) {
        console.error("❌ Failed to update expense request status:", err);
        res.status(500).json({ message: 'Failed to update request status.' });
    } 
});
 
 
app.get('/api/financial-summary/today', async (req, res) => {
    // 1. Get the schoolCode from the query string (e.g., /api/...?schoolCode=YOUR_SCHOOL)
    const { schoolCode } = req.query;
    console.log(`[API] Received request for daily financial summary for school: ${schoolCode}`);

    // 2. --- VALIDATION ---
    // Ensure a school code was provided, otherwise the request is invalid.
    if (!schoolCode) {
        return res.status(400).json({ message: 'School code is a required parameter.' });
    }

    // 3. --- DATABASE CONNECTION AND LOGIC ---
    let db; // Define the connection variable outside the try block
    try {
        // Get today's date in 'YYYY-MM-DD' format, which is safe for SQL.
        const today = new Date().toISOString().split('T')[0];

        // Connect to the specific school's database using your existing function.
        db = await getDatabaseConnection(schoolCode);
        console.log(`[DB] Connected to database: ${schoolCode}`);

        // --- Define SQL Queries ---

        // Query to sum all money paid from the 'FeesDetails' table for today.
        // It uses COALESCE to return 0 instead of NULL if no payments were made.
        const incomeQuery = `
            SELECT COALESCE(SUM(Paid_Amount), 0) AS totalIncome
            FROM FeesDetails
            WHERE DATE(created_at) = ?;
        `;
        // IMPORTANT: I am assuming the date column is `created_at`. If your payment date
        // is stored in a different column (e.g., `payment_date`), change it here.

        // Query to sum all money spent from the 'expenses' table for today.
        const expenseQuery = `
            SELECT COALESCE(SUM(amount), 0) AS totalExpense
            FROM expenses
            WHERE DATE(date) = ?;
        `;
        // NOTE: This uses the 'expenses' table as requested. If your expenses are in
        // the 'bills' table, change `FROM expenses` to `FROM bills`.

        console.log(`[DB] Executing summary queries for date: ${today}`);

        // --- Execute Queries in Parallel ---
        // `Promise.all` runs both queries at the same time for better performance.
        const [incomeResult, expenseResult] = await Promise.all([
            db.query(incomeQuery, [today]),
            db.query(expenseQuery, [today])
        ]);

        // 4. --- PROCESS AND SEND RESPONSE ---
        // Extract the calculated sum from the database result.
        // The result of db.query is [rows, fields], so we take the first row of the first element.
        const totalIncome = incomeResult[0][0].totalIncome;
        const totalExpense = expenseResult[0][0].totalExpense;

        console.log(`[API] Summary Calculated: Income = ${totalIncome}, Expense = ${totalExpense}`);

        // Send the final data back to the frontend in JSON format.
        res.status(200).json({
            totalIncome: totalIncome,
            totalExpense: totalExpense
        });

    } catch (error) {
        // This catch block is what currently causes "Summary N/A" to appear on your dashboard.
        console.error("❌ [API ERROR] Failed to fetch daily financial summary:", error);
        res.status(500).json({ message: "Failed to fetch daily financial summary due to a server error." });

    } 
});
app.get('/api/class-installments', async (req, res) => {
  const { class: className, section, schoolCode } = req.query;

  if (!schoolCode || !className || !section) {
    return res.status(400).json({
      success: false,
      message: 'School code, class and section are required'
    });
  }

  let db;
  try {
    db = await mysql.createConnection({
      host: '162.215.210.38',
      user: 'root',
      password: 'NavyAtagsoLnovA@$000',
      database: schoolCode,
    });

    // ✅ NUMERIC CLASS ONLY
    const classNumber = className.replace(/\D/g, ''); // "Class 10" → "10"

    console.log(`Using numeric class: ${classNumber}`);

    const query = `
      SELECT
        Installment1_Amount, Installment1_Deadline_Date, Installment1_Fine,
        Installment2_Amount, Installment2_Deadline_Date, Installment2_Fine,
        Installment3_Amount, Installment3_Deadline_Date, Installment3_Fine,
        Installment4_Amount, Installment4_Deadline_Date, Installment4_Fine,
        Installment5_Amount, Installment5_Deadline_Date, Installment5_Fine
      FROM FeesDetails
      WHERE FeeClass = ?
        AND FeeSection = ?
        AND (
          Installment1_Amount IS NOT NULL OR
          Installment2_Amount IS NOT NULL OR
          Installment3_Amount IS NOT NULL OR
          Installment4_Amount IS NOT NULL OR
          Installment5_Amount IS NOT NULL
        )
      LIMIT 1;
    `;

    const params = [classNumber, section];

    const [result] = await db.query(query, params);
    

    if (!result.length) {
      return res.status(404).json({
        success: false,
        message: 'No installment data found'
      });
    }

    const row = result[0];

    // ✅ INSTALLMENT NUMBERS ONLY
    const installments = [
      { installment: 1, amount: row.Installment1_Amount, dueDate: row.Installment1_Deadline_Date, fine: row.Installment1_Fine },
      { installment: 2, amount: row.Installment2_Amount, dueDate: row.Installment2_Deadline_Date, fine: row.Installment2_Fine },
      { installment: 3, amount: row.Installment3_Amount, dueDate: row.Installment3_Deadline_Date, fine: row.Installment3_Fine },
      { installment: 4, amount: row.Installment4_Amount, dueDate: row.Installment4_Deadline_Date, fine: row.Installment4_Fine },
      { installment: 5, amount: row.Installment5_Amount, dueDate: row.Installment5_Deadline_Date, fine: row.Installment5_Fine }
    ].filter(i => i.amount !== null);

    return res.status(200).json({
      success: true,
      class: Number(classNumber),   // ✅ numeric
      section,
      installments                  // ✅ numeric installments
    });

  } catch (error) {
    console.error('Error fetching class installment details:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Middleware to get schoolCode and attach pool to request
app.post('/api/installmentdetails', async (req, res) => {
  try {
    const {
      schoolCode,
      FeeClass,
      FeeSection,
      UpdatedCompleteFee,
      login_id,
      Installment1_Amount,
      Installment1_Deadline_Date,
      Installment1_Fine,
      Installment2_Amount,
      Installment2_Deadline_Date,
      Installment2_Fine,
      Installment3_Amount,
      Installment3_Deadline_Date,
      Installment3_Fine,
      Installment4_Amount,
      Installment4_Deadline_Date,
      Installment4_Fine,
      Installment5_Amount,
      Installment5_Deadline_Date,
      Installment5_Fine
    } = req.body;

    if (!schoolCode) {
      return res.status(400).json({ success: false, message: 'School code is required' });
    }

    // Create school-specific connection
    const db = await mysql.createConnection({
      host: '162.215.210.38',
      user: 'root',
      password: 'NavyAtagsoLnovA@$000',
      database: schoolCode
    });

    try {
      // Check if the record exists
      const [checkResult] = await db.query('SELECT * FROM FeesDetails WHERE login_id = ?', [login_id]);

      if (checkResult.length > 0) {
        // Record exists, perform update
        const updateQuery = `
          UPDATE FeesDetails
          SET
            FeeClass = ?,
            FeeSection = ?,
            UpdatedCompleteFee = ?,
            Installment1_Amount = ?,
            Installment1_Deadline_Date = ?,
            Installment1_Fine = ?,
            Installment2_Amount = ?,
            Installment2_Deadline_Date = ?,
            Installment2_Fine = ?,
            Installment3_Amount = ?,
            Installment3_Deadline_Date = ?,
            Installment3_Fine = ?,
            Installment4_Amount = ?,
            Installment4_Deadline_Date = ?,
            Installment4_Fine = ?,
            Installment5_Amount = ?,
            Installment5_Deadline_Date = ?,
            Installment5_Fine = ?,
            updated_at = NOW()
          WHERE login_id = ?
        `;
        const updateValues = [
          FeeClass,
          FeeSection,
          UpdatedCompleteFee,
          Installment1_Amount,
          Installment1_Deadline_Date,
          Installment1_Fine,
          Installment2_Amount,
          Installment2_Deadline_Date,
          Installment2_Fine,
          Installment3_Amount,
          Installment3_Deadline_Date,
          Installment3_Fine,
          Installment4_Amount,
          Installment4_Deadline_Date,
          Installment4_Fine,
          Installment5_Amount,
          Installment5_Deadline_Date,
          Installment5_Fine,
          login_id
        ];

        await db.query(updateQuery, updateValues);
      } else {
        // Record does not exist, perform insert
        const insertQuery = `
          INSERT INTO FeesDetails (
            FeeClass,
            FeeSection,
            UpdatedCompleteFee,
            Installment1_Amount,
            Installment1_Deadline_Date,
            Installment1_Fine,
            Installment2_Amount,
            Installment2_Deadline_Date,
            Installment2_Fine,
            Installment3_Amount,
            Installment3_Deadline_Date,
            Installment3_Fine,
            Installment4_Amount,
            Installment4_Deadline_Date,
            Installment4_Fine,
            Installment5_Amount,
            Installment5_Deadline_Date,
            Installment5_Fine,
            login_id,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?, NOW(), NOW())
        `;
        const insertValues = [
          FeeClass,
          FeeSection,
          UpdatedCompleteFee,
          Installment1_Amount,
          Installment1_Deadline_Date,
          Installment1_Fine,
          Installment2_Amount,
          Installment2_Deadline_Date,
          Installment2_Fine,
          Installment3_Amount,
          Installment3_Deadline_Date,
          Installment3_Fine,
          Installment4_Amount,
          Installment4_Deadline_Date,
          Installment4_Fine,
          Installment5_Amount,
          Installment5_Deadline_Date,
          Installment5_Fine,
          login_id
        ];

        await db.query(insertQuery, insertValues);
      }

       // Close connection
      return res.status(200).json({ success: true });
    } catch (error) {
       // Ensure connection is closed even if error occurs
      console.error('Database error:', error);
      return res.status(500).json({ success: false, message: 'Installment amounts and dates should be required' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Installment amounts and dates should be required' });
  }
});
app.get('/api/events', async (req, res) => {
  try {
    const { eventName, schoolCode } = req.query;
    if (!schoolCode) {
      return res.status(400).json({ error: 'schoolCode parameter is required' });
    }

    const pool = getDatabaseConnection(schoolCode);
    const connection = await pool.getConnection();

    // Corrected query (removed extra comma)
    let query = 'SELECT id, festival_name FROM school_festivals';
    let params = [];

    if (eventName) {
      query += ' WHERE festival_name LIKE ?';
      params.push(`%${eventName}%`);
    }

    const [results] = await connection.query(query, params);

    const events = results.map(event => ({
      id: event.id,
      event_name: event.festival_name,
    }));

    res.json(events);
  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});


// Get event details by ID
app.get('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolCode } = req.query;
    if (!schoolCode) {
      return res.status(400).json({ error: 'schoolCode parameter is required' });
    }

const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();
    const [results] = await connection.query(
      'SELECT * FROM event_notification WHERE id = ?',
      [id]
    );

    if (results.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = results[0];
    const response = {
      id: event.id,
      event_name: event.event_name,
      school_name: event.school_name,
      ...(event.image && { image: event.image.toString('base64') })
    };

    res.json(response);
  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});
app.put('/api/remove-discount/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { schoolCode } = req.body;

    if (!schoolCode) {
      return res.status(400).json({ error: 'School code is required' });
    }

    // Get a connection to the school-specific database
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();

    // Update the discounts to 0
    const sql = `
      UPDATE FeesDetails 
      SET 
        Discount = 0,
        tuition_discount = 0,
        fee_discount = 0,
        bus_discount = 0
      WHERE id = ?
    `;
    
    await connection.query(sql, [studentId]);
    
    // Release the connection
    

    res.status(200).json({ message: 'Discount removed successfully' });
  } catch (error) {
    console.error('Error removing discount:', error);
    res.status(500).json({ message: 'Error removing discount' });
  }
});
// Generate WhatsApp links
app.post('/api/generate-whatsapp-links', async (req, res) => {
  try {
    const { eventId, recipientType, schoolCode } = req.body;
    if (!eventId || !recipientType || !schoolCode) {
      return res.status(400).json({ error: 'eventId, recipientType, and schoolCode are required' });
    }

const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();

    // Get event details
    const [eventResults] = await connection.query(
      'SELECT * FROM event_notification WHERE id = ?',
      [eventId]
    );

    if (eventResults.length === 0) {
      
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResults[0];
    const message = `New Event Notification\n\n` +
                   `*${event.event_name}*\n` +
                   `🏫 School: ${event.school_name || 'Not specified'}\n\n` +
                   `Please confirm your attendance.`;

    // Get recipients from management_login_creation
    let query;
    if (recipientType === 'students') {
      query = "SELECT id, name, phone_no AS phone FROM management_login_creation WHERE phone_no IS NOT NULL AND user_type = 'student'";
    } else if (recipientType === 'teachers') {
      query = "SELECT id, name, phone_no AS phone FROM management_login_creation WHERE phone_no IS NOT NULL AND user_type = 'teacher'";
    } else {
      query = "SELECT id, name, phone_no AS phone FROM management_login_creation WHERE phone_no IS NOT NULL AND (user_type = 'student' OR user_type = 'teacher')";
    }

    const [recipients] = await connection.query(query);
    

    const results = recipients.map(recipient => {
      const phone = recipient.phone.toString().replace(/\D/g, '');
      const whatsappLink = `https://wa.me/${phone.startsWith('91') ? phone : '91' + phone}?text=${encodeURIComponent(message)}`;

      return {
        id: recipient.id,
        name: recipient.name,
        phone: recipient.phone,
        whatsappLink
      };
    });

    res.json({
      success: true,
      event: {
        id: event.id,
        name: event.event_name,
        school_name: event.school_name
      },
      recipientType,
      totalRecipients: results.length,
      recipients: results
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Send notifications to all recipients of a selected type
app.post('/api/send-notification-to-all', async (req, res) => {
  try {
    const { eventId, recipientType, schoolCode } = req.body;

    if (!eventId || !recipientType || !schoolCode) {
      return res.status(400).json({ error: 'eventId, recipientType, and schoolCode are required' });
    }

const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();

    // Get event details
    const [eventResults] = await connection.query(
      'SELECT * FROM event_notification WHERE id = ?',
      [eventId]
    );

    if (eventResults.length === 0) {
      
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResults[0];
    const message = `New Event Notification\n\n` +
                   `*${event.event_name}*\n` +
                   `🏫 School: ${event.school_name || 'Not specified'}\n\n` +
                   `Please confirm your attendance.`;

    // Get recipients from management_login_creation
    let query;
    if (recipientType === 'students') {
      query = "SELECT id, name, phone_no AS phone FROM management_login_creation WHERE phone_no IS NOT NULL AND user_type = 'student'";
    } else if (recipientType === 'teachers') {
      query = "SELECT id, name, phone_no AS phone FROM management_login_creation WHERE phone_no IS NOT NULL AND user_type = 'teacher'";
    } else {
      query = "SELECT id, name, phone_no AS phone FROM management_login_creation WHERE phone_no IS NOT NULL AND (user_type = 'student' OR user_type = 'teacher')";
    }

    const [recipients] = await connection.query(query);
    

    // Send notifications to all recipients
    const sendNotificationPromises = recipients.map(recipient => {
      const phone = recipient.phone.toString().replace(/\D/g, '');
      const whatsappLink = `https://wa.me/${phone.startsWith('91') ? phone : '91' + phone}?text=${encodeURIComponent(message)}`;

      // Here you would typically call a service to send the WhatsApp message
      // For example, using Twilio API or any other WhatsApp API service
      return axios.post('https://api.whatsapp.com/send', {
        phone,
        message
      });
    });

    await Promise.all(sendNotificationPromises);

    res.json({
      success: true,
      message: `Notifications sent to all ${recipientType} successfully!`,
      totalRecipients: recipients.length
    });
  } catch (err) {
    console.error('Error sending notifications:', err);
    res.status(500).json({ error: 'Failed to send notifications to all. Please try again.' });
  }
});
// --- NEW ENDPOINT: Update Discount Amount (EDIT) ---
app.put('/api/update-discount', async (req, res) => {
  const { studentId, schoolCode, newDiscountAmount, reason } = req.body;

  console.log("🟧 Incoming Request: /api/update-discount");
  console.log("👉 Request Body:", { studentId, schoolCode, newDiscountAmount, reason });

  if (!studentId || !schoolCode || newDiscountAmount === undefined || reason === undefined) {
    return res.status(400).json({ error: 'Student ID, school code, new discount amount, and reason are required' });
  }

  const discountAmount = parseFloat(newDiscountAmount);

  if (isNaN(discountAmount) || discountAmount < 0) {
    return res.status(400).json({ error: 'Invalid discount amount provided.' });
  }

  try {
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();
    
    // SQL to update the main Discount column and the reason
    const updateSql = `
      UPDATE FeesDetails 
      SET 
        Discount = ?, 
        discount_reason = ?, 
        tuition_discount = ?, 
        fee_discount = ?, 
        bus_discount = ? 
      WHERE 
        id = ?
    `;

    // Note on Discount Mapping: 
    // Since the frontend only provides a total discount, we will assume this total amount
    // should be applied to one of the specific discount fields (e.g., tuition_discount) 
    // or set as the total 'Discount' while setting others to 0 to prevent double-counting 
    // in complex fee calculation logic.
    
    // For simplicity, we set the total 'Discount' field and the 'tuition_discount' field 
    // to the new amount, and clear others.
    const params = [
      discountAmount,  // Sets the main total Discount field
      reason,          // Sets the reason
      discountAmount,  // Sets tuition_discount (assuming primary focus)
      0.00,            // Clears fee_discount
      0.00,            // Clears bus_discount
      studentId
    ];

    console.log("📘 Update SQL:", updateSql);
    console.log("📗 Update Params:", params);

    const [result] = await connection.query(updateSql, params);

    
    
    if (result.affectedRows === 0) {
      console.log(`⚠️ No record found for student_id: ${studentId}`);
      return res.status(404).json({ message: 'No student found or no change made.' });
    }

    console.log(`✅ Discount updated successfully for student_id: ${studentId}`);
    res.json({ message: 'Discount updated successfully', affectedRows: result.affectedRows });
  } catch (err) {
    console.error("🔥 Database Error during update:", err);
    res.status(500).json({ error: 'Database error during update', details: err.message });
  }
});
app.get('/api/discounted-students', async (req, res) => {
  const { className, section, schoolCode } = req.query;

  console.log("🟦 Incoming Request: /api/discounted-students");
  console.log("👉 Query Params:", { className, section, schoolCode });

  if (!schoolCode) {
    console.log("❌ Missing schoolCode");
    return res.status(400).json({ error: 'School code is required' });
  }

  let connection;
  try {
    console.log(`🔌 Connecting to DB: ${schoolCode}`);
    const pool = getDatabaseConnection(schoolCode);
    connection = await pool.getConnection();
    console.log("✅ DB Connected Successfully");

    let sql = `
      SELECT
        MAX(id) AS id,
        MAX(login_id) AS login_id,
        MAX(StudentName) AS StudentName,
        MAX(Class_name) AS Class_name,
        MAX(section) AS section,
        MAX(COALESCE(Discount, 0)) AS Discount,
        MAX(COALESCE(tuition_discount, 0)) AS tuition_discount,
        MAX(COALESCE(fee_discount, 0)) AS fee_discount,
        MAX(COALESCE(bus_discount, 0)) AS bus_discount
      FROM FeesDetails
      WHERE StudentName IS NOT NULL
        AND (
          COALESCE(Discount, 0) > 0 OR
          COALESCE(tuition_discount, 0) > 0 OR
          COALESCE(fee_discount, 0) > 0 OR
          COALESCE(bus_discount, 0) > 0
        )
    `;
    const params = [];

    if (className && section) {
      sql += ' AND Class_name = ? AND section = ?';
      params.push(className, section);
    }

    sql += `
      GROUP BY StudentName, Class_name, section
      ORDER BY StudentName ASC
    `;

    // Debug SQL & Params
    console.log("📘 Final SQL:", sql);
    console.log("📗 SQL Params:", params);

    // Execute query
    const [results] = await connection.query(sql, params);

    console.log("📊 Query executed. Rows fetched:", results.length);

    res.json(results);
  } catch (err) {
    console.error("🔥 Database Error:", err);
    res.status(500).json({ error: 'Database error', details: err.message });
  } finally {
    if (connection) {
      connection.release();
      console.log("🔌 DB Connection Released");
    }
  }
});


app.post('/Accountntdata', async (req, res) => {
  const {
    expenseName,
    expenseType,
    description,
    paymentMode,
    paidAmount,
    balance,
    totalAmount,
    personName,
    mobileNumber,
    schoolCode
  } = req.body;

  console.log('\n📩 Incoming Request to /new-accountant-data:');
  console.log('▶️ schoolCode:', schoolCode);
  console.log('▶️ description:', description);

  if (!schoolCode || !description) {
    return res.status(400).json({ error: 'School code and description are required' });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);
    const expense_date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const fields = ['description', 'expense_name', 'price', 'payment_mode', 'paid_amount', 'balance_amount', 'expense_date', 'expense_type', 'person_name', 'mobile_number'];
    const values = [description, expenseName || null, totalAmount !== undefined ? parseFloat(totalAmount) : null, paymentMode ? paymentMode.toLowerCase() : null, paidAmount !== undefined ? parseFloat(paidAmount) : null, balance !== undefined ? parseFloat(balance) : null, expense_date, expenseType || null, personName || null, mobileNumber || null];

    const insertQuery = `INSERT INTO Accountant (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`;

    console.log("📥 Final Insert Query:", insertQuery);
    console.log("📦 Final Values Array:", values);

    const [result] = await db.query(insertQuery, values);
    console.log('✅ Inserted into Accountant. ID:', result.insertId);
res.status(200).json({
  success: true,
  message: 'Expense saved!',
  expense: { _id: result.insertId }
});

  } catch (err) {
    console.error('❌ Error inserting into Accountant:', err);
    res.status(500).json({ error: 'Insert failed', sqlMessage: err.sqlMessage });
  }
});

// Define a new route for getting accountant data
app.get('/Accountentdataget', async (req, res) => {
  const { schoolCode, fromDate, toDate } = req.query;

  console.log('\n📥 GET /new-accountant-data called');
  console.log('▶️ Received schoolCode:', schoolCode);
  console.log('▶️ Received fromDate:', fromDate);
  console.log('▶️ Received toDate:', toDate);

  if (!schoolCode) {
    return res.status(400).json({ error: 'School code is required' });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);
    let selectQuery = `SELECT * FROM Accountant`;
    const conditions = [];
    const values = [];

    if (fromDate && toDate) {
      conditions.push('expense_date BETWEEN ? AND ?');
      values.push(fromDate, toDate);
    } else if (fromDate) {
      conditions.push('expense_date >= ?');
      values.push(fromDate);
    } else if (toDate) {
      conditions.push('expense_date <= ?');
      values.push(toDate);
    }

    if (conditions.length > 0) {
      selectQuery += ' WHERE ' + conditions.join(' AND ');
    }
    selectQuery += ' ORDER BY expense_date DESC';
    console.log("📄 Final SQL Query:", selectQuery);
    console.log("🔍 Parameters:", values);

    const [results] = await db.query(selectQuery, values);
    console.log(`✅ ${results.length} record(s) fetched from Accountant table`);

    const formattedResults = results.map(row => ({
      date: row.expense_date,
      name: row.expense_name,
      type: row.expense_type,
      description: row.description,
      paymentMode: row.payment_mode,
      balance:row.balance_amount,
      price: (row.price || 0) - (row.balance_amount || 0) // <-- calculate paid amount
    }));

    res.status(200).json(formattedResults);
  } catch (err) {
    console.error('❌ Query failed:', err);
    res.status(500).json({ error: 'Failed to fetch data', sqlMessage: err.sqlMessage });
  }
});

app.post("/getMonthlyData", async (req, res) => {
  const { schoolCode, salaryMonth, employeeId } = req.body;
  console.log("Params:", salaryMonth, employeeId);

  try {
    const db = await getDatabaseConnection(schoolCode);

    // ✅ Get the latest salary row directly from salary table
    const [salaryRow] = await db.execute(
      `SELECT salary_type, salary_amount, effective_from, status, hra, pf, professional_tax, mediclaim, deduction
       FROM bizpulse_teacher_salary
       WHERE teacher_id = ?
       ORDER BY effective_from DESC, salary_id DESC
       LIMIT 1`,
      [employeeId]
    );

    

    res.status(200).json({
      success: true,
      data: {
        baseSalary: salaryRow.length > 0 ? salaryRow[0].salary_amount : null,  // ✅ use salary_amount as base
        latestSalary: salaryRow.length > 0 ? salaryRow[0] : null
      }
    });

  } catch (error) {
    console.error("Error fetching monthly salary:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


app.post("/getEmployeeData", async (req, res) => {
  console.log("here is getEmployeeData");
  const { schoolCode, employeeId } = req.body;
  console.log(schoolCode, employeeId);

  try {
    const db = await getDatabaseConnection(schoolCode); // await the async connection
    const query = `SELECT name, school_name, email FROM management_login_creation WHERE id = ?`;
    const values = [employeeId];

    const [rows] = await db.query(query, values); // use async/await here
    

    if (rows.length === 0) {
      return res.status(404).json({ status: false, message: "Employee not found" });
    }

    return res.status(200).json({
      status: true,
      message: "Data found",
      data: rows[0]
    });

  } catch (err) {
    console.error("DB Error:", err);
    return res.status(500).json({ status: false, message: "Database error", error: err.message });
  }
});

// Function to format date-time
function formatDateTime(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    console.error("Invalid date passed to formatDateTime:", date);
    return null; // or return a default date if needed
  }
  return d.toISOString().slice(0, 19).replace('T', ' ');
}
// Route to handle setting login/logout time

app.post('/rollnumberdata', async (req, res) => {
  const { schoolCode, rollNumber } = req.body;

  if (!schoolCode || !rollNumber) {
    return res.status(400).json({ error: 'Missing schoolCode or rollNumber' });
  }

  let connection;
  try {
    // 1. Connect to the school-specific database (direct connection)
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();
    console.log(`🔗 Connected to DB: ${schoolCode}`);

    // 2. Parse rollNumber
    const studentId = parseInt(rollNumber);

    // 3. Get student record
    const [studentRows] = await connection.query(
      `SELECT * FROM management_login_creation WHERE id = ?`,
      [studentId]
    );

    if (studentRows.length === 0) {
      return res.status(404).json({ error: 'No student found with that ID' });
    }

    const student = studentRows[0];
    console.log('🎓 Student Data:');
    console.table(studentRows);

    // 4. Get fee details
    const [feeRows] = await connection.query(
      `SELECT * FROM FeesDetails WHERE login_id = ?`,
      [student.id]
    );

    console.log('💰 Fee Details:');
    console.table(feeRows);

    // 5. Get Seller info from same DB using institute_name = schoolCode
    const [sellerRows] = await connection.query(
      `SELECT institute_address, institute_contact_number, logo
       FROM Seller
       WHERE institute_name = ?
       LIMIT 1`,
      [schoolCode]
    );

    console.log('🏫 Seller Info:');
    console.table(sellerRows);

    // 6. Final Response
    res.status(200).json({
      studentData: student,
      feeDetails: feeRows,
      sellerInfo: sellerRows.length > 0 ? sellerRows[0] : null
    });

  } catch (err) {
    console.error('❌ Error in /rollnumberdata:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  } 
});

let billRequests = [];
let requestIdCounter = 1;
// API to create a new bill request
app.post('/api/bill-requests', (req, res) => {
    const { studentId, studentName, studentClass, schoolCode } = req.body;

    if (!studentId || !studentName || !studentClass) {
        return res.status(400).json({ error: 'Missing required fields: studentId, studentName, studentClass' });
    }

    const newRequest = {
        id: `req_${requestIdCounter++}`, // Unique ID for each request
        studentId,
        studentName,
        studentClass,
        schoolCode,
        status: 'pending', // Initial status
        timestamp: new Date().toISOString()
    };

    billRequests.push(newRequest);
    console.log('New bill request created:', newRequest);
    res.status(201).json(newRequest);
});

// API to get all bill requests (or a specific one by ID)
app.get('/api/bill-requests', (req, res) => {
    const { id } = req.query; // Allow fetching a specific request by ID

    if (id) {
        const request = billRequests.find(req => req.id === id);
        if (request) {
            return res.status(200).json(request);
        } else {
            return res.status(404).json({ error: 'Request not found' });
        }
    }
    // Return only pending requests to the dashboard by default
    const pending = billRequests.filter(req => req.status === 'pending');
    res.status(200).json(pending);
});

// API to update the status of a bill request (approve/reject)
app.put('/api/bill-requests/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    if (!status || (status !== 'approved' && status !== 'rejected')) {
        return res.status(400).json({ error: 'Invalid status provided. Must be "approved" or "rejected".' });
    }

    const requestIndex = billRequests.findIndex(req => req.id === id);

    if (requestIndex === -1) {
        return res.status(404).json({ error: 'Request not found' });
    }

    billRequests[requestIndex].status = status;
    console.log(`Request ${id} updated to status: ${status}`);
    res.status(200).json(billRequests[requestIndex]);
});

// API to create a new bulk bill request
app.post('/api/bulk-bill-requests', (req, res) => {
    const { studentIds, schoolCode, operation, amount } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0 || !schoolCode || !operation) {
        return res.status(400).json({ error: 'Missing required fields: studentIds (array), schoolCode, operation' });
    }

    const newBulkRequest = {
        id: `bulk_req_${bulkRequestIdCounter++}`,
        studentIds,
        schoolCode,
        operation,
        amount, // Store the amount for reference
        status: 'pending',
        timestamp: new Date().toISOString()
    };

    bulkBillRequests.push(newBulkRequest);
    console.log('New bulk bill request created:', newBulkRequest);
    res.status(201).json(newBulkRequest);
});

// API to get a specific bulk bill request status
app.get('/api/bulk-bill-requests/:id', (req, res) => {
    const { id } = req.params;
    const request = bulkBillRequests.find(req => req.id === id);
    if (request) {
        return res.status(200).json(request);
    } else {
        return res.status(404).json({ error: 'Bulk request not found' });
    }
});
// API to create a new bulk bill request
app.post('/api/bulk-bill-requests', (req, res) => {
    const { studentIds, schoolCode, operation, amount } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0 || !schoolCode || !operation) {
        return res.status(400).json({ error: 'Missing required fields: studentIds (array), schoolCode, operation' });
    }

    const newBulkRequest = {
        id: `bulk_req_${bulkRequestIdCounter++}`,
        studentIds,
        schoolCode,
        operation,
        amount, // Store the amount for reference
        status: 'pending',
        timestamp: new Date().toISOString()
    };

    bulkBillRequests.push(newBulkRequest);
    console.log('New bulk bill request created:', newBulkRequest);
    res.status(201).json(newBulkRequest);
});
// Sample in-memory storage (replace with database in production)
const bulkBillRequests = [
    {
        id: 'bulk_req_1',
        studentIds: ['stu1', 'stu2'],
        schoolCode: 'SCH001',
        operation: 'fee_payment',
        amount: 5000,
        status: 'pending', // 'pending', 'approved', 'rejected'
        timestamp: '2023-05-01T10:00:00Z'
    }
];
let bulkRequestIdCounter = 2;

// 1. Get all approvals (with filtering)
app.get('/api/bulk-bill-requests', (req, res) => {
    const { status, schoolCode } = req.query;
    
    let requests = [...bulkBillRequests];
    
    // Filter by status if provided
    if (status) {
        requests = requests.filter(req => req.status === status);
    }
    
    // Filter by school if provided
    if (schoolCode) {
        requests = requests.filter(req => req.schoolCode === schoolCode);
    }
    
    // Sort by newest first
    requests.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.status(200).json(requests);
});

// 2. Approve a request
app.put('/api/bulk-bill-requests/:id/approve', (req, res) => {
    const request = bulkBillRequests.find(req => req.id === req.params.id);
    
    if (!request) {
        return res.status(404).json({ error: 'Request not found' });
    }
    
    request.status = 'approved';
    request.processedAt = new Date().toISOString();
    request.processedBy = req.user?.id || 'admin'; // Assuming you have auth
    
    res.status(200).json(request);
});

// 3. Reject a request
app.put('/api/bulk-bill-requests/:id/reject', (req, res) => {
    const { reason } = req.body;
    const request = bulkBillRequests.find(req => req.id === req.params.id);
    
    if (!request) {
        return res.status(404).json({ error: 'Request not found' });
    }
    
    request.status = 'rejected';
    request.rejectionReason = reason;
    request.processedAt = new Date().toISOString();
    request.processedBy = req.user?.id || 'admin';
    
    res.status(200).json(request);
});
// API to update the status of a bulk bill request (e.g., by an admin)
app.put('/api/bulk-bill-requests/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    if (!status || (status !== 'approved' && status !== 'rejected')) {
        return res.status(400).json({ error: 'Invalid status provided. Must be "approved" or "rejected".' });
    }

    const requestIndex = bulkBillRequests.findIndex(req => req.id === id);

    if (requestIndex === -1) {
        return res.status(404).json({ error: 'Bulk request not found' });
    }

    bulkBillRequests[requestIndex].status = status;
    console.log(`Bulk request ${id} updated to status: ${status}`);
    res.status(200).json(bulkBillRequests[requestIndex]);
});

// Insert Fees Details endpoint
// Insert Fees Details endpoint
app.post('/api/insert-fees-details', async (req, res) => {
  console.log('Request received:', req.body);

  const { schoolCode, ...feeData } = req.body;

  if (!schoolCode) {
    console.log('Missing school code');
    return res.status(400).json({
      success: false,
      error: 'School code is required',
      code: 'MISSING_SCHOOL_CODE'
    });
  }

  let connection;
  try {
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();

if (!connection) {
  console.error('Connection failed - connection object is null');
  const err = new Error('Database connection failed');
  err.status = 500;          // optional, for better HTTP response
  return next(err);           // ✅ safely handled by central error handler
}


    if (!feeData.StudentName || !feeData.FeeClass || !feeData.login_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: StudentName, FeeClass, login_id',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const Paid_Amount = Number(feeData.tuition_paid) || 0;

    const checkQuery = `SELECT * FROM FeesDetails WHERE login_id = ?`;
    const [existingRecords] = await connection.execute(checkQuery, [feeData.login_id]);

    if (existingRecords.length > 0) {
      const updateQuery = `
        UPDATE FeesDetails
        SET
          Paid_Amount = Paid_Amount + ?,
          books_paid = books_paid + ?,
          bus_paid = bus_paid + ?,
          uniform_paid = uniform_paid + ?,
          exam_paid = exam_paid + ?,
          others_paid = others_paid + ?,
          Discount = ?,
          discount_reason = ?,
          fee_type = ?,
          UpdatedCompleteFee = ?,
          paidDate = ?
        WHERE login_id = ?`;

      const updateValues = [
        Paid_Amount,
        feeData.books_paid || 0,
        feeData.bus_paid || 0,
        feeData.uniform_paid || 0,
        feeData.exam_paid || 0,
        feeData.others_paid || 0,
        feeData.Discount || 0,
        feeData.discount_reason || null,
        feeData.paymentMode || 'Cash',
        feeData.CompleteFee || 0,
        feeData.paidDate || new Date().toISOString().split('T')[0], // Use the provided date or default to current date
        feeData.login_id
      ];

      await connection.execute(updateQuery, updateValues);
      res.status(200).json({
        success: true,
        message: 'Fee record updated successfully',
        data: {
          StudentName: feeData.StudentName,
          Class: feeData.FeeClass,
          Section: feeData.FeeSection,
          RollNumber: feeData.login_id,
          TotalPaid: existingRecords[0].Paid_Amount + Paid_Amount,
        }
      });
    } else {
      const insertQuery = `
        INSERT INTO FeesDetails (
          FeeClass, FeeSection, CompleteFee,
          Class_name, section, StudentName,
          Paid_Amount, Discount,
          UpdatedCompleteFee, login_id, fee_type,
          discount_reason, Book_Fees, Uniform_fees,
          Exam_fees, Bus_fees, Others, books_paid,
          bus_paid, uniform_paid, exam_paid, others_paid, paidDate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const insertValues = [
        feeData.FeeClass,
        feeData.FeeSection || null,
        feeData.CompleteFee || 0,
        feeData.FeeClass,
        feeData.FeeSection || null,
        feeData.StudentName,
        Paid_Amount,
        feeData.Discount || 0,
        feeData.CompleteFee || 0,
        feeData.login_id,
        feeData.paymentMode || 'Cash',
        feeData.discount_reason || null,
        feeData.Book_Fees || 0,
        feeData.Uniform_fees || 0,
        feeData.Exam_fees || 0,
        feeData.Bus_fees || 0,
        feeData.Others || 0,
        feeData.books_paid || 0,
        feeData.bus_paid || 0,
        feeData.uniform_paid || 0,
        feeData.exam_paid || 0,
        feeData.others_paid || 0,
        feeData.paidDate || new Date().toISOString().split('T')[0] // Use the provided date or default to current date
      ];

      const [result] = await connection.execute(insertQuery, insertValues);
      res.status(201).json({
        success: true,
        message: 'New fee record created successfully',
        data: {
          id: result.insertId,
          StudentName: feeData.StudentName,
          Class: feeData.FeeClass,
          Section: feeData.FeeSection,
          RollNumber: feeData.login_id,
          TotalPaid: Paid_Amount,
        }
      });
    }
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process fee record',
      code: 'DATABASE_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } 
});



app.get('/totalexpensesdatabizzpulse', async (req, res) => {
  console.log("this is server 7.js file");
  console.log('Received request for total expenses value');

  const { startDate, endDate, date, schoolCode } = req.query;
  console.log('Query Parameters:', { startDate, endDate, date, schoolCode });

  if (!schoolCode) {
    return res.status(400).json({ error: 'Missing schoolCode in query' });
  }

  let connection;
  try {
    // Get connection - need to await since createConnection returns a promise
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();
    
    let query = `
      SELECT id, person_name, description, expense_name, price, payment_mode,
             paid_amount, balance_amount, expense_date, expense_type
      FROM Accountant
    `;
    const queryParams = [];

    if (startDate && endDate) {
      query += ` WHERE expense_date BETWEEN ? AND ?`;
      queryParams.push(startDate, endDate);
    } else if (date) {
      query += ` WHERE expense_date = ?`;
      queryParams.push(date);
    }

    query += ` GROUP BY id, person_name, description, expense_name, price, 
                     payment_mode, paid_amount, balance_amount, expense_date, expense_type`;

    console.log('Executing SQL query:', query, 'with parameters:', queryParams);

    // Execute query using promise interface
    const [rows] = await connection.query(query, queryParams);

    // Format amounts as float (optional)
    const formattedRows = rows.map(row => ({
      ...row,
      paid_amount: parseFloat(row.paid_amount),
      balance_amount: parseFloat(row.balance_amount),
      price: parseFloat(row.price)
    }));

    res.json(formattedRows);
    console.log('Sent total expenses data to frontend:', formattedRows);
  } catch (err) {
    console.error('Error executing SQL query:', err.message);
    res.status(500).json({ error: 'Failed to retrieve total expenses data' });
  } 
});


app.post('/pay-fee', async (req, res) => {
    console.log("Full payment data received:", JSON.stringify(req.body, null, 2));

    // Trim all string inputs to avoid whitespace issues
    const { 
        studentName: rawStudentName, 
        className: rawClassName, 
        sectionName: rawSectionName, 
        schoolCode: rawSchoolCode, 
        feeType: rawFeeType,
        discountReason: rawDiscountReason,
        Discount = 0, 
        Paid_Amount = 0 
    } = req.body;

    // Trim and validate inputs
    const studentName = rawStudentName?.trim();
    const className = rawClassName?.trim();
    const sectionName = rawSectionName?.trim();
    const schoolCode = rawSchoolCode?.trim();
    const feeType = rawFeeType?.trim();
    const discountReason = rawDiscountReason?.trim();
    const discountAmount = parseFloat(Discount) || 0;
    const paidAmount = parseFloat(Paid_Amount) || 0;

    console.log('Processed inputs:', {
        studentName,
        className,
        sectionName,
        schoolCode,
        feeType,
        discountReason,
        discountAmount,
        paidAmount
    });

    if (!studentName || !className || !sectionName || !schoolCode || !feeType) {
        console.error('Validation failed - missing required fields');
        return res.status(400).json({ 
            success: false,
            message: 'Student name, class, section, school code, and fee type are required',
            received: {
                ...req.body,
                studentName: studentName,
                className: className,
                sectionName: sectionName,
                schoolCode: schoolCode,
                feeType: feeType
            }
        });
    }

    let db;
    try {
        console.log(`Connecting to database for school ${schoolCode}`);
        db = await getDatabaseConnection(schoolCode);
        if (!db) {
      // Instead of throw, return 500 safely
      console.error(`DB connection failed for school ${schoolCode}`);
      return res.status(500).json({ success: false, message: 'Database connection failed' });
    }

        // 1. Check if student exists and get current fee data
        const studentCheckQuery = `
            SELECT id, Discount, Paid_Amount, UpdatedCompleteFee, CompleteFee, fee_type, discount_reason
            FROM FeesDetails
            WHERE StudentName = ? AND Class_name = ? AND section = ?
            LIMIT 1
        `;
        console.log('Checking for existing student with query:', studentCheckQuery, [studentName, className, sectionName]);
        const [studentResults] = await db.query(studentCheckQuery, [studentName, className, sectionName]);

        const studentExists = studentResults.length > 0;
        let originalFee = 0;
        let existingDiscount = 0;
        let existingPaidAmount = 0;
        let currentFeeType = feeType;
        let currentDiscountReason = discountReason;

        console.log('Student exists:', studentExists, 'with data:', studentExists ? studentResults[0] : null);

        // 2. Get the original fee amount
        if (studentExists) {
            existingDiscount = parseFloat(studentResults[0].Discount) || 0;
            existingPaidAmount = parseFloat(studentResults[0].Paid_Amount) || 0;
            
            // Use UpdatedCompleteFee if available, otherwise fall back to CompleteFee
            originalFee = parseFloat(studentResults[0].UpdatedCompleteFee || studentResults[0].CompleteFee) || 0;
            currentFeeType = studentResults[0].fee_type || feeType;
            currentDiscountReason = studentResults[0].discount_reason || discountReason;
            
            console.log('Existing student fee details:', {
                originalFee,
                existingDiscount,
                existingPaidAmount,
                currentFeeType,
                currentDiscountReason
            });
        } else {
            console.log('Student does not exist, looking for fee template');
            // Enhanced fee template lookup
            const feeQuery = `
                SELECT CompleteFee 
                FROM FeesDetails
                WHERE Class_name = ? AND section = ?
                ORDER BY 
                    CASE WHEN StudentName IS NULL THEN 0 ELSE 1 END,
                    id DESC
                LIMIT 1
            `;
            
            console.log('Looking for fee template with query:', feeQuery, [className, sectionName]);
            const [feeResults] = await db.query(feeQuery, [className, sectionName]);
            
            if (feeResults.length === 0) {
                console.error('No fee records found for class/section:', className, sectionName);
                return res.status(404).json({
                    success: false,
                    message: `No fee records found for ${className}/${sectionName}`,
                    details: {
                        suggestion: "Create a fee template first (record with StudentName=NULL)",
                        queryUsed: feeQuery,
                        parameters: [className, sectionName]
                    }
                });
            }
            
            originalFee = parseFloat(feeResults[0].CompleteFee) || 0;
            console.log('Using fee amount from template:', originalFee);
        }

        // Calculate total discount (new + existing)
        const totalDiscount = existingDiscount + discountAmount;
        const totalPaidAmount = existingPaidAmount + paidAmount;

        console.log('Calculated totals:', {
            originalFee,
            existingDiscount,
            newDiscount: discountAmount,
            totalDiscount,
            existingPaidAmount,
            newPayment: paidAmount,
            totalPaidAmount
        });

        // Validate discount against remaining fee
        const remainingFee = originalFee - existingPaidAmount;
        if (totalDiscount > remainingFee) {
            console.error('Discount validation failed:', {
                originalFee,
                existingPaidAmount,
                remainingFee,
                totalDiscount,
                allowedMaximum: remainingFee
            });
            return res.status(400).json({
                success: false,
                message: 'Discount cannot be greater than the remaining fee',
                details: {
                    originalFee,
                    paidAmount: existingPaidAmount,
                    remainingFee,
                    attemptedDiscount: totalDiscount,
                    maximumAllowed: remainingFee
                }
            });
        }

        // 3. Calculate final amounts with precise rounding
        const finalAmount = originalFee - totalDiscount;
        console.log('Final amount calculation:', {
            originalFee,
            totalDiscount,
            finalAmount
        });

        // Calculate installments (20% each with remainder in last)
        const baseInstallment = Math.round(finalAmount * 0.2 * 100) / 100;
        const installments = [
            baseInstallment,
            baseInstallment,
            baseInstallment,
            baseInstallment,
            finalAmount - (baseInstallment * 4)
        ];

        // Adjust for any rounding errors
        installments[4] = Math.round(installments[4] * 100) / 100;
        const sumCheck = installments.reduce((sum, val) => sum + val, 0);
        const roundingDifference = finalAmount - sumCheck;

        if (Math.abs(roundingDifference) > 0.01) {
            console.warn('Rounding adjustment needed:', {
                expected: finalAmount,
                calculated: sumCheck,
                difference: roundingDifference
            });
            installments[4] += roundingDifference;
        }

        console.log('Final installment amounts:', {
            installments,
            sum: installments.reduce((sum, val) => sum + val, 0),
            finalAmount,
            difference: finalAmount - installments.reduce((sum, val) => sum + val, 0)
        });

        // 4. Insert or update record
        if (!studentExists) {
            const insertQuery = `
                INSERT INTO FeesDetails (
                    StudentName, Class_name, section,
                    CompleteFee, UpdatedCompleteFee, Discount, Final_Amount,
                    Paid_Amount, Installment1_Amount,
                    Installment2_Amount, Installment3_Amount,
                    Installment4_Amount, Installment5_Amount,
                    fee_type, discount_reason,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            
            console.log('Creating new record with:', insertQuery, [
                studentName, className, sectionName,
                originalFee, originalFee, totalDiscount, finalAmount,
                totalPaidAmount, ...installments,
                currentFeeType, currentDiscountReason
            ]);
            
            const [insertResult] = await db.query(insertQuery, [
                studentName, className, sectionName,
                originalFee, originalFee, totalDiscount, finalAmount,
                totalPaidAmount, ...installments,
                currentFeeType, currentDiscountReason
            ]);
            
            console.log('New record created with ID:', insertResult.insertId);
            return res.json({
                success: true,
                message: `Fee record created for ${studentName}`,
                data: {
                    originalFee,
                    discount: totalDiscount,
                    finalAmount,
                    paidAmount: totalPaidAmount,
                    remaining: finalAmount - totalPaidAmount,
                    feeType: currentFeeType,
                    discountReason: currentDiscountReason,
                    installments
                }
            });
        } else {
            const updateQuery = `
                UPDATE FeesDetails SET
                    Discount = ?,
                    Final_Amount = ?,
                    Paid_Amount = ?,
                    Installment1_Amount = ?,
                    Installment2_Amount = ?,
                    Installment3_Amount = ?,
                    Installment4_Amount = ?,
                    Installment5_Amount = ?,
                    fee_type = ?,
                    discount_reason = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE StudentName = ? AND Class_name = ? AND section = ?
            `;
            
            console.log('Updating record with:', updateQuery, [
                totalDiscount, finalAmount, totalPaidAmount,
                ...installments,
                currentFeeType, currentDiscountReason,
                studentName, className, sectionName
            ]);
            
            const [updateResult] = await db.query(updateQuery, [
                totalDiscount, finalAmount, totalPaidAmount,
                ...installments,
                currentFeeType, currentDiscountReason,
                studentName, className, sectionName
            ]);
            
            console.log('Record updated, affected rows:', updateResult.affectedRows);
            return res.json({
                success: true,
                message: `Updated fee record for ${studentName}`,
                data: {
                    originalFee,
                    discount: totalDiscount,
                    finalAmount,
                    paidAmount: totalPaidAmount,
                    remaining: finalAmount - totalPaidAmount,
                    feeType: currentFeeType,
                    discountReason: currentDiscountReason,
                    installments
                }
            });
        }
    } catch (error) {
        console.error('Payment processing failed:', {
            error: error.message,
            stack: error.stack,
            request: req.body,
            timestamp: new Date().toISOString()
        });
        return res.status(500).json({
            success: false,
            message: 'Payment processing failed',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            ...(process.env.NODE_ENV === 'development' && {
                stack: error.stack,
                request: req.body
            })
        });
    }
    
});

app.post("/schoolprofile", async (req, res) => {
  console.log("\n📥 Received POST request to /schoolprofile");

  const { schoolcode } = req.body;
  console.log("📦 Payload received ➜ schoolcode:", schoolcode);

  if (!schoolcode) {
    console.warn("⚠️ Missing schoolcode in request body");
    return res.status(400).json({ 
      status: false,
      error: "Missing schoolcode" 
    });
  }

  let connection;
  try {
    connection = await getNovaConnection();
    console.log(`✅ Connected to NOVA database`);
    
    // Special handling for SREE_GEETHANJALI_EM
    let cleanSchoolcode;
    let selectQuery;
    
    if (schoolcode === "SREE_GEETHANJALI_EM") {
      cleanSchoolcode = "SREE GEETHANJALI E.M"; // Exact match for DB
      selectQuery = `
        SELECT 
          id,
          institute_name, 
          institute_address, 
          logo, 
          number_of_students,
          number_of_staff, 
          authorized_logo, 
          date_of_inception, 
          registration_no, 
          institute_authorized_person, 
          pan_no AS "pan/no",
          institute_contact_number,
          city_name,
          area_name
        FROM Seller
        WHERE institute_name = ?
        LIMIT 1
      `;
    } else {
      cleanSchoolcode = schoolcode.replace(/_/g, ''); // Default behavior
      selectQuery = `
        SELECT 
          id,
          institute_name, 
          institute_address, 
          logo, 
          number_of_students,
          number_of_staff, 
          authorized_logo, 
          date_of_inception, 
          registration_no, 
          institute_authorized_person, 
          pan_no AS "pan/no",
          institute_contact_number,
          city_name,
          area_name
        FROM Seller
        WHERE REPLACE(institute_name, '_', '') = ?
        LIMIT 1
      `;
    }

    console.log(`📡 Fetching seller data matching schoolcode '${cleanSchoolcode}'...`);

    const [sellerResults] = await connection.query(selectQuery, [cleanSchoolcode]);

    console.log(`✅ Retrieved ${sellerResults.length} matching seller(s)`);
    if (sellerResults.length > 0) {
      console.log("🏫 First matching institute:", sellerResults[0].institute_name);
    }

    res.status(200).json({
      status: true,
      sellerData: sellerResults,
      message: "✅ Seller data fetched successfully",
    });
  } catch (err) {
    console.error("❌ Database error:", err.message);
    res.status(500).json({ 
      status: false,
      error: "Database error occurred" 
    });
  } 
});

app.post("/update-school-profile", async (req, res) => {
  console.log("\n📥 Received POST request to /updateSchoolProfile");

  const { schoolcode, updatedData } = req.body;
  
  if (!schoolcode || !updatedData) {
    console.warn("⚠️ Missing required fields in request body");
    return res.status(400).json({ 
      success: false, 
      message: "Missing required fields (schoolcode or updatedData)" 
    });
  }

  // Create sanitized update object
  const dataToUpdate = {};
  const allowedFields = [
    'institute_name', 'institute_gst', 'institute_address',
    'institute_contact_number', 'institute_authorized_person',
    'number_of_students', 'number_of_staff', 'city_name',
    'area_name', 'premium_type', 'folder_path',
    'date_of_inception', 'registration_no', 'pan_no'
  ];

  // Only include allowed fields and transform field names
  Object.keys(updatedData).forEach(key => {
    const dbFieldName = key === 'pan/no' ? 'pan_no' : key;
    if (allowedFields.includes(dbFieldName)) {  // Fixed the missing parenthesis
      dataToUpdate[dbFieldName] = updatedData[key];
    }
  });

  console.log("📦 Sanitized payload:", dataToUpdate);

  let connection;
  try {
    connection = await getNovaConnection();
    console.log(`✅ Connected to NOVA database`);

    const cleanSchoolcode = schoolcode.replace(/_/g, '');
    const updateQuery = "UPDATE Seller SET ? WHERE REPLACE(institute_name, '_', '') = ?";
    
    console.log(`🔄 Updating school profile for code: ${cleanSchoolcode}`);
    
    const [results] = await connection.query(updateQuery, [dataToUpdate, cleanSchoolcode]);
    
    if (results.affectedRows === 0) {
      console.warn("⚠️ No matching school found for code:", cleanSchoolcode);
      return res.status(404).json({ 
        success: false, 
        message: "No matching school found" 
      });
    }
    
    console.log("✅ Profile updated successfully");
    res.json({ 
      success: true, 
      message: "Profile updated successfully",
      updatedData: dataToUpdate
    });
  } catch (error) {
    console.error("❌ Update failed:", error.message);
    res.status(500).json({ 
      success: false, 
      message: "Database update error: " + error.message 
    });
  } 
});
app.get('/api/students/count', async (req, res) => {
  try {
    const { schoolCode } = req.query;

    if (!schoolCode) {
      return res.status(400).send('schoolCode is required');
    }

    // Create a connection to the school-specific database
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();

    // Query the school-specific database
    const [rows] = await connection.query(
      'SELECT COUNT(*) AS studentCount FROM management_login_creation WHERE user_type = ?',
      ['student']
    );

    // Close the connection
    

    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching student count:', error);
    res.status(500).send('Server Error');
  }
});
app.get('/api/teacher/count', async (req, res) => {
  try {
    const { schoolCode } = req.query;
    console.log('Received schoolCode:', schoolCode); // Debug: Log received schoolCode

    if (!schoolCode) {
      console.error('schoolCode is required');
      return res.status(400).send('schoolCode is required');
    }

const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();
    console.log('Database connection established for schoolCode:', schoolCode); // Debug: Log connection

    const [rows] = await connection.query(
      'SELECT COUNT(*) AS teacherCount FROM management_login_creation WHERE user_type = ?',
      ['teacher']
    );
    console.log('Query result:', rows[0]); // Debug: Log query result

    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching teacher count:', error);
    res.status(500).send('Server Error');
  }
});
app.get('/api/student-fee-details', async (req, res) => {
  // Extract parameters
  const schoolCode = req.query.schoolCode;
  const feeClass = req.query.class;
  const feeSection = req.query.section;
  const studentName = req.query.name;

  // Validate required parameters
  const missingParams = [];
  if (!schoolCode) missingParams.push('schoolCode');
  if (!feeClass) missingParams.push('class');

  if (missingParams.length > 0) {
    return res.status(400).json({
      error: 'Missing required parameters',
      missing: missingParams
    });
  }

  console.log(`[API] Request for /api/student-fee-details`);

  let db;
  try {
    db = await getDatabaseConnection(schoolCode);
    
    // First get the fee template for the class
    const templateSql = `
      SELECT
        CompleteFee,
        Exam_fees AS examFee,
        Bus_fees AS busFee,
        Book_fees AS bookFee,
        Uniform_fees AS uniformFee,
        Others AS othersFee,
        Admission_fees AS admissionFee
      FROM FeesDetails
      WHERE login_id IS NULL AND Class_name = ?
      LIMIT 1
    `;
    
    const [templateRows] = await db.query(templateSql, [feeClass]);
    
    if (templateRows.length === 0) {
      console.log(`[API] No fee template found for class: ${feeClass}`);
      return res.status(404).json({
        error: 'No fee template found for this class',
      });
    }
    
    const feeTemplate = templateRows[0];
    
    if (studentName && feeSection) {
      // Get student-specific fee details
      const studentSql = `
        SELECT *
        FROM FeesDetails
        WHERE Class_name = ?
          AND section = ?
          AND StudentName = ?
        ORDER BY id DESC
        LIMIT 1
      `;
      const [studentRows] = await db.query(studentSql, [feeClass, feeSection, studentName]);
      
      if (studentRows.length === 0) {
        console.log(`[API] No record found for: ${studentName}`);
        return res.status(404).json({
          error: 'No fee record found for this student',
        });
      }
      
      // Combine template with student-specific data
      const response = {
        feeStructure: feeTemplate,
        studentDetails: studentRows[0]
      };
      
      console.log(`[API] Successfully found and sent fee details for: ${studentName}`);
      return res.json(response);
    } else {
      // Return just the fee template if no student specified
      console.log(`[API] Successfully found and sent fee template for class: ${feeClass}`);
      return res.json({
        feeStructure: feeTemplate
      });
    }

  } catch (error) {
    console.error('[API ERROR]', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  } 
});

// Route to get total cost, amount, quantity, and other details with optional date filters
// Modified route to get expense data with school code connection
app.get('/expensesgoodwill', async (req, res) => {
  console.log('Received request for expense data');

  const { startDate, endDate, date, schoolCode } = req.query;

  // Validate schoolCode is provided
  if (!schoolCode) {
    return res.status(400).json({ error: 'School code is required' });
  }

  try {
    // Get a connection to the school-specific database
    const db = await getDatabaseConnection(schoolCode);
    
    let query = '';
    let queryParams = [];

    if (startDate && endDate) {
      // Date range query
      query = `
        SELECT 
          id,
          type,
          amount,
          quantity,
          total_cost,
          rent_type,
          vendor_type,
          vendor_name,
          vendor_contact,
          payment_method,
          date,
          description,
          created_at
        FROM Expense
        WHERE date BETWEEN ? AND ?
        ORDER BY id ASC;
      `;
      queryParams = [startDate, endDate];
    } else if (date) {
      // Single date query
      query = `
        SELECT 
          id,
          type,
          amount,
          quantity,
          total_cost,
          rent_type,
          vendor_type,
          vendor_name,
          vendor_contact,
          payment_method,
          date,
          description,
          created_at
        FROM Expense
        WHERE date = ?
        ORDER BY id ASC;
      `;
      queryParams = [date];
    } else {
      // Default query, no date filtering
      query = `
        SELECT 
          id,
          type,
          amount,
          quantity,
          total_cost,
          rent_type,
          vendor_type,
          vendor_name,
          vendor_contact,
          payment_method,
          date,
          description,
          created_at
        FROM Expense
        ORDER BY id ASC;
      `;
    }

    console.log('Executing SQL query:', query);

    // Execute the query using the school-specific connection
    const [result] = await db.query(query, queryParams);
    
    console.log('Expense data retrieved:', result);
    
    // Release the connection back to the pool
    

    // Send the result to frontend
    res.json(result);
    console.log('Sent expense data to frontend:', result);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve expense data' });
  }
});

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
    process.env.FRONTEND_URL || 'http://localhost:3000',

  process.env.PRODUCTION_URL || 'https://cleezoclass.com',
    process.env.PRODUCTION_URL || 'https://cleezoclass.com/CRM',

  process.env.PRODUCTION_URL || 'HTTPS://cleezoclass.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`Blocked CORS request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Middleware
// const allowedOrigins = ['http://localhost:5173', 'https://cleezoclass.com'];

// app.use(cors({
//   origin: function (origin, callback) {
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
//   credentials: true
// }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, '..')));

// Session middleware
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));


// Example data
const assetTypes = ['Laptop', 'Projector', 'Desk', 'Chair', 'Whiteboard'];
const depreciationRates = ['5%', '10%', '15%', '20%'];
app.get('/api/teachers_attendance/arrived', async (req, res) => {
    const { date, schoolCode } = req.query;

    if (!date || !schoolCode) {
        return res.status(400).json({ error: 'The "date" and "schoolCode" parameters are required.' });
    }

    let db;
    try {
        db = await getDatabaseConnection(schoolCode);

        // --- CORRECTED TIMEZONE-SAFE SQL QUERY ---
        const sql = `
            SELECT
                m.id,
                m.name AS teacher_name,
                t.entry_time AS login_time,
                t.exit_time AS logout_time
            FROM
                teachers_attendance AS t
            JOIN
                management_login_creation AS m ON t.username = m.username
            WHERE
                -- This range check is timezone-safe
                t.date >= ? AND t.date < DATE_ADD(?, INTERVAL 1 DAY)
                AND LOWER(m.user_type) = 'teacher'
                AND LOWER(t.status) = 'present'
            ORDER BY
                m.name;
        `;

        // Pass the date parameter twice for the range check
        const [arrivedTeachers] = await db.query(sql, [date, date]);

        res.json(arrivedTeachers);

    } catch (error) {
        console.error('Error fetching arrived teachers:', error);
        res.status(500).json({ error: 'Failed to fetch attendance data for arrived teachers.' });
    } 
});

// In your server file (e.g., index.js or app.js)
// In your server file (e.g., index.js or app.js)

// In your server file (e.g., index.js or app.js)
app.get('/api/teachers_attendance/unarrived', async (req, res) => {
    const { date, schoolCode } = req.query;

    if (!date || !schoolCode) {
        return res.status(400).json({ error: 'The "date" and "schoolCode" parameters are required.' });
    }

    let db;
    try {
        db = await getDatabaseConnection(schoolCode);

        // --- CORRECTED TIMEZONE-SAFE SQL QUERY ---
        const sql = `
            SELECT
                m.id,
                m.name,
                (
                    -- Subquery to count total working days in the month
                    (SELECT COUNT(DISTINCT DATE(date)) FROM teachers_attendance WHERE date >= DATE_FORMAT(?, '%Y-%m-01') AND date < DATE_ADD(DATE_FORMAT(?, '%Y-%m-01'), INTERVAL 1 MONTH))
                    -
                    -- Subquery to count ONLY 'present' days for this teacher in the month
                    (SELECT COUNT(*) FROM teachers_attendance WHERE teacher_id = m.id AND status = 'present' AND date >= DATE_FORMAT(?, '%Y-%m-01') AND date < DATE_ADD(DATE_FORMAT(?, '%Y-%m-01'), INTERVAL 1 MONTH))
                ) AS absent_days
            FROM
                management_login_creation m
            WHERE
                LOWER(m.user_type) = 'teacher'
                AND NOT EXISTS (
                    -- This condition checks if a 'present' record does NOT exist for this teacher on the selected date range
                    SELECT 1
                    FROM teachers_attendance t
                    WHERE t.username = m.username
                      AND t.date >= ? AND t.date < DATE_ADD(?, INTERVAL 1 DAY) -- Timezone-safe check
                      AND t.status = 'present'
                )
            ORDER BY
                m.name;
        `;

        // The date parameter is now used multiple times for the different clauses
        const params = [date, date, date, date, date, date];
       
        const [unarrivedTeachers] = await db.query(sql, params);

        res.json(unarrivedTeachers);

    } catch (error) {
        console.error('Error fetching unarrived teachers:', error);
        res.status(500).json({ error: 'Failed to fetch attendance data for unarrived teachers.' });
    } 
});
 
 
 
 
app.post("/getAllBills", async (req, res) => {
  const { schoolCode } = req.body;

  if (!schoolCode) {
    return res.status(400).json({ error: "Missing schoolCode in request body" });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);

    const [rows] = await db.query("SELECT * FROM bills ORDER BY date DESC");

    const bills = rows.map((row) => {
      const filename = row.image_path ? path.basename(row.image_path) : null;
      const imageUrl = filename ? `https://cleezoclass.com/MobileApp/uploads/${filename}` : null;

      return {
        id: row.id,
        billType: row.bill_type, // Changed from row.billType to row.bill_type
        amount: row.amount,
        date: row.date,
        description: row.description, // Added description
        imageUrl,
        bill_type: row.bill_type // Added bill_type as it appears in DB
      };
    });

    res.json(bills);
    
  } catch (error) {
    console.error("Error fetching bills:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Endpoint for getting asset types
app.get('/assetTypesdata', (req, res) => {
  res.json(assetTypes);
});

// Endpoint for getting depreciation rates
app.get('/depreciationRatesdata', (req, res) => {
  res.json(depreciationRates);
});
app.post('/submitAssetdata', async (req, res) => {
  const { 
    assetCode,
    assetName, 
    assetType, 
    purchaseCost,
    depreciationRate,
    depreciationMethod,
    category,
    assetCondition,
    usageType,
    purchaseDate,
    warrantyExpiry,
    vendorName,
    location,
    assignedTo,
    schoolCode
  } = req.body;

  // Validate required fields
  if (!assetName || !assetType || !purchaseCost || !schoolCode) {
    return res.status(400).json({ 
      message: 'Missing required fields',
      requiredFields: ['assetName', 'assetType', 'purchaseCost', 'schoolCode']
    });
  }

  let connection;
  try {
    // Get database connection
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();

    // Calculate depreciation value
    const rate = parseFloat(depreciationRate?.replace('%', '') || 0) / 100;
    let depreciationValue = 0;

    if (depreciationMethod === 'straight-line') {
      depreciationValue = purchaseCost * rate;
    } else if (depreciationMethod === 'declining-balance') {
      depreciationValue = purchaseCost * rate * 2; // Double declining balance
    }

    // Insert into assets table with correct column names
    const [result] = await connection.query(
      `INSERT INTO assets (
        assetCode,
        assetName, 
        assetType, 
        purchaseCost,
        category,
        assetCondition,
        usageType,
        purchaseDate,
        warrantyExpiry,
        vendorName,
        location,
        assignedTo,
        currentValue
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        assetCode || null,
        assetName,
        assetType,
        purchaseCost,
        category || null,
        assetCondition || null,
        usageType || null,
        purchaseDate || null,
        warrantyExpiry || null,
        vendorName || null,
        location || null,
        assignedTo || null,
        (purchaseCost - depreciationValue) // Calculate current value
      ]
    );

    // If you have a separate depreciation table
    if (depreciationMethod && depreciationRate) {
   await connection.query(
  `INSERT INTO depreciation (
    assetCode,
    purchaseCost,
    depreciationRate,  
    depreciationMethod,
    depreciationValue
  ) VALUES (?, ?, ?, ?, ?)`,
  [
    assetCode || result.insertId.toString(),
    purchaseCost,
    depreciationRate,
    depreciationMethod,
    depreciationValue
  ]
);
    }

    res.status(201).json({
      success: true,
      message: `Asset "${assetName}" registered successfully`,
      assetId: result.insertId,
      assetCode: assetCode || result.insertId.toString(),
      currentValue: (purchaseCost - depreciationValue).toFixed(2)
    });

  } catch (error) {
    console.error('Database operation failed:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error processing asset data',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        sqlError: error.sqlMessage,
        errorCode: error.code
      } : undefined
    });
  } 
});

// POST route to insert finance data (improved version)
app.post('/financedata', async (req, res) => {
  const {
    type,
    amount,
    quantity,
    totalCost,
    rentType,
    vendorType,
    vendorName,
    vendorContact,
    paymentMethod,
    date,
    description,
    schoolCode
  } = req.body;

  let connection;
  try {
    // Get a connection from the pool
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();

    const query = `
      INSERT INTO Expense (
        type, amount, quantity, total_cost, rent_type, vendor_type, vendor_name,
        vendor_contact, payment_method, date, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
      type,
      amount,
      quantity,
      totalCost,
      rentType || null,
      vendorType || null,
      vendorName || null,
      vendorContact || null,
      paymentMethod,
      date,
      description,
    ];

    // Execute the query
    const [result] = await connection.query(query, values);
    
    res.status(201).json({ 
      message: 'Form data inserted successfully',
      schoolCode: schoolCode,
      insertId: result.insertId 
    });

  } catch (err) {
    console.error('Database operation failed:', err);
    res.status(500).json({ 
      message: 'Error processing your request',
      error: err.message 
    });
  } 
});
app.get('/api/assistanceentries', async (req, res) => {
  let connection;
  try {
    const { schoolCode } = req.query;

    if (!schoolCode) {
      return res.status(400).json({ message: 'schoolCode is required' });
    }

    const pool = getDatabaseConnection(schoolCode);
    connection = await pool.getConnection();

    const [incomeRows] = await connection.query(`
      SELECT COALESCE(SUM(CAST(paid_amount AS DECIMAL(12,2))), 0) AS total_income
      FROM Accountant
    `);

    const [expenseRows] = await connection.query(`
      SELECT COALESCE(SUM(CAST(COALESCE(total_cost, amount, 0) AS DECIMAL(12,2))), 0) AS total_expense
      FROM Expense
    `);

    const [receivableRows] = await connection.query(`
      SELECT COALESCE(SUM(CAST(balance_amount AS DECIMAL(12,2))), 0) AS total_receivable
      FROM Accountant
    `);

    const [topCategories] = await connection.query(`
      SELECT
        COALESCE(type, 'Uncategorized') AS category,
        COALESCE(SUM(CAST(COALESCE(total_cost, amount, 0) AS DECIMAL(12,2))), 0) AS spent
      FROM Expense
      GROUP BY COALESCE(type, 'Uncategorized')
      ORDER BY spent DESC
      LIMIT 3
    `);

    const totalIncome = Number(incomeRows?.[0]?.total_income || 0);
    const totalExpense = Number(expenseRows?.[0]?.total_expense || 0);
    const totalReceivable = Number(receivableRows?.[0]?.total_receivable || 0);
    const netAmount = totalIncome - totalExpense;
    const expenseRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;

    const entries = [];

    entries.push({
      id: 'overall-net',
      name: netAmount >= 0 ? 'Surplus available' : 'Deficit alert',
      amount: Math.abs(netAmount),
      type: netAmount >= 0 ? 'summary' : 'alert',
      customType:
        netAmount >= 0
          ? `Income exceeds expense by ₹${Math.abs(netAmount).toLocaleString('en-IN')}`
          : `Expense exceeds income by ₹${Math.abs(netAmount).toLocaleString('en-IN')}`,
    });

    entries.push({
      id: 'expense-ratio',
      name: 'Expense ratio',
      amount: Number(expenseRatio.toFixed(2)),
      type: expenseRatio >= 85 ? 'alert' : expenseRatio >= 70 ? 'warning' : 'normal',
      customType: `Expenses are ${expenseRatio.toFixed(2)}% of income`,
    });

    if (totalReceivable > 0) {
      entries.push({
        id: 'receivable-followup',
        name: 'Pending fee follow-up',
        amount: totalReceivable,
        type: 'action',
        customType: `Collect pending balances worth ₹${totalReceivable.toLocaleString('en-IN')}`,
      });
    }

    topCategories.forEach((item, idx) => {
      entries.push({
        id: `category-${idx + 1}`,
        name: `High spend: ${item.category}`,
        amount: Number(item.spent || 0),
        type: idx === 0 ? 'warning' : 'insight',
        customType: `Review ${item.category} spend`,
      });
    });

    if (entries.length === 0) {
      entries.push({
        id: 'no-data',
        name: 'No financial data found',
        amount: 0,
        type: 'info',
        customType: 'Add income/expense data to generate assistance',
      });
    }

    return res.status(200).json({
      entries,
      schoolCode,
      summary: {
        totalIncome,
        totalExpense,
        totalReceivable,
        netAmount,
        expenseRatio: Number(expenseRatio.toFixed(2)),
      },
    });
  } catch (err) {
    console.error('[ERROR] Assistance entries fetch error:', err);
    return res.status(500).json({
      message: 'Failed to fetch assistance entries',
      error: err.message
    });
  } finally {
    if (connection) {
      await connection.end().catch(() => {});
    }
  }
});

// API to handle form submission (async/await version)
app.post('/assistanceentries', async (req, res) => {
  let connection;
  try {
    const { name, amount, type, customType, schoolCode } = req.body;
    
    // Validate required fields
    if (!name || !amount || !type || !schoolCode) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate amount is a positive number
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue)) {
      return res.status(400).json({ message: 'Amount must be a number' });
    }

    const finalType = type === 'other' ? customType : type;
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();

    // Check for existing entry
    const [existing] = await connection.query(
      'SELECT * FROM entries WHERE name = ?', 
      [name]
    );

    if (existing.length > 0) {
      // Update existing entry
      const existingAmount = parseFloat(existing[0].amount);
      const newAmount = existingAmount + amountValue;
      
      await connection.query(
        'UPDATE entries SET amount = ?, type = ?, customType = ? WHERE name = ?',
        [newAmount, finalType, type === 'other' ? customType : null, name]
      );
      
      console.log(`[INFO] Updated entry for ${name} in ${schoolCode}`);
      return res.status(200).json({ 
        message: `Amount updated successfully for ${name}!`,
        schoolCode
      });
    } else {
      // Insert new entry
      await connection.query(
        'INSERT INTO entries (name, amount, type, customType) VALUES (?, ?, ?, ?)',
        [name, amountValue, finalType, type === 'other' ? customType : null]
      );
      
      console.log(`[INFO] Created new entry for ${name} in ${schoolCode}`);
      return res.status(201).json({ 
        message: `Entry added successfully for ${name}!`,
        schoolCode
      });
    }
  } catch (err) {
    console.error('[ERROR] Assistance entries error:', err);
    return res.status(500).json({ 
      message: 'Database operation failed',
      error: err.message 
    });
  }
});
// Helper function to handle empty or null values
const handleEmptyString = (str) => {
  // Return empty string if the value is null, undefined, or empty
  return str && str.trim() !== '' ? str : '';
};

// Helper function to validate costs
const validCost = (cost) => (isNaN(cost) ? 0 : parseFloat(cost));
app.post('/submitMaintenancedata', async (req, res) => {
  let connection;
  try {
    const {
      electricMaintenance,
      electricCost,
      securityAndSafety,
      securityCost,
      itAndTechnological,
      itCost,
      transportation,
      transportCost,
      furnitureAndClassroom,
      furnitureCost,
      sportsFacilities,
      sportsCost,
      maintenanceDate,
      department,
      priority,
      maintenanceType,
      status,
      schoolCode,
    } = req.body;

    if (!schoolCode) {
      return res.status(400).json({ error: 'School code is required' });
    }

    // Get a connection from the pool or create a new connection
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();

    // Calculate total cost
    const totalCost =
      validCost(electricCost) +
      validCost(securityCost) +
      validCost(itCost) +
      validCost(transportCost) +
      validCost(furnitureCost) +
      validCost(sportsCost);

    const sql = `INSERT INTO requests (
      electric_maintenance, electric_cost,
      security_maintenance, security_cost,
      it_maintenance, it_cost,
      transportation_maintenance, transport_cost,
      furniture_maintenance, furniture_cost,
      sports_maintenance, sports_cost,
      maintenance_date, department, priority,
      maintenance_type, status, total_cost
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
      handleEmptyString(electricMaintenance),
      validCost(electricCost),
      handleEmptyString(securityAndSafety),
      validCost(securityCost),
      handleEmptyString(itAndTechnological),
      validCost(itCost),
      handleEmptyString(transportation),
      validCost(transportCost),
      handleEmptyString(furnitureAndClassroom),
      validCost(furnitureCost),
      handleEmptyString(sportsFacilities),
      validCost(sportsCost),
      maintenanceDate,
      department,
      priority,
      maintenanceType,
      status,
      totalCost,
    ];

    // Execute the query
    const [result] = await connection.query(sql, values);
    
    console.log('✅ Record inserted:', result);
    res.status(200).json({
      message: 'Maintenance request submitted successfully!',
      databaseUsed: schoolCode,
    });

  } catch (err) {
    console.error('❌ Error in /submitMaintenancedata:', err);
    res.status(500).json({ 
      error: 'Database error',
      details: err.message 
    });
  }
});



// Calculate bus fee based on distance
const calculateBusFee = (distance) => {
  if (distance <= 5) return 100; // Less than 5 km
  if (distance <= 10) return 150; // 5 to 10 km
  return 200; // More than 10 km
};

const REQUIRED_COLUMNS = [
  { name: 'fees_exam', type: 'DECIMAL(10,2)' },
  { name: 'fees_bus', type: 'DECIMAL(10,2)' },
  { name: 'fees_uniform', type: 'DECIMAL(10,2)' },
  { name: 'fees_books', type: 'DECIMAL(10,2)' },
  { name: 'other', type: 'VARCHAR(255)' },
];

const ensureColumnsExist = async (db, tableName) => {
  const [existingCols] = await db.query(`SHOW COLUMNS FROM \`${tableName}\``);
  const existingColNames = existingCols.map(col => col.Field);
  console.log("column is already their")
  

  for (const col of REQUIRED_COLUMNS) {
    if (!existingColNames.includes(col.name)) {
      const alterQuery = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${col.name}\` ${col.type}`;
      console.log(`🔧 Adding missing column: ${col.name}`);
      await db.query(alterQuery);
    }
  }
};

app.post('/income', async (req, res) => {
  console.log('Received POST /income request');
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  const {
    income_type,
    class_name,
    class_section,
    distance,
    exam,
    bus,
    uniform,
    books,
    tuition,
    admission = 0, // Default to 0 if not provided
    other,
    donor_name,
    donation_amount,
    donation_date,
    investor_name,
    investment_amount,
    investment_date,
    other_name,
    other_amount,
    other_date,
    schoolCode,
    feeEntries = [] // Default to empty array
  } = req.body;

  if (!schoolCode) {
    return res.status(400).json({ success: false, message: 'School Code is required' });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);

    if (income_type === "fees") {
      // Process class name (existing code)
      let processedClassName;
      if (/^[0-9]+$/.test(class_name)) {
        processedClassName = parseInt(class_name, 10);
      } else if (/^class\s+\d+$/i.test(class_name)) {
        const numericPart = class_name.replace(/\D/g, '');
        processedClassName = parseInt(numericPart, 10);
      } else {
        processedClassName = class_name.charAt(0).toUpperCase() + 
                           class_name.slice(1).toLowerCase();
      }

      // Calculate admission fee from feeEntries if not provided in main body
      const calculatedAdmission = feeEntries.find(entry => entry.type === 'admission')?.amount || admission;

      const baseFeeTypes = new Set([
        "tuition",
        "exam",
        "bus",
        "uniform",
        "books",
        "admission",
        "other",
        "previousfeedue",
        "residential",
      ]);

      const customFeeEntries = Array.isArray(feeEntries)
        ? feeEntries.filter((entry) => {
            const type = String(entry?.type || "").trim().toLowerCase();
            return type && !baseFeeTypes.has(type);
          })
        : [];

      // Calculate complete fee including admission
      const completeFee = [
        parseFloat(tuition) || 0,
        parseFloat(exam) || 0,
        parseFloat(bus) || 0,
        parseFloat(uniform) || 0,
        parseFloat(books) || 0,
        parseFloat(calculatedAdmission) || 0, // Use calculated admission fee
        parseFloat(other) || 0
      ].reduce((sum, val) => sum + val, 0) + customFeeEntries.reduce((sum, entry) => sum + (parseFloat(entry?.amount) || 0), 0);

      const insertColumns = [
        "Class_name",
        "section",
        "Exam_fees",
        "Bus_fees",
        "Uniform_fees",
        "Book_Fees",
        "Admission_fees",
        "Others",
        "CompleteFee",
        "fee_type",
      ];
      const insertValues = [
        processedClassName,
        class_section || null,
        parseFloat(exam) || 0,
        parseFloat(bus) || 0,
        parseFloat(uniform) || 0,
        parseFloat(books) || 0,
        parseFloat(calculatedAdmission) || 0,
        parseFloat(other) || 0,
        completeFee,
        "Tuition Fee",
      ];

      customFeeEntries.forEach((entry) => {
        const columnBase = normalizeFeeColumnBase(entry?.type);
        const amount = parseFloat(entry?.amount) || 0;
        if (!columnBase) return;
        insertColumns.push(columnBase, `${columnBase}_paid`, `${columnBase}_due`);
        insertValues.push(amount, 0, 0);
      });

      const feesQuery = `
        INSERT INTO FeesDetails (
          ${insertColumns.join(", ")},
          created_at
        ) VALUES (${insertColumns.map(() => "?").join(", ")}, NOW())`;

      const [feesResult] = await db.execute(feesQuery, insertValues);

      res.status(201).json({
        success: true,
        message: `Fees recorded successfully for ${class_name}-${class_section}`,
        data: {
          id: feesResult.insertId,
          completeFee,
          admissionFee: parseFloat(calculatedAdmission) || 0
        }
      });
    }  else {
      // Handle other income types (unchanged)
      let query = '';
      let params = [];

      switch (income_type) {
        case 'donations':
          query = `INSERT INTO school_income (
                    income_type, donor_name, donation_amount, donation_date
                   ) VALUES (?, ?, ?, ?)`;
          params = ['donations', donor_name, donation_amount, donation_date];
          break;
          
        case 'investments':
          query = `INSERT INTO school_income (
                    income_type, investor_name, investment_amount, investment_date
                   ) VALUES (?, ?, ?, ?)`;
          params = ['investments', investor_name, investment_amount, investment_date];
          break;
          
        case 'other':
          query = `INSERT INTO school_income (
                    income_type, other_name, other_amount, other_date
                   ) VALUES (?, ?, ?, ?)`;
          params = ['other', other_name, other_amount, other_date];
          break;
          
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid income type'
          });
      }

      params = params.map(p => p === undefined ? null : p);
      const [result] = await db.execute(query, params);

      res.status(201).json({
        success: true,
        message: `Data added successfully for school: ${schoolCode}`,
        details: `Income type: ${income_type}`,
        id: result.insertId
      });
    }

    
  } catch (err) {
    console.error('❌ Unexpected error in /income route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});
function sanitize(value) {
  if (value === undefined || value === '') return null;
  if (typeof value === 'number' && isNaN(value)) return 0;
  return value;
}
app.get('/api/totals', async (req, res) => {
  try {
    const { schoolCode } = req.query;
    
    if (!schoolCode) {
      return res.status(400).json({
        success: false,
        error: 'School code is required'
      });
    }

    // Get connection to the school-specific database
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();
    
    const [result] = await connection.query(`
      SELECT 
        COALESCE(SUM(paid_amount), 0) AS total_paid,
        COALESCE(SUM(balance_amount), 0) AS total_balance,
        COALESCE(SUM(price), 0) AS total_price
      FROM Accountant
    `);
    
    // Release the connection back to the pool
    
    
    res.json({
      success: true,
      totals: {
        paid: result[0].total_paid,
        balance: result[0].total_balance,
        price: result[0].total_price
      }
    });
  } catch (err) {
    console.error('Error calculating totals:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate totals'
    });
  }
});

app.post('/trial-pay-fee-detailsincome', async (req, res) => {
  const { feeDetails = [], studentName, className, sectionName, schoolCode, Discount = 0 } = req.body;

  if (!studentName || !className || !sectionName || !schoolCode) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  if (!feeDetails.length) {
    return res.status(400).json({ message: 'No fee details provided.' });
  }

  let connection;
  try {
    const pool = getDatabaseConnection(schoolCode);
    connection = await pool.getConnection();

    // Check student exists
    const [studentResult] = await connection.execute(
      `SELECT * FROM management_login_creation WHERE name = ? AND class_name = ? AND section = ? LIMIT 1`,
      [studentName, className, sectionName]
    );

    if (!studentResult.length) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    const safe = (val) => (val == null ? 0 : val);

    // Get latest fee row for this student to check installment usage
    const [latestFees] = await connection.execute(
      `SELECT * FROM FeesDetails WHERE StudentName = ? AND Class_name = ? AND FeeSection = ? ORDER BY created_at DESC LIMIT 1`,
      [studentName, className, sectionName]
    );

    const installments = ["Installment1_Paid", "Installment2_Paid", "Installment3_Paid", "Installment4_Paid", "Installment5_Paid"];

    for (const fee of feeDetails) {
      const { type, amount = 0, total = 0 } = fee;

      let insertData = {
        StudentName: studentName,
        Class_name: className,
        FeeSection: sectionName,
        Admission_fees: 0,
        Admission_paid: 0,
        CompleteFee: 0,
        Installment1_Paid: 0,
        Installment2_Paid: 0,
        Installment3_Paid: 0,
        Installment4_Paid: 0,
        Installment5_Paid: 0,
        Bus_fees: 0,
        bus_paid: 0,
        Exam_fees: 0,
        exam_paid: 0,
        Uniform_fees: 0,
        uniform_paid: 0,
        Book_Fees: 0,
        books_paid: 0,
        Others: 0,
        others_paid: 0,
        Paid_Amount: safe(amount),
        Final_Amount: safe(total),
        Discount: safe(Discount),
      };

      switch(type) {
        case "admission":
          insertData.Admission_fees = safe(total);
          insertData.Admission_paid = safe(amount);
          break;
        case "tuition":
          insertData.CompleteFee = safe(total);
          // Auto-fill first empty installment
          for (let col of installments) {
            if (!latestFees[0] || safe(latestFees[0][col]) === 0) {
              insertData[col] = safe(amount);
              break;
            }
          }
          break;
        case "bus":
          insertData.Bus_fees = safe(total);
          insertData.bus_paid = safe(amount);
          break;
        case "exam":
          insertData.Exam_fees = safe(total);
          insertData.exam_paid = safe(amount);
          break;
        case "uniform":
          insertData.Uniform_fees = safe(total);
          insertData.uniform_paid = safe(amount);
          break;
        case "book":
          insertData.Book_Fees = safe(total);
          insertData.books_paid = safe(amount);
          break;
        case "others":
          insertData.Others = safe(total);
          insertData.others_paid = safe(amount);
          break;
      }

      await connection.execute(
        `INSERT INTO FeesDetails 
        (StudentName, Class_name, FeeSection, Admission_fees, Admission_paid, CompleteFee, Installment1_Paid, Installment2_Paid, Installment3_Paid, Installment4_Paid, Installment5_Paid,
         Bus_fees, bus_paid, Exam_fees, exam_paid, Uniform_fees, uniform_paid, Book_Fees, books_paid, Others, others_paid, Paid_Amount, Final_Amount, Discount, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`,
        [
          insertData.StudentName, insertData.Class_name, insertData.FeeSection,
          insertData.Admission_fees, insertData.Admission_paid,
          insertData.CompleteFee, insertData.Installment1_Paid, insertData.Installment2_Paid, insertData.Installment3_Paid, insertData.Installment4_Paid, insertData.Installment5_Paid,
          insertData.Bus_fees, insertData.bus_paid,
          insertData.Exam_fees, insertData.exam_paid,
          insertData.Uniform_fees, insertData.uniform_paid,
          insertData.Book_Fees, insertData.books_paid,
          insertData.Others, insertData.others_paid,
          insertData.Paid_Amount, insertData.Final_Amount, insertData.Discount
        ]
      );
    }

    res.json({ success: true, message: "All fee payments inserted with tuition auto-assigned to installments." });

  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ message: "Internal server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
});

const findMatchingReceiptInFeesDetails = async (connection, body = {}) => {
  const paymentDate = body.paymentDate || body.paidDate;
  if (!paymentDate) return null;

  const amounts = {
    tuition: Number(parseFloat(body.Paid_Amount || body.tuition_paid_this_transaction || 0).toFixed(2)),
    books: Number(parseFloat(body.books_paid || 0).toFixed(2)),
    bus: Number(parseFloat(body.bus_paid || 0).toFixed(2)),
    uniform: Number(parseFloat(body.uniform_paid || 0).toFixed(2)),
    exam: Number(parseFloat(body.exam_paid || 0).toFixed(2)),
    admission: Number(parseFloat(body.admission_paid || 0).toFixed(2)),
    others: Number(parseFloat(body.others_paid || 0).toFixed(2)),
    residential: Number(parseFloat(body.residential_paid || 0).toFixed(2)),
  };
  const totalAmount = Number(
    (
      amounts.tuition +
      amounts.books +
      amounts.bus +
      amounts.uniform +
      amounts.exam +
      amounts.admission +
      amounts.others +
      amounts.residential
    ).toFixed(2)
  );

  const normalizedPaymentMode = body.paymentMode || "";
  const normalizedTransactionId = (body.transactionId || "").trim();

  const [rows] = await connection.execute(
    `SELECT
      receiptNumber,
      ROUND(SUM(COALESCE(amount_paid, 0)), 2) AS total_paid,
      ROUND(SUM(COALESCE(Paid_Amount, 0)), 2) AS tuition_paid,
      ROUND(SUM(COALESCE(books_paid, 0)), 2) AS books_paid,
      ROUND(SUM(COALESCE(bus_paid, 0)), 2) AS bus_paid,
      ROUND(SUM(COALESCE(uniform_paid, 0)), 2) AS uniform_paid,
      ROUND(SUM(COALESCE(exam_paid, 0)), 2) AS exam_paid,
      ROUND(SUM(COALESCE(Admission_paid, 0)), 2) AS admission_paid,
      ROUND(SUM(COALESCE(others_paid, 0)), 2) AS others_paid,
      MAX(created_at) AS created_at
    FROM FeesDetails
    WHERE StudentName = ?
      AND class_name = ?
      AND section = ?
      AND DATE(COALESCE(paidDate, created_at)) = DATE(?)
      AND IFNULL(paymentMode, '') = ?
      AND IFNULL(transaction_id, '') = ?
    GROUP BY receiptNumber
    HAVING
      total_paid = ?
      AND tuition_paid = ?
      AND books_paid = ?
      AND bus_paid = ?
      AND uniform_paid = ?
      AND exam_paid = ?
      AND admission_paid = ?
      AND others_paid = ?
    ORDER BY created_at DESC
    LIMIT 1`,
    [
      body.studentName,
      body.className,
      body.sectionName,
      paymentDate,
      normalizedPaymentMode,
      normalizedTransactionId,
      totalAmount,
      amounts.tuition,
      amounts.books,
      amounts.bus,
      amounts.uniform,
      amounts.exam,
      amounts.admission,
      amounts.others,
    ]
  );

  return rows.length > 0 ? rows[0] : null;
};

app.post('/api/check-duplicate-fee-payment', async (req, res) => {
  const { schoolCode, studentName, className, sectionName } = req.body || {};
  if (!schoolCode || !studentName || !className || !sectionName) {
    return res.status(400).json({
      success: false,
      message: 'schoolCode, studentName, className, sectionName are required'
    });
  }

  let connection;
  try {
    const pool = getDatabaseConnection(schoolCode);
    connection = await pool.getConnection();
    const duplicate = await findMatchingReceiptInFeesDetails(connection, req.body || {});

    if (!duplicate) {
      return res.json({ success: true, exists: false });
    }

    return res.json({
      success: true,
      exists: true,
      receiptNumber: duplicate.receiptNumber,
      createdAt: duplicate.created_at
    });
  } catch (error) {
    console.error('❌ Error checking duplicate payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check duplicate payment',
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
});

app.post('/pay-fee-detailsincome', async (req, res) => {
  const {
    studentId = null,
    studentName,
    className,
    sectionName,
    schoolCode,
    Discount = 0,
    books_paid = 0,
    bus_paid = 0,
    uniform_paid = 0,
    exam_paid = 0,
    admission_paid = 0,
    others_paid = 0,
    residential_paid = 0,
    tuition_paid_this_transaction = 0,
    tuition_installment_id = null, // 1 to 5
    paidDate,
    paymentDate,
    receiptNumber,
    paymentMode,
    transactionId = null,
    feeDescriptions = [],
    customFeeEntries = [],
    allowDuplicate = false
  } = req.body;

  if (!schoolCode) {
    return res.status(400).json({
      message: "schoolCode is required"
    });
  }

  let connection;

  try {
    const pool = getDatabaseConnection(schoolCode);
    connection = await pool.getConnection();

    // 🔎 Resolve the student first by ID, then fall back to name/class/section.
    let studentResult = [];
    if (studentId) {
      [studentResult] = await connection.execute(
        `SELECT id, name, class_name, section FROM management_login_creation
         WHERE id = ?
         LIMIT 1`,
        [studentId]
      );
    }

    if ((!studentResult || studentResult.length === 0) && studentName && className && sectionName) {
      [studentResult] = await connection.execute(
        `SELECT id, name, class_name, section FROM management_login_creation
         WHERE name = ? AND class_name = ? AND section = ?
         LIMIT 1`,
        [studentName, className, sectionName]
      );
    }

    if (studentResult.length === 0) {
      return res.status(404).json({ message: "Student not found" });
    }

    const resolvedStudent = studentResult[0];
    const login_id = resolvedStudent.id;
    const resolvedStudentName = resolvedStudent.name || studentName;
    const resolvedClassName = resolvedStudent.class_name || className;
    const resolvedSectionName = resolvedStudent.section || sectionName;

    await connection.beginTransaction();

    const existingDuplicate = await findMatchingReceiptInFeesDetails(connection, {
      studentName: resolvedStudentName,
      className: resolvedClassName,
      sectionName: resolvedSectionName,
      paymentDate,
      paidDate,
      paymentMode,
      transactionId,
      Paid_Amount: tuition_paid_this_transaction,
      books_paid,
      bus_paid,
      uniform_paid,
      exam_paid,
      admission_paid,
      others_paid,
      residential_paid,
    });

    if (existingDuplicate && !allowDuplicate) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        duplicate: true,
        message: `Already paid with receipt number ${existingDuplicate.receiptNumber}`,
        receiptNumber: existingDuplicate.receiptNumber
      });
    }

    // Allocate receipt number atomically from school_settings.
    // school_settings.last_receipt_number stores the NEXT receipt number to use.
    await connection.execute(
      `CREATE TABLE IF NOT EXISTS school_settings (
        school_code VARCHAR(255) PRIMARY KEY,
        last_receipt_number VARCHAR(20) NOT NULL DEFAULT '001'
      )`
    );

    const [receiptRows] = await connection.execute(
      `SELECT last_receipt_number
       FROM school_settings
       WHERE school_code = ?
       FOR UPDATE`,
      [schoolCode]
    );

    const currentNextReceipt =
      receiptRows.length > 0
        ? (receiptRows[0].last_receipt_number || '001')
        : '001';
    let currentNextNumeric = parseInt(currentNextReceipt, 10) || 1;
    let allocatedReceiptNumber = String(currentNextNumeric).padStart(3, '0');

    // Safety: skip already-used receipt numbers if pointer is stale.
    for (let guard = 0; guard < 100; guard += 1) {
      const [duplicateReceipt] = await connection.execute(
        `SELECT 1 FROM FeesDetails WHERE receiptNumber = ? LIMIT 1`,
        [allocatedReceiptNumber]
      );
      if (duplicateReceipt.length === 0) break;
      currentNextNumeric += 1;
      allocatedReceiptNumber = String(currentNextNumeric).padStart(3, '0');
    }

    const nextReceiptToStore = String(currentNextNumeric + 1).padStart(3, '0');

    if (receiptRows.length > 0) {
      await connection.execute(
        `UPDATE school_settings
         SET last_receipt_number = ?
         WHERE school_code = ?`,
        [nextReceiptToStore, schoolCode]
      );
    } else {
      await connection.execute(
        `INSERT INTO school_settings (school_code, last_receipt_number)
         VALUES (?, ?)`,
        [schoolCode, nextReceiptToStore]
      );
    }

    console.log(
      `[RECEIPT][BACKEND] allocated=${allocatedReceiptNumber}, next=${nextReceiptToStore}, schoolCode=${schoolCode}`
    );

    const payments = [];

    // ✅ Tuition
    if (parseFloat(tuition_paid_this_transaction) > 0) {
      payments.push({
        type: "Tuition Fee",
        amount: parseFloat(tuition_paid_this_transaction),
        installment: tuition_installment_id
      });
    }

    // ✅ Other Fees
    if (parseFloat(books_paid) > 0)
      payments.push({ type: "Books Fee", amount: parseFloat(books_paid) });

    if (parseFloat(bus_paid) > 0)
      payments.push({ type: "Bus Fee", amount: parseFloat(bus_paid) });

    if (parseFloat(uniform_paid) > 0)
      payments.push({ type: "Uniform Fee", amount: parseFloat(uniform_paid) });

    if (parseFloat(exam_paid) > 0)
      payments.push({ type: "Exam Fee", amount: parseFloat(exam_paid) });

    if (parseFloat(admission_paid) > 0)
      payments.push({ type: "Admission Fee", amount: parseFloat(admission_paid) });

    if (parseFloat(residential_paid) > 0)
      payments.push({ type: "Residential Fee", amount: parseFloat(residential_paid) });

    const otherDescription =
      feeDescriptions.find(f => f.type === "other")?.description || "Other Fee";

    if (parseFloat(others_paid) > 0)
      payments.push({ type: otherDescription, amount: parseFloat(others_paid) });

    if (Array.isArray(customFeeEntries)) {
      for (const customFee of customFeeEntries) {
        const amount = parseFloat(customFee?.amount || 0);
        if (amount > 0) {
          payments.push({
            type: customFee?.type || customFee?.columnBase || "Custom Fee",
            amount,
            customColumnBase: customFee?.columnBase || null,
            total: Number(customFee?.total || 0) || 0,
            remaining: Number(customFee?.remaining || 0) || 0,
          });
        }
      }
    }

    if (payments.length === 0) {
      return res.status(400).json({ message: "No payment amount provided" });
    }

    // ============================================
    // INSERT EACH PAYMENT
    // ============================================
    for (const pay of payments) {

      let books = 0,
          bus = 0,
          uniform = 0,
          exam = 0,
          admission = 0,
          others = 0,
          resInst1 = 0,
          resInst1Date = null,
          i1 = 0,
          i2 = 0,
          i3 = 0,
          i4 = 0,
          i5 = 0,
          paidAmountColumn = null,
          customColumnBase = null,
          customTotalAmount = 0,
          customPaidAmount = 0,
          customDueAmount = 0;

      // ✅ Map Fee Type
      if (pay.type === "Books Fee") books = pay.amount;
      else if (pay.type === "Bus Fee") bus = pay.amount;
      else if (pay.type === "Uniform Fee") uniform = pay.amount;
      else if (pay.type === "Exam Fee") exam = pay.amount;
      else if (pay.type === "Admission Fee") admission = pay.amount;
      else if (pay.type === "Residential Fee") {
        // Store residential payment in RES_INST_1 (first residential installment)
        resInst1 = pay.amount;
        resInst1Date = paidDate || paymentDate || new Date();
      }

      else if (pay.customColumnBase) {
        customColumnBase = String(pay.customColumnBase).trim();
        customTotalAmount =
          Number(pay.total ?? pay.customTotal ?? 0) || Number(pay.amount) || 0;
        customPaidAmount = Number(pay.amount) || 0;
        const remainingBeforePayment =
          Number(pay.remaining ?? pay.customRemaining ?? customTotalAmount) || 0;
        customDueAmount = Math.max(remainingBeforePayment - customPaidAmount, 0);
      }

      else if (pay.type === "Tuition Fee") {

        // 🔥 If installment selected → DO NOT insert into Paid_Amount
        if (pay.installment && [1,2,3,4,5].includes(Number(pay.installment))) {

          paidAmountColumn = null;

          if (pay.installment == 1) i1 = pay.amount;
          else if (pay.installment == 2) i2 = pay.amount;
          else if (pay.installment == 3) i3 = pay.amount;
          else if (pay.installment == 4) i4 = pay.amount;
          else if (pay.installment == 5) i5 = pay.amount;

        } else {
          // 🔥 No installment → insert into Paid_Amount
          paidAmountColumn = pay.amount;
        }
      }

      else {
        others = pay.amount;
      }

      const insertColumns = [
        "StudentName",
        "class_name",
        "section",
        "login_id",
        "fee_type",
        "amount_paid",
        "Paid_Amount",
        "books_paid",
        "bus_paid",
        "uniform_paid",
        "exam_paid",
        "Admission_paid",
        "others_paid",
        "RES_INST_1",
        "RES_INST_1_DATE",
        "Installment1_Paid",
        "Installment2_Paid",
        "Installment3_Paid",
        "Installment4_Paid",
        "Installment5_Paid",
        "Discount",
        "paymentMode",
        "transaction_id",
        "receiptNumber",
        "paidDate",
      ];

      const insertValues = [
        resolvedStudentName,
        resolvedClassName,
        resolvedSectionName,
        login_id,
        pay.type,
        pay.amount,
        paidAmountColumn,
        books,
        bus,
        uniform,
        exam,
        admission,
        others,
        resInst1,
        resInst1Date,
        i1,
        i2,
        i3,
        i4,
        i5,
        parseFloat(Discount || 0),
        paymentMode || "Cash",
        transactionId,
        allocatedReceiptNumber,
        paidDate || paymentDate || new Date()
      ];

      if (customColumnBase) {
        insertColumns.push(customColumnBase, `${customColumnBase}_paid`, `${customColumnBase}_due`);
        insertValues.push(customTotalAmount, customPaidAmount, customDueAmount);
      }

      await connection.execute(
        `INSERT INTO FeesDetails
        (${insertColumns.join(", ")}, created_at)
         VALUES (${insertColumns.map(() => "?").join(", ")}, CURRENT_TIMESTAMP)`,
        insertValues
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: "Payment inserted successfully",
      receiptNumber: allocatedReceiptNumber,
      insertedRows: payments.length,
      details: payments
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("❌ Error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  } finally {
    if (connection) connection.release();
  }
});

// app.post('/pay-fee-detailsincome', async (req, res) => {
//   const {
//     studentName,
//     className,
//     sectionName,
//     schoolCode,
//     Discount = 0,
//     books_paid = 0,
//     bus_paid = 0,
//     uniform_paid = 0,
//     exam_paid = 0,
//     admission_paid = 0,
//     others_paid = 0,
//     tuition_paid_this_transaction = 0,
//     tuition_installment_id = null, // 1 to 5, null if not selected
//     paidDate,
//     receiptNumber,
//     paymentMode,
//     transactionId = null,
//     feeDescriptions = []
//   } = req.body;

//   if (!studentName || !className || !sectionName || !schoolCode) {
//     return res.status(400).json({
//       message: "studentName, className, sectionName and schoolCode are required"
//     });
//   }

//   let connection;

//   try {
//     const pool = getDatabaseConnection(schoolCode);
//     connection = await pool.getConnection();

//     // ✅ Get Student login_id
//     const [studentResult] = await connection.execute(
//       `SELECT id FROM management_login_creation
//        WHERE name = ? AND class_name = ? AND section = ?
//        LIMIT 1`,
//       [studentName, className, sectionName]
//     );

//     if (studentResult.length === 0) {
//       return res.status(404).json({ message: "Student not found" });
//     }

//     const login_id = studentResult[0].id;
//     await connection.beginTransaction();

//     const payments = [];

//     // Tuition
//     if (parseFloat(tuition_paid_this_transaction) > 0) {
//       payments.push({
//         type: "Tuition Fee",
//         amount: parseFloat(tuition_paid_this_transaction),
//         installment: tuition_installment_id
//       });
//     }

//     if (parseFloat(books_paid) > 0)
//       payments.push({ type: "Books Fee", amount: parseFloat(books_paid) });

//     if (parseFloat(bus_paid) > 0)
//       payments.push({ type: "Bus Fee", amount: parseFloat(bus_paid) });

//     if (parseFloat(uniform_paid) > 0)
//       payments.push({ type: "Uniform Fee", amount: parseFloat(uniform_paid) });

//     if (parseFloat(exam_paid) > 0)
//       payments.push({ type: "Exam Fee", amount: parseFloat(exam_paid) });

//     if (parseFloat(admission_paid) > 0)
//       payments.push({ type: "Admission Fee", amount: parseFloat(admission_paid) });

//     const otherDescription =
//       feeDescriptions.find(f => f.type === "other")?.description || "Other Fee";

//     if (parseFloat(others_paid) > 0)
//       payments.push({ type: otherDescription, amount: parseFloat(others_paid) });

//     if (payments.length === 0) {
//       return res.status(400).json({ message: "No payment amount provided" });
//     }

//     // ✅ Insert Each Payment As New Row
//     for (const pay of payments) {

//       let books = 0,
//           bus = 0,
//           uniform = 0,
//           exam = 0,
//           admission = 0,
//           others = 0,
//           i1 = 0,
//           i2 = 0,
//           i3 = 0,
//           i4 = 0,
//           i5 = 0,
//           paidAmountColumn = null; // Paid_Amount only for Tuition

//       // Map fee type
//       if (pay.type === "Books Fee") books = pay.amount;
//       else if (pay.type === "Bus Fee") bus = pay.amount;
//       else if (pay.type === "Uniform Fee") uniform = pay.amount;
//       else if (pay.type === "Exam Fee") exam = pay.amount;
//       else if (pay.type === "Admission Fee") admission = pay.amount;
//       else if (pay.type === "Tuition Fee") {
//         paidAmountColumn = pay.amount; // ✅ Paid_Amount only for Tuition

//         if (pay.installment && [1,2,3,4,5].includes(Number(pay.installment))) {
//           if (pay.installment == 1) i1 = pay.amount;
//           else if (pay.installment == 2) i2 = pay.amount;
//           else if (pay.installment == 3) i3 = pay.amount;
//           else if (pay.installment == 4) i4 = pay.amount;
//           else if (pay.installment == 5) i5 = pay.amount;
//         }
//       }
//       else others = pay.amount;

//       await connection.execute(
//         `INSERT INTO FeesDetails
//         (StudentName, class_name, section,
//          login_id,
//          fee_type,
//          amount_paid,
//          Paid_Amount,
//          books_paid,
//          bus_paid,
//          uniform_paid,
//          exam_paid,
//          Admission_paid,
//          others_paid,
//          Installment1_Paid,
//          Installment2_Paid,
//          Installment3_Paid,
//          Installment4_Paid,
//          Installment5_Paid,
//          Discount,
//          paymentMode,
//          transaction_id,
//          receiptNumber,
//          paidDate,
//          created_at)
//          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
//         [
//           studentName,
//           className,
//           sectionName,
//           login_id,
//           pay.type,
//           pay.amount,          // amount_paid always
//           paidAmountColumn,    // Paid_Amount only for Tuition, null for others
//           books,
//           bus,
//           uniform,
//           exam,
//           admission,
//           others,
//           i1,
//           i2,
//           i3,
//           i4,
//           i5,
//           parseFloat(Discount || 0),
//           paymentMode || "Cash",
//           transactionId,
//           receiptNumber,
//           paidDate || new Date()
//         ]
//       );
//     }

//     await connection.commit();

//     res.json({
//       success: true,
//       message: "Payment inserted successfully",
//       insertedRows: payments.length,
//       details: payments
//     });

//   } catch (error) {
//     if (connection) await connection.rollback();
//     console.error("❌ Error:", error);
//     res.status(500).json({
//       message: "Internal server error",
//       error: error.message
//     });
//   } finally {
//     if (connection) connection.release();
//   }
// });


// app.post('/pay-fee-detailsincome', async (req, res) => {
// const { feeDescriptions = [] } = req.body;
// const otherDescription = feeDescriptions.find(f => f.type === 'other')?.description || null;

//   const cleanBody = { ...req.body };
//   delete cleanBody.Discount;

//   const {
//     studentName, className, sectionName, schoolCode,
//     Discount = 0, Paid_Amount = 0,
//     books_paid = 0, bus_paid = 0, uniform_paid = 0,
//     exam_paid = 0, admission_paid = 0, others_paid = 0,
//     tuition_paid_this_transaction = 0,
//     tuition_installment_id = null,
//     adjustedInstallments,
//     paymentDate,
//     receiptNumber,
//     paymentMode,
//       transactionId = null   // <-- Add this line

//   } = cleanBody;

//   console.log('📝 Incoming Fee Payment Request:', cleanBody);

//   if (!studentName || !className || !sectionName || !schoolCode) {
//     return res.status(400).json({
//       message: 'All fields (studentName, className, sectionName, schoolCode) are required.'
//     });
//   }

//   let connection;
//   try {
// const pool = getDatabaseConnection(schoolCode);
// connection = await pool.getConnection();

//     // 1. Get Student ID
//     const [studentResult] = await connection.execute(
//       `SELECT id FROM management_login_creation
//        WHERE name = ? AND class_name = ? AND section = ?
//        LIMIT 1`,
//       [studentName, className, sectionName]
//     );

//     if (studentResult.length === 0) {
//       return res.status(404).json({
//         message: 'Student not found',
//       });
//     }

//     const login_id = studentResult[0].id;

//     // 2. Get Fee Structure
//     const [feeResult] = await connection.execute(
//       `SELECT CompleteFee, Admission_fees FROM FeesDetails
//        WHERE class_name = ? AND section = ?
//        LIMIT 1`,
//       [className, sectionName]
//     );

//     if (feeResult.length === 0) {
//       return res.status(404).json({
//         message: 'Fee structure not found'
//       });
//     }

//     const originalFee = parseFloat(feeResult[0].CompleteFee || 0);
//     const originalAdmissionFee = parseFloat(feeResult[0].Admission_fees || 0);

//     const newDiscount = parseFloat(Discount || 0);
//     const newPaidAmount = parseFloat(Paid_Amount || 0);

//     const [existing] = await connection.execute(
//       `SELECT * FROM FeesDetails WHERE login_id = ?`,
//       [login_id]
//     );

//     let totals = {
//       discount: newDiscount,
//       paidAmount: newPaidAmount,
//       books: parseFloat(books_paid || 0),
//       bus: parseFloat(bus_paid || 0),
//       uniform: parseFloat(uniform_paid || 0),
//       exam: parseFloat(exam_paid || 0),
//       admission: parseFloat(admission_paid || 0),
//       others: parseFloat(others_paid || 0)
//     };

//     if (existing.length > 0) {
//       totals.discount += parseFloat(existing[0].Discount || 0);
//       totals.paidAmount += parseFloat(existing[0].Paid_Amount || 0);
//       totals.books += parseFloat(existing[0].books_paid || 0);
//       totals.bus += parseFloat(existing[0].bus_paid || 0);
//       totals.uniform += parseFloat(existing[0].uniform_paid || 0);
//       totals.exam += parseFloat(existing[0].exam_paid || 0);
//       totals.admission += parseFloat(existing[0].Admission_paid || 0);
//       totals.others += parseFloat(existing[0].others_paid || 0);
//     }

//     const finalAmount = originalFee - totals.discount;

//     let installmentAmounts = {};
//     if (adjustedInstallments && adjustedInstallments.length > 0) {
//       adjustedInstallments.forEach(inst => {
//         installmentAmounts[`i${inst.id}`] = parseFloat(inst.amount) || 0;
//       });
//     } else {
//       const [i1, i2, i3, i4] = [1, 2, 3, 4].map(() => Math.round(finalAmount * 0.2));
//       const i5 = finalAmount - (i1 + i2 + i3 + i4);
//       installmentAmounts = { i1, i2, i3, i4, i5 };
//     }

//     await connection.beginTransaction();

//     const query = existing.length === 0 ? `
// INSERT INTO FeesDetails (
//   StudentName, class_name, section,
//   Discount, Final_Amount, Paid_Amount,
//   books_paid, bus_paid, uniform_paid,
//   exam_paid, Admission_paid, others_paid,
//   others_description,
//   Installment1_Amount, Installment2_Amount,
//   Installment3_Amount, Installment4_Amount,
//   Installment5_Amount, login_id, created_at, paidDate,
//   transaction_id, paymentMode
// ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)


//     ` : `
// UPDATE FeesDetails
// SET
//   StudentName = ?, class_name = ?, section = ?,
//   Discount = ?, Final_Amount = ?, Paid_Amount = ?,
//   books_paid = ?, bus_paid = ?, uniform_paid = ?,
//   exam_paid = ?, Admission_paid = ?, others_paid = ?,
//   others_description = ?,
//   Installment1_Amount = ?, Installment2_Amount = ?,
//   Installment3_Amount = ?, Installment4_Amount = ?,
//   Installment5_Amount = ?, updated_at = CURRENT_TIMESTAMP,
//   paidDate = ?, transaction_id = ?, paymentMode = ?
// WHERE login_id = ?


//     `;

// const params = [
//   studentName, className, sectionName,
//   totals.discount, finalAmount, totals.paidAmount,
//   totals.books, totals.bus, totals.uniform,
//   totals.exam, totals.admission, totals.others,
//   otherDescription,  // <-- now contains actual description
//   installmentAmounts.i1 || 0,
//   installmentAmounts.i2 || 0,
//   installmentAmounts.i3 || 0,
//   installmentAmounts.i4 || 0,
//   installmentAmounts.i5 || 0,
//   ...(existing.length === 0
//     ? [login_id, paymentDate || new Date(), transactionId, paymentMode]
//     : [paymentDate || new Date(), transactionId, paymentMode, login_id])
// ];


//     await connection.execute(query, params);

//     // ⭐⭐⭐ ADD INSTALLMENT PAID DATE UPDATION HERE ⭐⭐⭐
//     if (tuition_installment_id && tuition_paid_this_transaction > 0) {

//       const paidField = `Installment${tuition_installment_id}_Paid`;
//       const dateField = `Installment${tuition_installment_id}_PaidDate`;

//       const [isPaidResult] = await connection.execute(
//         `SELECT ${paidField} FROM FeesDetails WHERE login_id = ?`,
//         [login_id]
//       );

//       const isPaid = isPaidResult.length > 0 && isPaidResult[0][paidField] > 0;

//       if (!isPaid) {

//         // Update Paid Amount
//         await connection.execute(
//           `UPDATE FeesDetails
//            SET ${paidField} = ?
//            WHERE login_id = ?`,
//           [tuition_paid_this_transaction, login_id]
//         );

//         // ⭐ Update Paid Date
//         await connection.execute(
//           `UPDATE FeesDetails
//            SET ${dateField} = ?
//            WHERE login_id = ?`,
//           [paymentDate || new Date(), login_id]
//         );

//         console.log(`✔ Installment ${tuition_installment_id} paid on ${paymentDate}`);
//       }
//     }

//     await connection.commit();

//     res.json({
//       success: true,
//       message: `Fee record saved successfully`,
//       login_id,
//       details: {
//         dueAmount: finalAmount - totals.paidAmount,
//         installmentPaid: tuition_installment_id,
//         paidDate: paymentDate
//       }
//     });

//   } catch (err) {
//     if (connection) await connection.rollback();
//     console.error('❌ Error:', err);
//     res.status(500).json({ message: 'Internal server error', error: err.message });
//   } 
// });
// app.post('/trial-pay-fee-detailsincome', async (req, res) => {
//   const { feeDetails = [], studentName, className, sectionName, schoolCode, Discount = 0 } = req.body;

//   if (!studentName || !className || !sectionName || !schoolCode) {
//     return res.status(400).json({ message: 'All fields are required.' });
//   }

//   if (!feeDetails.length) {
//     return res.status(400).json({ message: 'No fee details provided.' });
//   }

//   let connection;
//   try {
//     const pool = getDatabaseConnection(schoolCode);
//     connection = await pool.getConnection();

//     // Get student ID
//     const [studentResult] = await connection.execute(
//       `SELECT id FROM management_login_creation WHERE name = ? AND class_name = ? AND section = ? LIMIT 1`,
//       [studentName, className, sectionName]
//     );

//     if (!studentResult.length) {
//       return res.status(404).json({ message: 'Student not found.' });
//     }

//     const login_id = studentResult[0].id;

//     await connection.beginTransaction();

//     for (let fee of feeDetails) {
//       const { type, amount, paidDate = new Date(), paymentMode, transactionId = null, description = null } = fee;
//       if (!type || amount <= 0) continue;

//       // Map fee type to table column
//       let paidColumn = "";
//       let othersDescription = null;
//       switch (type) {
//         case "admission":
//           paidColumn = "Admission_paid";
//           break;
//         case "tuition":
//           paidColumn = "Installment1_Paid"; // or dynamically InstallmentX_Paid
//           break;
//         case "book":
//           paidColumn = "books_paid";
//           break;
//         case "uniform":
//           paidColumn = "uniform_paid";
//           break;
//         case "exam":
//           paidColumn = "exam_paid";
//           break;
//         case "bus":
//           paidColumn = "bus_paid";
//           break;
//         case "others":
//           paidColumn = "others_paid";
//           othersDescription = description;
//           break;
//         default:
//           continue; // skip unknown types
//       }

//       const query = `
//         INSERT INTO FeesDetails
//         (login_id, StudentName, class_name, section, ${paidColumn}, paidDate, paymentMode, transaction_id, others_description, Discount, created_at)
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,  ?, CURRENT_TIMESTAMP)
//       `;
//       const values = [login_id, studentName, className, sectionName, amount, paidDate, paymentMode, transactionId, othersDescription, Discount];

//       await connection.execute(query, values);
//     }

//     await connection.commit();

//     res.json({ success: true, message: "Payments inserted as separate rows successfully.", studentId: login_id });

//   } catch (err) {
//     if (connection) await connection.rollback();
//     console.error("❌ Error:", err);
//     res.status(500).json({ message: "Internal server error", error: err.message });
//   } finally {
//     if (connection) connection.release();
//   }
// });

// app.post('/pay-fee-detailsincome', async (req, res) => {
//   // Create clean body without deleting others_paid
//   const cleanBody = { ...req.body };
//   delete cleanBody.Discount; // Only delete Discount if needed for some reason

//   // Destructure with default values
//   const {
//     studentName, className, sectionName, schoolCode,
//     Discount = 0, Paid_Amount = 0,
//     books_paid = 0, bus_paid = 0, uniform_paid = 0,
//     exam_paid = 0, admission_paid = 0, others_paid = 0,
//     tuition_paid_this_transaction = 0,
//     tuition_installment_id = null,
//     adjustedInstallments,
//     paymentDate,
//     receiptNumber,
//     paymentMode
//   } = cleanBody;

//   console.log('📝 Incoming Fee Payment Request:', cleanBody);

//   // Validate required fields
//   if (!studentName || !className || !sectionName || !schoolCode) {
//     console.warn('⚠️ Missing required fields in request body');
//     return res.status(400).json({ 
//       message: 'All fields (studentName, className, sectionName, schoolCode) are required.' 
//     });
//   }

//   let connection;
//   try {
//     connection = await getDatabaseConnection(schoolCode);

//     // 1. Get student ID from management_login_creation
//     const [studentResult] = await connection.execute(
//       `SELECT id FROM management_login_creation
//        WHERE name = ? AND class_name = ? AND section = ?
//        LIMIT 1`,
//       [studentName, className, sectionName]
//     );

//     if (studentResult.length === 0) {
//       console.warn('⚠️ Student not found in management_login_creation');
//       return res.status(404).json({
//         message: 'Student not found in records',
//         details: `Student ${studentName} in Class ${className} Section ${sectionName} not found`
//       });
//     }

//     const login_id = studentResult[0].id;
//     console.log(`🔑 Found login_id: ${login_id} for student ${studentName}`);

//     // 2. Get fee structure for the class
//     const [feeResult] = await connection.execute(
//       `SELECT CompleteFee, Admission_fees FROM FeesDetails
//        WHERE class_name = ? AND section = ?
//        LIMIT 1`,
//       [className, sectionName]
//     );

//     if (feeResult.length === 0) {
//       console.warn(`⚠️ Fee structure not found for Class ${className} Section ${sectionName}`);
//       return res.status(404).json({
//         message: 'Fee structure not found',
//         details: `No fee structure for Class ${className} Section ${sectionName}`
//       });
//     }

//     const originalFee = parseFloat(feeResult[0].CompleteFee || 0);
//     const originalAdmissionFee = parseFloat(feeResult[0].Admission_fees || 0);

//     if (isNaN(originalFee)) {
//       console.warn(`⚠️ Invalid CompleteFee value: ${feeResult[0].CompleteFee}`);
//       return res.status(400).json({
//         message: 'Invalid fee structure',
//         details: `CompleteFee must be a number for Class ${className} Section ${sectionName}`
//       });
//     }

//     // 3. Calculate totals
//     const newDiscount = parseFloat(Discount || 0);
//     const newPaidAmount = parseFloat(Paid_Amount || 0);
//     const [existing] = await connection.execute(
//       `SELECT * FROM FeesDetails WHERE login_id = ?`,
//       [login_id]
//     );

//     // Initialize totals with new payment amounts
//     let totals = {
//       discount: newDiscount,
//       paidAmount: newPaidAmount,
//       books: parseFloat(books_paid || 0),
//       bus: parseFloat(bus_paid || 0),
//       uniform: parseFloat(uniform_paid || 0),
//       exam: parseFloat(exam_paid || 0),
//       admission: parseFloat(admission_paid || 0),
//       others: parseFloat(others_paid || 0)
//     };

//     // Add existing amounts if student has fee record
//     if (existing.length > 0) {
//       totals.discount += parseFloat(existing[0].Discount || 0);
//       totals.paidAmount += parseFloat(existing[0].Paid_Amount || 0);
//       totals.books += parseFloat(existing[0].books_paid || 0);
//       totals.bus += parseFloat(existing[0].bus_paid || 0);
//       totals.uniform += parseFloat(existing[0].uniform_paid || 0);
//       totals.exam += parseFloat(existing[0].exam_paid || 0);
//       totals.admission += parseFloat(existing[0].Admission_paid || 0);
//       totals.others += parseFloat(existing[0].others_paid || 0);
//     }

//     const finalAmount = originalFee - totals.discount;

//     // 4. Calculate installment amounts
//     let installmentAmounts = {};
//     if (adjustedInstallments && adjustedInstallments.length > 0) {
//       adjustedInstallments.forEach(inst => {
//         installmentAmounts[`i${inst.id}`] = parseFloat(inst.amount) || 0;
//       });
//     } else {
//       // Default equal installments if not specified
//       const [i1, i2, i3, i4] = [1, 2, 3, 4].map(() => Math.round(finalAmount * 0.2));
//       const i5 = finalAmount - (i1 + i2 + i3 + i4);
//       installmentAmounts = { i1, i2, i3, i4, i5 };
//     }

//     // 5. Begin transaction
//     await connection.beginTransaction();

//     try {
//       // Insert or update fee details
//       const query = existing.length === 0 ? `
//         INSERT INTO FeesDetails (
//           StudentName, class_name, section,
//           Discount, Final_Amount, Paid_Amount,
//           books_paid, bus_paid, uniform_paid,
//           exam_paid, Admission_paid, others_paid,
//           Installment1_Amount, Installment2_Amount,
//           Installment3_Amount, Installment4_Amount,
//           Installment5_Amount, login_id, created_at,
//           paidDate
//         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
//       ` : `
//         UPDATE FeesDetails
//         SET
//           StudentName = ?,
//           class_name = ?,
//           section = ?,
//           Discount = ?,
//           Final_Amount = ?,
//           Paid_Amount = ?,
//           books_paid = ?,
//           bus_paid = ?,
//           uniform_paid = ?,
//           exam_paid = ?,
//           Admission_paid = ?,
//           others_paid = ?,
//           Installment1_Amount = ?,
//           Installment2_Amount = ?,
//           Installment3_Amount = ?,
//           Installment4_Amount = ?,
//           Installment5_Amount = ?,
//           updated_at = CURRENT_TIMESTAMP,
//           paidDate = ?
//         WHERE login_id = ?
//       `;

//       const params = [
//         studentName, className, sectionName,
//         totals.discount, finalAmount, totals.paidAmount,
//         totals.books, totals.bus, totals.uniform,
//         totals.exam, totals.admission, totals.others,
//         installmentAmounts.i1 || 0,
//         installmentAmounts.i2 || 0,
//         installmentAmounts.i3 || 0,
//         installmentAmounts.i4 || 0,
//         installmentAmounts.i5 || 0,
//         ...(existing.length === 0 ? [login_id, paymentDate || new Date()] : [paymentDate || new Date(), login_id])
//       ];

//       await connection.execute(query, params);

//       // 6. Handle installment payment if specified
//       if (tuition_installment_id && tuition_paid_this_transaction > 0) {
//         const installmentPaidField = `Installment${tuition_installment_id}_Paid`;
        
//         // Check if installment is already paid
//         const [isPaidResult] = await connection.execute(
//           `SELECT ${installmentPaidField} FROM FeesDetails WHERE login_id = ?`,
//           [login_id]
//         );

//         const isPaid = isPaidResult.length > 0 && isPaidResult[0][installmentPaidField] > 0;

//         if (!isPaid) {
//           await connection.execute(
//             `UPDATE FeesDetails
//              SET ${installmentPaidField} = ?
//              WHERE login_id = ?`,
//             [tuition_paid_this_transaction, login_id]
//           );
//           console.log(`✅ Updated installment ${tuition_installment_id} with amount ${tuition_paid_this_transaction}`);
//         }
//       }

//       // 7. Handle adjusted installments if specified
//       if (adjustedInstallments && adjustedInstallments.length > 0) {
//         for (const installment of adjustedInstallments) {
//           const { id, amount, originalAmount } = installment;
//           const isPaid = await checkIfInstallmentIsPaid(connection, login_id, id);
          
//           if (!isPaid) {
//             await connection.execute(
//               `UPDATE FeesDetails
//                SET Installment${id}_Amount = ?
//                WHERE login_id = ? AND Installment${id}_Amount = ?`,
//               [amount, login_id, originalAmount]
//             );
//           }
//         }
//       }

//       // 8. Commit transaction
//       await connection.commit();

//       console.log('✅ Fee record successfully saved');
//       res.json({
//         success: true,
//         message: `Fee record ${existing.length ? 'updated' : 'created'} successfully`,
//         login_id: login_id,
//         details: {
//           studentName,
//           className,
//           sectionName,
//           tuitionPaid: totals.paidAmount,
//           booksPaid: totals.books,
//           busPaid: totals.bus,
//           uniformPaid: totals.uniform,
//           examPaid: totals.exam,
//           admissionPaid: totals.admission,
//           otherPaid: totals.others,
//           totalDiscount: totals.discount,
//           dueAmount: finalAmount - totals.paidAmount,
//           installmentPaid: tuition_installment_id || 'None',
//           installmentAmount: tuition_paid_this_transaction || 0,
//           installmentAmounts: installmentAmounts
//         }
//       });

//     } catch (err) {
//       await connection.rollback();
//       console.error('❌ Detailed Transaction Error:', {
//         message: err.message,
//         code: err.code,
//         sqlState: err.sqlState,
//         sqlMessage: err.sqlMessage,
//         sql: err.sql
//       });
//       throw err;
//     }
//   } catch (err) {
//     console.error('❌ Error in /pay-fee-details:', err);
//     res.status(500).json({
//       message: 'Internal server error',
//       error: err.message,
//       stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
//     });
//   } finally {
//     if (connection) 
//   }
// });
// Helper function to check if installment is paid
async function checkIfInstallmentIsPaid(connection, login_id, installmentId) {
  const [result] = await connection.execute(
    `SELECT Installment${installmentId}_Paid 
     FROM FeesDetails 
     WHERE login_id = ?`,
    [login_id]
  );
  return result.length > 0 && result[0][`Installment${installmentId}_Paid`] > 0;
}

async function checkIfInstallmentIsPaid(connection, login_id, installmentId) {
  const [result] = await connection.execute(
    `SELECT Installment${installmentId}_Paid FROM FeesDetails WHERE login_id = ?`,
    [login_id]
  );
  return result.length > 0 && result[0][`Installment${installmentId}_Paid`] > 0;
}

app.post('/pay-fee-details', async (req, res) => {
  const {
    studentName, className, sectionName, schoolCode,
    feeEntries = [], discounts = {},
    studentId = null
  } = req.body;

  console.log('📝 Incoming Discount Request:', req.body);

  // Validate required fields
  if (!studentName || !className || !sectionName || !schoolCode) {
    console.warn('⚠️ Missing required fields in request body');
    return res.status(400).json({ message: 'All fields are required.' });
  }

  let connection;
  try {
    const pool = getDatabaseConnection(schoolCode);
    connection = await pool.getConnection();

    const normalizeFeeColumnBase = (feeName) => {
      const normalized = String(feeName || "")
        .trim()
        .toLowerCase()
        .replace(/\bfees?\b/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .replace(/_+/g, "_");

      if (!normalized) return "";
      return /^[0-9]/.test(normalized) ? `fee_${normalized}` : normalized;
    };

    const resolveDiscountColumnName = (feeType) => {
      const lower = String(feeType || "").trim().toLowerCase();
      if (!lower) return "";
      if (lower.includes("tuition")) return "tuition_discount";
      if (lower.includes("bus") || lower.includes("transport")) return "bus_discount";
      if (lower.includes("book")) return "fee_discount";
      if (lower.includes("admission")) return "Admission_Discount";
      if (lower.includes("uniform")) return "uniform_discount";
      if (lower.includes("exam")) return "exam_discount";
      if (lower.includes("stationary") || lower.includes("stationery")) return "stationary_discount";
      if (lower.includes("sports")) return "sports_discount";
      if (lower.includes("guides")) return "guides_discount";
      if (lower.includes("belt")) return "belt_discount";
      if (lower.includes("tie")) return "tie_discount";
      if (lower.includes("cultural")) return "cultural_activities_discount";
      if (lower.includes("annual")) return "anual_discount";
      if (lower.includes("library")) return "library_discount";
      if (lower.includes("transportation")) return "transportation_discount";
      if (lower.includes("xyz")) return "xyz_discount";
      if (lower.includes("abc")) return "abc_discount";
      const base = normalizeFeeColumnBase(feeType);
      return base ? `${base}_discount` : "";
    };

    const buildFeeTypeSearchTerms = (feeType) => {
      const raw = String(feeType || "").trim().toLowerCase();
      const compact = raw.replace(/\s+/g, "_");
      const base = normalizeFeeColumnBase(feeType);
      return [...new Set([raw, compact, base, base.replace(/_/g, " ")])].filter(Boolean);
    };

    // 1. Get the student's login_id
    const [studentResult] = await connection.execute(
      `SELECT id FROM management_login_creation 
       WHERE name = ? AND class_name = ? AND section = ? 
       LIMIT 1`,
      [studentName, className, sectionName]
    );

    if (studentResult.length === 0) {
      console.warn('⚠️ Student not found in management_login_creation');
      return res.status(404).json({ 
        message: 'Student not found in records',
        details: `Student ${studentName} in Class ${className} Section ${sectionName} not found`
      });
    }

    const login_id = Number(studentId) || studentResult[0].id;
    console.log(`🔑 Found login_id: ${login_id} for student ${studentName}`);

    const incomingDiscountEntries = Array.isArray(feeEntries) && feeEntries.length
      ? feeEntries
      : [
          { feeType: "Tuition Fee", discount: discounts.tuition_discount || 0 },
          { feeType: "Books Fee", discount: discounts.fee_discount || 0 },
          { feeType: "Bus Fee", discount: discounts.bus_discount || 0 },
        ];

    // Start transaction
    await connection.beginTransaction();

    try {
      const resolvedEntries = incomingDiscountEntries
        .map((entry) => ({
          feeType: String(entry?.feeType || entry?.type || "").trim(),
          discount: Number(String(entry?.discount ?? entry?.amount ?? 0).replace(/,/g, "")) || 0,
          reason: String(entry?.reason || entry?.description || "").trim(),
        }))
        .filter((entry) => entry.feeType && entry.discount > 0);

      if (!resolvedEntries.length) {
        await connection.rollback();
        return res.status(400).json({ message: "No discount amount provided." });
      }

      let updatedRows = 0;
      let totalNewDiscount = 0;

      for (const entry of resolvedEntries) {
        const discountColumn = resolveDiscountColumnName(entry.feeType);
        if (!discountColumn || !/^[a-z0-9_]+$/i.test(discountColumn)) continue;

        const searchTerms = buildFeeTypeSearchTerms(entry.feeType);
        const whereClause = searchTerms.map(() => `LOWER(TRIM(COALESCE(fee_type, ''))) = ?`).join(" OR ");

        let targetRow = null;
        if (whereClause) {
          const [rows] = await connection.execute(
            `
              SELECT id, COALESCE(CompleteFee, 0) AS CompleteFee, COALESCE(Discount, 0) AS Discount
              FROM FeesDetails
              WHERE login_id = ?
                AND (${whereClause})
              ORDER BY id DESC
              LIMIT 1
            `,
            [login_id, ...searchTerms]
          );
          targetRow = rows[0] || null;
        }

        if (!targetRow) {
          const [rows] = await connection.execute(
            `
              SELECT id, COALESCE(CompleteFee, 0) AS CompleteFee, COALESCE(Discount, 0) AS Discount
              FROM FeesDetails
              WHERE login_id = ?
              ORDER BY id DESC
              LIMIT 1
            `,
            [login_id]
          );
          targetRow = rows[0] || null;
        }

        if (!targetRow) continue;

        const currentDiscount = parseFloat(targetRow.Discount || 0) || 0;
        const currentCompleteFee = parseFloat(targetRow.CompleteFee || 0) || 0;
        const nextDiscount = currentDiscount + entry.discount;
        const finalAmount = Math.max(currentCompleteFee - nextDiscount, 0);

        await connection.execute(
          `
            UPDATE FeesDetails
            SET
              Discount = ?,
              Final_Amount = ?,
              ${discountColumn} = COALESCE(${discountColumn}, 0) + ?,
              discount_reason = COALESCE(NULLIF(?, ''), discount_reason),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [
            nextDiscount,
            finalAmount,
            entry.discount,
            entry.reason || null,
            targetRow.id,
          ]
        );

        updatedRows += 1;
        totalNewDiscount += entry.discount;
      }

      await connection.commit();

      console.log('✅ Discounts successfully saved');
      res.json({
        success: true,
        message: `Discounts updated successfully for ${updatedRows} fee row(s)`,
        login_id: login_id,
        totalDiscount: totalNewDiscount,
        updatedRows
      });

    } catch (err) {
      await connection.rollback();
      console.error('❌ Detailed Transaction Error:', err);
      throw err;
    }

  } catch (err) {
    console.error('❌ Error in /pay-fee-details:', err);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: err.message
    });
  } 
});



app.get('/get-students', async (req, res) => {
  const { className, section, schoolCode } = req.query;

  if (!className || !section || !schoolCode) {
    return res.status(400).json({ success: false, message: 'Class, Section, and School Code are required' });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);
    const query = `
      SELECT id, name, class_name, section, photo
      FROM management_login_creation
      WHERE class_name = ? AND section = ?
    `;
    
    const [results] = await db.execute(query, [className, section]);
    

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'No students found' });
    }

    // 🔥 Convert HEX to string path
    const students = results.map(s => ({
      ...s,
      photo: s.photo ? s.photo.toString() : null
    }));

    res.json({ success: true, students });

  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({ success: false, message: 'Database query failed', error });
  }
});


app.get('/student/:name', (req, res) => {
  const studentName = req.params.name;
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ message: 'School Code is required' });
  }

  const db = createConnection(schoolCode);

  const query = 'SELECT * FROM school_income_student WHERE name = ?';

  db.query(query, [studentName], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database query failed', error: err });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json(results);
  });
});


app.post('/api/attendance/set-alert-time', async (req, res) => {
  const { alertTime, schoolCode } = req.body;

  if (!alertTime || !schoolCode) {
    return res.status(400).json({ message: 'Missing alertTime or schoolCode' });
  }

  const uploadedDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    const db = await getDatabaseConnection(schoolCode); // ✅ await connection

    const [results] = await db.query(
      `SELECT * FROM attendance_alert_settings WHERE uploaded_date = ?`,
      [uploadedDate]
    );

    if (results.length > 0) {
      // ✅ Record exists → update
      await db.query(
        `UPDATE attendance_alert_settings SET alert_time = ? WHERE uploaded_date = ?`,
        [alertTime, uploadedDate]
      );
      res.json({ message: 'Alert time updated successfully' });
    } else {
      // ✅ Record doesn't exist → insert
      await db.query(
        `INSERT INTO attendance_alert_settings (alert_time, uploaded_date) VALUES (?, ?)`,
        [alertTime, uploadedDate]
      );
      res.json({ message: 'Alert time set successfully' });
    }

     // ✅ Close connection

  } catch (err) {
    console.error("❌ DB error:", err);
    res.status(500).json({ message: 'Database error' });
  }
});

app.get('/api/attendance/get-alert-time', async (req, res) => {
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ message: 'schoolCode is required' });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);
    const [rows] = await db.query(
      `SELECT alert_time, uploaded_date
       FROM attendance_alert_settings
       ORDER BY uploaded_date DESC
       LIMIT 1`
    );

    return res.json({
      success: true,
      data: rows[0] || null,
    });
  } catch (err) {
    console.error("❌ DB error fetching alert time:", err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch alert time',
      error: err.message,
    });
  }
});

app.post('/api/attendance/reset-alert-time', async (req, res) => {
  const { schoolCode } = req.body;

  if (!schoolCode) {
    return res.status(400).json({ message: 'schoolCode is required' });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);
    const [rows] = await db.query(
      `SELECT id
       FROM attendance_alert_settings
       ORDER BY uploaded_date DESC, id DESC
       LIMIT 1`
    );

    if (!rows.length) {
      return res.json({ success: true, message: 'No student alert time to reset' });
    }

    await db.query(`DELETE FROM attendance_alert_settings WHERE id = ?`, [rows[0].id]);

    return res.json({ success: true, message: 'Student alert time reset successfully' });
  } catch (err) {
    console.error('❌ DB error resetting alert time:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset alert time',
      error: err.message,
    });
  }
});
app.use('/uploads', express.static('/usr/share/nginx/html/backend/uploads'));





// const messagesRoutes=require('./routes/messages')
// app.use('/api',messagesRoutes)
// ✅ LOGIN API
// app.post('/api/logincredentials', async (req, res) => {
//   const { username, password } = req.body;
//   console.log('[LOGIN ATTEMPT]', { username, password });

//   if (!username || !password) {
//     return res.status(400).json({
//       message: 'Username and password are required',
//     });
//   }

//   try {
//     const [users] = await qualityPool.query(
//       `SELECT username, password, user_type, schoolCode, designation 
//        FROM management_login_creation 
//        WHERE username = ? AND password = ?
//        LIMIT 1`,
//       [username, password]
//     );

//     if (users.length === 0) {
//       return res.status(401).json({ message: 'Invalid credentials' });
//     }

//     const user = users[0];
//     const userType = user.user_type?.toLowerCase();
//     const designation = user.designation?.toLowerCase();

//     console.log('[ROLE CHECK]', {
//       user_type: userType,
//       designation: designation,
//     });

//     // Determine user role
//     let role;
//     if (userType === 'teacher') {
//       role = 'teacher';
//     } else if (designation === 'director') {
//       role = 'director';
//     } else {
//       role = 'management';
//     }

//     // Prepare response data
//     const responseData = {
//       success: true,
//       message: 'Login successful',
//       username: user.username,
//       role,
//       schoolCode: user.schoolCode,
//     };

//     // If user is director, add available schools to response
//     if (role === 'director') {
//       responseData.availableSchools = [
//         'BLUEBELL',
//         'FIRST_IMPRESSION_PRE_SCHOOL',
//         'SREE_GEETHANJALI_EM',
//         'SREE_GEETHANJALI_EM_SCHOOL'
//       ];
//     }

//     return res.json(responseData);
//   } catch (error) {
//     console.error('[LOGIN ERROR]', error);
//     return res.status(500).json({
//       message: 'Error during login',
//       error: error.message,
//     });
//   }
// });
app.get('/api/students', async (req, res) => {
  const schoolCode = req.query.schoolCode; // <-- use query param for GET

  if (!schoolCode) {
    return res.status(400).json({ message: 'schoolCode is required' });
  }

  console.log('[DEBUG] /api/students GET endpoint hit');

  try {
    const db = await getDatabaseConnection(schoolCode);
    const [rows] = await db.query("SELECT * FROM management_login_creation WHERE user_type = 'student'");
    

    console.log(`[DEBUG] Found ${rows.length} students`);
    res.json(rows);
  } catch (error) {
    console.error('[ERROR] Failed to fetch students:', error);
    res.status(500).json({ error: error.message, details: 'Failed to fetch student list' });
  }
});
app.put('/income', async (req, res) => {
  const {
    income_type,
    schoolCode,
    class_name,
    class_section,
    tuition,
    exam,
    bus,
    uniform,
    books,
    admission,
    residential,
    other,
    feeEntries
  } = req.body;

  // Validate required fields
  if (!schoolCode) {
    return res.status(400).json({ 
      success: false, 
      message: 'School Code is required' 
    });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);

    if (income_type === 'fees') {
      // Process class name (convert "Class 1" to 1, etc.)
      const processedClassName = parseInt(class_name.replace(/\D/g, ''), 10) || class_name;
      console.log('[PUT /income] Processed class name:', processedClassName);
      console.log('[PUT /income] Class section:', class_section);
      
      // Helper function for safe number parsing and formatting
      const safeParseAndFormat = (value, defaultValue = 0) => {
        if (value === undefined || value === null || value === '') return defaultValue;
        
        // Convert to string and clean the input
        let strValue = value.toString().trim();
        
        // Remove any non-numeric characters except decimal point and minus sign
        strValue = strValue.replace(/[^\d.-]/g, '');
        
        // Handle multiple decimal points - keep only the first one
        const parts = strValue.split('.');
        if (parts.length > 1) {
          strValue = parts[0] + '.' + parts.slice(1).join('');
        }
        
        // Parse to number and fix to 2 decimal places
        const num = parseFloat(strValue);
        return isNaN(num) ? defaultValue : parseFloat(num.toFixed(2));
      };

      // Create fee map from feeEntries array
      const feeMap = {};
      if (Array.isArray(feeEntries)) {
        feeEntries.forEach(entry => {
          if (entry.type && entry.amount != null) {
            feeMap[entry.type.toLowerCase()] = safeParseAndFormat(entry.amount);
          }
        });
      }
      console.log('[PUT /income] feeEntries received:', JSON.stringify(feeEntries, null, 2));
      console.log('[PUT /income] feeMap normalized:', feeMap);

      const baseFeeTypes = new Set([
        "tuition",
        "exam",
        "bus",
        "uniform",
        "books",
        "admission",
        "other",
        "previousfeedue",
        "residential",
      ]);

      const customFeeEntries = Array.isArray(feeEntries)
        ? feeEntries.filter((entry) => {
            const type = String(entry?.type || "").trim().toLowerCase();
            return type && !baseFeeTypes.has(type);
          })
        : [];
      console.log('[PUT /income] customFeeEntries:', customFeeEntries);

      for (const entry of customFeeEntries) {
        console.log('[PUT /income] Ensuring dynamic columns for:', entry?.type);
        await ensureFeeTypeColumns(db, entry.type);
      }

      // Find or create the fee record
      let [existingRows] = await db.execute(
        `SELECT * FROM FeesDetails
         WHERE Class_name = ? AND section = ? AND login_id IS NULL
         ORDER BY id DESC LIMIT 1`,
        [processedClassName, class_section || null]
      );

      let recordId;
      
      // Create default record if none exists
      if (existingRows.length === 0) {
        const [createResult] = await db.execute(
          `INSERT INTO FeesDetails (
            Class_name, section, Exam_fees, Bus_fees, Uniform_fees,
            Book_Fees, Admission_fees, Others, CompleteFee, fee_type, created_at
          ) VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0, 'Tuition Fee', NOW())`,
          [processedClassName, class_section || null]
        );
        recordId = createResult.insertId;
      } else {
        recordId = existingRows[0].id;
      }

      // Get current values from DB if they exist
      const [currentRecord] = await db.execute(
        `SELECT * FROM FeesDetails WHERE id = ?`,
        [recordId]
      );
      const current = currentRecord[0] || {};
      console.log('[PUT /income] Existing fee row snapshot:', current);

      // Helper function to safely get numeric values from database
      const getSafeNumericValue = (value, defaultValue = 0) => {
        if (value === undefined || value === null) return defaultValue;
        const num = parseFloat(value);
        return isNaN(num) ? defaultValue : num;
      };

      // Calculate current total fees safely
      const currentTotalFees = getSafeNumericValue(current.CompleteFee);
      const currentAdmission = getSafeNumericValue(current.Admission_fees);
      const currentExam = getSafeNumericValue(current.Exam_fees);
      const currentBus = getSafeNumericValue(current.Bus_fees);
      const currentUniform = getSafeNumericValue(current.Uniform_fees);
      const currentBooks = getSafeNumericValue(current.Book_Fees);
      const currentOthers = getSafeNumericValue(current.Others);
      const currentResidential = getSafeNumericValue(current.ResidentialCompleteFee);
      const currentCustomFees = customFeeEntries.reduce((acc, entry) => {
        const columnBase = normalizeFeeColumnBase(entry?.type);
        if (!columnBase) return acc;
        acc[columnBase] = getSafeNumericValue(current[columnBase]);
        return acc;
      }, {});
      const currentCustomTotal = Object.values(currentCustomFees).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
      console.log('[PUT /income] currentCustomFees:', currentCustomFees);
      console.log('[PUT /income] currentCustomTotal:', currentCustomTotal);

      // Calculate tuition fee if not provided
      const calculatedTuition = currentTotalFees - (
        currentAdmission + currentExam + currentBus + currentUniform + currentBooks + currentOthers + currentCustomTotal
      );
      console.log('[PUT /income] calculatedTuition:', calculatedTuition);

      // Determine new fee values with proper type checking
      const fees = {
        admission: typeof (feeMap.admission ?? admission) !== 'undefined' ? 
                   safeParseAndFormat(feeMap.admission ?? admission) : currentAdmission,
        exam: typeof (feeMap.exam ?? exam) !== 'undefined' ? 
              safeParseAndFormat(feeMap.exam ?? exam) : currentExam,
        bus: typeof (feeMap.bus ?? bus) !== 'undefined' ? 
             safeParseAndFormat(feeMap.bus ?? bus) : currentBus,
        uniform: typeof (feeMap.uniform ?? uniform) !== 'undefined' ? 
                 safeParseAndFormat(feeMap.uniform ?? uniform) : currentUniform,
        books: typeof (feeMap.books ?? books) !== 'undefined' ? 
               safeParseAndFormat(feeMap.books ?? books) : currentBooks,
        residential: typeof (feeMap.residential ?? residential) !== 'undefined' ?
               safeParseAndFormat(feeMap.residential ?? residential) : currentResidential,
        other: typeof (feeMap.other ?? other) !== 'undefined' ? 
               safeParseAndFormat(feeMap.other ?? other) : currentOthers,
        tuition: typeof (feeMap.tuition ?? tuition) !== 'undefined' ? 
                 safeParseAndFormat(feeMap.tuition ?? tuition) : calculatedTuition
      };

      const customFees = {};
      customFeeEntries.forEach((entry) => {
        const columnBase = normalizeFeeColumnBase(entry?.type);
        if (!columnBase) return;
        const providedValue = feeMap[columnBase];
        customFees[columnBase] = typeof providedValue !== 'undefined'
          ? safeParseAndFormat(providedValue)
          : currentCustomFees[columnBase] || 0;
      });
      console.log('[PUT /income] customFees resolved:', customFees);

      // Debug logging to check fee values
      console.log('Fee values:', fees);
      console.log('Custom fee values:', customFees);
      
      // Ensure all fee values are numbers
      Object.keys(fees).forEach(key => {
        if (typeof fees[key] !== 'number') {
          console.warn(`Fee ${key} is not a number:`, fees[key]);
          fees[key] = 0;
        }
      });

      // Calculate complete fee with proper decimal handling
      const totalSum = [
        fees.admission,
        fees.exam,
        fees.bus,
        fees.uniform,
        fees.books,
        fees.other,
        fees.tuition,
        ...Object.values(customFees)
      ].reduce((sum, val) => {
        const numVal = typeof val === 'number' ? val : parseFloat(val) || 0;
        return sum + numVal;
      }, 0);
      
      const completeFee = parseFloat(totalSum.toFixed(2));

      const customUpdateColumns = [];
      const customUpdateValues = [];
      customFeeEntries.forEach((entry) => {
        const columnBase = normalizeFeeColumnBase(entry?.type);
        if (!columnBase) return;
        customUpdateColumns.push(
          `${columnBase} = ?`,
          `${columnBase}_paid = ?`,
          `${columnBase}_due = ?`
        );
        customUpdateValues.push(
          customFees[columnBase] || 0,
          0,
          0
        );
      });
      console.log('[PUT /income] customUpdateColumns:', customUpdateColumns);
      console.log('[PUT /income] customUpdateValues:', customUpdateValues);
      console.log('[PUT /income] completeFee:', completeFee);

      // Update the record
      await db.execute(
        `UPDATE FeesDetails SET
          Admission_fees = ?,
          Exam_fees = ?,
          Bus_fees = ?,
          Uniform_fees = ?,
          Book_Fees = ?,
          Others = ?,
          ResidentialCompleteFee = ?,
          CompleteFee = ?,
          fee_type = ?,
          ${customUpdateColumns.length ? `${customUpdateColumns.join(", ")},` : ""}
          updated_at = NOW()
        WHERE id = ?`,
        [
          fees.admission,
          fees.exam,
          fees.bus,
          fees.uniform,
          fees.books,
          fees.other,
          fees.residential,
          completeFee,
          'Tuition Fee',
          ...customUpdateValues,
          recordId
        ]
      );

      // Return success response
      return res.status(200).json({
        success: true,
        message: `Fees ${existingRows.length === 0 ? 'created' : 'updated'} successfully`,
        data: {
          class: processedClassName,
          section: class_section,
          ...fees,
          ...customFees,
          completeFee,
          id: recordId
        }
      });
    }

    // Handle other income types
    return res.status(400).json({
      success: false,
      message: 'Invalid income type for PUT operation'
    });

  } catch (err) {
    console.error('Error in /income PUT:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
});
app.get('/feeStructure/:className', async (req, res) => {
  console.log('🔹 [/feeStructure] Incoming request:', { params: req.params, query: req.query });

  const { className } = req.params;
  const { schoolCode, section } = req.query;
  if (!schoolCode) {
    console.warn('⚠️ [/feeStructure] School Code is required');
    return res.status(400).json({ success: false, message: 'School Code is required' });
  }

  let processedClassName;
  if (/^[0-9]+$/.test(className)) {
    processedClassName = parseInt(className, 10);
  } else if (/^class\s+\d+$/i.test(className)) {
    processedClassName = parseInt(className.replace(/\D/g, ''), 10);
  } else {
    processedClassName = className.charAt(0).toUpperCase() + className.slice(1).toLowerCase();
  }
  const processedSection = section || null;
  console.log('🔹 [/feeStructure] Processed class/section:', processedClassName, processedSection);
const sql = `
  SELECT * FROM FeesDetails
  WHERE Class_name = ? AND section = ? AND StudentName IS NULL AND CompleteFee > 0
  ORDER BY id DESC
`;

  const queryParams = [processedClassName, processedSection];
  console.log('🔹 [/feeStructure] Query:', sql, queryParams);

  let connection;
  try {
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();
    console.log('🔹 [/feeStructure] Database connection established');

    const [results] = await connection.query(sql, queryParams);
    console.log('🔹 [/feeStructure] Query results:', results.length, 'rows');

    if (results.length === 0) {
      console.log('🔹 [/feeStructure] No existing fee structure. Creating default...');
      const insertSql = `
        INSERT INTO FeesDetails
          (class_name, section, Book_Fees, Uniform_fees, Exam_fees, Bus_fees, Admission_fees, Others, CompleteFee, StudentName)
        VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0, NULL)
      `;
      const [insertResult] = await connection.query(insertSql, [processedClassName, processedSection]);
      console.log('🔹 [/feeStructure] Inserted new default row. ID:', insertResult.insertId);

      const [newRows] = await connection.query(
        `SELECT * FROM FeesDetails WHERE id = ? LIMIT 1`,
        [insertResult.insertId]
      );
      const feeRow = newRows[0];
      const feeStructure = {
        Book_Fee: 0,
        Uniform_Fee: 0,
        Exam_Fee: 0,
        Bus_Fee: 0,
        Admission_Fee: 0,
        Other_Fee: 0,
        CompleteFee: 0,
        Tuition_Fee: 0
      };
      console.log('🔹 [/feeStructure] Default dynamic columns: none');
      console.log('🔹 [/feeStructure] Default fee structure:', feeStructure);
      
      return res.status(200).json({ feeStructure, created: true });
    }

const feeRow = results[0];
console.log('🔹 [/feeStructure] Found existing fee row:', feeRow);

const feeStructureReservedColumns = new Set([
  "id",
  "Class_name",
  "class_name",
  "section",
  "Section",
  "StudentName",
  "student_name",
  "login_id",
  "fee_type",
  "fee_name",
  "CompleteFee",
  "created_at",
  "updated_at",
  "Tuition_Fee",
  "tuition_fee",
  "Admission_fees",
  "Admission_Fee",
  "Exam_fees",
  "Exam_Fee",
  "Bus_fees",
  "Bus_Fee",
  "Uniform_fees",
  "Uniform_Fee",
  "Book_Fees",
  "Book_Fee",
  "Others",
  "Other_Fee",
  "Saving_Fees",
  "Saving_paid",
  "Saving_Due",
]);

const feeRowCustomColumns = Object.keys(feeRow).filter((key) => {
  if (feeStructureReservedColumns.has(key)) return false;
  if (/_paid$/i.test(key) || /_due$/i.test(key)) return false;
  const value = feeRow[key];
  if (value === null || value === undefined || value === "") return false;
  return !Number.isNaN(Number(value));
});

const feeStructure = {
  Book_Fee: parseFloat(feeRow.Book_Fees || feeRow.Book_Fee || 0),
  Uniform_Fee: parseFloat(feeRow.Uniform_fees || feeRow.Uniform_Fee || 0),
  Exam_Fee: parseFloat(feeRow.Exam_fees || feeRow.Exam_Fee || 0),
  Bus_Fee: parseFloat(feeRow.Bus_fees || feeRow.Bus_Fee || 0),
  Admission_Fee: parseFloat(feeRow.Admission_fees || feeRow.Admission_Fee || 0),
  Other_Fee: parseFloat(feeRow.Others || feeRow.Other_Fee || 0),
  CompleteFee: parseFloat(feeRow.CompleteFee || 0),
  Tuition_Fee: parseFloat(feeRow.Tuition_Fee || feeRow.TuitionFee || 0)
};

feeRowCustomColumns.forEach((column) => {
  feeStructure[column] = parseFloat(feeRow[column] || 0);
});

const sumOfKnownFees =
  feeStructure.Book_Fee +
  feeStructure.Uniform_Fee +
  feeStructure.Exam_Fee +
  feeStructure.Admission_Fee +
  feeStructure.Other_Fee;

const sumOfCustomFees = feeRowCustomColumns.reduce((sum, column) => {
  return sum + (parseFloat(feeRow[column]) || 0);
}, 0);

feeStructure.Calculated_Tuition_Fee = Math.max(0, feeStructure.CompleteFee - sumOfKnownFees - sumOfCustomFees);


    
    console.log('🔹 [/feeStructure] Sum of known fees:', sumOfKnownFees);
    console.log('🔹 [/feeStructure] Sum of custom fees:', sumOfCustomFees);
    console.log('🔹 [/feeStructure] Custom fee columns:', feeRowCustomColumns);
    console.log('🔹 [/feeStructure] CompleteFee:', feeStructure.CompleteFee);
    console.log('🔹 [/feeStructure] Stored Tuition_Fee:', feeStructure.Tuition_Fee);
    console.log('🔹 [/feeStructure] Calculated Tuition_Fee:', feeStructure.Calculated_Tuition_Fee);

    
    console.log('🔹 [/feeStructure] Final fee structure:', feeStructure);
    return res.status(200).json({ feeStructure, created: false });

  } catch (err) {
    console.error('❌ [/feeStructure] Error:', err);
    if (connection && typeof connection.end === 'function') {
      
    }
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/students/:id', async (req, res) => {
  const schoolCode = req.query.schoolCode;  // use req.query for GET params
  const studentId = req.params.id;

  if (!schoolCode) {
    return res.status(400).json({ message: 'schoolCode is required' });
  }

  console.log(`[DEBUG] /api/students/${studentId} GET endpoint hit`);

  try {
    const db = await getDatabaseConnection(schoolCode);
    const sql = 'SELECT id, name, father_name, phone_no, class_name, section FROM management_login_creation WHERE id = ? AND user_type = "student"';
    const [rows] = await db.query(sql, [studentId]);
    

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Student not found', studentId });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('[ERROR] Failed to fetch student:', error);
    res.status(500).json({ error: error.message, details: 'Failed to fetch student details' });
  }
});

app.get('/api/fees', async (req, res) => {
  const schoolCode = req.query.schoolCode;
  const feeClass = req.query.class;
  const feeSection = req.query.section;
  const studentName = req.query.name;

  const missingParams = [];
  if (!schoolCode) missingParams.push('schoolCode');
  if (!feeClass) missingParams.push('class');
  if (!feeSection) missingParams.push('section');
  if (!studentName) missingParams.push('name');

  if (missingParams.length > 0) {
    return res.status(400).json({
      error: 'Missing required parameters',
      missing: missingParams,
      details: 'Please provide schoolCode, class, section, and name'
    });
  }

  console.log('[DEBUG] /api/fees GET endpoint hit');

  try {
    const db = await getDatabaseConnection(schoolCode);
    const sql = `
      SELECT *
      FROM FeesDetails
      WHERE FeeClass = ?
        AND FeeSection = ?
        AND StudentName = ?
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const [rows] = await db.query(sql, [feeClass, feeSection, studentName]);
    

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'No fee record found',
        parameters: { feeClass, feeSection, studentName }
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('[ERROR] Failed to fetch fee details:', error);
    res.status(500).json({ error: error.message, details: 'Failed to fetch fee details' });
  }
});

app.post('/api/evaluate', async (req, res) => {
  try {
    console.log('📥 Received POST /evaluate request');
    const { schoolCode } = req.body;

    if (!schoolCode) {
      console.error('⚠️ Missing schoolCode in request body');
      return res.status(400).json({ error: 'Missing schoolCode in request body' });
    }

    console.log(`🔍 Connecting to database for schoolCode: ${schoolCode}`);
    let db;
    try {
      db = await getDatabaseConnection(schoolCode);
      console.log('✅ MySQL connected successfully');

      const query = `
        SELECT
          e.student_name,
          e.score,
          a.email,
          a.phone AS phonenum,
          a.student_photo
        FROM evaluations e
        LEFT JOIN admission_form a ON e.student_name = a.student_name
      `;

      console.log('📤 Executing query to fetch evaluation data...');
      const [rows] = await db.query(query);

      if (!rows || rows.length === 0) {
        console.warn('⚠️ No evaluation data found');
        return res.status(404).json({ error: 'No data found' });
      }

      console.log(`✅ Query successful - ${rows.length} records retrieved`);
      return res.json(rows);
    } finally {
      if (db) {
        console.log('🔚 Closing database connection');
        // 
      }
    }
  } catch (error) {
    console.error('❌ Caught error during request processing:', error.message);
    if (error.code === 'ER_BAD_DB_ERROR') {
      return res.status(404).json({ error: `Database for school ${schoolCode} not found` });
    }
    return res.status(500).json({ error: error.message });
  }
});
app.post('/api/admissions', async (req, res) => {
  console.log('\n➡️  [R-01] /api/admissions hit');
  console.log('    [R-02] req.body =', req.body);

  /* 3a. Validate input */
  const { schoolCode } = req.body || {};
  if (!schoolCode || !schoolCode.trim()) {
    console.warn('⚠️  [R-03] Missing schoolCode – request rejected');
    return res.status(400).json({ error: 'schoolCode is required' });
  }
  const targetDB = schoolCode.trim();
  console.log(`🏫 [R-04] schoolCode received: "${targetDB}"`);

  let connection;
  try {
    /* 3b. Connect to the school-specific database */
    connection = await getDatabaseConnection(targetDB);
    console.log(`🔄 [DB-01] Connected to DB: ${targetDB}`);

    /* 3c. Run the query */
    const sql = `
      SELECT a.*, e.score
      FROM admission_form AS a
      LEFT JOIN evaluations AS e ON a.id = e.id
    `;
    console.log('🛠️  [DB-02] Executing SQL:\n', sql.trim());

    const [rows] = await connection.query(sql);
    console.log(`🎉 [DB-04] Query OK – ${rows.length} rows`);
    res.json(rows);

  } catch (error) {
    console.error('❌ [DB-ERROR] Database error:', error);
    if (error.code === 'ER_BAD_DB_ERROR') {
      return res.status(404).json({ error: `Database "${targetDB}" not found` });
    }
    return res.status(500).json({ error: 'Error fetching data' });
  } 
});


const PDFDocument = require('pdfkit');
const { v4: uuidv4 } = require('uuid');



const uploadPdf = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_, file, cb) =>
    file.mimetype === 'application/pdf'
      ? cb(null, true)
      : cb(new Error('Only PDF files are allowed')),
});

const admissionProcessPdfDir = path.join(__dirname, "../uploads/admission-process");
if (!fs.existsSync(admissionProcessPdfDir)) {
  fs.mkdirSync(admissionProcessPdfDir, { recursive: true });
}

const admissionProcessPdfStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, admissionProcessPdfDir);
  },
  filename: (_req, file, cb) => {
    const safeName = String(file.originalname || "admission-process.pdf")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const admissionProcessPdfUpload = multer({
  storage: admissionProcessPdfStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const lowerName = String(file.originalname || "").toLowerCase();
    const allowedMimeTypes = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);
    if (
      allowedMimeTypes.has(file.mimetype) ||
      lowerName.endsWith(".pdf") ||
      lowerName.endsWith(".doc") ||
      lowerName.endsWith(".docx")
    ) {
      cb(null, true);
      return;
    }
    cb(new Error("Only PDF, DOC, or DOCX files are allowed"));
  },
});

async function ensureAdmissionProcessTable() {
  await qualityPool.query(`
    CREATE TABLE IF NOT EXISTS admission_process (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL DEFAULT 'admission process',
      file_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function mapAdmissionProcessRow(row, req) {
  if (!row) return null;
  const filePath = String(row.file_path || "").trim();
  const normalizedPath = filePath.startsWith("/") ? filePath : `/${filePath}`;
  const baseUrl = req ? `${req.protocol}://${req.get("host")}` : "https://cleezoclass.com:4000";
  return {
    id: row.id,
    title: row.title,
    file_name: row.file_name,
    file_path: normalizedPath,
    file_url: `${baseUrl}${normalizedPath}`,
    uploaded_at: row.uploaded_at,
  };
}

function runExecFile(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || stdout || error.message));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function convertAdmissionProcessFileToPdf(file) {
  const sourcePath = path.join(admissionProcessPdfDir, file.filename);
  const originalName = String(file.originalname || file.filename || "");
  const lowerName = originalName.toLowerCase();

  if (lowerName.endsWith(".pdf") || file.mimetype === "application/pdf") {
    return {
      generatedPdfName: file.filename,
      generatedPdfPath: `/uploads/admission-process/${file.filename}`,
      originalFileName: originalName || file.filename,
    };
  }

  const officeCommand =
    process.env.LIBREOFFICE_PATH ||
    process.env.SOFFICE_PATH ||
    "libreoffice";

  try {
    await runExecFile(officeCommand, [
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      admissionProcessPdfDir,
      sourcePath,
    ]);
  } catch (conversionError) {
    throw new Error(
      "Word to PDF conversion is not available on this server. Install LibreOffice/soffice and try again."
    );
  }

  const expectedPdfName = `${path.parse(file.filename).name}.pdf`;
  const expectedPdfFsPath = path.join(admissionProcessPdfDir, expectedPdfName);

  if (!fs.existsSync(expectedPdfFsPath)) {
    throw new Error("Word file uploaded, but PDF conversion did not produce an output file.");
  }

  try {
    fs.unlinkSync(sourcePath);
  } catch (unlinkError) {
    console.warn("Unable to remove temporary Word file:", unlinkError.message);
  }

  return {
    generatedPdfName: expectedPdfName,
    generatedPdfPath: `/uploads/admission-process/${expectedPdfName}`,
    originalFileName: originalName || expectedPdfName,
  };
}

app.post("/api/quality/admission-process/upload", (req, res) => {
  admissionProcessPdfUpload.single("file")(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message || "PDF upload failed" });
    }
    if (err) {
      return res.status(400).json({ error: err.message || "PDF upload failed" });
    }

    try {
      await ensureAdmissionProcessTable();

      if (!req.file) {
        return res.status(400).json({ error: "Please upload a PDF, DOC, or DOCX file" });
      }

      const title = String(req.body?.title || "admission process").trim() || "admission process";
      const converted = await convertAdmissionProcessFileToPdf(req.file);
      const fileName = converted.originalFileName;
      const filePath = converted.generatedPdfPath;

      const [result] = await qualityPool.query(
        `INSERT INTO admission_process (title, file_name, file_path) VALUES (?, ?, ?)`,
        [title, fileName, filePath]
      );

      const [rows] = await qualityPool.query(
        `SELECT id, title, file_name, file_path, uploaded_at
         FROM admission_process
         WHERE id = ?
         LIMIT 1`,
        [result.insertId]
      );

      return res.json({
        success: true,
        message: "Admission process document uploaded successfully",
        record: mapAdmissionProcessRow(rows[0], req),
      });
    } catch (uploadError) {
      console.error("Admission process PDF upload failed:", uploadError);
      return res.status(500).json({ error: uploadError.message || "Failed to upload admission process document" });
    }
  });
});

app.post("/api/admission/upload", (req, res) => {
  admissionProcessPdfUpload.single("file")(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message || "PDF upload failed" });
    }
    if (err) {
      return res.status(400).json({ error: err.message || "PDF upload failed" });
    }

    try {
      await ensureAdmissionProcessTable();

      if (!req.file) {
        return res.status(400).json({ error: "Please upload a PDF, DOC, or DOCX file" });
      }

      const title = String(req.body?.title || "admission process").trim() || "admission process";
      const converted = await convertAdmissionProcessFileToPdf(req.file);
      const fileName = converted.originalFileName;
      const filePath = converted.generatedPdfPath;

      const [result] = await qualityPool.query(
        `INSERT INTO admission_process (title, file_name, file_path) VALUES (?, ?, ?)`,
        [title, fileName, filePath]
      );

      const [rows] = await qualityPool.query(
        `SELECT id, title, file_name, file_path, uploaded_at
         FROM admission_process
         WHERE id = ?
         LIMIT 1`,
        [result.insertId]
      );

      return res.json({
        success: true,
        message: "Admission process document uploaded successfully",
        data: mapAdmissionProcessRow(rows[0], req),
      });
    } catch (uploadError) {
      console.error("Admission process PDF upload failed:", uploadError);
      return res.status(500).json({ error: uploadError.message || "Failed to upload admission process document" });
    }
  });
});

app.get("/api/quality/admission-process/latest", async (req, res) => {
  try {
    await ensureAdmissionProcessTable();
    const [rows] = await qualityPool.query(
      `SELECT id, title, file_name, file_path, uploaded_at
       FROM admission_process
       WHERE LOWER(file_name) LIKE '%.pdf' OR LOWER(file_path) LIKE '%.pdf'
       ORDER BY uploaded_at DESC, id DESC
       LIMIT 1`
    );

    if (!rows.length) {
      return res.status(404).json({
        error: "No admission process PDF found. Please upload a PDF first.",
      });
    }

    return res.json({
      success: true,
      record: mapAdmissionProcessRow(rows[0], req),
    });
  } catch (fetchError) {
    console.error("Fetch admission process PDF failed:", fetchError);
    return res.status(500).json({ error: "Failed to fetch admission process PDF" });
  }
});

app.get("/api/admission/latest", async (req, res) => {
  try {
    await ensureAdmissionProcessTable();
    const [rows] = await qualityPool.query(
      `SELECT id, title, file_name, file_path, uploaded_at
       FROM admission_process
       WHERE LOWER(file_name) LIKE '%.pdf' OR LOWER(file_path) LIKE '%.pdf'
       ORDER BY uploaded_at DESC, id DESC
       LIMIT 1`
    );

    if (!rows.length) {
      return res.status(404).json({
        error: "No admission process PDF found. Please upload a PDF first.",
      });
    }

    return res.json({
      success: true,
      data: mapAdmissionProcessRow(rows[0], req),
    });
  } catch (fetchError) {
    console.error("Fetch latest admission PDF failed:", fetchError);
    return res.status(500).json({ error: "Failed to fetch latest admission PDF" });
  }
});




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
const filePath = path.join(uploadDir, fileName);
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
          try { 
            
           } catch (e) {
            console.warn('⚠️ DB close failed after error:', e.message);
          }
          return reject(err);
        }

        console.log('✅ Question paper saved to DB successfully');
        resolve(result);
      });
    });
  } catch (error) {
    console.error('❌ Exception in saveQuestionPaperToDB:', error.message);
    if (db) {
      try { 
        
      } catch (e) {
        console.warn('⚠️ Failed to close DB after exception:', e.message);
      }
    }
    throw error;
  }
}



app.get('/pdf-url', cors(), async (req, res) => {
  const { classLevel, subject, board, state, schoolCode } = req.query;

  console.log('📘 /pdf-url hit:', { classLevel, subject, board, state, schoolCode });

  if (!classLevel || !subject || !board || !schoolCode) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (board === 'SSC' && !state) {
    return res.status(400).json({ error: 'State is required for SSC board' });
  }

  try {
    let pdfUrl = '';

    if (board === 'SSC') {
      const stateMap = { AP: 'Andhra Pradesh', TS: 'Telangana' };
      const fullStateName = stateMap[state] || state;
      const classKey = String(classLevel);

      const subjectKey =
        syllabusData.SSC[fullStateName]?.[classKey]?.find(
          (s) => s.toLowerCase() === subject.toLowerCase()
        );

      if (!subjectKey) {
        return res.status(400).json({ error: `No SSC PDF for subject ${subject}` });
      }

      pdfUrl = syllabusData.syllabusPaths[`SSC-${fullStateName}-${classKey}-${subjectKey}`];
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
      return res.status(400).json({ error: 'Only SSC and CBSE boards are supported' });
    }

    if (!pdfUrl) {
      return res.status(400).json({ error: 'PDF URL not found for given parameters' });
    }

    // ✅ Save metadata to the school-specific DB
    try {
      const db = await getDatabaseConnection(schoolCode);

      console.log('🗄️ Saving question paper metadata to DB for schoolCode:', schoolCode);

      await db.query(
        `INSERT INTO question_papers (class, subject, exam_type, pdf_url, total_marks, uploaded_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [classLevel, subject, 'syllabus', pdfUrl, null]
      );

       // ✅ Close connection
    } catch (dbErr) {
      console.error('⚠️ Could not save metadata:', dbErr.message);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ pdfUrl });
  } catch (err) {
    console.error('❌ Fatal error:', err.stack || err);
    res.status(500).json({ error: 'Failed to fetch PDF URL' });
  }
});

app.post('/feeDataFinance', async (req, res) => {
  const { schoolCode } = req.query;
  const { startDate, endDate } = req.body;

  if (!schoolCode || !startDate || !endDate) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  let db;
  try {
    db = await getDatabaseConnection(schoolCode);
    const [results] = await db.query(
      `SELECT
         id,
         StudentName AS studentName,
         Class_name AS className,
         Section,
         CompleteFee,
         UpdatedCompleteFee,
         Paid_Amount,
         Discount,
         fee_type,
         Final_Amount,
         created_at
       FROM
         FeesDetails
       WHERE
         created_at BETWEEN ? AND ?
       ORDER BY created_at DESC`,
      [startDate, endDate]
    );

    console.table(results); // Optional for terminal view
    res.status(200).json(results);
  } catch (err) {
    console.error('❌ Error in /feeDataFinance:', err.message);
    res.status(500).json({ error: 'Failed to fetch finance data' });
  } 
});
// API to get classes and sections
app.get('/api/class-sections', async (req, res) => {
  const schoolCode = req.query.schoolCode;
  if (!schoolCode) {
    return res.status(400).json({ error: 'schoolCode is required' });
  }

  let connection;
  try {
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();
    
    const [classes] = await connection.query(`
      SELECT DISTINCT class_name 
      FROM management_login_creation 
      WHERE user_type = 'student' 
      AND class_name IS NOT NULL 
      ORDER BY class_name
    `);
    
    const [sections] = await connection.query(`
      SELECT DISTINCT section 
      FROM management_login_creation 
      WHERE user_type = 'student' 
      AND section IS NOT NULL 
      ORDER BY section
    `);
    
    res.json({
      classes: classes.map(c => c.class_name),
      sections: sections.map(s => s.section)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  } 
});
app.get('/api/fee-payment-status', async (req, res) => {
  const { class_name, section, schoolCode } = req.query;

  // Validate required fields
  if (!class_name || !schoolCode) {
    return res.status(400).json({
      error: 'class_name and schoolCode are required'
    });
  }

  let connection;
  try {
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();

    // Normalize class name (matches /api/class-installments)
    const rawClassName = String(class_name || "").trim();
    const strippedClassName = rawClassName.replace(/^Class\s+/i, "").trim();
    const upperClass = strippedClassName.toUpperCase();
    const normalizedClassName = ['LKG', 'UKG', 'NURSERY'].includes(upperClass)
      ? upperClass
      : strippedClassName || rawClassName;

    // Fetch class-level installment plan (only from default record: login_id IS NULL)
    const [rows] = await connection.query(`
      SELECT
        CompleteFee,
        Installment1_Amount, Installment1_Deadline_Date,
        Installment2_Amount, Installment2_Deadline_Date,
        Installment3_Amount, Installment3_Deadline_Date,
        Installment4_Amount, Installment4_Deadline_Date,
        Installment5_Amount, Installment5_Deadline_Date
      FROM FeesDetails
      WHERE (
          LOWER(TRIM(REPLACE(COALESCE(Class_name, ''), 'Class ', ''))) = LOWER(TRIM(REPLACE(?, 'Class ', '')))
          OR LOWER(TRIM(REPLACE(COALESCE(FeeClass, ''), 'Class ', ''))) = LOWER(TRIM(REPLACE(?, 'Class ', '')))
        )
        AND (
          LOWER(TRIM(COALESCE(section, ''))) = LOWER(TRIM(COALESCE(?, '')))
          OR LOWER(TRIM(COALESCE(FeeSection, ''))) = LOWER(TRIM(COALESCE(?, '')))
          OR ? = '' OR ? IS NULL
        )
        AND login_id IS NULL
        AND (
          Installment1_Amount IS NOT NULL OR
          Installment2_Amount IS NOT NULL OR
          Installment3_Amount IS NOT NULL OR
          Installment4_Amount IS NOT NULL OR
          Installment5_Amount IS NOT NULL
        )
      LIMIT 1
    `, [
      normalizedClassName, normalizedClassName,
      section, section,
      section, section
    ]);

    // If no default fee structure found
    if (!rows || rows.length === 0) {
      return res.status(404).json({
        error: `No default installment data found for class "${normalizedClassName}" and section "${section}"`
      });
    }

    const defaultRow = rows[0];
    const [feeTypeRows] = await connection.query(`
      SELECT fee_name
      FROM fee_type_master
      WHERE fee_name IS NOT NULL AND TRIM(fee_name) <> ''
      ORDER BY id ASC
    `);

    const dynamicFeeSelects = (Array.isArray(feeTypeRows) ? feeTypeRows : [])
      .map((item) => {
        const base = normalizeFeeColumnBase(item?.fee_name);
        if (!base) return null;
        return [
          `COALESCE(fd.\`${base}\`, 0) AS \`${base}\``,
          `COALESCE(fd.\`${base}_paid\`, 0) AS \`${base}_paid\``,
          `COALESCE(fd.\`${base}_due\`, 0) AS \`${base}_due\``,
          `COALESCE(fd.\`${base}_discount\`, 0) AS \`${base}_discount\``,
        ].join(",\n        ");
      })
      .filter(Boolean)
      .join(",\n        ");

    // Extract tuition installment plan (amount + deadline) from class default
    const installments = Array.from({ length: 5 }, (_, i) => {
      const idx = i + 1;
      return {
        amount: parseFloat(defaultRow[`Installment${idx}_Amount`]) || 0,
        dueDate: defaultRow[`Installment${idx}_Deadline_Date`] // can be null
      };
    });

    const totalTuitionFee = parseFloat(defaultRow.CompleteFee) || 0;

    // Fetch all students in the class/section
    const [students] = await connection.query(`
      SELECT
        mlc.id AS student_id,
        mlc.name AS StudentName,
        mlc.father_name AS FatherName,         -- Added: Father's name
        mlc.phone_no AS MobileNo,              -- Added: Mobile number
        mlc.class_name AS Class_name,
        mlc.section,
        mlc.admission_no,
        fd.id AS fee_id,

        -- Tuition Fee (fall back to class default)
        COALESCE(fd.CompleteFee, ?) AS CompleteFee,
        COALESCE(fd.Paid_Amount, 0) AS Paid_Amount,
        (COALESCE(fd.CompleteFee, ?) - COALESCE(fd.Paid_Amount, 0)) AS Remaining_Amount,

        -- Other fees (individual)
        COALESCE(fd.Book_Fees, 0) AS Book_Fees,
        COALESCE(fd.books_paid, 0) AS books_paid,
        (COALESCE(fd.Book_Fees, 0) - COALESCE(fd.books_paid, 0)) AS books_remaining,

        COALESCE(fd.Bus_fees, 0) AS Bus_fees,
        COALESCE(fd.bus_paid, 0) AS bus_paid,
        (COALESCE(fd.Bus_fees, 0) - COALESCE(fd.bus_paid, 0)) AS bus_remaining,

        COALESCE(fd.Uniform_fees, 0) AS Uniform_fees,
        COALESCE(fd.uniform_paid, 0) AS uniform_paid,
        (COALESCE(fd.Uniform_fees, 0) - COALESCE(fd.uniform_paid, 0)) AS uniform_remaining,

        COALESCE(fd.Exam_fees, 0) AS Exam_fees,
        COALESCE(fd.exam_paid, 0) AS exam_paid,
        (COALESCE(fd.Exam_fees, 0) - COALESCE(fd.exam_paid, 0)) AS exam_remaining,

        COALESCE(fd.Others, 0) AS Others,
        COALESCE(fd.others_paid, 0) AS others_paid,
        (COALESCE(fd.Others, 0) - COALESCE(fd.others_paid, 0)) AS others_remaining,

        COALESCE(fd.Discount, 0) AS Discount,
        COALESCE(fd.bus_discount, 0) AS bus_discount,
        COALESCE(fd.fee_discount, 0) AS fee_discount,
        COALESCE(fd.tuition_discount, 0) AS tuition_discount,

        ${dynamicFeeSelects ? `${dynamicFeeSelects},` : ""}

        COALESCE(fd.Installment1_Paid, 0) AS Installment1_Paid,
        COALESCE(fd.Installment2_Paid, 0) AS Installment2_Paid,
        COALESCE(fd.Installment3_Paid, 0) AS Installment3_Paid,
        COALESCE(fd.Installment4_Paid, 0) AS Installment4_Paid,
        COALESCE(fd.Installment5_Paid, 0) AS Installment5_Paid

      FROM management_login_creation mlc
      LEFT JOIN FeesDetails fd ON mlc.id = fd.login_id
        AND mlc.class_name = fd.class_name
        AND mlc.section = fd.section
      WHERE mlc.class_name = ?
        AND mlc.section = ?
        AND mlc.user_type = 'student'
      ORDER BY mlc.name
    `, [
      totalTuitionFee, totalTuitionFee,
      class_name, section
    ]);

    // Attach class-level installment plan and calculate remaining per installment
    const result = students.map(student => {
      const paid = [
        parseFloat(student.Installment1_Paid) || 0,
        parseFloat(student.Installment2_Paid) || 0,
        parseFloat(student.Installment3_Paid) || 0,
        parseFloat(student.Installment4_Paid) || 0,
        parseFloat(student.Installment5_Paid) || 0
      ];

      return {
        ...student,

        // Installment amounts and deadlines → from class default only
        Installment1_Amount: installments[0].amount,
        Installment1_Deadline_Date: installments[0].dueDate,
        Installment1_Remaining: Math.max(0, installments[0].amount - paid[0]),

        Installment2_Amount: installments[1].amount,
        Installment2_Deadline_Date: installments[1].dueDate,
        Installment2_Remaining: Math.max(0, installments[1].amount - paid[1]),

        Installment3_Amount: installments[2].amount,
        Installment3_Deadline_Date: installments[2].dueDate,
        Installment3_Remaining: Math.max(0, installments[2].amount - paid[2]),

        Installment4_Amount: installments[3].amount,
        Installment4_Deadline_Date: installments[3].dueDate,
        Installment4_Remaining: Math.max(0, installments[3].amount - paid[3]),

        Installment5_Amount: installments[4].amount,
        Installment5_Deadline_Date: installments[4].dueDate,
        Installment5_Remaining: Math.max(0, installments[4].amount - paid[4]),

        // Summary
        Total_Installments_Due: installments.reduce((sum, inst) => sum + inst.amount, 0),
        Total_Installments_Paid: paid.reduce((sum, p) => sum + p, 0),
        Total_Installments_Remaining: installments.reduce((sum, inst, i) => sum + (inst.amount - paid[i]), 0)
      };
    });

    // ✅ Send final response with father_name and phone_no included
    res.json(result);

  } catch (err) {
    console.error('Error in /api/fee-payment-status:', err);
    res.status(500).json({
      error: 'Failed to fetch fee payment status'
    });
  } 
});
// API to get fee payment status
// app.get('/api/fee-payment-status', async (req, res) => {
//   console.log('API call received for /api/fee-payment-status');
//   const { class_name, section, schoolCode, send_reminders } = req.query;
//   console.log('Request parameters:', { class_name, section, schoolCode, send_reminders });

//   if (!class_name || !section || !schoolCode) {
//     console.log('Validation failed: Missing class_name, section, or schoolCode');
//     return res.status(400).json({ error: 'class_name, section, and schoolCode are required' });
//   }

//   let connection;
//   try {
//     connection = await getDatabaseConnection(schoolCode);
//     console.log('Connected to the Expense database successfully');

//     // Get default fees for the class/section
//     console.log('Fetching default fees for class:', class_name, 'section:', section);
//     const [defaultFees] = await connection.query(`
//       SELECT CompleteFee, Book_Fees, Bus_fees, Uniform_fees, Exam_fees, Others
//       FROM FeesDetails
//       WHERE class_name = ? AND section = ? AND login_id IS NULL
//       LIMIT 1
//     `, [class_name, section]);
//     console.log('Default fees query result:', defaultFees);

//     const defaultCompleteFee = defaultFees[0]?.CompleteFee || 0;
//     const defaultBookFees = defaultFees[0]?.Book_Fees || 0;
//     const defaultBusFees = defaultFees[0]?.Bus_fees || 0;
//     const defaultUniformFees = defaultFees[0]?.Uniform_fees || 0;
//     const defaultExamFees = defaultFees[0]?.Exam_fees || 0;
//     const defaultOthers = defaultFees[0]?.Others || 0;
//     console.log('Parsed default fees:', { defaultCompleteFee, defaultBookFees, defaultBusFees, defaultUniformFees, defaultExamFees, defaultOthers });

//     // Get student payment data
//     console.log('Fetching student payment data for class:', class_name, 'section:', section);
//     const [students] = await connection.query(`
//       SELECT
//         mlc.id AS student_id,
//         mlc.name AS StudentName,
//         mlc.father_name AS FatherName,
//         mlc.phone_no AS MobileNo,
//         mlc.class_name AS Class_name,
//         mlc.section,
//         mlc.admission_no,
//         fd.id AS fee_id,
//         COALESCE(fd.CompleteFee, ?) AS CompleteFee,
//         COALESCE(fd.Paid_Amount, 0) AS Paid_Amount,
//         (COALESCE(fd.CompleteFee, ?) - COALESCE(fd.Paid_Amount, 0)) AS Remaining_Amount,
//         COALESCE(fd.Book_Fees, ?) AS Book_Fees,
//         COALESCE(fd.books_paid, 0) AS books_paid,
//         (COALESCE(fd.Book_Fees, ?) - COALESCE(fd.books_paid, 0)) AS books_remaining,
//         COALESCE(fd.Bus_fees, ?) AS Bus_fees,
//         COALESCE(fd.bus_paid, 0) AS bus_paid,
//         (COALESCE(fd.Bus_fees, ?) - COALESCE(fd.bus_paid, 0)) AS bus_remaining,
//         COALESCE(fd.Uniform_fees, ?) AS Uniform_fees,
//         COALESCE(fd.uniform_paid, 0) AS uniform_paid,
//         (COALESCE(fd.Uniform_fees, ?) - COALESCE(fd.uniform_paid, 0)) AS uniform_remaining,
//         COALESCE(fd.Exam_fees, ?) AS Exam_fees,
//         COALESCE(fd.exam_paid, 0) AS exam_paid,
//         (COALESCE(fd.Exam_fees, ?) - COALESCE(fd.exam_paid, 0)) AS exam_remaining,
//         COALESCE(fd.Others, ?) AS Others,
//         COALESCE(fd.others_paid, 0) AS others_paid,
//         (COALESCE(fd.Others, ?) - COALESCE(fd.others_paid, 0)) AS others_remaining,
//         CASE
//           WHEN COALESCE(fd.Paid_Amount, 0) >= COALESCE(fd.CompleteFee, ?) THEN 'Paid'
//           WHEN COALESCE(fd.Paid_Amount, 0) > 0 THEN 'Partial'
//           ELSE 'Unpaid'
//         END AS PaymentStatus,
//         COALESCE(fd.Installment1_Paid, 0) AS Installment1_Paid,
//         COALESCE(fd.Installment2_Paid, 0) AS Installment2_Paid,
//         COALESCE(fd.Installment3_Paid, 0) AS Installment3_Paid,
//         COALESCE(fd.Installment4_Paid, 0) AS Installment4_Paid,
//         COALESCE(fd.Installment5_Paid, 0) AS Installment5_Paid,
//         fd.Installment1_Amount,
//         fd.Installment2_Amount,
//         fd.Installment3_Amount,
//         fd.Installment4_Amount,
//         fd.Installment5_Amount
//       FROM management_login_creation mlc
//       LEFT JOIN FeesDetails fd ON mlc.id = fd.login_id
//       WHERE mlc.class_name = ? AND mlc.section = ?
//       AND mlc.user_type = 'student'
//       ORDER BY mlc.name
//     `, [
//       defaultCompleteFee, defaultCompleteFee,
//       defaultBookFees, defaultBookFees,
//       defaultBusFees, defaultBusFees,
//       defaultUniformFees, defaultUniformFees,
//       defaultExamFees, defaultExamFees,
//       defaultOthers, defaultOthers,
//       defaultCompleteFee,
//       class_name, section
//     ]);

//     console.log('Query results:', students);

//     // Send notifications to unpaid students if requested
//     if (send_reminders === 'true') {
//       console.log('send_reminders is true. Processing notifications.');
//       const unpaidStudents = students.filter(student => student.PaymentStatus === 'Unpaid');
//       console.log(`Found ${unpaidStudents.length} unpaid students to notify`);

//       const notificationResults = [];
      
//       for (const student of unpaidStudents) {
//         console.log(`Processing notification for student: ${student.StudentName} (ID: ${student.student_id})`);
//         try {
//           // Get the student's username from management_login_creation
//           const [usernameRows] = await connection.query(
//             'SELECT username FROM management_login_creation WHERE id = ?',
//             [student.student_id]
//           );
//           console.log('Username query result:', usernameRows);
          
//           if (usernameRows.length > 0 && usernameRows[0].username) {
//             const username = usernameRows[0].username;
//             console.log(`Found username: ${username}`);
            
//             // Get the push token for this student
//             const [tokenRows] = await connection.query(
//               'SELECT push_token FROM user_tokens WHERE username = ?',
//               [username]
//             );
//             console.log('Push token query result:', tokenRows);
            
//             if (tokenRows.length > 0 && tokenRows[0].push_token) {
//               const pushToken = tokenRows[0].push_token;
//               console.log('Found push token. Preparing message...');
              
//               const message = {
//                 notification: {
//                   title: 'Fee Payment Reminder',
//                   body: `Dear ${student.StudentName}, your fee payment of ₹${student.CompleteFee} is pending. Please complete the payment soon.`,
//                 },
//                 token: pushToken,
//                 data: {
//                   type: 'fee_reminder',
//                   studentId: student.student_id.toString(),
//                   studentName: student.StudentName,
//                   amountDue: student.Remaining_Amount.toString(),
//                   class: student.Class_name,
//                   section: student.section,
//                   click_action: 'FLUTTER_NOTIFICATION_CLICK'
//                 }
//               };
//               console.log('Message payload:', message);

//               // Send the notification
//               const response = await admin.messaging().send(message);
//               notificationResults.push({
//                 studentId: student.student_id,
//                 name: student.StudentName,
//                 status: 'Notification sent',
//                 messageId: response
//               });
//               console.log(`Notification sent successfully to ${student.StudentName}. Message ID: ${response}`);
//             } else {
//               notificationResults.push({
//                 studentId: student.student_id,
//                 name: student.StudentName,
//                 status: 'No push token found'
//               });
//               console.log(`No push token found for ${student.StudentName}. Notification not sent.`);
//             }
//           } else {
//             notificationResults.push({
//               studentId: student.student_id,
//               name: student.StudentName,
//               status: 'No username found'
//             });
//             console.log(`No username found for student ID: ${student.student_id}. Notification not sent.`);
//           }
//         } catch (error) {
//           console.error(`Error sending notification to ${student.StudentName}:`, error);
//           notificationResults.push({
//             studentId: student.student_id,
//             name: student.StudentName,
//             status: 'Error',
//             error: error.message
//           });
//         }
//       }

//       // Add notification results to the response
//       students.notificationResults = notificationResults;
//       console.log('All notifications processed. Results:', notificationResults);
//     } else {
//       console.log('send_reminders is not true. Skipping notification process.');
//     }

//     res.json(students);
//     console.log('Response sent to client.');
//   } catch (err) {
//     console.error('An error occurred during API execution:', err);
//     res.status(500).json({ error: 'Database error' });
//   } finally {
//     if (connection) {
//       
//       console.log('Database connection closed.');
//     }
//   }
// });
// app.get('/download-pdf', cors(), async (req, res) => {
//   const { url, schoolCode } = req.query;

//   if (!url) return res.status(400).json({ error: 'Missing url param' });

//   if (schoolCode) {
//     try {
//       createDynamicConnection(schoolCode).end();
//       console.log(`📚 download-pdf called by schoolCode: ${schoolCode}`);
//     } catch (e) {
//       console.warn(`⚠️ Invalid schoolCode '${schoolCode}' – proceeding`);
//     }
//   }

//   https
//     .get(url, remoteRes => {
//       if (remoteRes.statusCode !== 200) {
//         console.error(`❌ Source returned ${remoteRes.statusCode} for ${url}`);
//         return res.status(502).json({ error: 'Failed to fetch PDF' });
//       }

//       res.setHeader('Content-Type', 'application/pdf');
//      let filename = `file-${Date.now()}.pdf`;
// if (typeof url === 'string' && url.trim() !== '') {
//   const cleanUrl = url.split('?')[0];
//  let filename = `file-${Date.now()}.pdf`;

// try {
//   if (typeof url === 'string' && url.trim() !== '') {
//     const cleanUrl = url.split('?')[0];
//     if (cleanUrl) {
//       filename = path.basename(decodeURIComponent(cleanUrl));
//     }
//   }
// } catch (err) {
//   console.warn(`⚠️ Error extracting filename from url "${url}":`, err.message);
// }

// }

//       res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

//       remoteRes.pipe(res);
//     })
//     .on('error', err => {
//       console.error('❌ Error fetching:', err.message);
//       res.status(500).json({ error: 'Error downloading PDF file' });
//     });
// });

app.get('/download-pdf', cors(), async (req, res) => {
  const { url, schoolCode } = req.query;

  if (!url) return res.status(400).json({ error: 'Missing url param' });

  // Validate URL format first
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: 'Invalid URL protocol' });
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // Handle school code if provided
  if (schoolCode) {
    try {
      createDynamicConnection(schoolCode)
      ;
      console.log(`📚 download-pdf called by schoolCode: ${schoolCode}`);
    } catch (e) {
      console.warn(`⚠️ Invalid schoolCode '${schoolCode}' – proceeding`);
    }
  }

  // Generate filename
  let filename = `file-${Date.now()}.pdf`;
  try {
    const cleanUrl = url.split('?')[0].split('#')[0];
    const urlBasename = path.basename(decodeURIComponent(cleanUrl));
    if (urlBasename && path.extname(urlBasename).toLowerCase() === '.pdf') {
      filename = urlBasename;
    }
  } catch (err) {
    console.warn(`⚠️ Error extracting filename from url "${url}":`, err.message);
  }

  // Download the file
  https.get(parsedUrl, remoteRes => {
    if (remoteRes.statusCode !== 200) {
      console.error(`❌ Source returned ${remoteRes.statusCode} for ${url}`);
      return res.status(502).json({ error: 'Failed to fetch PDF' });
    }

    // Validate content type
    const contentType = remoteRes.headers['content-type'];
    if (!contentType || !contentType.includes('application/pdf')) {
      return res.status(400).json({ error: 'URL does not point to a PDF file' });
    }

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`);

    // Pipe the response
    remoteRes.pipe(res);
  }).on('error', err => {
    console.error('❌ Error fetching:', err.message);
    res.status(500).json({ error: 'Error downloading PDF file' });
  });
});
app.post('/upload-questionpaper', uploadPdf.single('pdf'), async (req, res) => {
  console.log('📥 /upload-questionpaper hit');

  let { schoolCode, classLevel, subject, examType } = req.body;

  if (!schoolCode || !classLevel || !subject || !examType || !req.file) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  schoolCode = schoolCode.toUpperCase();
  const savedPath = req.file.path.replace(/\\/g, '/'); // Normalize slashes

  try {
    const db = await getDatabaseConnection(schoolCode); // ✅ Use async DB connection

    const sql = `
      INSERT INTO question_papers (\`class\`, subject, exam_type, file_path)
      VALUES (?, ?, ?, ?)
    `;
    const values = [classLevel, subject, examType, savedPath];

    const [result] = await db.query(sql, values);

     // ✅ Close connection

    console.log('✅ PDF metadata stored');
    res.json({ success: true, id: result.insertId, filePath: savedPath });

  } catch (err) {
    console.error('❌ Upload error:', err.message);
    res.status(500).json({ error: 'Upload failed', message: err.message });
  }
});




// Add these routes to your existing server file



// Route to handle syllabus page school code
app.post("/syllabusPageSchoolCode", (req, res) => {
  const { schoolCode } = req.body;
  if (!schoolCode) return res.status(400).json({ error: "School code is required" });
  res.json({ message: "Database toggle attempted" });
});

// Route to get list of subjects for a given board, class, and state
app.get("/subjects", (req, res) => {
  const { board, className, state } = req.query;

  if (board === "CBSE") {
    const subjects = syllabusData.CBSE[className] || [];
    return res.json({ subjects });
  }

  if (board === "SSC" && state) {
    const subjects = syllabusData.SSC[state]?.[className] || [];
    return res.json({ subjects });
  }

  return res.status(400).json({ error: "Invalid request" });
});

const syllabusData = require("./syllabusData");
// Route to get syllabus PDF path for a given board, class, subject, and state
app.get("/syllabus", (req, res) => {
  const { board, className, subject, state } = req.query;
  const key = state
    ? `SSC-${state}-${className}-${subject}`
    : `CBSE-${className}-${subject}`;
  const path = syllabusData.syllabusPaths[key];

  if (!path) {
    return res.status(404).json({ error: "Syllabus not found" });
  }

  return res.json({ path });
});

// Route to update office seal
app.post(
  '/api/admissionprocess',
  upload.fields([
    { name: 'studentPhoto' },
    { name: 'birthCertificate' },
    { name: 'aadharCard' },
    { name: 'tc' },
    { name: 'markSheet' },
  ]),
  async (req, res) => {  // Make the callback async
    try {
      const data = req.body;
      const files = req.files;

      console.log('📩 Full req.body:', req.body);
      console.log('📂 Received files:', Object.keys(files || {}));

      const schoolCode = req.body.schoolCode || req.query.schoolCode;
      if (!schoolCode) {
        console.warn('⚠️ schoolCode missing in request');
        return res.status(400).json({ message: 'Missing schoolCode in form data' });
      }

      // Get database connection
      const db = await getDatabaseConnection(schoolCode);

      const insertData = {
        student_name: data.studentName,
        dob: data.dob,
        gender: data.gender,
        blood_group: data.bloodGroup,
        nationality: data.nationality,
        religion: data.religion,
        community: data.community,
        mother_tongue: data.motherTongue,
        aadhar: data.aadhar,
        previous_school: data.previousSchool,
        last_class: data.lastClass,
        applying_for: data.applyingFor,
        student_photo: files?.studentPhoto?.[0]?.filename || null,
        father_name: data.fatherName,
        father_occupation: data.fatherOccupation,
        father_phone: data.fatherPhone,
        mother_name: data.motherName,
        mother_occupation: data.motherOccupation,
        mother_phone: data.motherPhone,
        address: data.address,
        city: data.city,
        state: data.state,
        pin: data.pin,
        email: data.email,
        phone: data.phone,
        birth_certificate: files?.birthCertificate?.[0]?.filename || null,
        aadhar_card: files?.aadharCard?.[0]?.filename || null,
        tc: files?.tc?.[0]?.filename || null,
        mark_sheet: files?.markSheet?.[0]?.filename || null,
        allergies: data.allergies,
        health_issues: data.healthIssues,
        declaration: data.declaration === 'on' || data.declaration === '1' ? 1 : 0,
      };

      console.log('📝 Insert data preview:', insertData);

      const query = `INSERT INTO admission_form SET ?`;
      const [result] = await db.query(query, insertData);

      console.log('✅ Form inserted with ID:', result.insertId);
      res.json({ message: 'Form submitted successfully' });
      
      // Close the connection when done
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      res.status(500).json({ 
        message: 'An error occurred',
        error: error.message 
      });
    }
  }
);
// Updated assetsdata endpoint using your existing connection approach
app.post('/assetsdata', upload.single('supportingDocuments'), async (req, res) => {
  let db;
  try {
    const {
      category,
      assetType,
      assetCondition,
      usageType,
      purchaseDate,
      warrantyExpiry,
      lastMaintenanceDate,
      nextMaintenanceDue,
      assetName,
      assetCode,
      vendorName,
      purchaseCost,
      currentValue,
      location,
      assignedTo,
      supplierContact,
      comments,
      schoolCode
    } = req.body;

    const supportingDocuments = req.file ? req.file.path : null;

    // Create connection using your existing function
    db = await getDatabaseConnection(schoolCode);

    const query = `
      INSERT INTO assets (
        assetCode, category, assetType, assetCondition, usageType, purchaseDate,
        warrantyExpiry, lastMaintenanceDate, nextMaintenanceDue, assetName,
        vendorName, purchaseCost, currentValue, location, assignedTo,
        supplierContact, comments, supportingDocuments
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const values = [
      assetCode, category, assetType, assetCondition, usageType, purchaseDate,
      warrantyExpiry, lastMaintenanceDate, nextMaintenanceDue, assetName,
      vendorName, purchaseCost, currentValue, location, assignedTo,
      supplierContact, comments, supportingDocuments,
    ];

    const [result] = await db.query(query, values);
    console.log('Asset data saved successfully:', result);
    res.status(201).json({ message: `Asset data saved successfully for school: ${schoolCode}!` });
  } catch (err) {
    console.error('Error saving asset data:', err);
    res.status(500).json({ message: 'Error saving asset data.' });
  } 
});

// Updated get asset endpoint using your existing connection approach
app.get('/assetsdata/:schoolCode/:assetCode', async (req, res) => {
  let db;
  try {
    const { assetCode, schoolCode } = req.params;
    
    // Create connection using your existing function
    db = await getDatabaseConnection(schoolCode);

    const query = 'SELECT assetCode, purchaseCost FROM assets WHERE assetCode = ?';
    const [results] = await db.query(query, [assetCode]);
    
    if (results.length === 0) {
      return res.status(404).json({ message: 'Asset not found' });
    }
    res.status(200).json(results[0]);
  } catch (err) {
    console.error('Error fetching asset data:', err);
    res.status(500).json({ message: 'Error fetching asset data' });
  } 
});

// Updated depreciation data endpoint
app.post('/depreciationdata', async (req, res) => {
  let db;
  try {
    const { assetCode, purchaseCost, usefulLife, depreciationMethod, depreciationValue, schoolCode } = req.body;
    
    // Create connection using your existing function
    db = await getDatabaseConnection(schoolCode);

    const query = 'INSERT INTO depreciation (assetCode, purchaseCost, usefulLife, depreciationMethod, depreciationValue) VALUES (?, ?, ?, ?, ?)';
    const values = [assetCode, purchaseCost, usefulLife, depreciationMethod, depreciationValue];

    const [result] = await db.query(query, values);
    res.status(201).json({ 
      message: `Depreciation data saved successfully for school: ${schoolCode}`,
      result 
    });
  } catch (err) {
    console.error('Error inserting depreciation data:', err);
    res.status(500).json({ message: 'Error inserting depreciation data' });
  } 
});
app.get('/api/top-3-students', async (req, res) => {
  const schoolCode = req.query.schoolCode || 'NOVA'; // from query param

  console.log(`[DEBUG] Starting /top-3-students endpoint`);
  console.log(`[DEBUG] Received schoolCode: ${schoolCode}`);

  try {
    const dynamicDb = await mysql.createConnection({
      host: '162.215.210.38',
      user: 'root',
      password: 'NavyAtagsoLnovA@$000',
      database: schoolCode,
    });

    console.log('[DEBUG] Successfully connected to DB');

    const query = `
      SELECT aps.name, aps.class_name, aps.section, 
             ROUND(AVG(aps.marks), 2) AS avg_marks, 
             mlc.photo
      FROM academic_performance_of_student AS aps
      JOIN management_login_creation AS mlc 
        ON TRIM(LOWER(aps.name)) = TRIM(LOWER(mlc.name))
      GROUP BY aps.name, aps.class_name, aps.section, mlc.photo
      ORDER BY aps.class_name, avg_marks DESC
    `;

    console.log('[DEBUG] Executing query:', query.replace(/\s+/g, ' ').trim());

    const [results] = await dynamicDb.execute(query);

    console.log('[DEBUG] Database connection closed');

    console.log(`✅ Query successful. Found ${results.length} student(s).`);
    console.log('[DEBUG] Sample result:', results.length > 0 ? results[0] : 'No results');

    // Convert photo buffers to base64
    const processedResults = results.map(student => {
      if (student.photo) {
        console.log(`[DEBUG] Converting photo to base64 for student: ${student.name}`);
        student.photo = Buffer.from(student.photo).toString('base64');
      } else {
        console.log(`[DEBUG] No photo found for student: ${student.name}`);
      }
      return student;
    });

    console.log('[DEBUG] Processing top 3 students per class');
    const top3Students = [];
    let currentClass = null;
    let classCounter = 0;

    processedResults.forEach((student, index) => {
      console.log(`[DEBUG] Processing student ${index + 1}/${processedResults.length}: ${student.name}`);
      
      if (currentClass !== student.class_name) {
        console.log(`[DEBUG] New class detected: ${student.class_name}`);
        currentClass = student.class_name;
        classCounter = 0;
      }
      
      if (classCounter < 3) {
        console.log(`[DEBUG] Adding student to top 3 for ${currentClass}: ${student.name}`);
        top3Students.push(student);
        classCounter++;
      } else {
        console.log(`[DEBUG] Skipping student (already have 3 for ${currentClass}): ${student.name}`);
      }
    });

    console.log('[DEBUG] Final top students count:', top3Students.length);
    console.log('[DEBUG] Sample top student:', top3Students.length > 0 ? top3Students[0] : 'No top students');

    res.status(200).json({ 
      students: top3Students,
      meta: {
        totalStudents: results.length,
        topStudentsCount: top3Students.length,
        classesRepresented: [...new Set(top3Students.map(s => s.class_name))],
        timestamp: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('❌ Error:', err);
    res.status(500).json({ 
      error: 'Database operation failed', 
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
});





app.get('/api/totalcost', async (req, res) => {
  console.log('Received request for total cost data');

  const { startDate, endDate, date, schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: 'schoolCode is required' });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);

    let query = `
      SELECT
        COALESCE(SUM(CAST(electric_cost AS DECIMAL(10,2))), 0) AS electric_cost,
        COALESCE(SUM(CAST(security_cost AS DECIMAL(10,2))), 0) AS security_cost,
        COALESCE(SUM(CAST(it_cost AS DECIMAL(10,2))), 0) AS it_cost,
        COALESCE(SUM(CAST(transport_cost AS DECIMAL(10,2))), 0) AS transport_cost,
        COALESCE(SUM(CAST(furniture_cost AS DECIMAL(10,2))), 0) AS furniture_cost,
        COALESCE(SUM(CAST(sports_cost AS DECIMAL(10,2))), 0) AS sports_cost,
        COALESCE(SUM(CAST(total_cost AS DECIMAL(10,2))), 0) AS total_cost
      FROM requests
    `;

    const params = [];

    if (startDate && endDate) {
      query += ` WHERE maintenance_date BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    } else if (date) {
      query += ` WHERE maintenance_date = ?`;
      params.push(date);
    }

    console.log('Executing SQL query:', query);

    const [result] = await db.query(query, params);
    

    const data = result[0];
    const responseData = {
      electric_cost: parseFloat(data.electric_cost),
      security_cost: parseFloat(data.security_cost),
      it_cost: parseFloat(data.it_cost),
      transport_cost: parseFloat(data.transport_cost),
      furniture_cost: parseFloat(data.furniture_cost),
      sports_cost: parseFloat(data.sports_cost),
      total_cost: parseFloat(data.total_cost),
    };

    console.log('Sent total cost data to frontend:', responseData);
    res.json(responseData);
  } catch (error) {
    console.error('Error executing SQL query:', error.message);
    res.status(500).json({
      electric_cost: 0,
      security_cost: 0,
      it_cost: 0,
      transport_cost: 0,
      furniture_cost: 0,
      sports_cost: 0,
      total_cost: 0
    });
  }
});

app.get('/api/overall-income', async (req, res) => {
  const { date, startDate, endDate, schoolCode } = req.query;
  console.log("Incoming Request:", req.originalUrl);
  console.log("Extracted Query Params:", { date, startDate, endDate, schoolCode });

  if (!schoolCode) {
    return res.status(400).json({ error: 'schoolCode is required' });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);

    let query = `
      SELECT
        (SELECT COALESCE(SUM(Final_Amount), 0) FROM FeesDetails WHERE Final_Amount IS NOT NULL AND StudentName IS NOT NULL AND Class_name IS NOT NULL AND Section IS NOT NULL) AS total_fee,
        (SELECT COALESCE(SUM(finalamount), 0) FROM school_income_student WHERE finalamount IS NOT NULL) AS total_income,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('Class_name', class_name, 'Section', section, 'StudentName', name, 'TypeOfPayment', typeofpayment, 'PaidAmount', paidamount))
         FROM school_income_student
         WHERE finalamount IS NOT NULL) AS other_income_details
    `;

    let queryParams = [];

    if (date) {
      query = `
        SELECT
          (SELECT COALESCE(SUM(Final_Amount), 0) FROM FeesDetails WHERE DATE(created_at) = ? AND Final_Amount IS NOT NULL AND StudentName IS NOT NULL AND Class_name IS NOT NULL AND Section IS NOT NULL) AS total_fee,
          (SELECT COALESCE(SUM(finalamount), 0) FROM school_income_student WHERE DATE(created_at) = ? AND finalamount IS NOT NULL) AS total_income,
          (SELECT JSON_ARRAYAGG(JSON_OBJECT('StudentName', StudentName, 'Final_Amount', Final_Amount, 'Class_name', Class_name, 'Section', Section)) FROM FeesDetails WHERE DATE(created_at) = ? AND Final_Amount IS NOT NULL AND StudentName IS NOT NULL AND Class_name IS NOT NULL AND Section IS NOT NULL) AS student_details,
          (SELECT JSON_ARRAYAGG(JSON_OBJECT('Class_name', class_name, 'Section', section, 'StudentName', name, 'TypeOfPayment', typeofpayment, 'PaidAmount', paidamount)) FROM school_income_student WHERE DATE(created_at) = ? AND finalamount IS NOT NULL) AS other_income_details
      `;
      queryParams = [date, date, date, date];
    } else if (startDate && endDate) {
      query = `
        SELECT
          (SELECT COALESCE(SUM(Final_Amount), 0) FROM FeesDetails WHERE DATE(created_at) BETWEEN ? AND ? AND Final_Amount IS NOT NULL AND StudentName IS NOT NULL AND Class_name IS NOT NULL AND Section IS NOT NULL) AS total_fee,
          (SELECT COALESCE(SUM(finalamount), 0) FROM school_income_student WHERE DATE(created_at) BETWEEN ? AND ? AND finalamount IS NOT NULL) AS total_income,
          (SELECT JSON_ARRAYAGG(JSON_OBJECT('StudentName', StudentName, 'Final_Amount', Final_Amount, 'Class_name', Class_name, 'Section', Section)) FROM FeesDetails WHERE DATE(created_at) BETWEEN ? AND ? AND Final_Amount IS NOT NULL AND StudentName IS NOT NULL AND Class_name IS NOT NULL AND Section IS NOT NULL) AS student_details,
          (SELECT JSON_ARRAYAGG(JSON_OBJECT('Class_name', class_name, 'Section', section, 'StudentName', name, 'TypeOfPayment', typeofpayment, 'PaidAmount', paidamount)) FROM school_income_student WHERE DATE(created_at) BETWEEN ? AND ? AND finalamount IS NOT NULL) AS other_income_details
      `;
      queryParams = [startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate];
    }

    const [results] = await db.query(query, queryParams);
    

    const { total_fee, total_income, student_details, other_income_details } = results[0];

    let parsedStudentDetails = [];
    let parsedOtherIncomeDetails = [];

    try {
      parsedStudentDetails = student_details ? JSON.parse(student_details) : [];
      parsedOtherIncomeDetails = other_income_details ? JSON.parse(other_income_details) : [];
    } catch (parseErr) {
      console.error('JSON Parse Error:', parseErr);
    }

    return res.json({
      totalFee: total_fee,
      totalIncome: total_income,
      overallIncome: total_fee + total_income,
      studentDetails: parsedStudentDetails,
      otherIncomeDetails: parsedOtherIncomeDetails,
    });
  } catch (error) {
    console.error('Database operation failed:', error);
    return res.status(500).json({ error: 'Database operation failed' });
  }
});
app.get('/api/totalexpenses', async (req, res) => {
  console.log('Received request for total expenses');

  const { startDate, endDate, date, schoolCode } = req.query;
  console.log('Query Parameters:', { startDate, endDate, date, schoolCode });

  if (!schoolCode) {
    return res.status(400).json({ error: 'Missing schoolCode in request' });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);

    let query = `
      SELECT
        id,
        type,
        amount,
        quantity,
        total_cost,
        rent_type,
        vendor_type,
        vendor_name,
        vendor_contact,
        payment_method,
        date,
        description,
        COALESCE(SUM(CAST(amount AS DECIMAL(10,2))), 0) AS total_expenses
      FROM Expense
    `;

    const queryParams = [];

    if (startDate && endDate) {
      query += ` WHERE date BETWEEN ? AND ?`;
      queryParams.push(startDate, endDate);
    } else if (date) {
      query += ` WHERE date = ?`;
      queryParams.push(date);
    }

    query += ` GROUP BY id, type, amount, quantity, total_cost, rent_type, vendor_type, vendor_name, vendor_contact, payment_method, date, description`;

    console.log('Executing SQL:', query, 'with params:', queryParams);

    const [result] = await db.query(query, queryParams);
    

    // Convert total_expenses to number
    result.forEach(row => {
      row.total_expenses = parseFloat(row.total_expenses);
    });

    console.log('Sent total expenses data:', result);
    res.json(result);
  } catch (error) {
    console.error('Database operation failed:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});
app.get('/api/totaldepreciation', async (req, res) => {
  console.log('Received request for total depreciation value');

  const { startDate, endDate, date, schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: 'Missing schoolCode in request' });
  }

  try {
    const db = await getDatabaseConnection(schoolCode);

    let query = `
      SELECT
        COALESCE(SUM(CAST(depreciationValue AS DECIMAL(10,2))), 0) AS total_depreciation
      FROM depreciation
    `;

    const queryParams = [];

    if (startDate && endDate) {
      query += ` WHERE DATE(createDate) BETWEEN ? AND ?`;
      queryParams.push(startDate, endDate);
    } else if (startDate) {
      query += ` WHERE DATE(createDate) = ?`;
      queryParams.push(startDate);
    }

    console.log('Executing SQL query:', query, 'with parameters:', queryParams);

    const [result] = await db.query(query, queryParams);
    

    const data = result[0];
    data.total_depreciation = parseFloat(data.total_depreciation);

    console.log('Sent total depreciation data to frontend:', data);
    res.json(data);
  } catch (error) {
    console.error('Database operation failed:', error);
    res.status(500).json({ error: 'Failed to retrieve total depreciation data' });
  }
});
app.get('/api/teach', async (req, res) => {
  try {
    const rawSchoolCode = req.query.schoolCode;
    if (!rawSchoolCode) {
      return res.status(400).json({ error: 'schoolCode parameter is required' });
    }


    const schoolCode = String(rawSchoolCode).trim();


    const db = await getDatabaseConnection(schoolCode);


    const query = `
      SELECT
        mlc.id AS teacher_id,
        mlc.name AS teacher_name,
        bts.salary_id,
        bts.salary_amount,
        bts.payment_date,
        bts.salary_type,
        bts.status,
        bts.effective_from,
        bts.hra,
        bts.pf,
        bts.professional_tax,
        bts.mediclaim,
        bts.deduction
      FROM management_login_creation mlc
      LEFT JOIN (
        SELECT t1.*
        FROM bizpulse_teacher_salary t1
        INNER JOIN (
          SELECT teacher_id, MAX(salary_id) AS max_salary_id
          FROM bizpulse_teacher_salary
          GROUP BY teacher_id
        ) t2 ON t1.teacher_id = t2.teacher_id AND t1.salary_id = t2.max_salary_id
      ) bts ON mlc.id = bts.teacher_id
      WHERE mlc.user_type = "teacher"
      ORDER BY mlc.id;
    `;


    const [results] = await db.query(query);
    


    res.json(results);
  } catch (err) {
    console.error('[ROUTE ERROR] GET /api/teach:', err);
    res.status(500).json({
      error: 'Failed to fetch teachers with latest salary data',
      details: err.message,
    });
  }
});
app.post("/getFeesDataOfStudents", async (req, res) => {
  const { schoolCode, className, sectionName } = req.body;
  const classNumber = className.replace(/[^\d]/g, '');
  
  const sql = `SELECT * FROM FeesDetails WHERE class_name = ? AND section = ?`;

  let connection;
  try {
    // Use getDatabaseConnection instead of DBConnection
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();
    const [results] = await connection.query(sql, [classNumber, sectionName]);
    res.status(200).json({ data: results });
  } catch (err) {
    console.error('Fetch error:', err.message);
    res.status(500).json({ error: err.message });
  } 
});
const Syllabus=require('./routes/Syllabus')
app.use('/api/',Syllabus)
const StudentInformation=require('./routes/StudentInfomation')
app.use('/api/admin',StudentInformation)
const dashboard=require('./routes/Dashboard')
app.use('/api/admin',dashboard)
const admission=require('./routes/finance')
app.use('/api',admission)
const server11=require('./routes/server1')
app.use('/api',server11)
const schoolCode1=require('./routes/schoolCode')
app.use('/api',schoolCode1)
const logo=require('./routes/logo')
app.use('/api',logo)
const Bills=require('./routes/Bills')
app.use('/api',Bills)
const ledgerRoutes = require('./routes/ledger');
app.use('/api', ledgerRoutes);
const performanceRoutes = require('./routes/performance');
const weakstudents = require('./routes/weakstudentAnalysis');
const schoolTop = require('./routes/schoolTop');
const attendance =require('./routes/attendance');
const salaries = require('./routes/salary');
const payroll = require('./routes/payroll');
const question = require('./routes/Questionpaper');
// const hot = require('./routes/hotlead');
// const warm = require('./routes/warmlead');
// const cold = require('./routes/coldlead');
// const studentInfoRoutes = require('./routes/StudentInfo');
const radiusRoutes = require('./routes/radius');
// const timetableRoutes = require('./routes/generatetimetable');
// app.use('/api',timetableRoutes)
app.use('/api', radiusRoutes); 
const salary=require('./routes/Salaries')
app.use('/api',salary)
const others=require('./routes/Otherincome')
app.use('/api',others)
const invest=require('./routes/Investments')
app.use('/api',invest)
const profit=require('./routes/profitloss')
app.use('/api',profit)
const student=require('./routes/StudentInfo')
app.use('/api',student)
const teacher=require('./routes/TeacherInfo')
app.use('/api',teacher)
app.use('/api', payroll);
app.use('/api',question)
app.use('/api', salaries);
// app.use('/api', hot);
// app.use('/api',warm)
// app.use('/api', cold);
const studentRoutes=require('./routes/studentediting')
app.use('/api',studentRoutes)
const live=require('./routes/LiveChart')
app.use('/api',live)
const centralizationRoutes=require('./routes/Centralization')
app.use('/api',centralizationRoutes)
app.get('/teachers', async (req, res) => {
  const { schoolCode } = req.query;
  if (!schoolCode) {
    return res.status(400).json({ error: 'schoolCode is a required parameter' });
  }
 
  // Define db here so it's accessible in finally
  let db;
  try {
    // This is the only line you need to establish the connection
    db = await getDatabaseConnection(schoolCode);
   
    // DELETE THE LINE "const db = req.db;"

    const query = `
        SELECT
            m.id,
            m.name,
            m.designation AS subject,
            m.phone_no,m.email,
            m.section,
            CONCAT_WS(', ',
                NULLIF(m.teaches_to_1, ''), NULLIF(m.teaches_to_2, ''),
                NULLIF(m.teaches_to_3, ''), NULLIF(m.teaches_to_4, ''),
                NULLIF(m.teaches_to_5, ''), NULLIF(m.teaches_to_6, ''),
                NULLIF(m.teaches_to_7, ''), NULLIF(m.teaches_to_8, ''),
                NULLIF(m.teaches_to_9, ''), NULLIF(m.teaches_to_10, ''),
                NULLIF(m.teaches_to_11, ''), NULLIF(m.teaches_to_12, '')
            ) AS class,
            (
                SELECT COUNT(s.id)
                FROM management_login_creation s
                WHERE s.user_type = 'student' AND s.class_name IN (
                    m.teaches_to_1, m.teaches_to_2, m.teaches_to_3, m.teaches_to_4,
                    m.teaches_to_5, m.teaches_to_6, m.teaches_to_7, m.teaches_to_8,
                    m.teaches_to_9, m.teaches_to_10, m.teaches_to_11, m.teaches_to_12
                )
            ) AS students,
            COALESCE(
                SUM(CASE WHEN ap.marks >= 20 THEN 1 ELSE 0 END) * 100.0 /
                NULLIF(COUNT(ap.id), 0),
                0
            ) AS pass_percentage,
            COUNT(ap.id) AS total_performance_records,
            SUM(CASE WHEN ap.marks >= 20 THEN 1 ELSE 0 END) AS passed_performance_records
        FROM
            management_login_creation m
        LEFT JOIN academic_performance_of_student ap ON
            LOWER(ap.subject) = (
                CASE LOWER(m.designation)
                    WHEN 'physical science' THEN 'Science'
                    WHEN 'soical' THEN 'Social'
                    WHEN 'evs' THEN 'evs'
                    WHEN 'science' THEN 'Science'
                    WHEN 'telugu' THEN 'Telugu'
                    WHEN 'english' THEN 'English'
                    WHEN 'maths' THEN 'Maths'
                    ELSE LOWER(m.designation)
                END
            )
            AND ap.class_name IN (
                m.teaches_to_1, m.teaches_to_2, m.teaches_to_3, m.teaches_to_4,
                m.teaches_to_5, m.teaches_to_6, m.teaches_to_7, m.teaches_to_8,
                m.teaches_to_9, m.teaches_to_10, m.teaches_to_11, m.teaches_to_12
            )
        WHERE
            m.user_type = 'teacher'
        GROUP BY
            m.id, m.name, m.designation, m.section;
    `;
    const [teachers] = await db.query(query);
    res.json(teachers);
  } catch (err) {
    console.error("Error fetching teachers:", err);
    res.status(500).json({ error: "Failed to fetch teachers" });
  } 
});


// Endpoint for the new teacher details page
app.get('/teacher/:id', async (req, res) => {
  const { schoolCode } = req.query;
   if (!schoolCode) {
    return res.status(400).json({ error: 'schoolCode is a required parameter' });
  }
    const { id } = req.params;
     let db;
    try {
        db = await getDatabaseConnection(schoolCode);
        const [teacherRows] = await db.query(
            `SELECT
                id, name, photo, address, designation,
                teaches_to_1, teaches_to_2, teaches_to_3, teaches_to_4,
                teaches_to_5, teaches_to_6, teaches_to_7, teaches_to_8,
                teaches_to_9, teaches_to_10, teaches_to_11, teaches_to_12
             FROM management_login_creation
             WHERE id = ? AND user_type = 'teacher'`,
            [id]
        );


        if (teacherRows.length === 0) {
            return res.status(404).json({ error: "Teacher not found" });
        }
        const teacher = teacherRows[0];
       
        const taughtClassesList = [];
        for (let i = 1; i <= 12; i++) {
            if (teacher[`teaches_to_${i}`]) {
                taughtClassesList.push(teacher[`teaches_to_${i}`]);
            }
        }
        const classesString = taughtClassesList.join(', ');


        const [performanceRows] = await db.query(
            "SELECT name, marks, class_name FROM academic_performance_of_student WHERE subject LIKE ? AND class_name IN (?)",
            [teacher.designation, taughtClassesList.length > 0 ? taughtClassesList : ['']]
        );
       
        const [attendanceRows] = await db.query(
            "SELECT date, entry_time, exit_time FROM teachers_attendance WHERE teacher_id = ?",
            [id]
        );
        const attendance = attendanceRows.map(att => ({
            date: new Date(att.date).toISOString().split('T')[0],
            entry_time: att.entry_time,
            exit_time: att.exit_time,
        }));
       
        const teacherDetails = {
            photo: teacher.photo ? `data:image/jpeg;base64,${Buffer.from(teacher.photo).toString('base64')}` : "https://st3.depositphotos.com/6672868/13701/v/450/depositphotos_137014128-stock-illustration-user-profile-icon.jpg",
            name: teacher.name,
            classes: classesString,
            subjects: teacher.designation,
            address: teacher.address,
            salary: "₹50,000",
            teaching: taughtClassesList.map(className => {
                const classPerformance = performanceRows.filter(p => p.class_name === className);
                return {
                    class: className,
                    subject: teacher.designation,
                    results: {
                        firstClass: classPerformance.filter(s => s.marks >= 60),
                        pass: classPerformance.filter(s => s.marks >= 15 && s.marks < 60),
                        fail: classPerformance.filter(s => s.marks < 15)
                    }
                }
            }),
            attendance: attendance
        };
        res.json(teacherDetails);
    } catch (err) {
        console.error(`Error fetching details for teacher ${id}:`, err);
        res.status(500).json({ error: "Failed to fetch teacher details" });
    }
});


// This endpoint provides the pass percentage for each subject
app.get('/subject-pass-percentage', async (req, res) => {
  const { schoolCode } = req.query;
   if (!schoolCode) {
    return res.status(400).json({ error: 'schoolCode is a required parameter' });
  }
  let db;
    try {
        db = await getDatabaseConnection(schoolCode);
        const db = req.db;
        const query = `
            SELECT
                subject,
                COUNT(id) AS total_students,
                SUM(CASE WHEN marks >= 20 THEN 1 ELSE 0 END) AS passed_students,
                COALESCE(
                    SUM(CASE WHEN marks >= 20 THEN 1 ELSE 0 END) * 100.0 /
                    NULLIF(COUNT(id), 0),
                    0
                ) AS pass_percentage
            FROM
                academic_performance_of_student
            GROUP BY
                subject;
        `;
        const [passPercentageData] = await db.query(query);
        res.json(passPercentageData);
    } catch (err) {
        console.error("Error fetching pass percentage:", err);
        res.status(500).json({ error: "Failed to fetch pass percentage" });
    }
});

const TeacherRoute=require('./routes/teacherediting')
app.use('/api',TeacherRoute)

const teacheravailability=require('./routes/teacheravailability');
const substitue=require('./routes/substitute');

// const accademic=require('./routes/Accademic');
// app.use('/api',accademic);
app.use('/api',substitue);

app.use('/api',teacheravailability);

app.use('/api',performanceRoutes)
app.use('/api',weakstudents)
app.use('/api',schoolTop)
app.use('/api', attendance)
// app.use('/api',studentInfoRoutes)

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// HTTP server + Socket.io setup

const depreciationtwoRoute=require('./routes/depreciationtwo')
app.use('/api',depreciationtwoRoute)



const dashboardroutes=require('./routes/dashboardupload')
app.use('/api',dashboardroutes)


const expencesfinancetwoRoute=require('./routes/expencesfinancetwo')
app.use('/api',expencesfinancetwoRoute)


const otherexpencestwoRoute=require('./routes/otherexpencestwo')
app.use('/api',otherexpencestwoRoute)


const maintenancetwoRoute=require('./routes/maintenancetwo')
app.use('/api',maintenancetwoRoute)


const Certificate=require('./routes/certificates')
app.use('/api',Certificate)
const ApprecinttwoRoute=require('./routes/Appreciantstwo')
app.use('/api',ApprecinttwoRoute)

const feesincometwoRoute=require('./routes/feesincometwo')
app.use('/api',feesincometwoRoute)


const otherincometwoRoute=require('./routes/otherincometwo')
app.use('/api',otherincometwoRoute)


const AssetfoprmtwoRoute=require('./routes/Assetformtwo')
app.use('/api',AssetfoprmtwoRoute)


const expensestotaltwoRoute=require('./routes/expenses-total')
app.use('/api',expensestotaltwoRoute)


const DonationstwoRoute=require('./routes/Donationstwo')
app.use('/api',DonationstwoRoute)



const feecalculationtwotwoRoute=require('./routes/feecalculationtwo')
app.use('/api',feecalculationtwotwoRoute)


// In-memory meeting storage
const meetingData = {};


io.on('connection', (socket) => {
  console.log(`[Socket.IO] User connected: ${socket.id}`);

  socket.on("join-school", ({ schoolCode, username } = {}) => {
    const normalizedSchoolCode = String(schoolCode || "").trim();
    if (!normalizedSchoolCode) {
      return;
    }

    socket.join(notificationRoomName(normalizedSchoolCode));
    socket.data.schoolCode = normalizedSchoolCode;
    socket.data.username = String(username || "").trim();
    console.log(
      `[Socket.IO] ${socket.id} joined school room ${normalizedSchoolCode}${socket.data.username ? ` as ${socket.data.username}` : ""}`
    );
  });

  socket.on('join-meeting', (meetingId) => {
    console.log(`[Socket.IO] User ${socket.id} joined meeting ${meetingId}`);
    socket.join(meetingId);
  });

  socket.on('webrtc-offer', (data) => {
    console.log(`[Socket.IO] webrtc-offer from ${socket.id} for meeting ${data.meetingId}`);
    socket.to(data.meetingId).emit('webrtc-offer', data.offer);
  });

  socket.on('webrtc-answer', (data) => {
    console.log(`[Socket.IO] webrtc-answer from ${socket.id} for meeting ${data.meetingId}`);
    socket.to(data.meetingId).emit('webrtc-answer', data.answer);
  });

  socket.on('ice-candidate', (data) => {
    console.log(`[Socket.IO] ice-candidate from ${socket.id} for meeting ${data.meetingId}`);
    socket.to(data.meetingId).emit('ice-candidate', data.candidate);
  });

  // Group call events
  socket.on('join-room', (roomId) => {
    console.log(`[Socket.IO] User ${socket.id} joined room ${roomId}`);
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', socket.id);
  });

  socket.on('send-call', ({ userToSignal, callerId, signal }) => {
    console.log(`[Socket.IO] User ${callerId} sending call to ${userToSignal}`);
    io.to(userToSignal).emit('receive-call', { callerId, signal });
  });

  socket.on('accept-call', ({ callerId, signal }) => {
    console.log(`[Socket.IO] User ${socket.id} accepted call from ${callerId}`);
    io.to(callerId).emit('call-accepted', { signal, id: socket.id });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] User disconnected: ${socket.id}`);
  });
});
let notes = []; // store notes in memory

app.post('/notes', async (req, res) => {
  try {
    const { noteText } = req.body;
    if (!noteText || noteText.trim() === '') {
      return res.status(400).json({ error: 'Note text is required' });
    }

    const [result] = await pool.query('INSERT INTO notes (noteText) VALUES (?)', [noteText]);
    const [rows] = await pool.query('SELECT * FROM notes WHERE id = ?', [result.insertId]);

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error inserting note:', error);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

// Add this at the top of your file (with other utility functions)
const generateMeetingId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  if (meetingData[result]) {
    console.log(`[Utils] Meeting ID collision detected: ${result}, regenerating...`);
    return generateMeetingId();
  }
  console.log(`[Utils] Generated unique meeting ID: ${result}`);
  return result;
};

// Check if slot is already taken
const isSlotAlreadyTaken = (slotTime) => {
  console.log(`[Utils] Checking if slot ${slotTime} is already taken...`);
  for (const id in meetingData) {
    if (meetingData[id].slotTime === slotTime) {
      console.log(`[Utils] Slot ${slotTime} already taken by meeting ${id}`);
      return true;
    }
  }
  console.log(`[Utils] Slot ${slotTime} is available`);
  return false;
};

// Send confirmation email for slot booking
const sendSlotConfirmationEmail = async (email, meetingId, slotTime) => {
  console.log(`[Email] Sending slot confirmation email to ${email} for meeting ${meetingId} at ${slotTime}`);
  const mailOptions = {
    from: `"Student Counseling" <your.email@gmail.com>`,
    to: email,
    subject: 'Your Meeting Slot Confirmed',
    html: `
      <h3>Your counseling session is scheduled</h3>
      <p>Meeting ID: <b>${meetingId}</b></p>
      <p>Scheduled Time: <b>${slotTime}</b></p>
      <p>Please join on time.</p>
    `,
  };
  await transporter.sendMail(mailOptions);
  console.log(`[Email] Slot confirmation email sent to ${email}`);
};
// API: Create Meeting and Send Email (Updated)
app.post('/create-meeting', async (req, res) => {
  console.log('[API] POST /create-meeting received with body:', req.body);

  const { recipientEmail, counselorName } = req.body;

  // Validate email
  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    console.log('[API] Invalid email address:', recipientEmail);
    return res.status(400).json({
      success: false,
      code: 'INVALID_EMAIL',
      error: 'Please provide a valid email address',
    });
  }

  try {
    const meetingId = generateMeetingId();
    const createdAt = Date.now();
    const expires = createdAt + 30 * 60 * 1000; // expires in 30 minutes

    meetingData[meetingId] = {
      id: meetingId,
      createdAt,
      recipientEmail,
      counselorName: counselorName || 'School Counselor',
      expires,
      slotTime: null,
      status: 'pending',
      attempts: 0,
    };

    const meetingLink = `https://cleezoclass.com//Bizzpulse/meeting/${meetingId}`; // Not /video

    // Log the meeting link to the terminal
    console.log(`[Meeting] Generated link: ${meetingLink}`);

    const mailOptions = {
      from: `"Student Counseling" <your.email@gmail.com>`,
      to: recipientEmail,
      subject: `Invitation: Counseling Session with ${meetingData[meetingId].counselorName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Counseling Session Invitation</h2>
          <p>You've been invited for a session with ${meetingData[meetingId].counselorName}</p>
          <p><strong>Meeting ID:</strong> ${meetingId}</p>
          <p>Click the button below to select your slot and join the meeting:</p>
          <a href="${meetingLink}" style="padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">Select Slot & Join Meeting</a>
          <p style="font-size: 13px; color: #6c757d;">This link expires at ${new Date(expires).toLocaleString()}</p>
        </div>
      `,
      text: `You've been invited for a counseling session with ${meetingData[meetingId].counselorName}.
Meeting ID: ${meetingId}
Select your slot and join the meeting: ${meetingLink}
Expires at: ${new Date(expires).toLocaleString()}`
    };

    await transporter.sendMail(mailOptions);
    meetingData[meetingId].attempts++;

    // Logs after email sent successfully
    console.log(`[API] Invitation email sent for meeting ID ${meetingId} to ${recipientEmail}`);
    console.log('Meeting link sent to email!');

    // Send API response
    res.json({
      success: true,
      meetingId,
      expires,
      meetingLink,
      expiresAt: new Date(expires).toISOString(),
    });
  } catch (err) {
    console.error('[API] Email send error:', err);
    res.status(500).json({
      success: false,
      code: 'EMAIL_FAILED',
      error: 'Failed to send invitation. Please try again later.',
    });
  }
});
app.post('/select-slot', async (req, res) => {
  const { meetingId, slotTime } = req.body;

  console.log('[API] POST /select-slot received with body:', req.body);
  console.log(`[Meeting Info] Meeting ID: ${meetingId}`);

  // Safely get meeting link if meetingData exists
  const meetingLink = meetingData[meetingId]?.link || 'N/A';
  console.log(`[Meeting Info] Meeting Link: ${meetingLink}`);

  // Validate input
  if (!meetingId || !slotTime) {
    console.log('[API] Missing parameters:', { meetingId, slotTime });
    return res.status(400).json({
      success: false,
      code: 'MISSING_PARAMS',
      message: 'Both meetingId and slotTime are required',
    });
  }

  // Validate time format (HH:MM, only :00 or :30 allowed)
  const validTimes = ['00', '30'];
  const [hoursStr, minutesStr] = slotTime.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);

  if (
    isNaN(hours) || isNaN(minutes) ||
    hours < 0 || hours > 23 ||
    !validTimes.includes(minutesStr)
  ) {
    console.log('[API] Invalid time format:', slotTime);
    return res.status(400).json({
      success: false,
      code: 'INVALID_TIME_FORMAT',
      message: 'Invalid time format. Use HH:MM in 30-minute increments.',
    });
  }

  // Check if meeting exists
  const meeting = meetingData[meetingId];
  if (!meeting) {
    console.log(`[API] Meeting not found: ${meetingId}`);
    return res.status(404).json({
      success: false,
      code: 'MEETING_NOT_FOUND',
      message: 'No meeting found with this ID',
    });
  }

  // Check if meeting link expired
  if (Date.now() > meeting.expires) {
    console.log(`[API] Meeting link expired for meetingId ${meetingId}`);
    return res.status(410).json({
      success: false,
      code: 'MEETING_EXPIRED',
      message: 'Meeting link expired. Please request a new one.',
      expiresAt: meeting.expires,
    });
  }

  // Check if slot already taken (assuming this function is defined elsewhere)
  if (isSlotAlreadyTaken(slotTime)) {
    console.log(`[API] Slot ${slotTime} already booked`);
    return res.status(409).json({
      success: false,
      code: 'SLOT_TAKEN',
      message: 'This slot has already been booked. Please select another slot.',
    });
  }

  // Save slot time and status
  meeting.slotTime = slotTime;
  meeting.status = 'confirmed';
  console.log(`[API] Slot ${slotTime} confirmed for meeting ${meetingId}`);

  try {
    // Send confirmation email (assuming this function exists)
    await sendSlotConfirmationEmail(meeting.recipientEmail, meetingId, slotTime);
    res.json({
      success: true,
      message: 'Slot selected and confirmation email sent',
      meetingId,
      slotTime,
    });
  } catch (err) {
    console.error('[API] Error sending slot confirmation email:', err);
    res.status(500).json({
      success: false,
      code: 'EMAIL_FAILED',
      message: 'Failed to send confirmation email.',
    });
  }
});


// Validate a meeting
app.get('/validate-meeting/:meetingId', (req, res) => {
  const { meetingId } = req.params;
  console.log(`[API] Received validation request for meetingId: ${meetingId}`);

  const meeting = meetingData[meetingId];

  if (!meeting) {
    console.warn(`[API] Meeting not found for ID: ${meetingId}`);
    return res.json({
      valid: false,
      code: 'NOT_FOUND',
      message: 'Meeting not found',
    });
  }

  console.log(`[API] Meeting found:`, meeting);

  if (Date.now() > meeting.expires) {
    console.warn(`[API] Meeting expired at: ${meeting.expires}, now: ${Date.now()}`);
    return res.json({
      valid: false,
      code: 'EXPIRED',
      message: 'Meeting link expired',
    });
  }

  console.log(`[API] Meeting is valid`);
  res.json({
    valid: true,
    meetingId,
    slotTime: meeting.slotTime,
    status: meeting.status,
  });
});
app.get('/api/getpaidinstallment/:studentId', async (req, res) => {
  const { studentId } = req.params;
  const { schoolCode } = req.query;

  if (!studentId || !schoolCode) {
    return res.status(400).json({
      message: 'studentId and schoolCode are required'
    });
  }

  let connection;
  try {
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();

    // Fetch only paid amounts and dates if needed
    const [rows] = await connection.execute(
      `SELECT
         Installment1_Paid,
         Installment2_Paid,
         Installment3_Paid,
         Installment4_Paid,
         Installment5_Paid,
         paidDate
       FROM FeesDetails
       WHERE login_id = ?
       LIMIT 1`,
      [studentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: 'No fee record found for this student'
      });
    }

    res.json({
      success: true,
      installments: {
        installment1: rows[0].Installment1_Paid,
        installment2: rows[0].Installment2_Paid,
        installment3: rows[0].Installment3_Paid,
        installment4: rows[0].Installment4_Paid,
        installment5: rows[0].Installment5_Paid
      },
      paidDate: rows[0].paidDate
    });

  } catch (err) {
    console.error('❌ Error fetching paid installments:', err);
    res.status(500).json({
      message: 'Internal server error',
      error: err.message
    });
  } 
});




// ... (rest of your server.js file)
// CORRECTED: Backend Route for /api/pending-activities
app.get('/api/pending-activities', async (req, res) => {
  const { schoolCode } = req.query;

  if (!schoolCode) {
    return res.status(400).json({ error: 'schoolCode is a required parameter' });
  }

  let db;
  try {
    db = await getDatabaseConnection(schoolCode);

    // Query 1: Get the count of pending salaries
    const salarySql = `
        SELECT COUNT(*) as pendingSalaries
        FROM bizpulse_teacher_calculated_salary
        WHERE status = 'pending'
    `;

    // Query 2: Get the count of students with any unpaid fees
    // This correctly calculates total fees due vs. total fees paid.
    const feesSql = `
      SELECT COUNT(DISTINCT StudentName) as unpaidStudents
      FROM FeesDetails
      WHERE
        (
          COALESCE(CompleteFee, 0) + COALESCE(Book_Fees, 0) + COALESCE(Admission_fees, 0) +
          COALESCE(Uniform_fees, 0) + COALESCE(Exam_fees, 0) + COALESCE(Bus_fees, 0) + COALESCE(Others, 0)
        ) > (
          COALESCE(Paid_Amount, 0) + COALESCE(books_paid, 0) + COALESCE(Admission_paid, 0) +
          COALESCE(uniform_paid, 0) + COALESCE(exam_paid, 0) + COALESCE(bus_paid, 0) + COALESCE(others_paid, 0) +
          COALESCE(Discount, 0) + COALESCE(bus_discount, 0) + COALESCE(fee_discount, 0) + COALESCE(tuition_discount, 0)
        )
    `;

    // Execute both queries
    const [[salaryResult], [feesResult]] = await Promise.all([
      db.query(salarySql),
      db.query(feesSql)
    ]);
   
    const pendingSalaries = salaryResult.pendingSalaries;
    const unpaidStudents = feesResult.unpaidStudents;

    res.json({
      pendingSalaries: pendingSalaries,
      joiningLetters: 0,
      terminations: 0,
      transferCertificates: 0,
      pendingHallTickets: unpaidStudents,
      pendingReportCards: unpaidStudents
    });

  } catch (err) {
    console.error("!!! DATABASE ERROR in /api/pending-activities:", err);
    res.status(500).json({
        error: 'Database query failed while fetching pending activities.',
        details: err.message
    });
  } 
});



app.post('/pay-bus-fee', async (req, res) => {
  const { studentName, className, sectionName, schoolCode, busFee, frequency_type } = req.body;

  console.log('[pay-bus-fee] Request received:', req.body);

  // Validate required fields
  if (!studentName || !className || !sectionName || !schoolCode || busFee === undefined || !frequency_type) {
    console.log('[pay-bus-fee] Validation failed: Missing fields');
    return res.status(400).json({ message: 'Missing required fields' });
  }

  let connection;
  try {
    console.log(`[pay-bus-fee] Connecting to database for schoolCode: ${schoolCode}`);
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();

    // Step 1: Get login_id from management_login_creation
    const [studentRows] = await connection.execute(
      `SELECT id AS login_id
       FROM management_login_creation
       WHERE name = ? AND class_name = ? AND section = ? `,
      [studentName, className, sectionName]
    );
    console.log('[pay-bus-fee] Student query result:', studentRows);

    if (studentRows.length === 0) {
      console.log('[pay-bus-fee] No student found for', studentName, className, sectionName);
      return res.status(404).json({ message: 'Student not found' });
    }

    const login_id = studentRows[0].login_id;
    console.log('[pay-bus-fee] Found login_id:', login_id);

    // Step 2: Check if FeesDetails exists for this login_id
    const [existing] = await connection.execute(
      `SELECT id, Bus_fees, frequency_type FROM FeesDetails WHERE login_id = ? LIMIT 1`,
      [login_id]
    );
    console.log('[pay-bus-fee] Existing FeesDetails:', existing);

    const parsedBusFee = parseFloat(busFee);
    let updatedBusFee = parsedBusFee;

    if (existing.length === 0) {
      // Insert new record
      console.log('[pay-bus-fee] No existing FeesDetails found. Inserting new record.');
      const [insertResult] = await connection.execute(
        `INSERT INTO FeesDetails (id, login_id, Bus_fees, frequency_type, created_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [login_id, login_id, updatedBusFee, frequency_type]
      );
      console.log('[pay-bus-fee] Insert result:', insertResult);

      const [checkInsert] = await connection.execute(
        `SELECT id, login_id, Bus_fees, frequency_type FROM FeesDetails WHERE login_id = ?`,
        [login_id]
      );
      console.log('[pay-bus-fee] Row after insert:', checkInsert);

    } else {
      // Update existing record
      updatedBusFee += parseFloat(existing[0].Bus_fees || 0);
      console.log(`[pay-bus-fee] Updating FeesDetails for login_id: ${login_id}`);
      console.log(`[pay-bus-fee] Previous Bus_fees: ${existing[0].Bus_fees}, New Bus_fees: ${updatedBusFee}, frequency_type: ${frequency_type}`);

      const [updateResult] = await connection.execute(
        `UPDATE FeesDetails
         SET Bus_fees = ?, frequency_type = ?, updated_at = CURRENT_TIMESTAMP
         WHERE login_id = ?`,
        [updatedBusFee, frequency_type, login_id]
      );
      console.log('[pay-bus-fee] Update result:', updateResult);

      const [checkUpdate] = await connection.execute(
        `SELECT id, login_id, Bus_fees, frequency_type FROM FeesDetails WHERE login_id = ?`,
        [login_id]
      );
      console.log('[pay-bus-fee] Row after update:', checkUpdate);
    }

    res.json({
      success: true,
      message: 'Bus fee and frequency type inserted/updated successfully',
      Bus_fees: updatedBusFee,
      frequency_type
    });

  } catch (err) {
    console.error('[pay-bus-fee] Unexpected error:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal server error', error: err.message });
    }
  } 
});

app.post('/get-bus-fee', async (req, res) => {
  const { studentName, className, sectionName, schoolCode } = req.body;

  console.log('[get-bus-fee] Request received:', req.body);

  if (!studentName || !className || !sectionName || !schoolCode) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  let connection;

  try {
    const pool = getDatabaseConnection(schoolCode);
    connection = await pool.getConnection();

    console.log("Searching Bus Fee with:");
    console.log("StudentName:", studentName);
    console.log("Class:", className);
    console.log("Section:", sectionName);

    // ✅ GET FINAL BUS FEE FROM MULTIPLE ROWS
    const [feeRows] = await connection.execute(
      `SELECT 
          COALESCE(MAX(Bus_fees),0) AS Bus_fees,
          COALESCE(SUM(bus_paid),0) AS total_bus_paid
       FROM FeesDetails
       WHERE StudentName = ?
         AND class_name = ?
         AND section = ?`,
      [studentName, className, sectionName]
    );

    console.log("Aggregated Bus Result:", feeRows);

    res.json({
      Bus_fees: feeRows[0].Bus_fees,
      total_bus_paid: feeRows[0].total_bus_paid
    });

  } catch (err) {
    console.error('[get-bus-fee] Error:', err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  } finally {
    if (connection) connection.release();
  }
});

app.post('/pay-residential-fee', async (req, res) => {
  const { studentName, className, sectionName, schoolCode, residentialFee } = req.body;

  console.log('[pay-residential-fee] Request received:', req.body);

  if (!studentName || !className || !sectionName || !schoolCode || residentialFee === undefined) {
    console.log('[pay-residential-fee] Validation failed: Missing fields');
    return res.status(400).json({ message: 'Missing required fields' });
  }

  let connection;
  try {
    const pool = getDatabaseConnection(schoolCode);
    connection = await pool.getConnection();

    const [studentRows] = await connection.execute(
      `SELECT id AS login_id
       FROM management_login_creation
       WHERE name = ? AND class_name = ? AND section = ?`,
      [studentName, className, sectionName]
    );

    if (studentRows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const login_id = studentRows[0].login_id;
    const [existing] = await connection.execute(
      `SELECT id, ResidentialCompleteFee FROM FeesDetails WHERE login_id = ? LIMIT 1`,
      [login_id]
    );

    const parsedResidentialFee = parseFloat(residentialFee) || 0;

    if (existing.length === 0) {
      await connection.execute(
        `INSERT INTO FeesDetails (id, login_id, ResidentialCompleteFee, created_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [login_id, login_id, parsedResidentialFee]
      );
    } else {
      await connection.execute(
        `UPDATE FeesDetails
         SET ResidentialCompleteFee = ?, updated_at = CURRENT_TIMESTAMP
         WHERE login_id = ?`,
        [parsedResidentialFee, login_id]
      );
    }

    res.json({
      success: true,
      message: 'Residential fee inserted/updated successfully',
      ResidentialCompleteFee: parsedResidentialFee
    });
  } catch (err) {
    console.error('[pay-residential-fee] Unexpected error:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal server error', error: err.message });
    }
  } finally {
    if (connection) connection.release();
  }
});

app.post('/get-residential-fee', async (req, res) => {
  const { studentName, className, sectionName, schoolCode } = req.body;

  console.log('[get-residential-fee] Request received:', req.body);

  if (!studentName || !className || !sectionName || !schoolCode) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  let connection;
  try {
    const pool = getDatabaseConnection(schoolCode);
    connection = await pool.getConnection();

    const [rows] = await connection.execute(
      `SELECT 
          m.id AS login_id,
          COALESCE(MAX(f.ResidentialCompleteFee), 0) AS ResidentialCompleteFee
       FROM management_login_creation m
       LEFT JOIN FeesDetails f ON f.login_id = m.id
       WHERE m.name = ? AND m.class_name = ? AND m.section = ?
       GROUP BY m.id`,
      [studentName, className, sectionName]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json({
      login_id: rows[0].login_id,
      ResidentialCompleteFee: rows[0].ResidentialCompleteFee
    });
  } catch (err) {
    console.error('[get-residential-fee] Error:', err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  } finally {
    if (connection) connection.release();
  }
});

const billGeneration=require('./routes/BillGeneration')
app.use('/api',billGeneration)
const schoolprofile=require('./routes/schoolprofilebackend')
app.use('/api',schoolprofile)
// API: Validate Meeting
app.get('/validate-meeting/:id', (req, res) => {
  const meeting = meetingData[req.params.id];

  if (!meeting) {
    return res.status(404).json({
      valid: false,
      message: 'Invalid meeting ID'
    });
  }

  if (Date.now() > meeting.expires) {
    return res.status(410).json({
      valid: false,
      message: 'This meeting link has expired',
      code: 'MEETING_EXPIRED'
    });
  }

  res.json({
    valid: true,
    meetingId: meeting.id,
    status: meeting.status,
    slotTime: meeting.slotTime,
    expires: meeting.expires
  });
});
const GetBills=require('./routes/GetBillAll')
app.use('/api',GetBills)
// Serve React build for Bizzpulse project
const buildPath = '/usr/share/nginx/html/BIZZPULSE';
app.use('/BIZZPULSE', express.static(buildPath));

// Handle SPA routing for Bizzpulse
app.get('/BIZZPULSE/*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'), (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('Error loading the application');
    }
  });
});
function formatDateTime(timeString) {
  console.log("➡️ formatDateTime called with:", timeString);

  if (!timeString) {
    console.log("⚠️ No time string provided, returning null");
    return null;
  }

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const dateTimeString = `${today} ${timeString}:00`;   // e.g. "2025-08-23 09:30:00"

  console.log("✅ Formatted datetime:", dateTimeString);
  return dateTimeString;
}


function formatDateTime(timeString) {
  console.log("➡️ formatDateTime called with:", timeString);

  if (!timeString) {
    console.log("⚠️ No time string provided, returning null");
    return null;
  }

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const dateTimeString = `${today} ${timeString}:00`;   // e.g. "2025-08-23 09:30:00"

  console.log("✅ Formatted datetime:", dateTimeString);
  return dateTimeString;
}

app.post(
  '/minutes/upload',
  upload.single('minutesFile'),
  async (req, res) => {

    console.log("📥 Raw req.body after multer:", req.body);
    console.log("📎 Uploaded file:", req.file);

    const { schoolCode, meetingNo } = req.body;

    if (!schoolCode) {
      return res.status(400).json({ error: "schoolCode missing" });
    }

    if (!meetingNo) {
      return res.status(400).json({ error: "meetingNo missing" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    let db;

    try {
      // ✅ CONNECT USING YOUR FUNCTION
      db = await getDatabaseConnection(schoolCode);
      console.log(`✅ Connected to DB: ${schoolCode}`);

      const relativePath = req.file.path.replace('public/', '');

      const [result] = await db.execute(
        `INSERT INTO meeting_minutes (meeting_no, file_path)
         VALUES (?, ?)`,
        [meetingNo, relativePath]
      );

      res.json({
        success: true,
        message: "Minutes uploaded successfully",
        id: result.insertId
      });

    } catch (err) {
      console.error("❌ DB error:", err);
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(500).json({ error: err.message });

    } 
  }
);
app.get('/minutes', async (req, res) => {
  const { schoolCode } = req.query;
  let db;

  if (!schoolCode) {
    return res.status(400).json({ error: "schoolCode missing" });
  }

  try {
    db = await getDatabaseConnection(schoolCode);

    const [rows] = await db.execute(
      `SELECT id, meeting_no, file_path
       FROM meeting_minutes
       ORDER BY id DESC`
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } 
});

// ✅ Route to handle setting login/logout time
app.post("/attendance/set-login-logout-time", async (req, res) => {
  console.log("\n===========================================");
  console.log("📥 Received POST request -> /attendance/set-login-logout-time");
  console.log("Request body:", req.body);

  const { schoolCode, loginTime, logoutTime } = req.body;
  const uploadedDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  console.log("📌 Parsed values:");
  console.log("   School Code:", schoolCode);
  console.log("   Login Time (raw):", loginTime);
  console.log("   Logout Time (raw):", logoutTime);
  console.log("   Uploaded Date (today):", uploadedDate);

  // ✅ Validation
  if (!schoolCode || (!loginTime && !logoutTime)) {
    console.warn("❌ Validation failed: Missing required fields");
    return res.status(400).json({
      message: "Missing required fields: schoolCode, or at least one of loginTime/logoutTime."
    });
  }

  // ✅ Format times
  const loginTimeFormatted = formatDateTime(loginTime);
  const logoutTimeFormatted = formatDateTime(logoutTime);

  console.log("🛠️ After formatting:");
  console.log("   Login Time Formatted:", loginTimeFormatted);
  console.log("   Logout Time Formatted:", logoutTimeFormatted);

  if (!loginTimeFormatted && !logoutTimeFormatted) {
    console.warn("❌ Both login and logout times are invalid or missing after formatting");
    return res.status(400).json({ message: "Both login and logout times are invalid." });
  }

  let connection;
  try {
    console.log("🔌 Attempting to get database connection for school:", schoolCode);
const pool = getDatabaseConnection(schoolCode);
connection = await pool.getConnection();
    console.log("✅ Database connection established");

    console.log("📤 Executing INSERT query...");
    console.log(
      "SQL: INSERT INTO TEACHERS_ATTENDANCE_TIME (LOGIN_TIME, LOGOUT_TIME, UPLOADED_DATE) VALUES (?, ?, ?)"
    );
    console.log("Values:", [loginTimeFormatted, logoutTimeFormatted, uploadedDate]);

    await connection.execute(
      `INSERT INTO TEACHERS_ATTENDANCE_TIME (LOGIN_TIME, LOGOUT_TIME, UPLOADED_DATE) VALUES (?, ?, ?)`,
      [loginTimeFormatted, logoutTimeFormatted, uploadedDate]
    );

    console.log("✅ Data inserted successfully");

    
    console.log("🔒 Database connection closed");

    return res.status(200).json({ message: "Login/Logout time saved successfully" });

  } catch (error) {
    console.error("❌ SQL Error occurred:");
    console.error("   Name:", error.name);
    console.error("   Message:", error.message);

    if (connection) {
      try {
        
        console.log("🔒 Database connection closed after error");
      } catch (closeErr) {
        console.error("⚠️ Failed to close connection after error:", closeErr.message);
      }
    }

    return res.status(500).json({
      message: "Database error",
      error: error.message,
    });
  } finally {
    console.log("===========================================\n");
  }
});

app.get("/attendance/get-login-logout-time", async (req, res) => {
  const { schoolCode } = req.query;

  try {
    const pool = getDatabaseConnection(schoolCode);
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(
        `SELECT LOGIN_TIME, LOGOUT_TIME, UPLOADED_DATE
         FROM TEACHERS_ATTENDANCE_TIME
         ORDER BY UPLOADED_DATE DESC
         LIMIT 1`
      );

      return res.json({
        success: true,
        data: rows[0] || null,
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("❌ Error fetching teacher attendance time:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch teacher attendance time",
      error: err.message,
    });
  }
});

app.post("/attendance/reset-login-logout-time", async (req, res) => {
  const { schoolCode } = req.body;

  if (!schoolCode) {
    return res.status(400).json({ message: "schoolCode is required" });
  }

  try {
    const pool = getDatabaseConnection(schoolCode);
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(
        `SELECT id
         FROM TEACHERS_ATTENDANCE_TIME
         ORDER BY UPLOADED_DATE DESC, id DESC
         LIMIT 1`
      );

      if (!rows.length) {
        return res.json({ success: true, message: "No teacher attendance time to reset" });
      }

      await connection.execute(`DELETE FROM TEACHERS_ATTENDANCE_TIME WHERE id = ?`, [rows[0].id]);

      return res.json({ success: true, message: "Teacher attendance time reset successfully" });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("❌ Error resetting teacher attendance time:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to reset teacher attendance time",
      error: err.message,
    });
  }
});

app.use(errorHandler);


    // This is the only listen call you should have.
    // It starts the server after the database connection is successful.
  httpsServer.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server and WebSocket running securely at https://nova-a.tagsol.in:${port}`);


});
 



async function closeAllPools() {
  const allPools = [qualityPool, ...Object.values(schoolPools)];
  for (const pool of allPools) {
    try {
      await pool.end();
      console.log('DB pool closed successfully');
    } catch (err) {
      console.error('Error closing DB pool:', err);
    }
  }
}

// let isShuttingDown = false;

// async function gracefulShutdown(signal) {
//   if (isShuttingDown) return;
//   isShuttingDown = true;

//   console.log(`${signal} received: shutting down gracefully...`);

//   try {
//     await closeAllPools();
//   } catch (err) {
//     console.error('Error during DB shutdown:', err);
//   }

//   console.log('Shutdown complete. Exiting process.');
//   process.exit(0);
// }

// process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // PM2 stop/restart
// process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // Ctrl+C

// process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // PM2 stop/restart
// process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // Ctrl+C
