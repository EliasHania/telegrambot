import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri); // Eliminadas las opciones deprecated

let dbInstance = null;

export const connectToDatabase = async () => {
  if (dbInstance) {
    return dbInstance; // Usa la conexión existente si ya está conectada
  }

  try {
    await client.connect();
    dbInstance = client.db("telegrambot"); // Nombre de la base de datos que deseas usar
    console.log("Connected to MongoDB");
    return dbInstance;
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    throw error;
  }
};

// Cierra la conexión cuando la función Lambda se detenga
export const closeConnection = async () => {
  if (client.isConnected()) {
    await client.close();
    console.log("MongoDB connection closed");
  }
};
