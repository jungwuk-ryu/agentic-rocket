const MAX_TOOL_OUTPUT_CHARS = 12_000;

export class OpenAICompatibleClient {
  constructor({ baseUrl, apiKey, model }) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.model = model;
  }

  async complete(messages, tools = [], signal) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        reasoning_effort: "high",
        temperature: 0.1,
        messages,
        tools,
        tool_choice: tools.length ? "auto" : "none",
      }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(120_000)])
        : AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`Model request failed (${response.status}): ${detail}`);
    }
    const payload = await response.json();
    const message = payload.choices?.[0]?.message;
    if (!message) throw new Error("Model response did not contain a message.");
    return message;
  }
}

export function boundedToolResult(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > MAX_TOOL_OUTPUT_CHARS
    ? `${text.slice(0, MAX_TOOL_OUTPUT_CHARS)}\n…truncated (${text.length - MAX_TOOL_OUTPUT_CHARS} chars omitted)`
    : text;
}
