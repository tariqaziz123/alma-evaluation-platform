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

const result = await prisma.submissionArtifact.updateMany({
  where: {
    type: "GITHUB",
    sourceUrl: "https://github.com/example/student-project",
  },
  data: {
    sourceUrl: "https://github.com/octocat/Hello-World",
  },
});

console.log(
  `Updated ${result.count} placeholder GitHub artifacts.`,
);

await prisma.$disconnect();