import { config } from "dotenv";
import express from "express";
import axios from "axios";
import cron from "node-cron";
import { MongoClient } from "mongodb";
import { decode } from "html-entities";

// Cargar las variables de entorno
config();

const app = express();
const port = process.env.PORT || 3000;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MONGODB_URI = process.env.MONGODB_URI;

const client = new MongoClient(MONGODB_URI);
const dbName = "telegrambot";
const collectionName = "sentNewsUrls";

let db, collection;

const connectToDatabase = async () => {
  try {
    await client.connect();
    db = client.db(dbName);
    collection = db.collection(collectionName);
    console.log("Connected to MongoDB.");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
};

const decodeHTML = (html) => decode(html);

const getCryptoNews = async () => {
  try {
    const response = await axios.get("https://api.coingecko.com/api/v3/news");
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
  try {
    const articles = await getCryptoNews();
    const sentUrls = await getSentNewsFromTelegram();

    const existingUrls = new Set(
      (await collection.find().toArray()).map((doc) => doc.url)
    );

    const newArticles = articles.filter(
      (article) => !existingUrls.has(article.url)
    );

    // Solo guarda nuevos artículos
    for (const article of newArticles) {
      await sendToTelegram(article);
      await collection.insertOne({ url: article.url, date: new Date() });
    }

    console.log("Número de artículos nuevos enviados:", newArticles.length);
  } catch (error) {
    console.error("Error handling news:", error);
  }
};

// Eliminar noticias antiguas
const deleteOldNews = async () => {
  try {
    const now = new Date();
    const threeDaysAgo = new Date(now.setDate(now.getDate() - 3));

    const result = await collection.deleteMany({
      date: { $lt: threeDaysAgo },
    });

    console.log(`Deleted ${result.deletedCount} old news articles.`);
  } catch (error) {
    console.error("Error deleting old news:", error);
  }
};

// Configurar el cron job para ejecutar cada minuto
cron.schedule("*/1 * * * *", async () => {
  console.log("Cron job executed at:", new Date().toISOString());

  // Primero, eliminar noticias antiguas
  await deleteOldNews();

  // Luego, manejar nuevas noticias
  await handleNewNews();
});

// Ruta para ejecutar el cron job manualmente
app.get("/test-cron", async (req, res) => {
  try {
    await deleteOldNews();
    await handleNewNews();
    res.status(200).send("Cron job executed successfully.");
  } catch (error) {
    console.error("Error executing cron job:", error);
    res.status(500).send("Error executing cron job.");
  }
});

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("Crypto News Backend is running.");
});

// Iniciar el servidor y conectar a la base de datos
app.listen(port, async () => {
  await connectToDatabase();
  console.log(`Server is running on http://localhost:${port}`);
});
