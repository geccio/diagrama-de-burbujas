"use client";

import { useRef, useState } from "react";
import { useDiagram } from "@/store/useDiagram";
import { readImageFile } from "@/lib/readImage";
import {
  IconImage,
  IconLock,
  IconUnlock,
  IconTrash,
  IconX,
} from "@/components/icons";

/**
 * Bottom-right panel to manage the active layer's floor-plan background:
 * upload/replace, opacity, lock, and remove.
 */
export default function BackgroundPanel() {
  const layer = useDiagram((s) => s.activeLayer());
  const setBackground = useDiagram((s) => s.setBackground);
  const updateBackground = useDiagram((s) => s.updateBackground);
  const removeBackground = useDiagram((s) => s.removeBackground);

  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const bg = layer.background;

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const { src, width, height } = await readImageFile(file);
      setBackground(src, width, height);
      setOpen(true);
    } catch {
      // ignore — bad image
    } finally {
      setBusy(false);
    }
  }

  // Collapsed pill when there's no background and panel is closed.
  if (!bg && !open) {
    return (
      <>
        <button
          onClick={() => fileInput.current?.click()}
          className="absolute bottom-3 right-3 flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/90 px-3 py-1.5 text-xs text-[var(--color-fg)] shadow-lg backdrop-blur transition-colors duration-150 hover:bg-[var(--color-surface)]"
          title="Add a floor-plan image to this layer"
        >
          <IconImage size={14} />
          {busy ? "Loading…" : "Floor plan"}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </>
    );
  }

  return (
    <div className="absolute bottom-3 right-3 w-60 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-3 shadow-xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-fg)]">
          <IconImage size={14} />
          Floor plan
        </span>
        <button
          onClick={() => setOpen(false)}
          className="cursor-pointer rounded p-0.5 text-[var(--color-muted-fg)] transition-colors duration-150 hover:text-[var(--color-fg)]"
          aria-label="Collapse"
        >
          <IconX size={14} />
        </button>
      </div>

      {!bg && (
        <button
          onClick={() => fileInput.current?.click()}
          className="w-full cursor-pointer rounded-lg border border-dashed border-[var(--color-border)] py-3 text-sm text-[var(--color-muted-fg)] transition-colors duration-150 hover:border-[var(--color-accent)] hover:text-[var(--color-fg)]"
        >
          {busy ? "Loading…" : "Upload an image"}
        </button>
      )}

      {bg && (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-xs text-[var(--color-muted-fg)]">
              <span>Opacity</span>
              <span className="font-mono-accent">
                {Math.round(bg.opacity * 100)}%
              </span>
            </span>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={bg.opacity}
              onChange={(e) =>
                updateBackground({ opacity: Number(e.target.value) })
              }
              className="w-full cursor-pointer accent-[var(--color-primary)]"
            />
          </label>

          <div className="flex gap-2">
            <button
              onClick={() => updateBackground({ locked: !bg.locked })}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-xs transition-colors duration-150 ${
                bg.locked
                  ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                  : "bg-[var(--color-surface-2)] text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
              }`}
              title={bg.locked ? "Unlock to move/resize" : "Lock in place"}
            >
              {bg.locked ? <IconLock size={14} /> : <IconUnlock size={14} />}
              {bg.locked ? "Locked" : "Unlocked"}
            </button>
            <button
              onClick={() => fileInput.current?.click()}
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-xs text-[var(--color-fg)] transition-colors duration-150 hover:bg-[var(--color-surface)]"
            >
              <IconImage size={14} />
              Replace
            </button>
          </div>

          <button
            onClick={removeBackground}
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-[var(--color-muted-fg)] transition-colors duration-150 hover:bg-[rgba(220,38,38,0.15)] hover:text-[var(--color-destructive-hover)]"
          >
            <IconTrash size={14} />
            Remove image
          </button>

          {!bg.locked && (
            <p className="text-[10px] leading-tight text-[var(--color-muted-fg)]">
              Drag the image on the canvas to position it. Lock it when done.
            </p>
          )}
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}
