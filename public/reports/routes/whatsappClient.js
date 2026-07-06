const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const client = new Client({
  authStrategy: new LocalAuth(),
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
  console.log("Scan this QR code:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ WhatsApp Client Ready");
});

client.initialize();

module.exports = client;
