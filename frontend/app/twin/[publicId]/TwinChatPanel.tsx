"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { getApiBaseUrl } from "@/lib/api";

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
  "What are your strongest professional skills?",
  "Tell me about your work experience.",
  "What responsibilities have you handled?",
  "What should an employer know first about you?",
];

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
    <section className="rounded-[2rem] border border-white/10 bg-white/8 p-6 backdrop-blur-xl">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
        Chat with me
      </p>
      <p className="mt-4 text-base leading-7 text-white/72">
        Here are quick questions you can start with. Just click and I will answer.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        {STARTER_QUESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            disabled={isLoading}
            onClick={() => void submitQuestion(question)}
            className="cursor-pointer rounded-full border border-white/12 bg-black/18 px-4 py-2 text-sm text-white/84 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {question}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {messages.length > 0 ? (
          messages.map((entry, index) => (
            <div
              key={`${entry.role}-${index}-${entry.content.slice(0, 24)}`}
              className={`flex ${
                entry.role === "assistant" ? "justify-start" : "justify-end"
              }`}
            >
              <div
                className={`flex max-w-[90%] items-end gap-3 sm:max-w-[78%] ${
                  entry.role === "assistant" ? "flex-row" : "flex-row-reverse"
                }`}
              >
                {entry.role === "assistant" ? (
                  candidateImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={candidateImageUrl}
                      alt=""
                      title={candidateName}
                      className="h-10 w-10 rounded-full border border-white/12 object-cover object-top shadow-[0_8px_24px_rgba(0,0,0,0.22)]"
                    />
                  ) : (
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
                  )
                ) : (
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-xs font-semibold uppercase tracking-[0.12em] text-white/80"
                    title="You"
                  >
                    You
                  </div>
                )}

                <div
                  className={`rounded-[1.5rem] border p-5 ${
                    entry.role === "assistant"
                      ? "border-cyan-300/20 bg-cyan-400/8"
                      : "border-white/10 bg-black/18"
                  }`}
                >
                  <div className="markdown-answer text-sm leading-7 text-white/78">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {entry.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-[1.25rem] border border-rose-300/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
          <p>{error}</p>
          {errorCode === "subscription_required" ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/subscription"
                className="rounded-full bg-sky-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-sky-300"
              >
                Go to subscription page
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <form className="mt-5" onSubmit={handleSubmit}>
        <div className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-black/18 transition focus-within:border-sky-300">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => void handleKeyDown(event)}
            placeholder={`Ask ${candidateName} a professional question`}
            className="min-h-32 w-full resize-none bg-transparent px-4 pb-16 pt-4 pr-28 text-sm text-white outline-none placeholder:text-white/35"
          />

          <div className="pointer-events-none absolute inset-x-4 bottom-3 flex items-center gap-3 text-xs text-white/40">
            <span>Enter to send</span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="absolute bottom-3 right-3 inline-flex min-h-11 items-center justify-center rounded-full bg-sky-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:bg-sky-200"
          >
            {isLoading ? "..." : "Send"}
          </button>
        </div>
      </form>
    </section>
  );
}
