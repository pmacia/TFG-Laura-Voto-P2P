import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_URL = process.env.APP_URL || "http://localhost:4200";

const PROJECT_ROOT = path.resolve(__dirname, "../..");

const voterKeyPath = (country, filename) => {
    return path.resolve(PROJECT_ROOT, "keys", "voters", country, filename);
};

const country = (process.argv[2] || "es").toLowerCase();
const voterCount = Number(process.argv[3] || 5);

if (!Number.isInteger(voterCount) || voterCount <= 0) {
    throw new Error("El número de votantes debe ser un entero positivo");
}

const AVAILABLE_COUNTRIES = ["ES", "FR", "DE", "IT", "PT"];

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray(array) {
    return [...array].sort(() => Math.random() - 0.5);
}

function getRandomVoteFor(voterCountry) {
    const normalizedVoterCountry = voterCountry.toUpperCase();

    // Evita que un país se vote a sí mismo.
    const eligibleCountries = AVAILABLE_COUNTRIES.filter(
        (candidateCountry) => candidateCountry !== normalizedVoterCountry
    );

    // Cada votante vota aleatoriamente entre 1 y 3 países.
    const numberOfVotes = getRandomInt(1, Math.min(3, eligibleCountries.length));

    return shuffleArray(eligibleCountries).slice(0, numberOfVotes);
}

const voters = Array.from({ length: voterCount }, (_, index) => {
    const voterNumber = index + 1;
    const voterId = `${country}-${voterNumber}`;

    return {
        country,
        webUser: `${country.toUpperCase()} Usuario ${voterNumber}`,
        voterId,
        secretCode: "TFG_Pass_Segura6983985()·$=",
        identityPrivateKeyPath: voterKeyPath(
            country,
            `${voterId}_private.pem`
        ),
        voteFor: getRandomVoteFor(country)
    };
});

function assertFileExists(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`No existe el archivo: ${filePath}`);
    }
}

async function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clickIfExists(page, selector, label) {
    const locator = page.locator(selector);
    const count = await locator.count();

    if (count === 0) {
        console.log(`No se encontró ${label}. Se continúa igualmente.`);
        return false;
    }

    await locator.first().click();
    console.log(`Click en ${label}.`);
    return true;
}

async function fillRequired(page, selector, value, label) {
    const locator = page.locator(selector);

    await locator.waitFor({
        state: "visible",
        timeout: 15000
    });

    await locator.fill(value);
    console.log(`Rellenado ${label}.`);
}

async function setFileRequired(page, selector, filePath, label) {
    assertFileExists(filePath);

    const locator = page.locator(selector);

    await locator.waitFor({
        state: "attached",
        timeout: 15000
    });

    await locator.setInputFiles(filePath);
    console.log(`Archivo cargado en ${label}: ${filePath}`);
}

async function clickRequired(page, selector, label) {
    const locator = page.locator(selector);

    await locator.waitFor({
        state: "visible",
        timeout: 15000
    });

    await page.waitForFunction((testId) => {
        const element = document.querySelector(`[data-testid="${testId}"]`);
        return element && !element.disabled;
    }, selector.replace('[data-testid="', "").replace('"]', ""));

    await locator.click();
    console.log(`Click en ${label}.`);
}

async function login(page, voter) {
    await fillRequired(
        page,
        '[data-testid="voter-id-input"]',
        voter.voterId,
        "voterId"
    );

    await fillRequired(
        page,
        '[data-testid="secret-code-input"]',
        voter.secretCode,
        "secretCode"
    );

    await setFileRequired(
        page,
        '[data-testid="identity-private-key-file-input"]',
        voter.identityPrivateKeyPath,
        "clave privada de identidad"
    );

    await clickRequired(
        page,
        '[data-testid="login-button"]',
        "botón de login"
    );

    console.log(`Login enviado para ${voter.voterId}.`);
}

