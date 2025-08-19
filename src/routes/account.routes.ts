import { Router } from "express";
import { AccountController } from "../controllers/account.controller";
import { asyncHandler } from "../middlewares/async-handler";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Balance:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único do balance
 *         type:
 *           type: string
 *           enum: [REAL, PRACTICE, TOURNAMENT]
 *           description: Tipo do balance
 *         currency:
 *           type: string
 *           description: Moeda do balance
 *         amount:
 *           type: number
 *           description: Valor disponível
 *
 *     SwitchRequest:
 *       type: object
 *       required:
 *         - mode
 *       properties:
 *         mode:
 *           type: integer
 *           enum: [1, 2]
 *           description: Modo do balance (1=REAL, 2=PRACTICE)
 */

/**
 * @swagger
 * /api/account/balances:
 *   get:
 *     summary: Obtém todos os balances disponíveis
 *     tags: [Account]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Balances recuperados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     active_balance_id:
 *                       type: integer
 *                       nullable: true
 *                     balances:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Balance'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get("/balances", asyncHandler(AccountController.getBalances));

/**
 * @swagger
 * /api/account/actualbalance:
 *   get:
 *     summary: Obtém o balance ativo atual
 *     tags: [Account]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Balance ativo recuperado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     active:
 *                       $ref: '#/components/schemas/Balance'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get("/actualbalance", asyncHandler(AccountController.getActualBalance));

/**
 * @swagger
 * /api/account/switch:
 *   post:
 *     summary: Troca o balance ativo
 *     tags: [Account]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SwitchRequest'
 *     responses:
 *       200:
 *         description: Balance trocado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     balance_id:
 *                       type: integer
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.post("/switch", asyncHandler(AccountController.switchBalance));

export default router;
