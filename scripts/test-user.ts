import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      email: `test-${Date.now()}@example.com`,
      name: "Test Student",
      role: "STUDENT",
    },
  });

  console.log("Created user:");
  console.log({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
}

main()
  .catch((error) => {
    console.error("Failed to create user:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });