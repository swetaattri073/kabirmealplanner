// Pure OpenAI-calling logic, separate from server/index.js's HTTP wiring so
// it's testable without booting a real listener or hitting the network.

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

// NOTE: don't read process.env at module load time here - server/index.js
// loads the project's .env file at its own startup, and ES module imports
// are evaluated before any of that importing file's other top-level code
// runs. Reading env vars lazily, inside the function, is what makes sure
// a key/model set in .env is actually picked up.
export async function callOpenAIChat({ apiKey, messages, tools, model }) {
  if (!apiKey) {
    const err = new Error("OPENAI_API_KEY is not set. Add it to your .env file at the project root to enable the chatbot.");
    err.code = "NO_API_KEY";
    throw err;
  }
  if (!Array.isArray(messages) || !messages.length) {
    const err = new Error("Missing messages array.");
    err.code = "BAD_REQUEST";
    throw err;
  }

  const res = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      messages,
      ...(tools && tools.length ? { tools, tool_choice: "auto" } : {}),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `OpenAI API error (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}
