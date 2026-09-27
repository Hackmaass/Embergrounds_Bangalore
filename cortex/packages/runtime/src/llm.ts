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
 * Deterministic, zero-cost fallback used whenever no ANTHROPIC_API_KEY is
 * configured — keeps the demo fully offline-safe (AGENTS.md invariant 5).
 * Callers that need structured output (Studio compiler, quote parsing)
 * should not rely on this for anything beyond a plausible-looking draft.
 */
class OfflineStubLlmClient implements LlmClient {
  async complete(input: LlmCompleteInput): Promise<LlmCompleteOutput> {
    const text = `[offline-stub reply to]: ${input.prompt.slice(0, 200)}`;
    return { text, inputTokens: 0, outputTokens: 0 };
  }
}

let cachedClient: LlmClient | undefined;

export function getLlmClient(model: string = REASONING_MODEL): LlmClient {
  if (!process.env.ANTHROPIC_API_KEY) {
    cachedClient ??= new OfflineStubLlmClient();
    return cachedClient;
  }
  return new AnthropicLlmClient(new Anthropic(), model);
}
