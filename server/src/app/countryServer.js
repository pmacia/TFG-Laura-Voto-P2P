import { createExpressApp } from "./createExpressApp.js";
import { connectToDatabase } from "../data/database.js";

export async function countryServer() {
    const app = createExpressApp();

    const hostname = process.env.HOSTNAME;
    const port = process.env.PORT;
    const countryName = process.env.COUNTRY_NAME;
    const countryCode = process.env.COUNTRY_CODE;
    const dataBaseUri = process.env.DATABASE_URI;

    await connectToDatabase(dataBaseUri);

    app.listen(port, hostname, () => {
        console.log(
            `Servidor ${countryName} (${countryCode}) escuchando en http://${hostname}:${port}/`
        );
    });
}
