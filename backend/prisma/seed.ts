import { PrismaClient, WorkMode, JobStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.upsert({
    where: { slug: "rolebrief-demo" },
    update: {},
    create: {
      slug: "rolebrief-demo",
      canonicalName: "RoleBrief Demo",
      domain: "rolebrief.local",
      verificationState: "verified"
    }
  });

  await prisma.job.upsert({
    where: { slug: "founding-backend-engineer-rolebrief-demo" },
    update: {},
    create: {
      slug: "founding-backend-engineer-rolebrief-demo",
      canonicalTitle: "Founding Backend Engineer",
      normalizedRole: "backend engineer",
      workMode: WorkMode.REMOTE,
      status: JobStatus.ACTIVE,
      moderationState: "approved",
      companyId: company.id,
      requiredSkills: ["TypeScript", "PostgreSQL", "NestJS"],
      sourceDisclosure: { provider: "seed", note: "Development fixture" }
    }
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
