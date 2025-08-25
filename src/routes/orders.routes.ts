import { Router } from 'express';
import { TestOrderController } from '../controllers/testOrder.controller';

const router = Router();

// Endpoint para testar abertura de ordem
router.post('/open', TestOrderController.openOrder);

export default router;