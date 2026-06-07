"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type Konva from "konva";
import Toolbar from "@/components/Toolbar";
import Tabs from "@/components/Tabs";
import PropertyPanel from "@/components/PropertyPanel";
import UploadPanel from "@/components/UploadPanel";
import { useDiagram } from "@/store/useDiagram";

// Konva touches the DOM/canvas — load it only in the browser.
const Canvas = dynamic(() => import("@/components/Canvas"), { ssr: false });

export default function Page() {
  const hydrate = useDiagram((s) => s.hydrate);
  const hydrated = useDiagram((s) => s.hydrated);

  const [showUpload, setShowUpload] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const stageRef = useRef<Konva.Stage | null>(null);
  const canvasWrap = useRef<HTMLDivElement>(null);

  // Restore from localStorage once on mount.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

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
      <Toolbar onUploadClick={() => setShowUpload(true)} stageRef={stageRef} />
      <Tabs />

      <div ref={canvasWrap} className="relative flex-1 overflow-hidden">
        {hydrated && size.width > 0 && (
          <Canvas ref={stageRef} width={size.width} height={size.height} />
        )}
        {hydrated && <PropertyPanel />}

        {/* Empty-state hint */}
        {hydrated && <EmptyHint onUploadClick={() => setShowUpload(true)} />}
      </div>

      {showUpload && (
        <UploadPanel
          onClose={() => setShowUpload(false)}
          canvasSize={size}
        />
      )}
    </div>
  );
}

function EmptyHint({ onUploadClick }: { onUploadClick: () => void }) {
  const layer = useDiagram((s) => s.activeLayer());
  if (layer.bubbles.length > 0 || layer.drawings.length > 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="pointer-events-auto rounded-xl bg-slate-800/80 p-6 text-center ring-1 ring-slate-700 backdrop-blur">
        <p className="text-lg font-medium">This layer is empty</p>
        <p className="mt-1 text-sm text-slate-400">
          Upload an Excel, CSV, or PDF to generate bubbles from your data.
        </p>
        <button
          onClick={onUploadClick}
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
        >
          ⬆ Upload data
        </button>
      </div>
    </div>
  );
}
