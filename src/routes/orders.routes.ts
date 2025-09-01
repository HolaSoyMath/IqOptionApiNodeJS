import { Router } from "express";
import { LegacyOrderHelper } from "../helpers/legacyOrderHelper";

const router = Router();

// Endpoint para testar abertura de ordem
router.post("/open", LegacyOrderHelper.openOrder);

export default router;
