"use client";

import { useState, useEffect } from "react";

type Mode = "app" | "file" | "link";

type SummaryResponse = {
  summaryBullets: string[];
  keyClauses: { label: string; text: string }[];
  warnings: string[];
  analyzedChars?: number;
};

const RECENT_KEY = "clearpolicy_recent";
const RECENT_MAX = 5;

export default function Home() {
  const [mode, setMode] = useState<Mode>("app");
  const [appName, setAppName] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SummaryResponse | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
          setRecentSearches(parsed.slice(0, RECENT_MAX));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  function pickService(name: string) {
    setMode("app");
    setAppName(name);
    setUrl("");
    setFile(null);
    setResult(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (mode === "link" && !url) {
      setError("Please paste a link to the terms page.");
      return;
    }
    if (mode === "app" && !appName.trim()) {
      setError("Please enter an app or service name.");
      return;
    }
    if (mode === "file" && !file) {
      setError("Please select a file to upload.");
      return;
    }

    setIsLoading(true);
    try {
      let response: Response;

      if (mode === "file") {
        const formData = new FormData();
        formData.append("mode", "file");
        if (file) {
          formData.append("file", file);
        }
        response = await fetch("/api/summarize", {
          method: "POST",
          body: formData,
        });
      } else {
        const body =
          mode === "link"
            ? { mode: "link", url }
            : { mode: "app", appName: appName.trim() };
        response = await fetch("/api/summarize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      }

      if (!response.ok) {
        let message = "Something went wrong. Please try again.";
        try {
          const text = await response.text();
          const data = text ? (JSON.parse(text) as { error?: string }) : null;
          if (data?.error) message = data.error;
          else if (text && response.status >= 500)
            message = `Server error (${response.status}). Please try again.`;
        } catch {
          if (response.status >= 500)
            message = `Server error (${response.status}). Please try again.`;
        }
        throw new Error(message);
      }

      const data = (await response.json()) as SummaryResponse;
      setResult(data);
      const query = mode === "app" ? appName.trim() : mode === "link" ? url : "";
      if (query) {
        setRecentSearches((prev) => {
          const next = [query, ...prev.filter((q) => q !== query)].slice(0, RECENT_MAX);
          try {
            localStorage.setItem(RECENT_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_500px_at_20%_-10%,var(--accent-soft),transparent),radial-gradient(900px_500px_at_100%_0%,var(--accent-2-soft),transparent),var(--background)] text-[var(--foreground)]">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 sm:mb-8">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <img
              src="/logo.svg"
              alt="Clear Policy"
              className="h-11 w-auto sm:h-14"
            />
          </div>
          <span className="rounded-full border border-[var(--border-subtle)] bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur-sm">
            AI policy assistant
          </span>
        </header>

        <section className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-8">
          <div className="flex flex-col gap-8">
            <div className="rounded-3xl border border-[var(--border-subtle)] bg-white/90 p-5 shadow-sm backdrop-blur-sm sm:p-8">
              <h2 className="mb-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Understand any Terms &amp; Conditions in minutes.
              </h2>
              <p className="mb-6 text-sm leading-relaxed text-slate-600 sm:text-base">
                Choose how you want to provide the policy, and Clear Policy will
                summarize the key points, risks, and fine print using AI.
              </p>

              <ModeSelector mode={mode} onChange={setMode} />

              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-2)]">
                  Quick service shortcuts
                </p>
                <ServiceShortcuts onPick={pickService} />
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {mode === "app" && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">
                      App or service name
                    </label>
                    <input
                      type="text"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      placeholder="e.g. Instagram, Netflix, Spotify"
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-slate-50/80 px-3 py-2.5 text-sm outline-none ring-[var(--accent)]/0 transition focus:border-[var(--accent)]/70 focus:bg-white focus:ring-2 sm:text-base"
                    />
                    <p className="text-xs text-slate-500">
                      We&apos;ll try to find the official terms page for this
                      service.
                    </p>
                  </div>
                )}

                {mode === "link" && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Link to Terms &amp; Conditions
                    </label>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com/terms"
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-slate-50/80 px-3 py-2.5 text-sm outline-none ring-[var(--accent)]/0 transition focus:border-[var(--accent)]/70 focus:bg-white focus:ring-2 sm:text-base"
                    />
                    <p className="text-xs text-slate-500">
                      Paste the URL of the policy or terms page you want
                      summarized.
                    </p>
                  </div>
                )}

                {mode === "file" && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Upload policy file
                    </label>
                    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] bg-slate-50/70 p-4">
                      <input
                        type="file"
                        accept=".pdf,.txt"
                        onChange={(e) =>
                          setFile(e.target.files ? e.target.files[0] : null)
                        }
                        className="text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-emerald-700"
                      />
                      <p className="text-xs text-slate-500">
                        Supported: PDF and plain text files. Please avoid
                        password-protected documents.
                      </p>
                      {file && (
                        <p className="text-xs font-medium text-slate-600">
                          Selected: {file.name}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {recentSearches.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Recent
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((query) => (
                        <button
                          key={query}
                          type="button"
                          onClick={() => {
                            if (/^https?:\/\//i.test(query)) {
                              setMode("link");
                              setUrl(query);
                              setAppName("");
                              setFile(null);
                            } else {
                              setMode("app");
                              setAppName(query);
                              setUrl("");
                              setFile(null);
                            }
                            setResult(null);
                            setError(null);
                          }}
                          className="rounded-full border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-[var(--accent)]/50 hover:bg-[var(--accent-soft)]/50"
                        >
                          {query.length > 32 ? query.slice(0, 32) + "…" : query}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {error && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex w-full items-center justify-center rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400 disabled:opacity-80 sm:w-auto sm:px-6 sm:text-base"
                  >
                    {isLoading ? "Summarizing..." : "Summarize policy"}
                  </button>
                  <span className="hidden text-xs text-slate-500 sm:inline sm:text-sm">
                    Powered by large language models. Always double-check
                    important details.
                  </span>
                </div>
              </form>
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <div className="rounded-3xl border border-[var(--border-subtle)] bg-white/90 p-5 shadow-sm backdrop-blur-sm sm:p-6">
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-2)]">
                Why Clear Policy?
              </h3>
              <p className="mb-4 text-sm leading-relaxed text-slate-600">
                Policies are written for lawyers. Clear Policy rewrites them for
                humans, so you can quickly see what you&apos;re agreeing to.
              </p>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                  <span>See data collection and sharing at a glance.</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                  <span>Understand billing, renewals, and cancellation rules.</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                  <span>Spot potential red flags before you click “Accept”.</span>
                </li>
              </ul>
            </div>

            <div className="flex-1 rounded-3xl border border-[var(--border-subtle)] bg-white/90 p-5 shadow-sm backdrop-blur-sm sm:p-6">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-2)]">
                Summary
              </h3>

              {!result && !isLoading && (
                <p className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--accent-soft)]/40 p-3 text-sm leading-relaxed text-slate-500">
                  Your summary will appear here. Start by searching for an app,
                  pasting a link, or uploading a file.
                </p>
              )}

              {isLoading && (
                <SkeletonLoader />
              )}

              {result && (
                <SummaryResults
                  result={result}
                  onRegenerate={() =>
                    handleSubmit({ preventDefault: () => {} } as React.FormEvent)
                  }
                  isRegenerating={isLoading}
                />
              )}
            </div>
          </aside>
        </section>

        <footer className="mt-8 border-t border-[var(--border-subtle)] pt-4 text-xs text-slate-500">
          Clear Policy does not provide legal advice. Always refer to the
          original policy for legally binding terms.
        </footer>
      </main>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="space-y-5 text-sm">
      <div className="h-8 w-24 animate-pulse rounded-full bg-slate-200" />
      <section>
        <div className="mb-2 h-3 w-24 animate-pulse rounded bg-slate-200" />
        <ul className="space-y-2 pl-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <li key={i} className="h-4 animate-pulse rounded bg-slate-100" style={{ width: `${80 - i * 5}%` }} />
          ))}
        </ul>
      </section>
      <section>
        <div className="mb-2 h-3 w-28 animate-pulse rounded bg-slate-200" />
        <div className="space-y-2">
          <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </section>
      <section>
        <div className="mb-2 h-3 w-32 animate-pulse rounded bg-slate-200" />
        <ul className="space-y-2 pl-4">
          <li className="h-4 w-[85%] animate-pulse rounded bg-slate-100" />
          <li className="h-4 w-[75%] animate-pulse rounded bg-slate-100" />
        </ul>
      </section>
    </div>
  );
}

