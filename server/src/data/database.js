import mongoose from "mongoose";

export async function connectToDatabase(uri) {
    try {
        await mongoose.connect(uri);
        console.log("Conectado a la base de datos");
    } catch (error) {
        console.error("Error al conectar a la base de datos:", error);
        process.exit(1);
    }
}

export async function disconnectFromDatabase() {
    try {
        await mongoose.disconnect();
        console.log("Desconectado de la base de datos");
    } catch (error) {
        console.error("Error al desconectar de la base de datos:", error);
        process.exit(1);
    }
}