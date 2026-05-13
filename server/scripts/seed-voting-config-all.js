import { spawnSync } from "child_process";

const countries = ["es", "fr", "de", "pt", "it"];

for (const country of countries) {
    spawnSync(
        process.execPath,
        ["scripts/seed-voting-config.js", country],
        {
            stdio: "inherit",
            shell: false
        }
    );

    console.log("Configuración lista en todos los países");
}