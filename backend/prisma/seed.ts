import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  return;
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
