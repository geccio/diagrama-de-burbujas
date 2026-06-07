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
  Image as KonvaImage,
} from "react-konva";
import type Konva from "konva";
import { useDiagram } from "@/store/useDiagram";
import type { Bubble, Background } from "@/lib/types";
import { uid } from "@/lib/id";
import BubbleLabel from "@/components/BubbleLabel";
import { canvasColors } from "@/lib/themeColors";
import { CATEGORIES, type CategoryId } from "@/lib/categories";

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
  const colors = canvasColors(diagram.theme);

  const selectedBubbleId = useDiagram((s) => s.selectedBubbleId);
  const selectedLinkId = useDiagram((s) => s.selectedLinkId);
  const pendingConnectId = useDiagram((s) => s.pendingConnectId);

  const selectBubble = useDiagram((s) => s.selectBubble);
  const selectLink = useDiagram((s) => s.selectLink);
  const moveBubble = useDiagram((s) => s.moveBubble);
  const handleBubbleConnectClick = useDiagram((s) => s.handleBubbleConnectClick);
  const addDrawing = useDiagram((s) => s.addDrawing);
  const pushHistory = useDiagram((s) => s.pushHistory);
  const updateBackground = useDiagram((s) => s.updateBackground);
  const fitRequest = useDiagram((s) => s.fitRequest);
  const background = layer.background;

  // pan/zoom state
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // in-progress measure line
  const [draft, setDraft] = useState<DraftLine | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  // hovered bubble (for tooltip)
  const [hoverId, setHoverId] = useState<string | null>(null);

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

  // Zoom-to-fit when requested: frame all bubbles (+ drawings) in view.
  useEffect(() => {
    if (fitRequest === 0) return;
    const items = layer.bubbles;
    if (items.length === 0) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const b of items) {
      minX = Math.min(minX, b.x - b.radius);
      minY = Math.min(minY, b.y - b.radius);
      maxX = Math.max(maxX, b.x + b.radius);
      maxY = Math.max(maxY, b.y + b.radius);
    }
    for (const d of layer.drawings) {
      for (let i = 0; i < d.points.length; i += 2) {
        minX = Math.min(minX, d.points[i]);
        maxX = Math.max(maxX, d.points[i]);
        minY = Math.min(minY, d.points[i + 1]);
        maxY = Math.max(maxY, d.points[i + 1]);
      }
    }
    const pad = 60;
    const contentW = maxX - minX + pad * 2;
    const contentH = maxY - minY + pad * 2;
    const newScale = Math.min(
      2,
      Math.max(0.15, Math.min(width / contentW, height / contentH))
    );
    setScale(newScale);
    setPos({
      x: width / 2 - ((minX + maxX) / 2) * newScale,
      y: height / 2 - ((minY + maxY) / 2) * newScale,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRequest]);

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
        background: colors.bg,
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
          fill={colors.bg}
        />
        {gridLines.map((l, i) => (
          <Line
            key={i}
            points={l}
            stroke={colors.grid}
            strokeWidth={1 / scale}
          />
        ))}
      </KonvaLayer>

      {/* Background floor-plan image (under bubbles) */}
      {background && (
        <KonvaLayer>
          <BackgroundImage
            bg={background}
            draggable={mode === "select" && !background.locked}
            onChange={(patch) => updateBackground(patch)}
            onDragStart={pushHistory}
          />
        </KonvaLayer>
      )}

      {/* Links (drawn beneath bubbles) */}
      <KonvaLayer>
        {layer.links.map((link) => {
          const a = bubbleById.get(link.fromBubbleId);
          const b = bubbleById.get(link.toBubbleId);
          if (!a || !b) return null;
          const selected = link.id === selectedLinkId;
          const dashed = link.kind === "dashed";
          return (
            <Line
              key={link.id}
              points={[a.x, a.y, b.x, b.y]}
              stroke={selected ? "#ef4444" : colors.link}
              strokeWidth={selected ? 4 : 2.5}
              dash={dashed ? [9, 7] : undefined}
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
              onDragStart={() => pushHistory()}
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
              onMouseEnter={() => setHoverId(b.id)}
              onMouseLeave={() => setHoverId((id) => (id === b.id ? null : id))}
            >
              <Circle
                radius={b.radius}
                fill={b.color}
                opacity={isSelected || b.id === hoverId ? 0.95 : 0.85}
                stroke={
                  isPending
                    ? "#fde047"
                    : isSelected
                    ? colors.label === "#0b1220"
                      ? "#0f172a"
                      : "#ffffff"
                    : "rgba(15,23,42,0.35)"
                }
                strokeWidth={isPending || isSelected ? 4 : 1.5}
                shadowColor="black"
                shadowBlur={b.id === hoverId ? 12 : 6}
                shadowOpacity={b.id === hoverId ? 0.35 : 0.2}
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

      {/* Hover tooltip (full details) */}
      <KonvaLayer listening={false}>
        {(() => {
          if (!hoverId) return null;
          const b = bubbleById.get(hoverId);
          if (!b) return null;
          return (
            <BubbleTooltip
              x={b.x}
              y={b.y - b.radius - 8}
              label={b.label}
              category={b.category}
              value={b.value}
              scale={scale}
            />
          );
        })()}
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

// --- background floor-plan image ---

function BackgroundImage({
  bg,
  draggable,
  onChange,
  onDragStart,
}: {
  bg: Background;
  draggable: boolean;
  onChange: (patch: Partial<Background>) => void;
  onDragStart: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const image = new window.Image();
    image.src = bg.src;
    image.onload = () => setImg(image);
    return () => {
      image.onload = null;
    };
  }, [bg.src]);

  if (!img) return null;

  return (
    <KonvaImage
      image={img}
      x={bg.x}
      y={bg.y}
      width={bg.width}
      height={bg.height}
      opacity={bg.opacity}
      draggable={draggable}
      onDragStart={() => draggable && onDragStart()}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      // Subtle cursor hint when movable.
      onMouseEnter={(e) => {
        if (draggable) {
          const stage = e.target.getStage();
          if (stage) stage.container().style.cursor = "move";
        }
      }}
      onMouseLeave={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "default";
      }}
    />
  );
}

// --- tooltip ---

function BubbleTooltip({
  x,
  y,
  label,
  category,
  value,
  scale,
}: {
  x: number;
  y: number;
  label: string;
  category?: CategoryId;
  value?: number;
  scale: number;
}) {
  const cat = category ? CATEGORIES[category] : undefined;
  const lines = [
    label,
    cat ? cat.label : null,
    typeof value === "number" ? `${value} m²` : null,
  ].filter(Boolean) as string[];

  // Counter-scale so the tooltip stays a constant on-screen size regardless of
  // canvas zoom. Width estimated from the longest line.
  const inv = 1 / scale;
  const pad = 8;
  const lineH = 16;
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  const w = Math.min(280, Math.max(90, longest * 7 + pad * 2));
  const h = lines.length * lineH + pad * 2;

  return (
    <Group x={x} y={y} scaleX={inv} scaleY={inv} offsetX={w / 2} offsetY={h}>
      <Rect
        width={w}
        height={h}
        cornerRadius={8}
        fill="#0f172a"
        opacity={0.95}
        shadowColor="black"
        shadowBlur={10}
        shadowOpacity={0.4}
      />
      {cat && (
        <Circle x={pad + 4} y={pad + 6} radius={4} fill={cat.color} />
      )}
      {lines.map((ln, i) => (
        <Text
          key={i}
          text={ln}
          x={pad + (i === 1 && cat ? 14 : 0)}
          y={pad + i * lineH}
          width={w - pad * 2}
          fontSize={i === 0 ? 13 : 11}
          fontStyle={i === 0 ? "bold" : "normal"}
          fill={i === 0 ? "#f1f5f9" : "#94a3b8"}
          wrap="none"
          ellipsis
        />
      ))}
    </Group>
  );
}

export default Canvas;
