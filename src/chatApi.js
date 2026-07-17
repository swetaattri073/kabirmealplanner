// Client-side glue for the chatbot. Talks to the local proxy in
// server/index.js (never directly to OpenAI - same reasoning as
// nutritionApi.js: the key stays server-side).

export async function checkChatHealth() {
  try {
    const res = await fetch("/api/chat/health");
    return await res.json();
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Sends one turn of a conversation (the full message history) and returns
// the raw assistant message from the model, which may be a plain reply
// (`content`) or a request to call a tool (`tool_calls`). Callers handle
// the tool-call round trip themselves - this function just relays one call.
export async function sendChatTurn(messages, { tools } = {}) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, tools }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Chat request failed (${res.status})`);
  }
  const choice = data.choices && data.choices[0];
  if (!choice || !choice.message) {
    throw new Error("Unexpected response from chat proxy.");
  }
  return choice.message;
}
