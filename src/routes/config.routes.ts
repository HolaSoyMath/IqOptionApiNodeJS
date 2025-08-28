import { Router } from 'express';
import { ConfigController } from '../controllers/config.controller';
import { asyncHandler } from '../middlewares/async-handler';

const router = Router();

/**
 * @swagger
 * /api/config:
 *   get:
 *     summary: Recuperar configurações do sistema
 *     description: |
 *       Retorna as configurações atuais do sistema. Se não existir configuração,
 *       uma configuração padrão será criada automaticamente.
 *     tags: [Configurações]
 *     responses:
 *       200:
 *         description: Configurações recuperadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConfigResponse'
 *             examples:
 *               configuracao_padrao:
 *                 summary: Configuração padrão
 *                 value:
 *                   success: true
 *                   message: "Configurações recuperadas com sucesso"
 *                   data:
 *                     autoConnect: false
 *                     defaultEntryValue: 5.0
 *                     maxOperationsPerDay: 50
 *                     stopLoss: 0
 *                     stopGain: 0
 *                     stopLossEnabled: false
 *                     stopGainEnabled: false
 *                     notifications:
 *                       win: true
 *                       loss: true
 *                       auto: true
 *                       sound: true
 *                   timestamp: "2024-01-15T10:30:00.000Z"
 *               configuracao_personalizada:
 *                 summary: Configuração personalizada
 *                 value:
 *                   success: true
 *                   message: "Configurações recuperadas com sucesso"
 *                   data:
 *                     autoConnect: true
 *                     defaultEntryValue: 15.0
 *                     maxOperationsPerDay: 100
 *                     stopLoss: 50
 *                     stopGain: 100
 *                     stopLossEnabled: true
 *                     stopGainEnabled: true
 *                     notifications:
 *                       win: true
 *                       loss: false
 *                       auto: true
 *                       sound: false
 *                   timestamp: "2024-01-15T10:30:00.000Z"
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "Erro ao recuperar configurações"
 *               timestamp: "2024-01-15T10:30:00.000Z"
 */
router.get('/', asyncHandler(ConfigController.getConfig));

/**
 * @swagger
 * /api/config:
 *   post:
 *     summary: Atualizar configurações do sistema
 *     description: |
 *       Atualiza as configurações do sistema com os valores fornecidos.
 *       Apenas os campos enviados serão atualizados, os demais permanecerão inalterados.
 *       
 *       **Validações aplicadas:**
 *       - `defaultEntryValue`: deve ser um número >= 1
 *       - `maxOperationsPerDay`: deve ser um inteiro positivo
 *       - `stopLoss` e `stopGain`: devem ser números não negativos
 *       - `stopLossEnabled` e `stopGainEnabled`: devem ser booleanos
 *       - `autoConnect`: deve ser booleano
 *       - `notifications`: deve ser um objeto com propriedades booleanas
 *     tags: [Configurações]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ConfigData'
 *           examples:
 *             atualizacao_basica:
 *               summary: Atualização básica
 *               value:
 *                 autoConnect: true
 *                 defaultEntryValue: 10.0
 *                 maxOperationsPerDay: 75
 *             atualizacao_completa:
 *               summary: Atualização completa
 *               value:
 *                 autoConnect: true
 *                 defaultEntryValue: 15.0
 *                 maxOperationsPerDay: 100
 *                 stopLoss: 50
 *                 stopGain: 100
 *                 stopLossEnabled: true
 *                 stopGainEnabled: true
 *                 notifications:
 *                   win: true
 *                   loss: false
 *                   auto: true
 *                   sound: false
 *             apenas_notificacoes:
 *               summary: Apenas notificações
 *               value:
 *                 notifications:
 *                   win: false
 *                   loss: true
 *                   auto: false
 *                   sound: true
 *     responses:
 *       200:
 *         description: Configurações atualizadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConfigResponse'
 *             example:
 *               success: true
 *               message: "Configurações atualizadas com sucesso"
 *               data:
 *                 autoConnect: true
 *                 defaultEntryValue: 15.0
 *                 maxOperationsPerDay: 100
 *                 stopLoss: 50
 *                 stopGain: 100
 *                 stopLossEnabled: true
 *                 stopGainEnabled: true
 *                 notifications:
 *                   win: true
 *                   loss: false
 *                   auto: true
 *                   sound: false
 *               timestamp: "2024-01-15T10:30:00.000Z"
 *       400:
 *         description: Dados de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               defaultEntryValue_invalido:
 *                 summary: defaultEntryValue inválido
 *                 value:
 *                   success: false
 *                   message: "defaultEntryValue deve ser no mínimo 1"
 *                   timestamp: "2024-01-15T10:30:00.000Z"
 *               maxOperationsPerDay_invalido:
 *                 summary: maxOperationsPerDay inválido
 *                 value:
 *                   success: false
 *                   message: "maxOperationsPerDay deve ser um inteiro positivo"
 *                   timestamp: "2024-01-15T10:30:00.000Z"
 *               stopLoss_invalido:
 *                 summary: stopLoss inválido
 *                 value:
 *                   success: false
 *                   message: "stopLoss deve ser um número não negativo"
 *                   timestamp: "2024-01-15T10:30:00.000Z"
 *               notifications_invalidas:
 *                 summary: notifications inválidas
 *                 value:
 *                   success: false
 *                   message: "notifications deve ser um objeto com propriedades booleanas"
 *                   timestamp: "2024-01-15T10:30:00.000Z"
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "Erro interno do servidor"
 *               timestamp: "2024-01-15T10:30:00.000Z"
 */
router.post('/', asyncHandler(ConfigController.updateConfig));

export { router as configRoutes };