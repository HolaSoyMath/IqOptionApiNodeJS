import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { UserModel } from '../models/user.model';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const userModel = new UserModel(prisma);
const authService = new AuthService(userModel);
const authController = new AuthController(authService);

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Fazer login na IQ Option
 *     description: Autentica o usuário e retorna o token SSID para uso nas outras APIs
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           example:
 *             email: "usuario@exemplo.com"
 *             password: "senha123"
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *             example:
 *               success: true
 *               message: "Login realizado com sucesso"
 *               data:
 *                 ssid: "1234567890abcdef"
 *                 user_id: 12345
 *                 balance: 1000.50
 *                 currency: "USD"
 *               timestamp: "2024-01-15T10:30:00.000Z"
 *       202:
 *         description: Autenticação de dois fatores necessária
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Autenticação de dois fatores necessária"
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: "temp_token_123"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Dados de entrada inválidos
 *       401:
 *         description: Credenciais inválidas
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', (req, res) => authController.login(req, res));

/**
 * @swagger
 * /api/logout:
 *   post:
 *     summary: Fazer logout
 *     description: Invalida o token SSID atual
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logout realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               success: true
 *               message: "Logout realizado com sucesso"
 *               timestamp: "2024-01-15T10:30:00.000Z"
 *       401:
 *         description: Token não fornecido ou inválido
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/logout', (req, res) => authController.logout(req, res));

export default router;