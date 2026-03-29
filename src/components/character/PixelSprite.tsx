"use client";
import {
  buildSprite,
  DEFAULT_APPEARANCE,
  getArchetypePalette,
} from "@/lib/characterEngine";
import type { ArchetypePalette } from "@/lib/characterEngine";
import type { CharacterAppearance, StateSignal } from "@/types";

function getColor(pixel: string, palette: ArchetypePalette): string | null {
  switch (pixel) {
    case "H":
      return palette.hair;
    case "k":
      return "#0F0F23";
    case "S":
      return "#F5C6A0";
    case "W":
      return "#FFFFFF";
    case "E":
      return palette.eye;
    case "C":
      return palette.shirt;
    case "P":
      return "#1E293B";
    case "B":
      return "#374151";
    default:
      return null;
  }
}

interface Props {
  palette: ArchetypePalette;
  scale?: number;
  animated?: boolean;
  signals?: StateSignal[];
  appearance?: CharacterAppearance;
}

export default function PixelSprite({
  palette,
  scale = 4,
  animated = true,
  signals = [],
  appearance = DEFAULT_APPEARANCE,
}: Props) {
  const W = 16 * scale;
  const H = 20 * scale;
  const sprite = buildSprite(appearance);

  const isSurging = signals.includes("surging");
  const isDrifting = signals.includes("drifting");
  const isStretched = signals.includes("stretched");

  const animDuration = isSurging ? "1s" : isDrifting ? "3.5s" : "2s";
  const glowColor = isStretched
    ? "#F97316"
    : isSurging
      ? "#F59E0B"
      : palette.glow;

  return (
    <div
      style={{
        width: W,
        height: H,
        imageRendering: "pixelated",
        filter: `drop-shadow(${
          isStretched
            ? "0 0 6px #F9731688"
            : isSurging
              ? "0 0 8px #F59E0B88"
              : `0 0 4px ${palette.glow}44`
        })`,
        animation: animated
          ? `idle-bob ${animDuration} ease-in-out infinite`
          : undefined,
        flexShrink: 0,
      }}
    >
      <svg
        width={W}
        height={H}
        viewBox="0 0 16 20"
        xmlns="http://www.w3.org/2000/svg"
        style={{ imageRendering: "pixelated", display: "block" }}
      >
        {sprite.flatMap((row, rowIdx) =>
          row.split("").map((pixel, colIdx) => {
            const fill = getColor(pixel, palette);
            if (!fill) return null;
            return (
              <rect
                key={`${rowIdx}-${colIdx}`}
                x={colIdx}
                y={rowIdx}
                width={1}
                height={1}
                fill={fill}
              />
            );
          }),
        )}
      </svg>
    </div>
  );
}
