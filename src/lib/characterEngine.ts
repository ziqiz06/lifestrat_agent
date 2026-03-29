import type {
  CalendarTask,
  CharacterStats,
  StateSignal,
  StatSnapshot,
  Character,
  CharacterAppearance,
  HairStyle,
  EyeStyle,
  FaceShape,
} from "@/types";

// ── Sprite building system ─────────────────────────────────────────────────────
// Each row is exactly 16 characters. Pixel codes:
//   . = transparent  H = hair  k = outline  S = skin
//   W = eye-white    E = eye-pupil  C = shirt  P = pants  B = boot

const HAIR_ROWS: Record<HairStyle, string[]> = {
  medium: [
    "....HHHHHHHH....",
    "...HHHHHHHHHH...",
    "..kHHHHHHHHHHk..",
    "..kHHHHHHHHHHk..",
  ],
  short: [
    "....HHHHHHHH....",
    "..kHHHHHHHHHHk..",
    "..kSSSSSSSSSSk..",
    "..kSSSSSSSSSSk..",
  ],
  long: [
    ".H..HHHHHHHH..H.",
    ".HkHHHHHHHHHHkH.",
    ".HkHHHHHHHHHHkH.",
    "..kHHHHHHHHHHk..",
  ],
  spiky: [
    "...H.HH.HH.H....",
    "..kHHHHHHHHHHk..",
    "..kHHHHHHHHHHk..",
    "..kHHHHHHHHHHk..",
  ],
};

const EYE_ROWS: Record<EyeStyle, [string, string]> = {
  default: ["..kSWEWSSWEWSk..", "..kSWkWSSWkWSk.."],
  wide: ["..kSWEESSEEWSk..", "..kSWkESSEkWSk.."],
  narrow: ["..kSSSSSSSSSSk..", "..kSSESSSSESSk.."],
};

interface FaceRows {
  forehead: string;
  mid: string;
  mouth: string;
  chin: string;
}

const FACE_ROWS: Record<FaceShape, FaceRows> = {
  round: {
    forehead: "..kSSSSSSSSSSk..",
    mid: "..kSSSSSSSSSSk..",
    mouth: "..kSSSkkkkSSSk..",
    chin: "..kSSSSSSSSSSk..",
  },
  angular: {
    forehead: "..kSSSSSSSSSSk..",
    mid: "..kSSSSSSSSSSk..",
    mouth: "..kSSSkkkSSSSk..",
    chin: "..kSSSSSSSSSSk..",
  },
  soft: {
    forehead: "..kSSSSSSSSSSk..",
    mid: "..kSSSSSSSSSSk..",
    mouth: "..kSSSSkkSSSSk..",
    chin: "..kSSSSSSSSSSk..",
  },
};

const BODY_ROWS: string[] = [
  "..kCCCCCCCCCCk..", // 10 collar
  ".kCCCCCCCCCCCCk.", // 11 shirt
  ".kCCCCCCCCCCCCk.", // 12 shirt
  ".kCCCCCCCCCCCCk.", // 13 shirt lower
  "kCk.kPPPPPPk.kCk", // 14 arms + legs
  "kCk.kPPPPPPk.kCk", // 15 arms + legs
  ".k..kPPPPPPk..k.", // 16 lower legs
  "....kBBBBBBk....", // 17 boots
  "....kBBBBBBk....", // 18 boots
  "....kkkkkkkk....", // 19 boot soles
];

export const DEFAULT_APPEARANCE: CharacterAppearance = {
  hairStyle: "medium",
  eyeStyle: "default",
  faceShape: "round",
};

/** Assemble a full 16×20 sprite from the chosen appearance parts. */
export function buildSprite(
  appearance: CharacterAppearance = DEFAULT_APPEARANCE,
): string[] {
  const hair = HAIR_ROWS[appearance.hairStyle] ?? HAIR_ROWS.medium;
  const eyes = EYE_ROWS[appearance.eyeStyle] ?? EYE_ROWS.default;
  const face = FACE_ROWS[appearance.faceShape] ?? FACE_ROWS.round;
  return [
    ...hair, // rows 0-3
    face.forehead, // row 4
    eyes[0], // row 5
    eyes[1], // row 6
    face.mid, // row 7
    face.mouth, // row 8
    face.chin, // row 9
    ...BODY_ROWS, // rows 10-19
  ];
}

