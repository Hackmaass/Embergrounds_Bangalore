import Anthropic from "@anthropic-ai/sdk";

export interface LlmCompleteInput {
  system?: string;
  prompt: string;
  maxTokens?: number;
}

export interface LlmCompleteOutput {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LlmClient {
  complete(input: LlmCompleteInput): Promise<LlmCompleteOutput>;
}

/** claude-haiku-4-5 — fast intent routing & inbound message classification (AGENTS.md §3.3). */
export const ROUTING_MODEL = "claude-haiku-4-5";
/** claude-sonnet-5 — agent reasoning, message drafting, Studio compiler (AGENTS.md §3.3). */
export const REASONING_MODEL = "claude-sonnet-5";
/** Local Ollama model — verified to fit an 8GB-VRAM laptop GPU (RTX 5050:
 * ~4.8GB resident at num_ctx=4096, ~53 tok/s warm). See OllamaLlmClient. */
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:7b-instruct";

class AnthropicLlmClient implements LlmClient {
  constructor(
    private readonly client: Anthropic,
    private readonly model: string,
  ) {}

  async complete(input: LlmCompleteInput): Promise<LlmCompleteOutput> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: input.maxTokens ?? 1024,
      ...(input.system ? { system: input.system } : {}),
      messages: [{ role: "user", content: input.prompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return {
      text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}

/**
 * Deterministic, zero-cost fallback used whenever no live LLM is reachable —
 * keeps the demo fully offline-safe (AGENTS.md invariant 5). Callers that
 * need structured output (Studio compiler, quote parsing) should not rely
 * on this for anything beyond a plausible-looking draft.
 */
class OfflineStubLlmClient implements LlmClient {
  async complete(input: LlmCompleteInput): Promise<LlmCompleteOutput> {
    const text = `[offline-stub reply to]: ${input.prompt.slice(0, 200)}`;
    return { text, inputTokens: 0, outputTokens: 0 };
  }
}

/**
 * Local Ollama server (no API key, no network egress). Fits an 8GB-VRAM
 * laptop GPU: `num_ctx: 4096` keeps resident VRAM around 4.8GB (verified on
 * an RTX 5050 Laptop GPU) instead of Ollama's 32K-context default, which
 * pushed the same model to ~6.8GB and left almost no headroom.
 *
 * Never throws: if Ollama isn't running or times out, callers get the same
 * offline-stub-shaped fallback rather than a crash — this integration must
 * not weaken the "demo works with zero setup" invariant it was added
 * alongside.
 */
class OllamaLlmClient implements LlmClient {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async complete(input: LlmCompleteInput): Promise<LlmCompleteOutput> {
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          model: this.model,
          stream: false,
          options: { num_ctx: 4096, num_predict: input.maxTokens ?? 256 },
          messages: [
            ...(input.system ? [{ role: "system", content: input.system }] : []),
            { role: "user", content: input.prompt },
          ],
        }),
      });
      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);

      const json = (await res.json()) as {
        message?: { content?: string };
        prompt_eval_count?: number;
        eval_count?: number;
      };
      return {
        text: json.message?.content ?? "",
        inputTokens: json.prompt_eval_count ?? 0,
        outputTokens: json.eval_count ?? 0,
      };
    } catch (err) {
      console.error(`[llm] Ollama unreachable, falling back to offline stub: ${(err as Error).message}`);
      return { text: `[offline-stub reply to]: ${input.prompt.slice(0, 200)}`, inputTokens: 0, outputTokens: 0 };
    }
  }
}

let cachedClient: LlmClient | undefined;

/**
 * Provider selection (LLM_PROVIDER env, one of "anthropic" | "ollama" |
 * "offline"). Defaults to Anthropic when ANTHROPIC_API_KEY is set (matches
 * the originally documented AGENTS.md §3.3 model choice), otherwise to the
 * local Ollama model — no key required, nothing leaves the machine.
 */
export function getLlmClient(model: string = REASONING_MODEL): LlmClient {
  const provider = process.env.LLM_PROVIDER ?? (process.env.ANTHROPIC_API_KEY ? "anthropic" : "ollama");

  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return new AnthropicLlmClient(new Anthropic(), model);
  }
  if (provider === "ollama") {
    cachedClient ??= new OllamaLlmClient(process.env.OLLAMA_BASE_URL ?? "http://localhost:11434", OLLAMA_MODEL);
    return cachedClient;
  }
  cachedClient ??= new OfflineStubLlmClient();
  return cachedClient;
}
