import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString,
  }),
});

const rows = await prisma.submissionArtifact.findMany({
  where: {
    type: "GITHUB",
  },
  select: {
    id: true,
    submissionId: true,
    sourceUrl: true,
  },
});

console.log(rows);

await prisma.$disconnect();