// ── Appearance option metadata (for customisation UI) ─────────────────────────
export const HAIR_OPTIONS: {
  value: HairStyle;
  label: string;
  icon: string;
  desc: string;
}[] = [
  { value: "medium", label: "Medium", icon: "💇", desc: "Shoulder-length" },
  { value: "short", label: "Short", icon: "✂️", desc: "Close-cropped" },
  { value: "long", label: "Long", icon: "🌊", desc: "Flowing strands" },
  { value: "spiky", label: "Spiky", icon: "⚡", desc: "Wild spikes" },
];

export const EYE_OPTIONS: {
  value: EyeStyle;
  label: string;
  icon: string;
  desc: string;
}[] = [
  { value: "default", label: "Round", icon: "👁️", desc: "Classic circular" },
  { value: "wide", label: "Wide", icon: "✨", desc: "Expressive & bright" },
  { value: "narrow", label: "Calm", icon: "😌", desc: "Gentle slits" },
];

export const FACE_OPTIONS: {
  value: FaceShape;
  label: string;
  icon: string;
  desc: string;
}[] = [
  { value: "round", label: "Round", icon: "⭕", desc: "Soft oval" },
  { value: "angular", label: "Sharp", icon: "💎", desc: "Defined edges" },
  { value: "soft", label: "Soft", icon: "🌸", desc: "Gentle curves" },
];

// ── Stat boosts per calendar task type ────────────────────────────────────────
const TASK_BOOSTS: Record<string, Partial<CharacterStats>> = {
  internship_application: { career: 5, focus: 3 },
  company_research: { career: 3, focus: 4, exploration: 2 },
  resume_update: { career: 4, focus: 3 },
  networking: { social: 5, career: 3, exploration: 1 },
  career_fair: { career: 4, social: 4, exploration: 2 },
  workshop: { focus: 3, career: 2, exploration: 3 },
  class: { focus: 5, career: 1 },
  deadline: { focus: 3, career: 4 },
  free_time: { vitality: 5, exploration: 1 },
  entertainment: { vitality: 4 },
  other: { exploration: 3, vitality: 1 },
};

const BASE: CharacterStats = {
  focus: 20,
  career: 20,
  vitality: 20,
  social: 20,
  exploration: 20,
};

// ── Stat computation (recency-weighted, with stability buffer) ─────────────────
export function computeStats(tasks: CalendarTask[]): CharacterStats {
  const stats = { ...BASE };
  const now = Date.now();

  for (const task of tasks) {
    if (task.confirmed === false) continue;
    const boosts = TASK_BOOSTS[task.type];
    if (!boosts) continue;

    const days =
      (now - new Date(task.date + "T00:00:00").getTime()) / 86_400_000;
    // Stability buffer: full credit for 7 days, then graceful decay
    const weight =
      days <= 7 ? 1.0 : days <= 14 ? 0.65 : days <= 30 ? 0.35 : 0.15;

    for (const [k, v] of Object.entries(boosts) as [
      keyof CharacterStats,
      number,
    ][]) {
      stats[k] = Math.min(100, stats[k] + v * weight);
    }
  }

  return {
    focus: Math.round(stats.focus),
    career: Math.round(stats.career),
    vitality: Math.round(stats.vitality),
    social: Math.round(stats.social),
    exploration: Math.round(stats.exploration),
  };
}

// ── Level derived from total stats (max level ~10) ────────────────────────────
export function getLevel(stats: CharacterStats): number {
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  return Math.max(1, Math.floor(total / 75));
}

export function getLevelProgress(stats: CharacterStats): {
  current: number;
  needed: number;
  pct: number;
} {
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  const level = getLevel(stats);
  const current = total - level * 75;
  const needed = 75;
  return { current, needed, pct: Math.round((current / needed) * 100) };
}

// ── Archetype from dominant stat ──────────────────────────────────────────────
export function getArchetype(stats: CharacterStats): string {
  const vals = Object.values(stats);
  if (Math.max(...vals) - Math.min(...vals) < 12) return "The Sage";
  const dominant = (
    Object.entries(stats) as [keyof CharacterStats, number][]
  ).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  return (
    {
      focus: "The Scholar",
      career: "The Strategist",
      vitality: "The Wanderer",
      social: "The Connector",
      exploration: "The Pioneer",
    }[dominant] ?? "The Adventurer"
  );
}

