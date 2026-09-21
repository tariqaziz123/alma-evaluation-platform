
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
  // 1. Create or reuse a test student
  const student = await prisma.user.upsert({
    where: {
      email: "tariq.test.student@example.com",
    },
    update: {},
    create: {
      id: randomUUID(),
      email: "tariq.test.student@example.com",
      name: "Test Student",
      role: "STUDENT",
    },
  });

  // 2. Create a course
  const course = await prisma.course.create({
    data: {
      id: randomUUID(),
      name: `Frontend Engineering ${Date.now()}`,
      description: "Test course for the evaluation platform",
    },
  });

  // 3. Add the student to the course
  await prisma.courseMember.create({
    data: {
      id: randomUUID(),
      courseId: course.id,
      userId: student.id,
    },
  });

  // 4. Create an assignment
  const assignment = await prisma.assignment.create({
    data: {
      id: randomUUID(),
      courseId: course.id,
      title: `React Project Evaluation ${Date.now()}`,
      description: "Test assignment for API development",
    },
  });

  // 5. Create a rubric
  const rubric = await prisma.rubric.create({
    data: {
      id: randomUUID(),
      assignmentId: assignment.id,
      name: "Default Project Rubric",
      version: 1,
    },
  });

  // 6. Create rubric criteria
  const criteria = [
    {
      name: "Functionality",
      description: "How well the project meets its functional requirements",
      weight: 25,
      maxScore: 25,
    },
    {
      name: "Code Quality",
      description: "Readability, maintainability, and code organization",
      weight: 20,
      maxScore: 20,
    },
    {
      name: "Architecture",
      description: "Structure, scalability, and technical decisions",
      weight: 20,
      maxScore: 20,
    },
    {
      name: "Problem Solving",
      description: "Quality of implementation and handling of challenges",
      weight: 15,
      maxScore: 15,
    },
    {
      name: "Documentation",
      description: "Clarity and completeness of documentation",
      weight: 10,
      maxScore: 10,
    },
    {
      name: "Innovation",
      description: "Creative features and effective AI usage",
      weight: 10,
      maxScore: 10,
    },
  ];

  await prisma.rubricCriterion.createMany({
    data: criteria.map((criterion) => ({
      id: randomUUID(),
      rubricId: rubric.id,
      name: criterion.name,
      description: criterion.description,
      weight: criterion.weight,
      maxScore: criterion.maxScore,
    })),
  });

  console.log("\nTest data created successfully:\n");

  console.log({
    studentId: student.id,
    studentEmail: student.email,
    courseId: course.id,
    assignmentId: assignment.id,
    rubricId: rubric.id,
  });

  console.log("\nUse these values to test the submission API.");
}

main()
  .catch((error) => {
    console.error("Failed to seed test data:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });