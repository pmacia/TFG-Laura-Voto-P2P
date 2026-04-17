import dotenv from 'dotenv';

const country = process.argv[2];

if (!country) {
    console.error('Por favor, introduce el código del país');
    process.exit(1);
}

const result = dotenv.config({ path: `./env/.${country}.env` });

if (result.error) {
    console.error(`Error al cargar el archivo .${country}.env:`, result.error);
    process.exit(1);
}

await import('../src/index.js');