// ── State signals (gentle, observational, character-centric) ──────────────────
export function detectSignals(stats: CharacterStats): StateSignal[] {
  const vals = Object.values(stats);
  const avg = vals.reduce((a, b) => a + b, 0) / 5;
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const signals: StateSignal[] = [];

  if (avg < 28) signals.push("drifting");
  if (max - min > 38) signals.push("narrowing");
  if (stats.vitality < 25 && (stats.focus > 60 || stats.career > 60))
    signals.push("stretched");
  if (stats.social < 22) signals.push("isolated");
  if (stats.exploration > 62 && stats.focus < 35) signals.push("restless");
  if (avg > 70 && max - min < 20) signals.push("surging");
  else if (avg > 52 && max - min < 18) signals.push("finding_rhythm");

  return signals.length > 0 ? signals : ["steady"];
}

// ── Synthetic history seed (7-day build-up for the trend graph) ───────────────
export function seedHistory(stats: CharacterStats): StatSnapshot[] {
  return Array.from({ length: 7 }, (_, i) => {
    const factor = (i + 1) / 7;
    const jitter = () => Math.round((Math.random() - 0.5) * 4);
    return {
      date: new Date(Date.now() - (6 - i) * 86_400_000)
        .toISOString()
        .slice(0, 10),
      stats: {
        focus: Math.max(
          20,
          Math.round(20 + (stats.focus - 20) * factor + jitter()),
        ),
        career: Math.max(
          20,
          Math.round(20 + (stats.career - 20) * factor + jitter()),
        ),
        vitality: Math.max(
          20,
          Math.round(20 + (stats.vitality - 20) * factor + jitter()),
        ),
        social: Math.max(
          20,
          Math.round(20 + (stats.social - 20) * factor + jitter()),
        ),
        exploration: Math.max(
          20,
          Math.round(20 + (stats.exploration - 20) * factor + jitter()),
        ),
      },
    };
  });
}

// ── Archetype colour palettes ─────────────────────────────────────────────────
export interface ArchetypePalette {
  hair: string;
  eye: string;
  shirt: string;
  glow: string;
  accent: string;
}

export function getArchetypePalette(archetype: string): ArchetypePalette {
  const map: Record<string, ArchetypePalette> = {
    "The Scholar": {
      hair: "#7C3AED",
      eye: "#A78BFA",
      shirt: "#4F46E5",
      glow: "#6366F1",
      accent: "#EDE9FE",
    },
    "The Strategist": {
      hair: "#1E40AF",
      eye: "#60A5FA",
      shirt: "#1D4ED8",
      glow: "#3B82F6",
      accent: "#DBEAFE",
    },
    "The Wanderer": {
      hair: "#166534",
      eye: "#4ADE80",
      shirt: "#15803D",
      glow: "#22C55E",
      accent: "#DCFCE7",
    },
    "The Connector": {
      hair: "#9D174D",
      eye: "#F472B6",
      shirt: "#BE185D",
      glow: "#EC4899",
      accent: "#FCE7F3",
    },
    "The Pioneer": {
      hair: "#9A3412",
      eye: "#FB923C",
      shirt: "#C2410C",
      glow: "#F97316",
      accent: "#FFEDD5",
    },
    "The Sage": {
      hair: "#5B21B6",
      eye: "#C4B5FD",
      shirt: "#6D28D9",
      glow: "#8B5CF6",
      accent: "#EDE9FE",
    },
  };
  return map[archetype] ?? map["The Sage"];
}

// ── Stat display metadata ─────────────────────────────────────────────────────
export const STAT_META: Record<
  keyof CharacterStats,
  { label: string; icon: string; color: string; desc: string }
> = {
  focus: {
    label: "Focus",
    icon: "🧠",
    color: "#818CF8",
    desc: "Deep work, learning, concentration",
  },
  career: {
    label: "Career",
    icon: "💼",
    color: "#60A5FA",
    desc: "Applications, networking, professional growth",
  },
  vitality: {
    label: "Vitality",
    icon: "💚",
    color: "#4ADE80",
    desc: "Rest, personal time, recovery",
  },
  social: {
    label: "Social",
    icon: "🤝",
    color: "#F472B6",
    desc: "Connections, events, community",
  },
  exploration: {
    label: "Exploration",
    icon: "🌟",
    color: "#FB923C",
    desc: "New experiences, curiosity, breadth",
  },
};

// ── Signal display metadata ───────────────────────────────────────────────────
export const SIGNAL_META: Record<
  StateSignal,
  {
    label: string;
    desc: (name: string) => string;
    color: string;
    bg: string;
    icon: string;
  }
