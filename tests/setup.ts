import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Setup global para testes
beforeAll(async () => {
  // Conectar ao banco de dados de teste
  await prisma.$connect();
});

afterAll(async () => {
  // Desconectar do banco de dados após todos os testes
  await prisma.$disconnect();
});

export { prisma };