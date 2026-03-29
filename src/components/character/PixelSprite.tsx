"use client";
import { ArchetypePalette } from "@/lib/characterEngine";
import { StateSignal } from "@/types";

// ── 16×20 pixel sprite definition ─────────────────────────────────────────────
// Pixel codes: . transparent  H hair  k outline  S skin  W eye-white
//              E eye-pupil    C shirt  P pants    B boot
const SPRITE: string[] = [
  "....HHHHHHHH....", // 0  hair top
  "...HHHHHHHHHH...", // 1  hair
  "..kHHHHHHHHHHk..", // 2  hair outlined
  "..kHHHHHHHHHHk..", // 3  hair outlined
  "..kSSSSSSSSSSk..", // 4  forehead
  "..kSWEWSSWEWSk..", // 5  eyes (W=white E=pupil)
  "..kSWkWSSWkWSk..", // 6  pupils
  "..kSSSSSSSSSSk..", // 7  mid face
  "..kSSSkkkkSSSk..", // 8  smile
  "..kSSSSSSSSSSk..", // 9  chin
  "..kCCCCCCCCCCk..", // 10 collar
  ".kCCCCCCCCCCCCk.", // 11 shirt (wider)
  ".kCCCCCCCCCCCCk.", // 12 shirt
  ".kCCCCCCCCCCCCk.", // 13 shirt lower
  "kCk.kPPPPPPk.kCk", // 14 arms + legs
  "kCk.kPPPPPPk.kCk", // 15 arms + legs
  ".k..kPPPPPPk..k.", // 16 lower legs
  "....kBBBBBBk....", // 17 boots
  "....kBBBBBBk....", // 18 boots
  "....kkkkkkkk....", // 19 boot soles
];

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
    default:  return null; // "." and unknown = transparent
  }
}

interface Props {
  palette: ArchetypePalette;
  scale?: number;          // px per pixel, default 4
  animated?: boolean;
  signals?: StateSignal[];
}

export default function PixelSprite({ palette, scale = 4, animated = true, signals = [] }: Props) {
  const W = 16 * scale;
  const H = 20 * scale;

  const isSurging   = signals.includes("surging");
  const isDrifting  = signals.includes("drifting");
  const isStretched = signals.includes("stretched");

  const animDuration = isSurging ? "1s" : isDrifting ? "3.5s" : "2s";
  const glowColor    = isStretched ? "#F97316" : isSurging ? "#F59E0B" : palette.glow;
  const glowIntensity = (isSurging || isStretched) ? `0 0 12px 4px ${glowColor}44` : `0 0 8px 2px ${glowColor}22`;

  return (
    <div
      style={{
        width: W,
        height: H,
        imageRendering: "pixelated",
        filter: `drop-shadow(${isStretched ? "0 0 6px #F9731688" : isSurging ? "0 0 8px #F59E0B88" : `0 0 4px ${palette.glow}44`})`,
        animation: animated ? `idle-bob ${animDuration} ease-in-out infinite` : undefined,
        flexShrink: 0,
      }}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 16 20`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ imageRendering: "pixelated", display: "block" }}
      >
        {SPRITE.flatMap((row, rowIdx) =>
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
          })
        )}
      </svg>
    </div>
  );
}
