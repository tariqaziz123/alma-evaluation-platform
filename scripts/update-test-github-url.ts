import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

await prisma.submissionArtifact.update({
  where: {
    id: "77893933-718d-4257-a54a-8f5ebd523650",
  },
  data: {
    sourceUrl: "https://github.com/octocat/Hello-World",
  },
});

console.log("GitHub URL updated");

await prisma.$disconnect();