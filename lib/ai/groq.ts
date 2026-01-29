export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

export function resolveGroqModel(choice: "LLAMA_70B" | "LLAMA_8B") {
  if (choice === "LLAMA_8B") return process.env.GROQ_MODEL_8B!;
  return process.env.GROQ_MODEL_70B!;
}


export function getGroqKey() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY em falta");
  return key;
}
