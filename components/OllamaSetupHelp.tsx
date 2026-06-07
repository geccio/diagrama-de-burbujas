"use client";

import { useState } from "react";

/**
 * Step-by-step instructions for letting the browser reach Ollama (the common
 * CORS / origin issue). Collapsible; can be forced open when a connection
 * error happens.
 */
export default function OllamaSetupHelp({
  defaultOpen = false,
}: {
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm font-medium text-[var(--color-fg)]"
      >
        <span>How to set up Ollama (first time)</span>
        <span className="text-[var(--color-muted-fg)]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-[var(--color-border)] px-3 py-3 text-sm text-[var(--color-fg)]">
          <p className="text-[var(--color-muted-fg)]">
            By default Ollama only allows <Code>localhost</Code>. To let this app
            talk to it, set <Code>OLLAMA_ORIGINS</Code> and restart Ollama.
          </p>

          <Step n={1}>
            <strong>Quit Ollama completely</strong> — right-click the llama icon
            in the system tray → <em>Quit</em>. (The tray app ignores env vars
            set in a terminal, so it must be fully closed.)
          </Step>

          <Step n={2}>
            Open <strong>PowerShell</strong> and set it permanently:
            <Block>setx OLLAMA_ORIGINS &quot;*&quot;</Block>
          </Step>

          <Step n={3}>
            Close that window, open a <strong>new</strong> PowerShell, and start
            the server:
            <Block>ollama serve</Block>
          </Step>

          <Step n={4}>
            Back here, click <strong>Test connection</strong>.
          </Step>

          <div className="rounded-lg bg-[var(--color-surface)] p-2.5 text-[var(--color-muted-fg)]">
            <p className="mb-1">
              Prefer just one session? Run this instead of steps 2–3:
            </p>
            <Block>$env:OLLAMA_ORIGINS=&quot;*&quot;{"\n"}ollama serve</Block>
          </div>

          <ul className="list-disc space-y-1 pl-5 text-[var(--color-muted-fg)]">
            <li>
              Make sure your model is pulled, e.g.{" "}
              <Code>ollama pull qwen2.5:7b</Code>. Put the exact tag in the Model
              field above. (Text models like <Code>qwen2.5</Code> or{" "}
              <Code>llama3.1</Code> work best for this — better than{" "}
              <Code>llava</Code>.)
            </li>
            <li>
              Default port is <Code>11434</Code>; keep the endpoint as{" "}
              <Code>http://localhost:11434</Code> unless you changed it.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-[var(--color-on-primary)]">
        {n}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono-accent rounded bg-[var(--color-surface)] px-1 py-0.5 text-xs">
      {children}
    </code>
  );
}

function Block({ children }: { children: React.ReactNode }) {
  return (
    <pre className="font-mono-accent mt-1.5 overflow-x-auto whitespace-pre-wrap rounded-lg bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-fg)] ring-1 ring-[var(--color-border)]">
      {children}
    </pre>
  );
}
