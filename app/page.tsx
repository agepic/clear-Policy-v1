"use client";

import { useState } from "react";

type Mode = "app" | "file" | "link";

type SummaryResponse = {
  summaryBullets: string[];
  keyClauses: { label: string; text: string }[];
  warnings: string[];
};

export default function Home() {
  const [mode, setMode] = useState<Mode>("app");
  const [appName, setAppName] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SummaryResponse | null>(null);

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
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Something went wrong. Please try again.");
      }

      const data = (await response.json()) as SummaryResponse;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_500px_at_20%_-10%,var(--accent-soft),transparent),radial-gradient(900px_500px_at_100%_0%,var(--accent-2-soft),transparent),var(--background)] text-[var(--foreground)]">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
        <header className="mb-6 flex items-center justify-between gap-4 sm:mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)] shadow-sm ring-1 ring-[var(--accent)]/15">
              CP
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
                Clear Policy
              </h1>
              <p className="text-xs text-slate-500 sm:text-sm">
                Turn dense legal text into clear points.
              </p>
            </div>
          </div>
          <span className="hidden rounded-full border border-[var(--border-subtle)] bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm backdrop-blur-sm sm:inline-flex">
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
                <p className="text-sm leading-relaxed text-slate-600">
                  Reading the policy and preparing a clear summary…
                </p>
              )}

              {result && (
                <SummaryResults result={result} />
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

function SummaryResults({ result }: { result: SummaryResponse }) {
  return (
    <div className="space-y-5 text-sm text-slate-700">
      {result.summaryBullets.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Main points
          </h4>
      <ul className="list-disc space-y-1 pl-4 marker:text-[var(--accent)]">
            {result.summaryBullets.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.keyClauses.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-2)]">
            Key clauses
          </h4>
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
        </section>
      )}

      {result.warnings.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-red-600">
            Potential red flags
          </h4>
          <ul className="list-disc space-y-1 pl-4 text-red-700">
            {result.warnings.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
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
