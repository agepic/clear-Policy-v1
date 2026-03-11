const apiKey = process.env.GROQ_API_KEY;
const configuredModel =
  process.env.GROQ_MODEL?.trim() || "llama-3.1-8b-instant";

if (!apiKey) {
  // We intentionally don't throw here so the app can still build;
  // the API route will return a friendly error if the key is missing.
  console.warn("GROQ_API_KEY is not set. Summarization will not work.");
}

export type NormalizedSummary = {
  summaryBullets: string[];
  keyClauses: { label: string; text: string }[];
  warnings: string[];
};

export class SummarizationProviderError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "SummarizationProviderError";
    this.statusCode = statusCode;
  }
}

export async function summarizePolicyText(
  text: string,
  options?: { appName?: string; sourceDescription?: string }
): Promise<NormalizedSummary> {
  const prompt = buildPrompt(text, options);
  if (!apiKey) {
    throw new SummarizationProviderError(
      "Summarization is not configured. Please set GROQ_API_KEY.",
      500
    );
  }

  const modelsToTry = dedupeModels([configuredModel, "llama-3.1-8b-instant"]);

  let payload: GroqChatCompletionResponse | null = null;
  let lastError: GroqFailure | null = null;

  for (const model of modelsToTry) {
    const result = await callGroq(prompt, model, apiKey);
    if (result.ok) {
      payload = result.payload;
      break;
    }

    lastError = result.failure;
    if (!result.retryWithNextModel) {
      break;
    }
  }

  if (!payload) {
    throw buildProviderError(lastError);
  }

  const json = extractJsonText(payload);
  let parsed: Partial<NormalizedSummary>;
  try {
    parsed = JSON.parse(json) as Partial<NormalizedSummary>;
  } catch {
    throw new SummarizationProviderError(
      "Summary could not be parsed. Please try again with a shorter or simpler policy.",
      502
    );
  }

  const keyClauses = Array.isArray(parsed.keyClauses)
    ? parsed.keyClauses
        .filter(
          (item): item is { label: string; text: string } =>
            Boolean(
              item &&
                typeof item === "object" &&
                typeof item.label === "string" &&
                typeof item.text === "string"
            )
        )
        .slice(0, 20)
    : [];

  return {
    summaryBullets: Array.isArray(parsed.summaryBullets)
      ? parsed.summaryBullets.filter((item): item is string => typeof item === "string")
      : [],
    keyClauses,
    warnings: Array.isArray(parsed.warnings)
      ? parsed.warnings.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function buildPrompt(
  text: string,
  options?: { appName?: string; sourceDescription?: string }
): string {
  const trimmed = text.slice(0, 24000); // simple guardrail

  const contextLines: string[] = [];
  if (options?.appName) {
    contextLines.push(`Service or app name: ${options.appName}`);
  }
  if (options?.sourceDescription) {
    contextLines.push(`Source: ${options.sourceDescription}`);
  }

  return `
You are a helpful assistant that summarizes Terms & Conditions and privacy policies
for regular people. You write in clear, neutral, non-legal language.

${contextLines.length ? contextLines.join("\n") + "\n\n" : ""}
TASK:
- Read the policy text below.
- Produce a JSON object with:
  - "summaryBullets": 5-10 short bullet points in plain language.
  - "keyClauses": list of important clauses. Each item has:
      - "label" (e.g. "Data collection", "Subscription & billing", "Cancellation", "Dispute resolution", "Jurisdiction", "Tracking & cookies", "Data sharing with third parties").
      - "text" (2-4 sentences explaining what the clause means in practice).
  - "warnings": a list of potential red flags or things users should pay attention to.
    Only include real concerns, not generic statements.

Guidelines:
- Be concise but specific.
- Prefer concrete examples over vague wording.
- If some sections are missing (for example billing is not mentioned), you can omit them.
- If the text looks incomplete or truncated, explain that briefly in one of the bullets.

Return ONLY the JSON object, with no additional text.

POLICY TEXT START
----------------
${trimmed}
----------------
POLICY TEXT END
`.trim();
}

type GroqMessage = { content?: string | null };
type GroqChoice = { message?: GroqMessage };
type GroqChatCompletionResponse = { choices?: GroqChoice[] };
type GroqFailure = { statusCode: number; model: string; details: string };

type GroqCallResult =
  | { ok: true; payload: GroqChatCompletionResponse }
  | { ok: false; failure: GroqFailure; retryWithNextModel: boolean };

async function callGroq(
  prompt: string,
  model: string,
  key: string
): Promise<GroqCallResult> {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You summarize legal policies for regular people and output strict JSON only.",
          },
          { role: "user", content: prompt },
        ],
      }),
    }
  );

  if (response.ok) {
    return {
      ok: true,
      payload: (await response.json()) as GroqChatCompletionResponse,
    };
  }

  const details = await response.text().catch(() => "");
  const isMissingModel = response.status === 404 || response.status === 400;
  return {
    ok: false,
    failure: {
      statusCode: response.status,
      model,
      details: details || "unknown error",
    },
    retryWithNextModel: isMissingModel,
  };
}

function dedupeModels(models: string[]): string[] {
  return [...new Set(models.map((item) => item.trim()).filter(Boolean))];
}

function buildProviderError(failure: GroqFailure | null): SummarizationProviderError {
  if (!failure) {
    return new SummarizationProviderError("Groq API request failed.", 502);
  }

  if (failure.statusCode === 429) {
    return new SummarizationProviderError(
      "Groq API quota is exhausted for this key. Try again later or use another key.",
      429
    );
  }

  if (failure.statusCode === 401 || failure.statusCode === 403) {
    return new SummarizationProviderError(
      "Groq API authentication failed. Check GROQ_API_KEY and API permissions.",
      401
    );
  }

  if (failure.statusCode === 404) {
    return new SummarizationProviderError(
      "Groq model is unavailable for this API key. Update GROQ_MODEL to a supported model.",
      400
    );
  }

  return new SummarizationProviderError(
    `Groq API request failed (${failure.statusCode}) on model '${failure.model}'.`,
    502
  );
}

function extractJsonText(response: GroqChatCompletionResponse): string {
  for (const choice of response.choices ?? []) {
    const content = choice.message?.content;
    if (typeof content === "string" && content.trim()) {
      return content;
    }
  }

  throw new Error("Groq did not return a parseable summary payload.");
}