> = {
  finding_rhythm: {
    label: "Finding Rhythm",
    desc: (n) =>
      `${n} is moving in harmony — growth feels steady and natural across all dimensions.`,
    color: "#22C55E",
    bg: "bg-green-950/40 border-green-800/40",
    icon: "🎵",
  },
  surging: {
    label: "Surging",
    desc: (n) =>
      `${n} is in a season of broad, rapid growth. The world feels expansive.`,
    color: "#F59E0B",
    bg: "bg-yellow-950/40 border-yellow-800/40",
    icon: "⚡",
  },
  narrowing: {
    label: "Narrowing",
    desc: (n) =>
      `${n}'s path has grown focused in one direction. Other dimensions are waiting quietly to be revisited.`,
    color: "#A78BFA",
    bg: "bg-violet-950/40 border-violet-800/40",
    icon: "🔍",
  },
  drifting: {
    label: "Drifting",
    desc: (n) =>
      `${n} seems to be in a quieter season. A small spark of intention can shift momentum quickly.`,
    color: "#94A3B8",
    bg: "bg-gray-800/60 border-gray-600/40",
    icon: "🌫️",
  },
  stretched: {
    label: "Feeling the Pull",
    desc: (n) =>
      `${n} has been giving a lot to Career and Focus lately. A moment of stillness might open deeper clarity.`,
    color: "#F97316",
    bg: "bg-orange-950/40 border-orange-800/40",
    icon: "🌊",
  },
  isolated: {
    label: "Growing Quiet",
    desc: (n) =>
      `${n}'s world has become a little solitary. Even a brief connection could open new paths.`,
    color: "#EC4899",
    bg: "bg-pink-950/40 border-pink-800/40",
    icon: "🌙",
  },
  restless: {
    label: "Restless",
    desc: (n) =>
      `${n} is drawn toward the new and uncharted. Some grounding might help turn curiosity into depth.`,
    color: "#FB923C",
    bg: "bg-orange-950/40 border-orange-800/40",
    icon: "🌪️",
  },
  steady: {
    label: "Steady",
    desc: (n) =>
      `${n} is holding ground — present, balanced, and ready for whatever comes next.`,
    color: "#6B7280",
    bg: "bg-gray-800/60 border-gray-600/40",
    icon: "⚓",
  },
};

// ── Character-centric suggestions ─────────────────────────────────────────────
export function getSuggestions(char: Character): string[] {
  const { name, signals, archetype, stats } = char;
  const out: string[] = [];

  if (signals.includes("stretched"))
    out.push(
      `${name} has been giving a lot to growth lately. Even small pockets of stillness restore more energy than they seem to cost.`,
    );
  if (signals.includes("isolated"))
    out.push(
      `${name}'s world has grown quieter. A single conversation this week could shift the texture of everything else.`,
    );
  if (signals.includes("drifting"))
    out.push(
      `${name} seems to be in a gentler season. The momentum is still there — it just needs a small trigger to start flowing again.`,
    );
  if (signals.includes("narrowing")) {
    const dom = (Object.entries(stats) as [string, number][]).reduce((a, b) =>
      b[1] > a[1] ? b : a,
    )[0];
    out.push(
      `${name}'s path has narrowed toward ${dom}. This creates real depth, but other dimensions are waiting patiently for attention.`,
    );
  }
  if (signals.includes("restless"))
    out.push(
      `${name} is drawn to new horizons. A structured curiosity project might channel this energy into something that compounds.`,
    );
  if (signals.includes("surging"))
    out.push(
      `${name} is in a rare season of broad growth. This is a good time to take on challenges that require multiple strengths at once.`,
    );
  if (signals.includes("finding_rhythm"))
    out.push(
      `${name} is in balance — a state that often precedes meaningful breakthroughs. This is a good time to deepen what's already working.`,
    );

  const archetypeTips: Record<string, string> = {
    "The Scholar": `${name}'s strength lies in depth. Projects that reward long-form thinking — the kind that compound over weeks — are where ${name} truly shines.`,
    "The Strategist": `${name} sees the board clearly. Mapping a longer horizon might reveal opportunities that feel invisible at close range.`,
    "The Wanderer": `${name} thrives when life has texture. A new environment or a different kind of task this week might bring unexpected clarity.`,
    "The Connector": `${name}'s greatest leverage comes through people. One conversation with the right person could open doors ${name} hasn't imagined yet.`,
    "The Pioneer": `${name} is at the edge of the known. The best moves are often the ones that feel slightly too early — ${name} might be right on time.`,
    "The Sage": `${name} has found a rare balance. The challenge now is integration — weaving these diverse strengths into something greater than their sum.`,
  };
  if (archetypeTips[archetype]) out.push(archetypeTips[archetype]);

  return out.slice(0, 3);
}
