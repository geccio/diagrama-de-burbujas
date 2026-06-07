"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import {
  Stage,
  Layer as KonvaLayer,
  Circle,
  Text,
  Line,
  Group,
  Rect,
} from "react-konva";
import type Konva from "konva";
import { useDiagram } from "@/store/useDiagram";
import type { Bubble } from "@/lib/types";
import { uid } from "@/lib/id";
import BubbleLabel from "@/components/BubbleLabel";

interface Props {
  width: number;
  height: number;
}

interface DraftLine {
  points: number[];
}

const GRID = 50; // base grid spacing in px (1m at default ppm=50)

const Canvas = forwardRef<Konva.Stage, Props>(function Canvas(
  { width, height },
  stageRef
) {
  const diagram = useDiagram((s) => s.diagram);
  const layer = useDiagram((s) => s.activeLayer());
  const mode = useDiagram((s) => s.mode);
  const ppm = diagram.pixelsPerMeter;

  const selectedBubbleId = useDiagram((s) => s.selectedBubbleId);
  const selectedLinkId = useDiagram((s) => s.selectedLinkId);
  const pendingConnectId = useDiagram((s) => s.pendingConnectId);

  const selectBubble = useDiagram((s) => s.selectBubble);
  const selectLink = useDiagram((s) => s.selectLink);
  const moveBubble = useDiagram((s) => s.moveBubble);
  const handleBubbleConnectClick = useDiagram((s) => s.handleBubbleConnectClick);
  const addDrawing = useDiagram((s) => s.addDrawing);

  // pan/zoom state
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // in-progress measure line
  const [draft, setDraft] = useState<DraftLine | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const internalRef = useRef<Konva.Stage | null>(null);
  function setStageRef(node: Konva.Stage | null) {
    internalRef.current = node;
    if (typeof stageRef === "function") stageRef(node);
    else if (stageRef) {
      (stageRef as React.MutableRefObject<Konva.Stage | null>).current = node;
    }
  }

  const bubbleById = useMemo(() => {
    const m = new Map<string, Bubble>();
    layer.bubbles.forEach((b) => m.set(b.id, b));
    return m;
  }, [layer.bubbles]);

  // Convert a screen pointer position into stage (world) coordinates.
  function getWorldPointer(): { x: number; y: number } | null {
    const stage = internalRef.current;
    if (!stage) return null;
    const p = stage.getPointerPosition();
    if (!p) return null;
    return {
      x: (p.x - pos.x) / scale,
      y: (p.y - pos.y) / scale,
    };
  }

  // Zoom with the wheel, centered on the cursor.
  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = internalRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const scaleBy = 1.08;
    const direction = e.evt.deltaY > 0 ? 1 / scaleBy : scaleBy;
    const newScale = Math.min(4, Math.max(0.2, scale * direction));
    const mousePoint = {
      x: (pointer.x - pos.x) / scale,
      y: (pointer.y - pos.y) / scale,
    };
    setScale(newScale);
    setPos({
      x: pointer.x - mousePoint.x * newScale,
      y: pointer.y - mousePoint.y * newScale,
    });
  }

  function finishDraft() {
    if (draft && draft.points.length >= 4) {
      const lengthMeters = polylineLengthMeters(draft.points, ppm);
      addDrawing({ id: uid("draw"), points: draft.points, lengthMeters });
    }
    setDraft(null);
    setCursor(null);
  }

  // Click handling on empty canvas depends on mode.
  // Accept both mouse and touch events (onClick / onTap).
  function handleStageClick(
    e: Konva.KonvaEventObject<MouseEvent | TouchEvent>
  ) {
    const clickedEmpty = e.target === e.target.getStage();

    if (mode === "draw") {
      const w = getWorldPointer();
      if (!w) return;
      setDraft((d) =>
        d
          ? { points: [...d.points, w.x, w.y] }
          : { points: [w.x, w.y, w.x, w.y] }
      );
      return;
    }

    if (clickedEmpty) {
      selectBubble(null);
      selectLink(null);
    }
  }

  function handleMouseMove() {
    if (mode === "draw" && draft) {
      const w = getWorldPointer();
      if (!w) return;
      setCursor(w);
    }
  }

  // Esc finishes/cancels the draft line.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        finishDraft();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, ppm]);

  function onBubbleClick(b: Bubble) {
    if (mode === "connect") {
      handleBubbleConnectClick(b.id);
    } else if (mode === "select") {
      selectBubble(b.id);
    }
  }

  // Build grid lines covering the visible world area.
  const gridLines = useMemo(() => {
    const lines: number[][] = [];
    const left = -pos.x / scale;
    const top = -pos.y / scale;
    const right = (width - pos.x) / scale;
    const bottom = (height - pos.y) / scale;
    const startX = Math.floor(left / GRID) * GRID;
    const startY = Math.floor(top / GRID) * GRID;
    for (let x = startX; x < right; x += GRID) {
      lines.push([x, top, x, bottom]);
    }
    for (let y = startY; y < bottom; y += GRID) {
      lines.push([left, y, right, y]);
    }
    return lines;
  }, [pos, scale, width, height]);

  const draftPreview = draft
    ? cursor
      ? [...draft.points.slice(0, -2), cursor.x, cursor.y]
      : draft.points
    : null;

  return (
    <Stage
      ref={setStageRef}
      width={width}
      height={height}
      scaleX={scale}
      scaleY={scale}
      x={pos.x}
      y={pos.y}
      draggable={mode !== "draw"}
      onWheel={handleWheel}
      onClick={handleStageClick}
      onTap={handleStageClick}
      onMouseMove={handleMouseMove}
      onDblClick={() => mode === "draw" && finishDraft()}
      onDragEnd={(e) => {
        // Stage drag = pan. Only update when the stage itself moved.
        if (e.target === e.target.getStage()) {
          setPos({ x: e.target.x(), y: e.target.y() });
        }
      }}
      style={{
        background: "#0f172a",
        cursor: mode === "draw" ? "crosshair" : "default",
      }}
    >
      {/* Background grid */}
      <KonvaLayer listening={false}>
        <Rect
          x={-pos.x / scale}
          y={-pos.y / scale}
          width={width / scale}
          height={height / scale}
          fill="#0f172a"
        />
        {gridLines.map((l, i) => (
          <Line key={i} points={l} stroke="#1e293b" strokeWidth={1 / scale} />
        ))}
      </KonvaLayer>

      {/* Links (drawn beneath bubbles) */}
      <KonvaLayer>
        {layer.links.map((link) => {
          const a = bubbleById.get(link.fromBubbleId);
          const b = bubbleById.get(link.toBubbleId);
          if (!a || !b) return null;
          const selected = link.id === selectedLinkId;
          return (
            <Line
              key={link.id}
              points={[a.x, a.y, b.x, b.y]}
              stroke={selected ? "#f87171" : "#64748b"}
              strokeWidth={selected ? 4 : 2.5}
              hitStrokeWidth={14}
              onClick={(e) => {
                e.cancelBubble = true;
                if (mode !== "draw") selectLink(link.id);
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                if (mode !== "draw") selectLink(link.id);
              }}
            />
          );
        })}
      </KonvaLayer>

      {/* Bubbles */}
      <KonvaLayer>
        {layer.bubbles.map((b) => {
          const isSelected = b.id === selectedBubbleId;
          const isPending = b.id === pendingConnectId;
          return (
            <Group
              key={b.id}
              x={b.x}
              y={b.y}
              draggable={mode === "select"}
              onDragMove={(e) => {
                // live-update so links follow during drag
                moveBubble(b.id, e.target.x(), e.target.y());
              }}
              onClick={(e) => {
                e.cancelBubble = true;
                onBubbleClick(b);
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                onBubbleClick(b);
              }}
            >
              <Circle
                radius={b.radius}
                fill={b.color}
                opacity={0.85}
                stroke={
                  isPending ? "#fde047" : isSelected ? "#ffffff" : "#0b1220"
                }
                strokeWidth={isPending || isSelected ? 4 : 1.5}
                shadowColor="black"
                shadowBlur={6}
                shadowOpacity={0.3}
              />
              <BubbleLabel
                label={b.label}
                radius={b.radius}
                value={b.value}
              />
            </Group>
          );
        })}
      </KonvaLayer>

      {/* Drawings + measurements */}
      <KonvaLayer>
        {layer.drawings.map((d) => (
          <Group key={d.id}>
            <Line
              points={d.points}
              stroke="#f59e0b"
              strokeWidth={2.5}
              dash={[8, 4]}
            />
            {segmentLabels(d.points, ppm).map((s, i) => (
              <Text
                key={i}
                x={s.x}
                y={s.y}
                text={s.text}
                fontSize={12}
                fontStyle="bold"
                fill="#fbbf24"
                listening={false}
              />
            ))}
          </Group>
        ))}

        {/* Draft (in-progress) line */}
        {draftPreview && (
          <Group>
            <Line
              points={draftPreview}
              stroke="#fde047"
              strokeWidth={2.5}
              dash={[6, 4]}
            />
            {segmentLabels(draftPreview, ppm).map((s, i) => (
              <Text
                key={i}
                x={s.x}
                y={s.y}
                text={s.text}
                fontSize={12}
                fontStyle="bold"
                fill="#fde047"
                listening={false}
              />
            ))}
          </Group>
        )}
      </KonvaLayer>
    </Stage>
  );
});

