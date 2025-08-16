import { Router } from 'express';
import { MarketController } from '../controllers/market.controller';

const router = Router();

/**
 * @swagger
 * /api/markets:
 *   get:
 *     summary: Obter todos os mercados disponíveis
 *     description: Retorna uma lista de todos os mercados disponíveis na IQ Option
 *     tags: [Markets]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de mercados obtida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         markets:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Market'
 *             example:
 *               success: true
 *               message: "Mercados obtidos com sucesso"
 *               data:
 *                 markets:
 *                   - id: 1
 *                     name: "EURUSD"
 *                     enabled: true
 *                     is_suspended: false
 *                     type: "forex"
 *                     profit_commission: 85
 *                     is_open: true
 *               timestamp: "2024-01-15T10:30:00.000Z"
 *       401:
 *         description: Token não fornecido ou inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', MarketController.getAllMarkets);

/**
 * @swagger
 * /api/markets/binary:
 *   get:
 *     summary: Obter mercados binários
 *     description: Retorna uma lista de mercados disponíveis para opções binárias
 *     tags: [Markets]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Mercados binários obtidos com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         binary:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/BinaryMarket'
 *                         turbo:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/BinaryMarket'
 *             example:
 *               success: true
 *               message: "Mercados binários obtidos com sucesso"
 *               data:
 *                 binary:
 *                   - id: 1
 *                     name: "EURUSD"
 *                     enabled: true
 *                     is_suspended: false
 *                     type: "binary"
 *                     profit_commission: 85
 *                     is_open: true
 *                 turbo:
 *                   - id: 2
 *                     name: "GBPUSD"
 *                     enabled: true
 *                     is_suspended: false
 *                     type: "turbo"
 *                     profit_commission: 82
 *                     is_open: true
 *               timestamp: "2024-01-15T10:30:00.000Z"
 *       401:
 *         description: Token não fornecido ou inválido
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/binary', MarketController.getBinaryMarkets);

/**
 * @swagger
 * /api/markets/check/{pair}:
 *   get:
 *     summary: Verificar disponibilidade de um par
 *     description: Verifica se um par específico está disponível para negociação
 *     tags: [Markets]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pair
 *         required: true
 *         description: O par de moedas para verificar (ex EURUSD)
 *         schema:
 *           type: string
 *           example: EURUSD
 *     responses:
 *       200:
 *         description: Informações do par obtidas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         pair:
 *                           $ref: '#/components/schemas/Market'
 *                         available:
 *                           type: boolean
 *             example:
 *               success: true
 *               message: "Par verificado com sucesso"
 *               data:
 *                 pair:
 *                   id: 1
 *                   name: "EURUSD"
 *                   enabled: true
 *                   is_suspended: false
 *                   type: "forex"
 *                   profit_commission: 85
 *                   is_open: true
 *                 available: true
 *               timestamp: "2024-01-15T10:30:00.000Z"
 *       401:
 *         description: Token não fornecido ou inválido
 *       404:
 *         description: Par não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/check/:pair', MarketController.checkPairAvailability);

export default router;