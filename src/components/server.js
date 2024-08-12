import { config } from "dotenv";
import express from "express";
import axios from "axios";
import schedule from "node-schedule";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { decode } from "html-entities";

config();

const app = express();
const port = process.env.PORT || 3000;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SENT_NEWS_FILE = path.join(__dirname, "sentNewsUrls.json");

const MAX_NEWS_COUNT = 600;
const CLEANUP_COUNT = 300;

const readSentNewsUrls = () => {
  if (fs.existsSync(SENT_NEWS_FILE)) {
    return new Set(JSON.parse(fs.readFileSync(SENT_NEWS_FILE, "utf8")));
  }
  return new Set();
};

const saveSentNewsUrls = (urls) => {
  fs.writeFileSync(SENT_NEWS_FILE, JSON.stringify(Array.from(urls)), "utf8");
};

let sentNewsUrls = readSentNewsUrls();
console.log("URLs de noticias enviadas al iniciar:", sentNewsUrls.size);

const decodeHTML = (html) => {
  return decode(html);
};

const getCryptoNews = async () => {
  try {
    const response = await axios.get("https://api.coingecko.com/api/v3/news");
    console.log("Datos de noticias:", response.data.data); // Agrega esto para verificar los datos de noticias
    return response.data.data || [];
  } catch (error) {
    console.error("Error fetching news:", error);
    return [];
  }
};

const getSentNewsFromTelegram = async () => {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`
    );
    const messages = response.data.result || [];

    const today = new Date().toISOString().split("T")[0];
    const urls = messages
      .filter((msg) => msg.message && msg.message.text && msg.message.date)
      .filter(
        (msg) =>
          new Date(msg.message.date * 1000).toISOString().split("T")[0] ===
          today
      )
      .map((msg) => {
        const urlMatch = msg.message.text.match(/https?:\/\/[^\s]+/g);
        return urlMatch ? urlMatch[0] : null;
      })
      .filter((url) => url !== null);

    return urls;
  } catch (error) {
    console.error("Error fetching messages from Telegram:", error);
    return [];
  }
};

const sendToTelegram = async (article) => {
  const message = `
    📰 *${decodeHTML(article.title)}*
    🌐 [Read More](${article.url})
    🗓️ *Date:* ${new Date(article.updated_at * 1000).toLocaleDateString()}
  `;

  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }
    );
    console.log("Mensaje enviado:", response.data);
  } catch (error) {
    console.error(
      "Error enviando el mensaje a Telegram:",
      error.response ? error.response.data : error.message
    );
  }
};

const handleNewNews = async () => {
  const articles = await getCryptoNews();
  const sentUrls = await getSentNewsFromTelegram();

  console.log("Noticias recibidas desde la API:", articles.length);
  console.log("URLs enviadas desde Telegram:", sentUrls.length);

  let newArticlesCount = 0;

  for (const article of articles) {
    console.log("Comparando URL:", article.url);
    if (!sentNewsUrls.has(article.url)) {
      console.log("Enviando noticia nueva con URL:", article.url);
      await sendToTelegram(article);
      sentNewsUrls.add(article.url); // Agregar la URL al conjunto de URLs enviadas
      newArticlesCount++;
    }
  }

  if (sentNewsUrls.size > MAX_NEWS_COUNT) {
    // Limpiar URLs antiguas
    const urlsArray = Array.from(sentNewsUrls);
    sentNewsUrls = new Set(urlsArray.slice(CLEANUP_COUNT));
  }

  saveSentNewsUrls(sentNewsUrls);
  console.log(
    "URLs almacenadas después de enviar noticias:",
    sentNewsUrls.size
  );
  console.log("Número de artículos nuevos enviados:", newArticlesCount);
};

schedule.scheduleJob("*/1 * * * *", () => {
  console.log("Job ejecutado a:", new Date().toISOString());
  console.log("Ejecutando handleNewNews...");
  handleNewNews();
});

app.get("/", (req, res) => {
  res.send("Crypto News Backend is running.");
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
