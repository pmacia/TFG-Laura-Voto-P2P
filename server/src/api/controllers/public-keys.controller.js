import fs from 'fs';
import path from 'path';

export async function publicKeysController(req, res) {
  try {
    // Desde el directorio server/ cuando se arranca con start-country.js
    const keysDir = path.resolve(process.cwd(), '..', 'keys', 'countries');

    if (!fs.existsSync(keysDir)) {
      return res.status(200).json({});
    }

    const countries = {};
    for (const name of fs.readdirSync(keysDir)) {
      const countryPath = path.join(keysDir, name);
      const signingFile = path.join(countryPath, 'public.pem');
      const encFile = path.join(countryPath, 'encryption-public.pem');

      const signing = fs.existsSync(signingFile) ? fs.readFileSync(signingFile, 'utf8') : '';
      const encryption = fs.existsSync(encFile) ? fs.readFileSync(encFile, 'utf8') : '';

      countries[name] = {
        ed25519SigningPublicKey: signing,
        rsaEncryptionPublicKey: encryption,
      };
    }

    res.json(countries);
  } catch (err) {
    console.error('Error reading public keys:', err);
    res.status(500).json({ error: 'could not read public keys' });
  }
}
