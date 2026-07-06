const { Client, LocalAuth } = require("whatsapp-web.js");

const sessions = {};

function createSession(schoolCode, onQR) {

  if (sessions[schoolCode]) {
    return sessions[schoolCode];
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: schoolCode
    }),

    puppeteer: {
      executablePath: "/usr/bin/chromium-browser",
      headless: true,
      args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu"
  ]
    }
  });

  client.on("qr", (qr) => {
    console.log(`QR for ${schoolCode}`);
    if (onQR) onQR(qr);
  });

  client.on("ready", () => {
    console.log(`WhatsApp Ready for ${schoolCode}`);
  });

  client.on("disconnected", () => {
    console.log(`WhatsApp disconnected for ${schoolCode}`);
  });

  client.initialize();

  sessions[schoolCode] = client;

  return client;
}

module.exports = { createSession };