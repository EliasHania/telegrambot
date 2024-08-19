import axios from "axios";
import { config } from "dotenv";
import { MongoClient } from "mongodb";
import { decode } from "html-entities";
import cron from "node-cron";

// Cargar variables de entorno
config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MONGODB_URI = process.env.MONGODB_URI;

const client = new MongoClient(MONGODB_URI);
const dbName = "telegrambot";
const collectionName = "sentNewsUrls";

let db, collection;

// Conectar a la base de datos y mantener la conexión abierta
const connectToDatabase = async () => {
  if (db && collection) {
    return; // Conexión ya establecida
  }

  try {
    await client.connect();
    db = client.db(dbName);
    collection = db.collection(collectionName);
    console.log("Connected to MongoDB.");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
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
    await connectToDatabase(); // Asegúrate de conectar a la base de datos

    const articles = await getCryptoNews();
    const sentUrls = await getSentNewsFromTelegram();

    const existingUrls = new Set(
      (await collection.find().toArray()).map((doc) => doc.url)
    );

    const newArticles = articles.filter(
      (article) => !existingUrls.has(article.url)
    );

    for (const article of newArticles) {
      await sendToTelegram(article);
      await collection.insertOne({ url: article.url, date: new Date() });
    }

    console.log("Número de artículos nuevos enviados:", newArticles.length);
  } catch (error) {
    console.error("Error handling news:", error);
  }
};

const deleteOldNews = async () => {
  try {
    await connectToDatabase(); // Asegúrate de conectar a la base de datos

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

  try {
    // Primero, eliminar noticias antiguas
    await deleteOldNews();

    // Luego, manejar nuevas noticias
    await handleNewNews();
  } catch (error) {
    console.error("Error in cron job:", error);
  }
});
