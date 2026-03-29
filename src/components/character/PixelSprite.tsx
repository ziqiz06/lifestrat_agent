"use client";
import {
  buildSprite,
  DEFAULT_APPEARANCE,
} from "@/lib/characterEngine";
import type { ArchetypePalette } from "@/lib/characterEngine";
import type { CharacterAppearance, StateSignal } from "@/types";

function getColor(pixel: string, palette: ArchetypePalette): string | null {
  switch (pixel) {
    case "H": return palette.hair;
    case "k": return "#0F0F23";
    case "S": return "#F5C6A0";
    case "W": return "#FFFFFF";
    case "E": return palette.eye;
    case "C": return palette.shirt;
    case "P": return "#1E293B";
    case "B": return "#374151";
    case "A": return palette.eye; // accent trim — bright archetype color
    default:  return null;
  }
}

export type SpritePose = 'idle' | 'think' | 'ponder';

interface Props {
  palette: ArchetypePalette;
  scale?: number;
  animated?: boolean;
  signals?: StateSignal[];
  appearance?: CharacterAppearance;
  level?: number;
  pose?: SpritePose;
}

export default function PixelSprite({
  palette,
  scale = 4,
  animated = true,
  signals = [],
  appearance = DEFAULT_APPEARANCE,
  level = 1,
  pose = 'idle',
}: Props) {
  const W = 16 * scale;
  const H = 20 * scale;
  const sprite = buildSprite(appearance, level);

  const isSurging = signals.includes("surging");
  const isDrifting = signals.includes("drifting");
  const isStretched = signals.includes("stretched");

  const baseAnimDuration = isSurging ? "1s" : isDrifting ? "3.5s" : "2s";
  const glowColor = isStretched
    ? "#F97316"
    : isSurging
      ? "#F59E0B"
      : palette.glow;

  const animationName =
    !animated ? undefined
    : pose === 'think'  ? `think-bob`
    : pose === 'ponder' ? `ponder-bob`
    : `idle-bob`;
  const animDuration =
    pose === 'think'  ? "3.2s"
    : pose === 'ponder' ? "2.4s"
    : baseAnimDuration;

  // Glow radius intensifies at higher levels
  const glowRadius = level >= 7 ? 10 : level >= 5 ? 7 : level >= 3 ? 5 : 4;
  const glowAlpha = level >= 7 ? "bb" : level >= 5 ? "88" : "55";

  return (
    <div
      style={{
        width: W,
        height: H,
        imageRendering: "pixelated",
        filter: `drop-shadow(0 0 ${isStretched ? 6 : isSurging ? 8 : glowRadius}px ${
          isStretched ? "#F9731688" : isSurging ? "#F59E0B88" : `${glowColor}${glowAlpha}`
        })`,
        animation: animationName
          ? `${animationName} ${animDuration} ease-in-out infinite`
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