// --- geometry helpers ---

function polylineLengthMeters(points: number[], ppm: number): number {
  let px = 0;
  for (let i = 2; i < points.length; i += 2) {
    const dx = points[i] - points[i - 2];
    const dy = points[i + 1] - points[i - 1];
    px += Math.hypot(dx, dy);
  }
  return px / ppm;
}

function segmentLabels(
  points: number[],
  ppm: number
): { x: number; y: number; text: string }[] {
  const labels: { x: number; y: number; text: string }[] = [];
  for (let i = 2; i < points.length; i += 2) {
    const x1 = points[i - 2];
    const y1 = points[i - 1];
    const x2 = points[i];
    const y2 = points[i + 1];
    const meters = Math.hypot(x2 - x1, y2 - y1) / ppm;
    if (meters < 0.001) continue;
    labels.push({
      x: (x1 + x2) / 2 + 6,
      y: (y1 + y2) / 2 - 16,
      text: `${meters.toFixed(2)} m`,
    });
  }
  // total at the end
  const total = polylineLengthMeters(points, ppm);
  if (points.length >= 6 && total > 0) {
    labels.push({
      x: points[points.length - 2] + 6,
      y: points[points.length - 1] + 6,
      text: `Σ ${total.toFixed(2)} m`,
    });
  }
  return labels;
}

export default Canvas;
