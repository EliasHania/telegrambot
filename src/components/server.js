import { config } from "dotenv";
import express from "express";
import axios from "axios";
import cron from "node-cron"; // Cambiado de 'node-schedule' a 'node-cron'
import { MongoClient } from "mongodb";
import { decode } from "html-entities";

// Cargar las variables de entorno
config();

const app = express();
const port = process.env.PORT || 3000;

// Configuración de variables de entorno
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MONGODB_URI = process.env.MONGODB_URI;

// Configuración de MongoDB
const client = new MongoClient(MONGODB_URI);
const dbName = "telegrambot";
const collectionName = "sentNewsUrls";

let db, collection;

// Función para conectar a la base de datos
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

// Función para decodificar HTML
const decodeHTML = (html) => {
  return decode(html);
};

// Función para obtener noticias de criptomonedas
const getCryptoNews = async () => {
  try {
    const response = await axios.get("https://api.coingecko.com/api/v3/news");
    console.log("Datos de noticias:", response.data.data);
    return response.data.data || [];
  } catch (error) {
    console.error("Error fetching news:", error);
    return [];
  }
};

// Función para obtener noticias enviadas desde Telegram
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

// Función para enviar noticias a Telegram
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

// Función para manejar las noticias nuevas
const handleNewNews = async () => {
  const articles = await getCryptoNews();
  const sentUrls = await getSentNewsFromTelegram();

  console.log("Noticias recibidas desde la API:", articles.length);
  console.log("URLs enviadas desde Telegram:", sentUrls.length);

  let newArticlesCount = 0;

  // Obtener URLs existentes en MongoDB
  const existingUrls = new Set(
    (await collection.find().toArray()).map((doc) => doc.url)
  );

  for (const article of articles) {
    console.log("Comparando URL:", article.url);
    if (!existingUrls.has(article.url)) {
      console.log("Enviando noticia nueva con URL:", article.url);
      await sendToTelegram(article);

      // Guardar la URL en MongoDB
      await collection.insertOne({ url: article.url });
      newArticlesCount++;
    }
  }

  console.log("Número de artículos nuevos enviados:", newArticlesCount);
};

// Configurar el cron job para ejecutar cada minuto
cron.schedule("*/1 * * * *", () => {
  console.log("Job ejecutado a:", new Date().toISOString());
  console.log("Ejecutando handleNewNews...");
  handleNewNews();
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
