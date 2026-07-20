"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { getApiBaseUrl } from "@/lib/api";

import { ChatStarfield } from "./ChatStarfield";

type TwinChatPanelProps = {
  publicProfileId: string;
  candidateName: string;
  candidateImageUrl: string | null;
};

type ChatState = {
  answer: string;
  usedContext: boolean;
  sources: number[];
};

type ChatErrorState = {
  detail?: string;
  code?: string;
};

type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

const STARTER_QUESTIONS = [
  "Tell me about your work experience.",
  "What are your strongest professional skills?",
];

function TwinAvatar({
  candidateImageUrl,
  candidateName,
}: {
  candidateImageUrl: string | null;
  candidateName: string;
}) {
  if (candidateImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={candidateImageUrl}
        alt=""
        title={candidateName}
        className="h-10 w-10 rounded-full border border-white/12 object-cover object-top shadow-[0_8px_24px_rgba(0,0,0,0.22)]"
      />
    );
  }

  return (
    <div
      title={candidateName}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-cyan-300/12 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100"
    >
      {candidateName
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)}
    </div>
  );
}

function ThinkingIndicator({
  candidateImageUrl,
  candidateName,
}: {
  candidateImageUrl: string | null;
  candidateName: string;
}) {
  return (
    <div className="flex justify-start" aria-live="polite" aria-label="Twin is thinking">
      <div className="flex max-w-[90%] items-end gap-3 sm:max-w-[78%]">
        <TwinAvatar candidateImageUrl={candidateImageUrl} candidateName={candidateName} />
        <div className="rounded-[1.5rem] border border-cyan-300/20 bg-cyan-400/8 p-5 shadow-[0_0_36px_rgba(34,211,238,0.08)]">
          <div className="flex items-center gap-3 text-sm font-medium text-white/78">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-200" />
            </span>
            <span>Thinking...</span>
            <span className="flex items-center gap-1" aria-hidden="true">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-100/80 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-100/70 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-100/60" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TwinChatPanel({
  publicProfileId,
  candidateName,
  candidateImageUrl,
}: TwinChatPanelProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<HistoryMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function submitQuestion(nextMessage: string) {
    const trimmedMessage = nextMessage.trim();
    if (!trimmedMessage) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setErrorCode(null);
    const nextHistory = [...messages, { role: "user" as const, content: trimmedMessage }];
    setMessages(nextHistory);
    setMessage("");

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/v1/chat/public/${publicProfileId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmedMessage,
            history: messages,
          }),
        },
      );

      const payload = (await response.json()) as ChatState | ChatErrorState;

      if (!response.ok) {
        if ("code" in payload && payload.code === "subscription_required") {
          setErrorCode("subscription_required");
          throw new Error(
            ("detail" in payload ? payload.detail : undefined) ??
              "This account has hit its access limit.",
          );
        }

        throw new Error(
          ("detail" in payload ? payload.detail : undefined) ??
            "Unable to answer that question.",
        );
      }

      const chatResult = payload as ChatState;
      setMessages([
        ...nextHistory,
        { role: "assistant", content: chatResult.answer },
      ]);
    } catch (submissionError) {
      setMessages(messages);
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to answer that question.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitQuestion(message);
  }

  async function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    if (!isLoading) {
      await submitQuestion(message);
    }
  }

  return (
    <section className="chat-space relative isolate overflow-hidden rounded-2xl border border-white/10 bg-[#050505] shadow-[0_24px_80px_rgba(0,0,0,0.3)] sm:rounded-[1.5rem]">
      <ChatStarfield />

      <div className="relative z-10 p-4 sm:p-5 lg:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          What you can ask
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {STARTER_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              disabled={isLoading}
              onClick={() => void submitQuestion(question)}
              className="cursor-pointer rounded-lg border border-white/12 bg-black/35 px-3 py-2 text-left text-xs leading-5 text-white/84 transition hover:border-white/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70 sm:text-sm"
            >
              {question}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {messages.length > 0 ? (
            messages.map((entry, index) => (
              <div
                key={`${entry.role}-${index}-${entry.content.slice(0, 24)}`}
                className={`flex ${
                  entry.role === "assistant" ? "justify-start" : "justify-end"
                }`}
              >
                <div
                  className={`flex max-w-[94%] items-end gap-2 sm:max-w-[78%] ${
                    entry.role === "assistant" ? "flex-row" : "flex-row-reverse"
                  }`}
                >
                  {entry.role === "assistant" ? (
                    <TwinAvatar
                      candidateImageUrl={candidateImageUrl}
                      candidateName={candidateName}
                    />
                  ) : (
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-white/80"
                      title="You"
                    >
                      You
                    </div>
                  )}

                  <div
                    className={`rounded-xl border px-4 py-3 ${
                      entry.role === "assistant"
                        ? "border-cyan-300/20 bg-cyan-400/8"
                        : "border-white/10 bg-black/35"
                    }`}
                  >
                    <div className="markdown-answer text-sm leading-6 text-white/78">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {entry.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : null}

          {isLoading ? (
            <ThinkingIndicator
              candidateImageUrl={candidateImageUrl}
              candidateName={candidateName}
            />
          ) : null}
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            <p>{error}</p>
            {errorCode === "subscription_required" ? (
              <div className="mt-3 flex flex-wrap gap-3">
                <Link
                  href="/subscription"
                  className="rounded-lg bg-sky-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-sky-300"
                >
                  Go to subscription page
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

        <form className="mt-4" onSubmit={handleSubmit}>
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/38 transition focus-within:border-sky-300">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => void handleKeyDown(event)}
              placeholder={`Ask ${candidateName} a professional question`}
              className="min-h-24 w-full resize-none bg-transparent px-3 pb-12 pt-3 pr-24 text-sm text-white outline-none placeholder:text-white/35 sm:min-h-28 sm:px-4 sm:pt-4"
            />

            <div className="pointer-events-none absolute inset-x-3 bottom-2 flex items-center gap-3 text-[0.65rem] text-white/40 sm:inset-x-4 sm:bottom-3 sm:text-xs">
              <span>Enter to send</span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="absolute bottom-2 right-2 inline-flex min-h-9 items-center justify-center rounded-lg bg-sky-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-sky-200 sm:bottom-3 sm:right-3 sm:min-h-10"
            >
              {isLoading ? "Thinking..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
