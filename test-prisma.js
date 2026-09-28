require("dotenv").config();

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Connecting through Prisma...");

  await prisma.$connect();

  const result = await prisma.$queryRaw`SELECT NOW() AS current_time`;

  console.log("Prisma connection succeeded:", result);
}

main()
  .catch((error) => {
    console.error("Prisma connection failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });