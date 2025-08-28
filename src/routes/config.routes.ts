import { Router } from 'express';
import { ConfigController } from '../controllers/config.controller';
import { asyncHandler } from '../middlewares/async-handler';

const router = Router();

// GET /api/config - Recuperar configurações
router.get('/', asyncHandler(ConfigController.getConfig));

// POST /api/config - Atualizar configurações
router.post('/', asyncHandler(ConfigController.updateConfig));

export { router as configRoutes };