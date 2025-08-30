import { Router } from 'express';
import { StrategyController } from '../controllers/strategy.controller';
import { asyncHandler } from '../middlewares/async-handler';
import { validateBody } from '../middlewares/validation';
import { updateStrategySchema } from '../dto/strategy.dto';

const router = Router();

/**
 * @swagger
 * /api/strategies:
 *   get:
 *     summary: Recuperar todas as estratégias
 *     description: |
 *       Retorna todas as estratégias cadastradas com um resumo contendo
 *       contadores de estratégias ativas, inativas, lucrativas e com prejuízo.
 *     tags: [Estratégias]
 *     responses:
 *       200:
 *         description: Estratégias recuperadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Estratégias recuperadas com sucesso"
 *                 data:
 *                   type: object
 *                   properties:
 *                     strategies:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Strategy'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         active:
 *                           type: number
 *                         inactive:
 *                           type: number
 *                         profitable:
 *                           type: number
 *                         losing:
 *                           type: number
 */
router.get('/', asyncHandler(StrategyController.getAll));

/**
 * @swagger
 * /api/strategies/{id}:
 *   put:
 *     summary: Atualizar configurações de uma estratégia
 *     description: |
 *       Atualiza as configurações de uma estratégia específica.
 *       Quando uma estratégia é ativada, valores padrão são aplicados automaticamente
 *       a partir das configurações do sistema.
 *     tags: [Estratégias]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da estratégia
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateStrategyDto'
 *     responses:
 *       200:
 *         description: Estratégia atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Estratégia atualizada com sucesso"
 *                 data:
 *                   $ref: '#/components/schemas/Strategy'
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Estratégia não encontrada
 */
router.put('/:id', validateBody(updateStrategySchema), asyncHandler(StrategyController.update));

export { router as strategyRoutes };