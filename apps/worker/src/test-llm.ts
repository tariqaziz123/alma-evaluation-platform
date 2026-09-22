import { MockLLMProvider } from "./services/llm/mock-llm.provider.js";

async function main() {
  const provider = new MockLLMProvider();

  const result = await provider.evaluate(
    "Evaluate the student's functionality.",
  );

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("LLM test failed:", error);
  process.exitCode = 1;
});