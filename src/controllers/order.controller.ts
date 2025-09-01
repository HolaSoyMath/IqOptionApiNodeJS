import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/order.service';
import { AppError } from '../errors/custom-errors';
import { asyncHandler } from '../middlewares/async-handler';

export class OrderController {
  static openOrder = asyncHandler(async (req: Request, res: Response) => {
    const ssid = req.headers.authorization?.replace('Bearer ', '');
    if (!ssid) {
      throw new AppError('SSID necessário', 401);
    }

    const order = await OrderService.sendOrderToIQOption({
      ssid,
      ...req.body
    });

    return res.status(201).json({
      success: true,
      message: 'Ordem enviada com sucesso',
      data: order
    });
  });

  // Método de compatibilidade para rota legada
  static testOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // Redireciona para o método principal openOrder
    return OrderController.openOrder(req, res, next);
  });

  static getOrders = asyncHandler(async (req: Request, res: Response) => {
    const result = await OrderService.getOrders(req.query as any);

    return res.json({
      success: true,
      message: 'Ordens recuperadas com sucesso',
      data: result
    });
  });
}