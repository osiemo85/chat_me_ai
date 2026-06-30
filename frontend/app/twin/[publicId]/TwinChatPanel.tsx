"use client";

import { FormEvent, useState } from "react";

import { getApiBaseUrl } from "@/lib/api";

type TwinChatPanelProps = {
  publicProfileId: string;
  fullName: string;
};

type ChatState = {
  answer: string;
  usedContext: boolean;
  sources: number[];
};

export function TwinChatPanel({
  publicProfileId,
  fullName,
}: TwinChatPanelProps) {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ChatState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/v1/chat/public/${publicProfileId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmedMessage }),
        },
      );

      const payload = (await response.json()) as
        | ChatState
        | { detail?: string };

      if (!response.ok) {
        const detail =
          "detail" in payload ? payload.detail : "Unable to answer that question.";
        throw new Error(detail ?? "Unable to answer that question.");
      }

      setResult(payload as ChatState);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to answer that question.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/8 p-6 backdrop-blur-xl">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
        Ask The Twin
      </p>
      <p className="mt-4 text-base leading-7 text-white/72">
        Ask about {fullName}&apos;s experience, skills, or background. Greetings
        are answered directly. CV-based questions are answered only from stored
        CV context.
      </p>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ask a question about this candidate"
          className="min-h-32 w-full rounded-[1.5rem] border border-white/10 bg-black/18 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-sky-300"
        />

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-sky-400 px-6 font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-sky-200"
        >
          {isLoading ? "Answering..." : "Ask Question"}
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-[1.25rem] border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/18 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
            Answer
          </p>
          <p className="mt-3 text-sm leading-7 text-white/78">{result.answer}</p>
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/45">
            {result.usedContext
              ? `CV context used: chunks ${result.sources.join(", ")}`
              : "No CV context used"}
          </p>
        </div>
      ) : null}
    </section>
  );
}
