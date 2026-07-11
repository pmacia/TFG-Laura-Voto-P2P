import { Router } from 'express';
import { publicKeysController } from '../controllers/public-keys.controller.js';

const router = Router();

router.get('/', publicKeysController);

export { router as publicKeysRouter };