import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

export const connectToDatabase = async () => {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    return client.db("telegrambot"); // Nombre de la base de datos que deseas usar
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    throw error;
  }
};