async function castVote(page, voter) {
    console.log(`Preparando voto de ${voter.voterId}: ${voter.voteFor.join(", ")}`);

    // Espera a que esté abierta la pantalla de selección.
    await page.locator('[data-testid^="candidate-checkbox-"]').first().waitFor({
        state: "attached",
        timeout: 20000
    });

    for (const countryCode of voter.voteFor) {
        await checkCandidate(page, countryCode, voter.voterId);
        await wait(250);
    }

    await clickRequired(
        page,
        '[data-testid="prepare-vote-button"]',
        "botón Preparar voto"
    );

    // Espera a que aparezca la pantalla de revisión.
    await page.locator('[data-testid="confirm-vote-button"]').waitFor({
        state: "visible",
        timeout: 15000
    });

    await clickRequired(
        page,
        '[data-testid="confirm-vote-button"]',
        "botón Confirmar voto"
    );

    console.log(`Voto confirmado para ${voter.voterId}.`);
}

async function openVoterSession(voter, index) {
    const userDataDir = path.join(os.tmpdir(), `tfg-voter-${voter.webUser}`);

    console.log("----------------------------------------");
    console.log(`Preparando sesión para ${voter.voterId}`);
    console.log(`Perfil Chromium: ${userDataDir}`);
    console.log(`Clave privada: ${voter.identityPrivateKeyPath}`);

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        viewport: {
            width: 375,
            height: 840
        },
        args: [
            `--window-position=${0 + index * 375},${0}`,
            "--window-size=375,840",

            // Evita avisos del gestor de contraseñas / credenciales.
            "--disable-save-password-bubble",
            "--disable-password-generation",
            "--disable-features=PasswordLeakDetection,AutofillServerCommunication,AutofillEnableAccountWalletStorage",

            // Reduce notificaciones/pantallas molestas en demo.
            "--disable-notifications",
            "--no-default-browser-check",
            "--no-first-run"
        ]
    });

    const page = context.pages()[0] || await context.newPage();

    page.on("console", (message) => {
        console.log(`[${voter.voterId}] ${message.type()}: ${message.text()}`);
    });

    page.on("pageerror", (error) => {
        console.error(`[${voter.voterId}] Error en página:`, error);
    });

    await page.goto(APP_URL, {
        waitUntil: "domcontentloaded"
    });

    await page.goto(APP_URL, {
        waitUntil: "domcontentloaded"
    });

    await login(page, voter);

    // Espera breve para navegación/carga del dashboard.
    await page.waitForTimeout(1500);

    await castVote(page, voter);

    // Si tras confirmar el voto aparece el flujo P2P o un botón de unión, lo pulsamos.
    await page.waitForTimeout(1000);

    await clickIfExists(
        page,
        '[data-testid="join-p2p-button"]',
        "botón de unirse a P2P"
    );

    console.log(`Sesión preparada para ${voter.voterId}.`);

    return {
        context,
        page,
        voter
    };
}

async function checkCandidate(page, countryCode, voterId) {
    const normalizedCountryCode = countryCode.toUpperCase();

    const selector = `[data-testid="candidate-checkbox-${normalizedCountryCode}"]`;
    const checkbox = page.locator(selector);

    await checkbox.waitFor({
        state: "attached",
        timeout: 15000
    });

    const alreadyChecked = await checkbox.isChecked();

    if (alreadyChecked) {
        console.log(`${voterId}: ${normalizedCountryCode} ya estaba seleccionado.`);
        return;
    }

    await checkbox.evaluate((input) => {
        input.checked = true;

        input.dispatchEvent(
            new Event("input", {
                bubbles: true
            })
        );

        input.dispatchEvent(
            new Event("change", {
                bubbles: true
            })
        );
    });

    await page.waitForFunction((selector) => {
        const input = document.querySelector(selector);
        return input && input.checked === true;
    }, selector, {
        timeout: 5000
    });

    console.log(`${voterId} selecciona ${normalizedCountryCode}.`);
}

async function main() {
    console.log("Iniciando demo multiusuario...");
    console.log(`URL de la aplicación: ${APP_URL}`);
    console.log(`Raíz del proyecto: ${PROJECT_ROOT}`);

    for (const voter of voters) {
        assertFileExists(voter.identityPrivateKeyPath);
    }

    const sessions = [];

    for (const [index, voter] of voters.entries()) {
        const session = await openVoterSession(voter, index);
        sessions.push(session);

        await wait(700);
    }

    console.log("----------------------------------------");
    console.log("Todas las sesiones están abiertas, logueadas y con voto confirmado.");
    console.log("Mantén este proceso abierto para no cerrar los navegadores.");

    await new Promise(() => { });
}

main().catch((error) => {
    console.error("Error ejecutando demo multiusuario:");
    console.error(error);
    process.exit(1);
});