/** Minimal OpenRouter helpers (server-only; the key never reaches the browser). */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

type Content = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
export type ChatMessage = { role: "system" | "user" | "assistant"; content: Content };

function key() {
  const value = process.env.OPENROUTER_API_KEY;
  if (!value) throw new Error("OPENROUTER_API_KEY is not configured");
  return value;
}

async function post(body: Record<string, unknown>, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text) as {
      choices?: Array<{ message?: { content?: string; images?: Array<{ image_url?: { url?: string } }> } }>;
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Chat completion that must return a JSON object. */
export async function chatJson<T>(
  model: string,
  messages: ChatMessage[],
  options: {
    schema?: Record<string, unknown>;
    maxTokens?: number;
    timeoutMs?: number;
    temperature?: number;
    /** OpenRouter `reasoning.effort`; reasoning models otherwise spend the whole token budget thinking. */
    reasoningEffort?: string;
  } = {},
): Promise<T> {
  const result = await post(
    {
      model,
      messages,
      max_completion_tokens: options.maxTokens ?? 1200,
      temperature: options.temperature ?? 0.7,
      ...(options.reasoningEffort ? { reasoning: { effort: options.reasoningEffort } } : {}),
      response_format: options.schema
        ? { type: "json_schema", json_schema: { name: "result", strict: true, schema: options.schema } }
        : { type: "json_object" },
    },
    options.timeoutMs ?? 45_000,
  );
  const content = result.choices?.[0]?.message?.content ?? "";
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Model returned no JSON");
  return JSON.parse(content.slice(start, end + 1)) as T;
}

/** Image generation / editing through an image-output chat model. Returns PNG/JPEG bytes. */
export async function generateImage(
  model: string,
  prompt: string,
  options: { inputImageDataUrl?: string; inputImageDataUrls?: string[]; aspectRatio?: string; timeoutMs?: number } = {},
) {
  const inputs = options.inputImageDataUrls ?? (options.inputImageDataUrl ? [options.inputImageDataUrl] : []);
  const content: Content = inputs.length
    ? [
        ...inputs.map((url) => ({ type: "image_url" as const, image_url: { url } })),
        { type: "text" as const, text: prompt },
      ]
    : prompt;
  const result = await post(
    {
      model,
      modalities: ["image", "text"],
      messages: [{ role: "user", content }],
      image_config: { aspect_ratio: options.aspectRatio ?? "16:9" },
    },
    options.timeoutMs ?? 120_000,
  );
  const url = result.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url?.startsWith("data:")) throw new Error("Image model returned no image");
  const [head, b64] = url.split(",", 2);
  const mime = head.slice(5).split(";")[0] || "image/png";
  return { bytes: Buffer.from(b64, "base64"), mime };
}
