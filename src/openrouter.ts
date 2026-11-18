import { z } from "zod";

const BASE_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

export type ModelInfo = {
  id: string;
  listedAt: string;
  acceptsImages: boolean;
  supportsTemperature: boolean;
  usdPerToken: { input: number; output: number };
};

export type ChatOutput = {
  content: string;
  costUsd: number;
};

// 401 and 402 are problems with our key or credits, so the whole run stops.
// 403 and 404 mean this model is gated or gone, so the model is recorded as unavailable.
export class OpenRouterError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`OpenRouter ${status}: ${body.slice(0, 300)}`);
  }

  get isFatal() {
    return this.status === 401 || this.status === 402;
  }

  get isUnavailable() {
    return this.status === 403 || this.status === 404;
  }
}

const catalogSchema = z.object({ data: z.array(z.looseObject({ id: z.string() })) });

const modelSchema = z.object({
  id: z.string(),
  created: z.number(),
  architecture: z.object({ input_modalities: z.array(z.string()) }),
  pricing: z.object({ prompt: z.coerce.number(), completion: z.coerce.number() }),
  supported_parameters: z.array(z.string()).nullish(),
});

export async function getModelInfo(id: string): Promise<ModelInfo | null> {
  const res = await fetch(`${BASE_URL}/models`);
  if (!res.ok) throw new OpenRouterError(res.status, await res.text());
  const entry = catalogSchema.parse(await res.json()).data.find((m) => m.id === id);
  if (!entry) return null;
  const model = modelSchema.parse(entry);
  return {
    id: model.id,
    listedAt: new Date(model.created * 1000).toISOString(),
    acceptsImages: model.architecture.input_modalities.includes("image"),
    supportsTemperature: model.supported_parameters?.includes("temperature") ?? false,
    usdPerToken: { input: model.pricing.prompt, output: model.pricing.completion },
  };
}

const chatSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullable() }) }))
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      cost: z.number().optional(),
    })
    .optional(),
});

export type ChatRequest = {
  model: ModelInfo;
  text: string;
  temperature: number | null;
  maxTokens: number;
};

const RETRY_DELAYS_MS = [2_000, 8_000, 30_000];

export async function chat(req: ChatRequest): Promise<ChatOutput> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await chatOnce(req);
    } catch (error) {
      const retryable = !(error instanceof OpenRouterError) || error.status === 429 || error.status >= 500;
      const delay = RETRY_DELAYS_MS[attempt];
      if (!retryable || delay === undefined) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function chatOnce({ model, text, temperature, maxTokens }: ChatRequest): Promise<ChatOutput> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new OpenRouterError(401, "OPENROUTER_API_KEY is not set. Add it to .env.");
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model.id,
      messages: [{ role: "user", content: text }],
      max_tokens: maxTokens,
      ...(temperature === null ? {} : { temperature }),
      usage: { include: true },
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new OpenRouterError(res.status, body);
  const parsed = chatSchema.safeParse(JSON.parse(body));
  if (!parsed.success) throw new OpenRouterError(502, `Unexpected response: ${body}`);
  const { choices, usage } = parsed.data;
  const content = choices[0]?.message.content ?? "";
  const costUsd =
    usage?.cost ??
    (usage ? usage.prompt_tokens * model.usdPerToken.input + usage.completion_tokens * model.usdPerToken.output : 0);
  return { content, costUsd };
}
