"use client";

import { useMemo } from "react";
import { Text } from "react-konva";
import { fitBubbleLabel } from "@/lib/fitText";

interface Props {
  label: string;
  radius: number;
  value?: number;
}

/**
 * Renders a bubble's label (auto-sized + truncated to fit the circle) plus an
 * optional area value line beneath it. Text is dark on the colored fill.
 */
export default function BubbleLabel({ label, radius, value }: Props) {
  const hasValue = typeof value === "number" && isFinite(value);
  const reserve = hasValue ? Math.max(12, radius * 0.34) : 0;

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
          y={radius * 0.42}
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
