// src/api/cron.js
import axios from "axios";
import { config } from "dotenv";
import { MongoClient } from "mongodb";
import { decode } from "html-entities";

config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MONGODB_URI = process.env.MONGODB_URI;

const client = new MongoClient(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const dbName = "telegrambot";
const collectionName = "sentNewsUrls";

let db, collection;

const connectToDatabase = async () => {
  try {
    await client.connect();
    db = client.db(dbName);
    collection = db.collection(collectionName);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
};

const decodeHTML = (html) => {
  return decode(html);
};

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
  await connectToDatabase();
  const articles = await getCryptoNews();
  const sentUrls = await getSentNewsFromTelegram();

  let newArticlesCount = 0;

  const existingUrls = new Set(
    (await collection.find().toArray()).map((doc) => doc.url)
  );

  for (const article of articles) {
    if (!existingUrls.has(article.url)) {
      await sendToTelegram(article);
      await collection.insertOne({ url: article.url });
      newArticlesCount++;
    }
  }

  console.log("Número de artículos nuevos enviados:", newArticlesCount);
};

export default async function handler(req, res) {
  console.log("Cron job ejecutado a:", new Date().toISOString());
  await handleNewNews();
  res.status(200).json({ message: "Cron job ejecutado correctamente." });
}