type ModeSelectorProps = {
  mode: Mode;
  onChange: (mode: Mode) => void;
};

function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  const options: { id: Mode; label: string; description: string }[] = [
    {
      id: "app",
      label: "Search for an app",
      description: "Type the name and we'll look for its terms.",
    },
    {
      id: "file",
      label: "Upload a file",
      description: "PDF or text document with the policy.",
    },
    {
      id: "link",
      label: "Paste a link",
      description: "Direct URL to the terms or privacy policy page.",
    },
  ];

  return (
    <div className="inline-grid w-full gap-2 rounded-2xl bg-slate-50/80 p-1.5 sm:grid-cols-3">
      {options.map((opt) => {
        const isActive = opt.id === mode;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`flex flex-col items-start rounded-xl px-3 py-2.5 text-left text-xs transition sm:px-4 sm:py-3 sm:text-sm ${
              isActive
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-[var(--accent)]/70"
                : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
            }`}
          >
            <span className="mb-0.5 font-semibold">{opt.label}</span>
            <span className="text-[11px] text-slate-500 sm:text-xs">
              {opt.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SummaryResults({
  result,
  onRegenerate,
  isRegenerating,
}: {
  result: SummaryResponse;
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  type SectionKey = "bullets" | "clauses" | "warnings";
  const [collapsed, setCollapsed] = useState<Set<SectionKey>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  const toggle = (key: SectionKey) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  };

  const bulletsText = result.summaryBullets.map((b) => `• ${b}`).join("\n");
  const clausesText = result.keyClauses
    .map((c) => `${c.label}\n${c.text}`)
    .join("\n\n");
  const warningsText = result.warnings.map((w) => `• ${w}`).join("\n");
  const fullText = [
    "MAIN POINTS",
    bulletsText,
    "",
    "KEY CLAUSES",
    clausesText,
    "",
    "POTENTIAL RED FLAGS",
    warningsText,
  ]
    .filter(Boolean)
    .join("\n\n");

  const downloadTxt = () => {
    const blob = new Blob([fullText], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "policy-summary.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const riskLevel =
    result.warnings.length === 0
      ? "low"
      : result.warnings.length <= 2
        ? "medium"
        : "high";
  const riskLabel =
    riskLevel === "low"
      ? "Low Risk"
      : riskLevel === "medium"
        ? "Medium Risk"
        : "High Risk";
  const riskClass =
    riskLevel === "low"
      ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
      : riskLevel === "medium"
        ? "bg-amber-100 text-amber-800 ring-amber-200"
        : "bg-red-100 text-red-800 ring-red-200";

  return (
    <div className="space-y-5 text-sm text-slate-700">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${riskClass}`}
        >
          {riskLabel}
        </span>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          aria-label="Regenerate summary"
        >
          <RefreshIcon className="h-3.5 w-3.5" />
          Regenerate
        </button>
        <button
          type="button"
          onClick={() => copyToClipboard(fullText, "all")}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          {copied === "all" ? "Copied!" : "Copy all"}
        </button>
        <button
          type="button"
          onClick={downloadTxt}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          Download summary
        </button>
      </div>

      {result.summaryBullets.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => toggle("bullets")}
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 hover:text-slate-700"
            >
              <ChevronIcon
                className={`h-4 w-4 transition ${collapsed.has("bullets") ? "" : "-rotate-90"}`}
              />
              Main points
            </button>
            <button
              type="button"
              onClick={() => copyToClipboard(bulletsText, "bullets")}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              {copied === "bullets" ? "Copied!" : "Copy"}
            </button>
          </div>
          <div
            className={`overflow-hidden transition-[height] duration-200 ${
              collapsed.has("bullets") ? "max-h-0 opacity-0" : "max-h-[2000px] opacity-100"
            }`}
          >
            <ul className="list-disc space-y-1 pl-4 marker:text-[var(--accent)]">
              {result.summaryBullets.map((item, idx) => (
                <li key={idx} className="leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {result.keyClauses.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => toggle("clauses")}
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-2)] hover:opacity-90"
            >
              <ChevronIcon
                className={`h-4 w-4 transition ${collapsed.has("clauses") ? "" : "-rotate-90"}`}
              />
              Key clauses
            </button>
            <button
              type="button"
              onClick={() => copyToClipboard(clausesText, "clauses")}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              {copied === "clauses" ? "Copied!" : "Copy"}
            </button>
          </div>
          <div
            className={`overflow-hidden transition-[height] duration-200 ${
              collapsed.has("clauses") ? "max-h-0 opacity-0" : "max-h-[3000px] opacity-100"
            }`}
          >
            <div className="space-y-2">
              {result.keyClauses.map((clause, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[var(--border-subtle)] bg-slate-50/80 p-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-2)]">
                    {clause.label}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">
                    {clause.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {result.warnings.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => toggle("warnings")}
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-red-600 hover:opacity-90"
            >
              <ChevronIcon
                className={`h-4 w-4 transition ${collapsed.has("warnings") ? "" : "-rotate-90"}`}
              />
              Potential red flags
            </button>
            <button
              type="button"
              onClick={() => copyToClipboard(warningsText, "warnings")}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              {copied === "warnings" ? "Copied!" : "Copy"}
            </button>
          </div>
          <div
            className={`overflow-hidden transition-[height] duration-200 ${
              collapsed.has("warnings") ? "max-h-0 opacity-0" : "max-h-[1000px] opacity-100"
            }`}
          >
            <ul className="list-disc space-y-1 pl-4 text-red-700">
              {result.warnings.map((item, idx) => (
                <li key={idx} className="leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {typeof result.analyzedChars === "number" && (
        <p className="text-xs text-slate-500">
          Analyzed {result.analyzedChars.toLocaleString()} characters
        </p>
      )}
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 21h5v-5" />
    </svg>
  );
}

function ServiceShortcuts({ onPick }: { onPick: (name: string) => void }) {
  const services: { name: string; icon: React.ReactNode }[] = [
    { name: "YouTube", icon: <YoutubeIcon /> },
    { name: "Snapchat", icon: <SnapchatIcon /> },
    { name: "Instagram", icon: <InstagramIcon /> },
    { name: "Netflix", icon: <NetflixIcon /> },
    { name: "Spotify", icon: <SpotifyIcon /> },
    { name: "TikTok", icon: <TikTokIcon /> },
    { name: "X (Twitter)", icon: <XIcon /> },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {services.map((service) => (
        <button
          key={service.name}
          type="button"
          onClick={() => onPick(service.name)}
          className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 shadow-sm transition hover:border-[var(--accent)]/50 hover:bg-[var(--accent-soft)]/50 sm:text-sm"
        >
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 ring-1 ring-black/5">
            {service.icon}
          </span>
          <span className="truncate">{service.name}</span>
        </button>
      ))}
    </div>
  );
}

function YoutubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M23.5 7.3a3 3 0 0 0-2.1-2.1C19.5 4.7 12 4.7 12 4.7s-7.5 0-9.4.5A3 3 0 0 0 .5 7.3 31 31 0 0 0 0 12a31 31 0 0 0 .5 4.7 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-4.7ZM9.6 15.3V8.7l6 3.3-6 3.3Z" />
    </svg>
  );
}

function SnapchatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M12 2c3.4 0 6 2.6 6 6v2.2c0 .8.4 1.5 1.1 1.9l1 .5c.7.3.7 1.4 0 1.7l-1 .5c-.4.2-.7.5-.9.9-.6 1.1-1.6 1.8-2.8 2.1-.6.1-1 .7-1.1 1.3-.1.5-.5.9-1 .9h-2.6c-.5 0-.9-.4-1-.9-.1-.6-.5-1.2-1.1-1.3-1.2-.3-2.2-1-2.8-2.1-.2-.4-.5-.7-.9-.9l-1-.5c-.7-.3-.7-1.4 0-1.7l1-.5c.7-.4 1.1-1.1 1.1-1.9V8c0-3.4 2.6-6 6-6Zm0 1.8C9.5 3.8 7.8 5.5 7.8 8v2.2a4 4 0 0 1-2.2 3.6l-.2.1.2.1c.9.5 1.6 1.2 2 2.1.3.5.8.9 1.3 1 .7.2 1.3.6 1.8 1.2h2.6c.5-.6 1.1-1 1.8-1.2.6-.1 1-.5 1.3-1 .5-.9 1.1-1.6 2-2.1l.2-.1-.2-.1a4 4 0 0 1-2.2-3.6V8c0-2.5-1.7-4.2-4.2-4.2Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 1.8A3.2 3.2 0 0 0 3.8 7v10A3.2 3.2 0 0 0 7 20.2h10A3.2 3.2 0 0 0 20.2 17V7A3.2 3.2 0 0 0 17 3.8H7Zm5 3.4A4.8 4.8 0 1 1 7.2 12 4.8 4.8 0 0 1 12 7.2Zm0 1.8A3 3 0 1 0 15 12a3 3 0 0 0-3-3Zm5.2-2.2a1.1 1.1 0 1 1-1.1 1.1 1.1 1.1 0 0 1 1.1-1.1Z" />
    </svg>
  );
}

function NetflixIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M8 2h3l5 14V2h3v20l-3-.6-5-14V22l-3-.6V2Z" />
    </svg>
  );
}

function SpotifyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.4 14.3a.8.8 0 0 1-1.1.2c-2.9-1.8-6.5-2.2-10.6-1.4a.8.8 0 1 1-.3-1.6c4.5-.9 8.5-.4 11.8 1.6a.8.8 0 0 1 .2 1.2Zm1.6-2.8a1 1 0 0 1-1.3.3c-3.3-2-8.2-2.6-12.1-1.5a1 1 0 1 1-.5-1.9c4.5-1.2 9.8-.5 13.6 1.8.5.3.7.9.3 1.3Zm.1-3a1.2 1.2 0 0 1-1.6.4c-3.7-2.2-9.7-2.4-13.2-1.4a1.2 1.2 0 1 1-.7-2.3c4.1-1.2 10.8-1 15.1 1.7.6.3.8 1 .4 1.6Z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M14 2h2.4a4.5 4.5 0 0 0 3.6 3.4v2.5a7.1 7.1 0 0 1-3.6-1.1v6.3a6.1 6.1 0 1 1-5.3-6v2.5a3.6 3.6 0 1 0 2.9 3.5V2Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M3 3h4.8l4 5.8L16.9 3H21l-7.2 8.3L21 21h-4.8l-4.4-6.4L7 21H3l7.4-8.7L3 3Z" />
    </svg>
  );
}
