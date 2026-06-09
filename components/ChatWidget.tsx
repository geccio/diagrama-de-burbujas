"use client";

import { useEffect, useRef, useState } from "react";
import { useDiagram } from "@/store/useDiagram";
import { loadOllamaSettings, describeOllamaError } from "@/lib/ollama";
import { aiChatTurn, normalizeCategory } from "@/lib/aiTasks";
import { IconChat, IconX, IconSparkles } from "@/components/icons";

interface Props {
  canvasSize: { width: number; height: number };
}

type Msg = { role: "user" | "assistant"; content: string };

/**
 * Floating, collapsible AI chat docked bottom-left. Talks to the user's Ollama
 * and can create/edit the diagram across turns while staying on the canvas.
 */
export default function ChatWidget({ canvasSize }: Props) {
  const layer = useDiagram((s) => s.activeLayer());
  const applyChatActions = useDiagram((s) => s.applyChatActions);

  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest message.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat, open]);

  function snapshot() {
    return layer.bubbles.map((b) => ({
      id: b.id,
      name: b.label,
      area: b.value,
      category: b.category,
      floor: b.floor,
    }));
  }

  async function send() {
    const msg = input.trim();
    if (!msg || busy) return;
    setInput("");
    const history = chat.slice(-8);
    setChat((c) => [...c, { role: "user", content: msg }]);
    setBusy(true);
    // Remember which layer the request was about — if the user switches tabs
    // while the AI is thinking, don't apply the changes to the wrong layer.
    const requestLayerId = useDiagram.getState().diagram.activeLayerId;
    try {
      const res = await aiChatTurn(
        loadOllamaSettings(),
        history,
        snapshot(),
        msg
      );
      const actions = res.actions.map((a) => ({
        ...a,
        category: a.category ? normalizeCategory(a.category) : undefined,
      }));
      if (
        actions.length > 0 &&
        useDiagram.getState().diagram.activeLayerId !== requestLayerId
      ) {
        setChat((c) => [
          ...c,
          {
            role: "assistant",
            content:
              "⚠ You switched to another layer while I was thinking, so I didn't apply the changes. Switch back and resend to apply them.",
          },
        ]);
        return;
      }
      const changed = applyChatActions(actions, canvasSize);
      const note =
        changed > 0
          ? ` (applied ${changed} change${changed > 1 ? "s" : ""})`
          : "";
      setChat((c) => [
        ...c,
        { role: "assistant", content: (res.reply || "Done.") + note },
      ]);
    } catch (e) {
      setChat((c) => [
        ...c,
        { role: "assistant", content: "⚠ " + describeOllamaError(e) },
      ]);
    } finally {
      setBusy(false);
    }
  }

  // Collapsed launcher.
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="AI chat"
        aria-label="Open AI chat"
        className="absolute bottom-3 left-3 z-20 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-xl transition-transform duration-150 hover:scale-105"
      >
        <IconChat size={22} />
      </button>
    );
  }

  return (
    <div className="absolute bottom-3 left-3 z-30 flex h-[26rem] w-80 flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 shadow-2xl backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-fg)]">
          <IconChat size={16} className="text-[var(--color-primary-hover)]" />
          AI chat
        </span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Collapse chat"
          className="cursor-pointer rounded-lg p-1 text-[var(--color-muted-fg)] transition-colors duration-150 hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
        >
          <IconX size={16} />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto px-3 py-3"
      >
        {chat.length === 0 && (
          <p className="text-xs leading-relaxed text-[var(--color-muted-fg)]">
            Ask or instruct in plain language — it can create and edit across
            messages. e.g.{" "}
            <span className="text-[var(--color-fg)]">
              &quot;add 3 phone booths on P2 and connect them to the
              lounge&quot;
            </span>
            .
          </p>
        )}
        {chat.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
              m.role === "user"
                ? "ml-auto bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                : "mr-auto bg-[var(--color-surface-2)] text-[var(--color-fg)]"
            }`}
          >
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="mr-auto max-w-[85%] rounded-2xl bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-muted-fg)]">
            Thinking…
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-[var(--color-border)] p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Type a message…"
          className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1.5 text-sm text-[var(--color-fg)] focus:border-[var(--color-ring)]"
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          aria-label="Send"
          className="flex cursor-pointer items-center justify-center rounded-lg bg-[var(--color-primary)] px-2.5 py-1.5 text-sm font-medium text-[var(--color-on-primary)] transition-colors duration-150 hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
        >
          <IconSparkles size={16} />
        </button>
      </div>
    </div>
  );
}
