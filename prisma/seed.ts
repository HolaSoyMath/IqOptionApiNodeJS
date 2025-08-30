import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.config.upsert({
    where: { id: 1 },
    update: {
      defaultEntryValue: 5.0,
      stopLoss: 100,
      stopGain: 10,
      stopLossEnabled: false,
      stopGainEnabled: false,
    },
    create: {
      id: 1,
      defaultEntryValue: 5.0,
      stopLoss: 100,
      stopGain: 10,
      stopLossEnabled: false,
      stopGainEnabled: false,
    },
  });

  await prisma.strategy.upsert({
    where: { name: "MA Crossover 2" },
    update: {},
    create: {
      id: 1,
      name: "MA Crossover 2",
      description:
        "Estratégia baseada no cruzamento de 2 médias móveis (5 e 20 períodos)",
      isActive: "inactive",
    },
  });

  await prisma.strategy.upsert({
    where: { name: "MA Crossover 3" },
    update: {},
    create: {
      id: 2,
      name: "MA Crossover 3",
      description:
        "Estratégia baseada no cruzamento de 3 médias móveis (5, 20 e 50 períodos)",
      isActive: "inactive",
    },
  });

  console.log("Seed executado com sucesso!");
  console.log("- Configuração padrão criada/atualizada");
  console.log("- Estratégias MA Crossover 2 e 3 criadas");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
