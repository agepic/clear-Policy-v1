import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { summarizePolicyText, SummarizationProviderError } from "@/lib/llm";
import {
  extractTextFromHtml,
  extractTextFromPdf,
  extractTextFromPlainFile,
} from "@/lib/extract";
import { buildCandidatePolicyUrls, guessTermsUrl } from "@/lib/appSearch";

export const runtime = "nodejs";
export const maxDuration = 60;
const MIN_TEXT_LENGTH = 200;
const FETCH_TIMEOUT_MS = 15000;
const BROWSERISH_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,application/pdf;q=0.7,*/*;q=0.5",
  "accept-language": "en-US,en;q=0.9",
};

const JsonBodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("link"),
    url: z.string().url(),
  }),
  z.object({
    mode: z.literal("app"),
    appName: z.string().min(1),
  }),
]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      return await handleFileUpload(req);
    }

    const json = await req.json().catch(() => null);
    const parsed = JsonBodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        {
          error:
            "Summarization is not configured yet. Please set GROQ_API_KEY in your environment.",
        },
        { status: 500 }
      );
    }

    if (parsed.data.mode === "link") {
      return await handleLink(parsed.data.url);
    }

    if (parsed.data.mode === "app") {
      return await handleApp(parsed.data.appName);
    }

    return NextResponse.json({ error: "Unsupported mode." }, { status: 400 });
  } catch (error) {
    console.error("Error in /api/summarize:", error);
    const maybeProviderError =
      error instanceof SummarizationProviderError
        ? error
        : typeof error === "object" &&
            error !== null &&
            "statusCode" in error &&
            typeof (error as { statusCode?: unknown }).statusCode === "number" &&
            "message" in error &&
            typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string; statusCode: number })
          : null;

    if (maybeProviderError) {
      return NextResponse.json(
        { error: maybeProviderError.message },
        { status: maybeProviderError.statusCode }
      );
    }
    return NextResponse.json(
      { error: "Unexpected error while summarizing policy." },
      { status: 500 }
    );
  }
}

async function handleLink(url: string): Promise<NextResponse> {
  const fetched = await fetchAndExtract(url);
  if (!fetched) {
    return NextResponse.json(
      {
        error:
          "Could not fetch the provided URL. Please check the link and try again.",
      },
      { status: 400 }
    );
  }

  if (!hasEnoughText(fetched.text)) {
    return NextResponse.json(
      {
        error:
          "The page does not appear to contain enough readable text to summarize.",
      },
      { status: 400 }
    );
  }

  const summary = await summarizePolicyText(fetched.text, {
    sourceDescription: `URL: ${url}`,
  });
  return NextResponse.json({ ...summary, analyzedChars: fetched.text.length });
}

async function handleApp(appName: string): Promise<NextResponse> {
  const candidateUrls = buildCandidatePolicyUrls(appName);
  const fallback = guessTermsUrl(appName);
  if (fallback && !candidateUrls.includes(fallback)) {
    candidateUrls.unshift(fallback);
  }

  if (candidateUrls.length === 0) {
    return NextResponse.json(
      {
        error:
          "Could not guess a terms page for this app. Try pasting a direct link instead.",
      },
      { status: 400 }
    );
  }

  let bestCandidate: { url: string; text: string } | null = null;
  for (const candidateUrl of candidateUrls.slice(0, 18)) {
    const fetched = await fetchAndExtract(candidateUrl);
    if (!fetched) continue;
    if (!bestCandidate || fetched.text.length > bestCandidate.text.length) {
      bestCandidate = { url: candidateUrl, text: fetched.text };
    }
    if (hasEnoughText(fetched.text)) {
      bestCandidate = { url: candidateUrl, text: fetched.text };
      break;
    }
  }

  if (!bestCandidate) {
    return NextResponse.json(
      {
        error:
          "We tried to open a likely terms page, but the request failed. Please paste a link manually.",
      },
      { status: 400 }
    );
  }

  if (!hasEnoughText(bestCandidate.text)) {
    return NextResponse.json(
      {
        error:
          "The guessed page does not contain enough readable text. Try pasting a more specific link.",
      },
      { status: 400 }
    );
  }

  const summary = await summarizePolicyText(bestCandidate.text, {
    appName,
    sourceDescription: `Discovered policy page: ${bestCandidate.url}`,
  });

  return NextResponse.json({ ...summary, analyzedChars: bestCandidate.text.length });
}

async function handleFileUpload(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData();
  const mode = formData.get("mode");
  const file = formData.get("file");

  if (mode !== "file" || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Invalid file upload payload." },
      { status: 400 }
    );
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Summarization is not configured yet. Please set GROQ_API_KEY in your environment.",
      },
      { status: 500 }
    );
  }

  const fileName = file.name.toLowerCase();

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let text: string;
  try {
    if (fileName.endsWith(".pdf")) {
      text = await extractTextFromPdf(buffer);
    } else if (fileName.endsWith(".txt")) {
      text = await extractTextFromPlainFile(buffer);
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a PDF or .txt file." },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Failed to read uploaded file:", error);
    return NextResponse.json(
      {
        error:
          "We could not read this file. Try another PDF/TXT file or paste a direct link instead.",
      },
      { status: 400 }
    );
  }

  if (!hasEnoughText(text)) {
    return NextResponse.json(
      {
        error:
          "The file does not appear to contain enough readable text to summarize.",
      },
      { status: 400 }
    );
  }

  const summary = await summarizePolicyText(text, {
    sourceDescription: `Uploaded file: ${file.name}`,
  });

  return NextResponse.json({ ...summary, analyzedChars: text.length });
}

async function fetchAndExtract(url: string): Promise<{ text: string } | null> {
  const attempts = [url, toReaderFallbackUrl(url)];

  for (const attemptUrl of attempts) {
    if (!attemptUrl) continue;
    try {
      const res = await fetch(attemptUrl, {
        headers: attemptUrl === url ? BROWSERISH_HEADERS : undefined,
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) continue;

      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      const looksLikePdf =
        contentType.includes("application/pdf") ||
        attemptUrl.toLowerCase().includes(".pdf");

      if (looksLikePdf) {
        const pdfBuffer = Buffer.from(await res.arrayBuffer());
        return { text: await extractTextFromPdf(pdfBuffer) };
      }

      if (
        contentType.includes("text/plain") ||
        attemptUrl.startsWith("https://r.jina.ai/")
      ) {
        const plainBuffer = Buffer.from(await res.arrayBuffer());
        return { text: await extractTextFromPlainFile(plainBuffer) };
      }

      const html = await res.text();
      return { text: await extractTextFromHtml(html) };
    } catch {
      continue;
    }
  }

  return null;
}

function hasEnoughText(text: string | null | undefined): boolean {
  return Boolean(text && text.trim().length >= MIN_TEXT_LENGTH);
}

function toReaderFallbackUrl(url: string): string | null {
  if (!/^https?:\/\//i.test(url)) return null;
  return `https://r.jina.ai/${url}`;
}
