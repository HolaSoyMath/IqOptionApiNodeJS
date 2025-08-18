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
 *     summary: Obter mercados de opções binárias
 *     description: Retorna uma lista agregada de mercados binary-option e turbo-option com informações de payout
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
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           iq_active_id:
 *                             type: number
 *                             description: ID do ativo na IQ Option
 *                           name:
 *                             type: string
 *                             description: Nome amigável do ativo
 *                           type:
 *                             type: string
 *                             enum: ["binary"]
 *                             description: Tipo normalizado
 *                           subtype:
 *                             type: string
 *                             enum: ["binary", "turbo"]
 *                             description: Subtipo do mercado
 *                           payout_percent:
 *                             type: number
 *                             nullable: true
 *                             description: Percentual de payout (ex 85)
 *                           is_open:
 *                             type: boolean
 *                             description: Se o mercado está aberto
 *             example:
 *               success: true
 *               message: "Mercados binários obtidos com sucesso (2 mercados)"
 *               data:
 *                 - iq_active_id: 1
 *                   name: "EURUSD"
 *                   type: "binary"
 *                   subtype: "turbo"
 *                   payout_percent: 87
 *                   is_open: true
 *                 - iq_active_id: 4
 *                   name: "GBPUSD"
 *                   type: "binary"
 *                   subtype: "binary"
 *                   payout_percent: 82
 *                   is_open: true
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