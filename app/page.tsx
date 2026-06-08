"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type Konva from "konva";
import Toolbar from "@/components/Toolbar";
import Tabs from "@/components/Tabs";
import PropertyPanel from "@/components/PropertyPanel";
import UploadPanel from "@/components/UploadPanel";
import Legend from "@/components/Legend";
import BackgroundPanel from "@/components/BackgroundPanel";
import SummaryPanel from "@/components/SummaryPanel";
import MultiSelectBar from "@/components/MultiSelectBar";
import AdjacencyMatrix from "@/components/AdjacencyMatrix";
import AiPanel from "@/components/AiPanel";
import ChatWidget from "@/components/ChatWidget";
import { IconBubbles, IconUpload } from "@/components/icons";
import { useDiagram } from "@/store/useDiagram";

// Konva touches the DOM/canvas — load it only in the browser.
const Canvas = dynamic(() => import("@/components/Canvas"), { ssr: false });

export default function Page() {
  const hydrate = useDiagram((s) => s.hydrate);
  const hydrated = useDiagram((s) => s.hydrated);
  const theme = useDiagram((s) => s.diagram.theme ?? "light");

  const [showUpload, setShowUpload] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const stageRef = useRef<Konva.Stage | null>(null);
  const canvasWrap = useRef<HTMLDivElement>(null);

  // Restore from localStorage once on mount.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Reflect the active theme on the document root so CSS variables switch.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Clipboard shortcuts: Ctrl/Cmd + C (copy), V (paste), D (duplicate).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return; // don't hijack real text copy/paste
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      const store = useDiagram.getState();
      if (k === "c") {
        if (store.copySelection() > 0) e.preventDefault();
      } else if (k === "v") {
        if (store.pasteClipboard() > 0) e.preventDefault();
      } else if (k === "d") {
        if (store.duplicateSelection() > 0) e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Track the canvas container size responsively.
  useEffect(() => {
    function measure() {
      if (canvasWrap.current) {
        setSize({
          width: canvasWrap.current.clientWidth,
          height: canvasWrap.current.clientHeight,
        });
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [hydrated]);

  return (
    <div className="flex h-screen w-screen flex-col">
      <Toolbar
        onUploadClick={() => setShowUpload(true)}
        onMatrixClick={() => setShowMatrix(true)}
        onAiClick={() => setShowAi(true)}
        stageRef={stageRef}
      />
      <Tabs />

      <div ref={canvasWrap} className="relative flex-1 overflow-hidden">
        {hydrated && size.width > 0 && (
          <Canvas ref={stageRef} width={size.width} height={size.height} />
        )}
        {hydrated && <PropertyPanel />}
        {hydrated && <MultiSelectBar />}
        {hydrated && <SummaryPanel />}
        {hydrated && <Legend />}
        {hydrated && size.width > 0 && <BackgroundPanel />}
        {hydrated && size.width > 0 && <ChatWidget canvasSize={size} />}

        {/* Empty-state hint */}
        {hydrated && <EmptyHint onUploadClick={() => setShowUpload(true)} />}
      </div>

      {showUpload && (
        <UploadPanel
          onClose={() => setShowUpload(false)}
          canvasSize={size}
        />
      )}
      {showMatrix && <AdjacencyMatrix onClose={() => setShowMatrix(false)} />}
      {showAi && (
        <AiPanel onClose={() => setShowAi(false)} canvasSize={size} />
      )}
    </div>
  );
}

function EmptyHint({ onUploadClick }: { onUploadClick: () => void }) {
  const layer = useDiagram((s) => s.activeLayer());
  if (layer.bubbles.length > 0 || layer.drawings.length > 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="pointer-events-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-7 text-center backdrop-blur">
        <IconBubbles
          size={40}
          className="mx-auto text-[var(--color-primary-hover)]"
        />
        <p className="mt-3 text-lg font-medium">This layer is empty</p>
        <p className="mt-1 text-sm text-[var(--color-muted-fg)]">
          Upload an Excel, CSV, or PDF to generate bubbles from your data.
        </p>
        <button
          onClick={onUploadClick}
          className="mx-auto mt-4 flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--color-accent-hover)]"
        >
          <IconUpload size={16} />
          Upload data
        </button>
      </div>
    </div>
  );
}
