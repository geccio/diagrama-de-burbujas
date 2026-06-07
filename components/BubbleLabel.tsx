"use client";

import { useMemo } from "react";
import { Text } from "react-konva";
import { fitBubbleLabel } from "@/lib/fitText";

interface Props {
  label: string;
  radius: number;
  value?: number;
  floor?: string;
}

/**
 * Renders a bubble's label (auto-sized + truncated to fit the circle) plus an
 * optional area value + floor line beneath it. Text is dark on the colored fill.
 */
export default function BubbleLabel({ label, radius, value, floor }: Props) {
  const hasValue = typeof value === "number" && isFinite(value);
  const hasFloor = !!floor && radius >= 34;
  // Reserve space for whichever sub-lines we'll show.
  const subLines = (hasValue ? 1 : 0) + (hasFloor ? 1 : 0);
  const reserve = subLines > 0 ? Math.max(12, radius * 0.3 * subLines) : 0;

  const fit = useMemo(
    () => fitBubbleLabel(label || "(blank)", radius, reserve),
    [label, radius, reserve]
  );

  const valueFont = Math.max(9, Math.min(13, radius * 0.22));

  return (
    <>
      <Text
        text={fit.text}
        fontSize={fit.fontSize}
        fontStyle="bold"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="#0b1220"
        width={fit.boxWidth}
        height={radius * 2}
        offsetX={fit.boxWidth / 2}
        offsetY={radius}
        // Nudge the label up a touch when a value line is shown.
        y={hasValue ? -reserve / 2 : 0}
        align="center"
        verticalAlign="middle"
        // fitBubbleLabel already inserts explicit line breaks; disable Konva's
        // own wrapping so it doesn't character-split words (e.g. "Ban o").
        wrap="none"
        lineHeight={1.15}
        listening={false}
      />
      {hasValue && (
        <Text
          text={`${formatValue(value!)} m²`}
          fontSize={valueFont}
          fontStyle="bold"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fill="#1e293b"
          width={radius * 2}
          offsetX={radius}
          // Place the value line in the lower portion of the circle.
          y={radius * (hasFloor ? 0.34 : 0.42)}
          align="center"
          listening={false}
        />
      )}
      {hasFloor && (
        <Text
          text={floor!}
          fontSize={Math.max(8, Math.min(11, radius * 0.18))}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fill="#334155"
          width={radius * 2}
          offsetX={radius}
          y={radius * (hasValue ? 0.6 : 0.46)}
          align="center"
          listening={false}
        />
      )}
    </>
  );
}

function formatValue(v: number): string {
  // Avoid long decimals; keep up to 2 decimals when needed.
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
}
