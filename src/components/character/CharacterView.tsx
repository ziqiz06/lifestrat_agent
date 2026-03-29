"use client";
import { useState } from "react";
import { useAppStore } from "@/store/appStore";
import {
  getArchetypePalette,
  STAT_META,
  SIGNAL_META,
  getSuggestions,
  getLevelProgress,
  DEFAULT_APPEARANCE,
  HAIR_OPTIONS,
  EYE_OPTIONS,
  FACE_OPTIONS,
} from "@/lib/characterEngine";
import type { ArchetypePalette } from "@/lib/characterEngine";
import PixelSprite from "./PixelSprite";
import type {
  CharacterStats,
  StatSnapshot,
  CharacterAppearance,
} from "@/types";

// ── Radar / pentagon stat chart ───────────────────────────────────────────────
function RadarChart({
  stats,
  palette,
}: {
  stats: CharacterStats;
  palette: ArchetypePalette;
}) {
  const CX = 100,
    CY = 105,
    R = 72;
  const keys: (keyof CharacterStats)[] = [
    "focus",
    "career",
    "vitality",
    "social",
    "exploration",
  ];
  const ang = (i: number) => (Math.PI * 2 * i) / 5 - Math.PI / 2;
  const px = (i: number, r: number) => CX + r * Math.cos(ang(i));
  const py = (i: number, r: number) => CY + r * Math.sin(ang(i));

  const statPts = keys
    .map((k, i) => `${px(i, (stats[k] / 100) * R)},${py(i, (stats[k] / 100) * R)}`)
    .join(" ");

  return (
    <svg viewBox="0 0 200 220" className="w-full max-w-50 mx-auto">
      {/* Grid polygons */}
      {[0.25, 0.5, 0.75, 1].map((lvl) => (
        <polygon
          key={lvl}
          points={keys
            .map((_, i) => `${px(i, lvl * R)},${py(i, lvl * R)}`)
            .join(" ")}
          fill="none"
          stroke={lvl === 1 ? "#374151" : "#1F2937"}
          strokeWidth={lvl === 1 ? 1 : 0.5}
        />
      ))}
      {/* Axis lines */}
      {keys.map((_, i) => (
        <line
          key={i}
          x1={CX}
          y1={CY}
          x2={px(i, R)}
          y2={py(i, R)}
          stroke="#1F2937"
          strokeWidth={0.75}
        />
      ))}
      {/* Filled area */}
      <polygon
        points={statPts}
        fill={`${palette.glow}20`}
        stroke={palette.glow}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Stat dots */}
      {keys.map((k, i) => (
        <circle
          key={k}
          cx={px(i, (stats[k] / 100) * R)}
          cy={py(i, (stats[k] / 100) * R)}
          r={3.5}
          fill={STAT_META[k].color}
          stroke="#111827"
          strokeWidth={0.75}
        />
      ))}
      {/* Labels */}
      {keys.map((k, i) => {
        const lr = R + 18;
        return (
          <g key={k}>
            <text
              x={px(i, lr)}
              y={py(i, lr) - 3}
              textAnchor="middle"
              fontSize={7}
              fill={STAT_META[k].color}
              fontWeight="600"
            >
              {STAT_META[k].label.slice(0, 3).toUpperCase()}
            </text>
            <text
              x={px(i, lr)}
              y={py(i, lr) + 7}
              textAnchor="middle"
              fontSize={6.5}
              fill="#9CA3AF"
            >
              {stats[k]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Sparkline trend graph ─────────────────────────────────────────────────────
function TrendGraph({ history }: { history: StatSnapshot[] }) {
  if (history.length < 2)
    return (
      <p className="text-xs text-gray-600 italic">
        Not enough data yet — trends appear after a few sessions.
      </p>
    );

  const W = 320,
    H = 90,
    PAD = 8;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;
  const xStep = innerW / (history.length - 1);
  const stats: (keyof CharacterStats)[] = [
    "focus",
    "career",
    "vitality",
    "social",
    "exploration",
  ];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: 200 }}
      >
        {/* Grid lines */}
        {[25, 50, 75].map((y) => (
          <g key={y}>
            <line
              x1={PAD}
              y1={PAD + innerH - (y / 100) * innerH}
              x2={W - PAD}
              y2={PAD + innerH - (y / 100) * innerH}
              stroke="#374151"
              strokeWidth={0.5}
              strokeDasharray="3,3"
            />
            <text
              x={0}
              y={PAD + innerH - (y / 100) * innerH + 3}
              fontSize={5}
              fill="#6B7280"
            >
              {y}
            </text>
          </g>
        ))}
        {/* Stat lines */}
        {stats.map((key) => {
          const color = STAT_META[key].color;
          const points = history
            .map(
              (snap, i) =>
                `${PAD + i * xStep},${PAD + innerH - (snap.stats[key] / 100) * innerH}`,
            )
            .join(" ");
          return (
            <g key={key}>
              <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
              <circle
                cx={PAD + (history.length - 1) * xStep}
                cy={
                  PAD +
                  innerH -
                  (history[history.length - 1].stats[key] / 100) * innerH
                }
                r={2}
                fill={color}
              />
            </g>
          );
        })}
        {/* Date labels */}
        {history.map((snap, i) => {
          if (
            i !== 0 &&
            i !== Math.floor(history.length / 2) &&
            i !== history.length - 1
          )
            return null;
          const d = new Date(snap.date + "T00:00:00");
          const label = d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
          return (
            <text
              key={i}
              x={PAD + i * xStep}
              y={H - 1}
              fontSize={5}
              fill="#6B7280"
              textAnchor={
                i === 0 ? "start" : i === history.length - 1 ? "end" : "middle"
              }
            >
              {label}
            </text>
          );
        })}
      </svg>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2">
        {stats.map((key) => (
          <div key={key} className="flex items-center gap-1">
            <div
              className="w-3 h-1.5 rounded-full"
              style={{ backgroundColor: STAT_META[key].color }}
            />
            <span className="text-[10px] text-gray-500">
              {STAT_META[key].label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Single stat bar ───────────────────────────────────────────────────────────
function StatBar({
  statKey,
  value,
  history,
}: {
  statKey: keyof CharacterStats;
  value: number;
  history: StatSnapshot[];
}) {
  const meta = STAT_META[statKey];
  const prevValue =
    history.length >= 2 ? history[history.length - 2].stats[statKey] : value;
  const delta = value - prevValue;
  const trend = delta > 2 ? "↑" : delta < -2 ? "↓" : "→";
  const trendColor =
    delta > 2
      ? "text-green-400"
      : delta < -2
        ? "text-orange-400"
        : "text-gray-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{meta.icon}</span>
          <span className="text-xs font-semibold text-gray-200">
            {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-bold ${trendColor}`}>{trend}</span>
          <span className="text-xs font-bold text-white tabular-nums">
            {value}
          </span>
          <span className="text-[10px] text-gray-600">/ 100</span>
        </div>
      </div>
      <div className="h-2 bg-gray-700/60 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${value}%`,
            background: `linear-gradient(90deg, ${meta.color}99, ${meta.color})`,
            boxShadow: `0 0 6px ${meta.color}66`,
          }}
        />
      </div>
      <p className="text-[10px] text-gray-600 mt-0.5">{meta.desc}</p>
    </div>
  );
}

// ── Appearance option picker row ──────────────────────────────────────────────
function OptionRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; icon: string; desc: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 mb-2">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.desc}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border text-xs transition-all ${
              value === opt.value
                ? "border-indigo-500 bg-indigo-600/25 text-white"
                : "border-gray-700 bg-gray-800/60 text-gray-400 hover:border-gray-500 hover:text-gray-200"
            }`}
          >
            <span className="text-base leading-none">{opt.icon}</span>
            <span className="font-medium mt-0.5">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Character creation screen ─────────────────────────────────────────────────
function CharacterSetup() {
  const { createCharacter } = useAppStore();
  const [name, setName] = useState("");
  const [appearance, setAppearance] =
    useState<CharacterAppearance>(DEFAULT_APPEARANCE);
  const [error, setError] = useState("");

  const previewPalette = getArchetypePalette("The Sage");

  function patchAppearance(patch: Partial<CharacterAppearance>) {
    setAppearance((prev) => ({ ...prev, ...patch }));
  }

  function handleSubmit() {
    if (!name.trim()) {
      setError("Please give your character a name.");
      return;
    }
    createCharacter(name.trim(), appearance);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">
          Create Your Character
        </h1>
        <p className="text-gray-400 text-sm leading-relaxed max-w-md mx-auto">
          This character is an alternate version of you — shaped by how you
          spend your time and energy. Their color palette will shift
          automatically as you grow.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-8 items-start">
        {/* Live sprite preview */}
        <div className="shrink-0 flex flex-col items-center gap-3 sm:sticky sm:top-24 mx-auto sm:mx-0">
          <div
            className="rounded-2xl p-6 border flex items-center justify-center"
            style={{
              borderColor: `${previewPalette.glow}30`,
              background: `radial-gradient(ellipse at center, ${previewPalette.glow}18, transparent 70%), #1f2937`,
              minWidth: 140,
              minHeight: 180,
            }}
          >
            <PixelSprite
              palette={previewPalette}
              scale={8}
              animated
              appearance={appearance}
            />
          </div>
          <p className="text-[10px] text-gray-600 italic text-center max-w-35">
            Color shifts with your archetype as you grow
          </p>
        </div>

        {/* Customisation + name */}
        <div className="flex-1 space-y-5">
          <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 space-y-5">
            <h2 className="text-sm font-semibold text-white">
              Customise appearance
            </h2>
            <OptionRow
              label="Hair"
              options={HAIR_OPTIONS}
              value={appearance.hairStyle}
              onChange={(v) => patchAppearance({ hairStyle: v })}
            />
            <OptionRow
              label="Eyes"
              options={EYE_OPTIONS}
              value={appearance.eyeStyle}
              onChange={(v) => patchAppearance({ eyeStyle: v })}
            />
            <OptionRow
              label="Face shape"
              options={FACE_OPTIONS}
              value={appearance.faceShape}
              onChange={(v) => patchAppearance({ faceShape: v })}
            />
          </div>

          <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700 space-y-4">
            <h2 className="text-sm font-semibold text-white">
              Give them a name
            </h2>
            <input
              autoFocus
              type="text"
              maxLength={24}
              className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 border border-gray-600 focus:border-indigo-500 focus:outline-none placeholder-gray-500 text-sm"
              placeholder="e.g. Aelith, Nova, Kiran…"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={handleSubmit}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
            >
              Begin the Journey →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main CharacterView ────────────────────────────────────────────────────────
export default function CharacterView() {
  const { character, refreshCharacterStats } = useAppStore();

  if (!character) return <CharacterSetup />;

  const palette = getArchetypePalette(character.archetype);
  const lvlProgress = getLevelProgress(character.stats);
  const suggestions = getSuggestions(character);
  const stats = character.stats;

  // Compute stat deltas vs last snapshot
  const prevSnap =
    character.statHistory.length >= 2
      ? character.statHistory[character.statHistory.length - 2]
      : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* ── Hero banner ────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border relative overflow-hidden"
        style={{
          borderColor: `${palette.glow}35`,
          background: `radial-gradient(ellipse at top left, ${palette.glow}22, transparent 55%), radial-gradient(ellipse at bottom right, ${palette.glow}0d, transparent 50%), #0F1117`,
        }}
      >
        {/* Decorative corner glow */}
        <div
          className="absolute top-0 left-0 w-48 h-48 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${palette.glow}15, transparent 70%)`,
            transform: "translate(-30%, -30%)",
          }}
        />

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6 p-6">
          {/* Sprite */}
          <div className="shrink-0 flex flex-col items-center gap-3">
            <div
              className="rounded-2xl p-4 border"
              style={{
                borderColor: `${palette.glow}25`,
                background: `radial-gradient(ellipse at center, ${palette.glow}18, transparent 70%), #111827`,
              }}
            >
              <PixelSprite
                palette={palette}
                scale={9}
                animated
                signals={character.signals}
                appearance={character.appearance}
              />
            </div>
            <button
              onClick={refreshCharacterStats}
              className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1"
            >
              ↻ sync stats
            </button>
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0 text-center sm:text-left">
            {/* Name + level */}
            <div className="flex items-center justify-center sm:justify-start gap-3 mb-1">
              <h1 className="text-3xl font-bold text-white tracking-tight">
                {character.name}
              </h1>
              <span
                className="text-sm font-bold px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: `${palette.glow}22`,
                  color: palette.glow,
                  border: `1px solid ${palette.glow}44`,
                }}
              >
                Lv {character.level}
              </span>
            </div>

            {/* Archetype */}
            <p
              className="text-base font-semibold mb-4 tracking-wide uppercase"
              style={{ color: `${palette.glow}cc` }}
            >
              {character.archetype}
            </p>

            {/* XP bar */}
            <div className="mb-5 max-w-xs mx-auto sm:mx-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-gray-500 font-medium">
                  Progress to Lv {character.level + 1}
                </span>
                <span className="text-[11px] text-gray-500 tabular-nums">
                  {lvlProgress.current} / {lvlProgress.needed} xp
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700/50">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${lvlProgress.pct}%`,
                    background: `linear-gradient(90deg, ${palette.glow}88, ${palette.glow})`,
                    boxShadow: `0 0 8px ${palette.glow}55`,
                  }}
                />
              </div>
            </div>

            {/* Active signals */}
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              {character.signals.map((signal) => {
                const m = SIGNAL_META[signal];
                return (
                  <div
                    key={signal}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium"
                    style={{
                      color: m.color,
                      borderColor: `${m.color}40`,
                      backgroundColor: `${m.color}15`,
                    }}
                  >
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <section className="bg-gray-800/80 rounded-2xl p-5 border border-gray-700 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Core Stats</h2>
            <span className="text-[10px] text-gray-500">
              from your calendar activity
            </span>
          </div>

          {/* Radar chart */}
          <div className="flex justify-center py-2">
            <RadarChart stats={stats} palette={palette} />
          </div>

          {/* Stat bars */}
          <div className="space-y-3 pt-2 border-t border-gray-700/60">
            {(Object.keys(stats) as (keyof CharacterStats)[]).map((key) => (
              <StatBar
                key={key}
                statKey={key}
                value={stats[key]}
                history={character.statHistory}
              />
            ))}
          </div>

          {prevSnap && (
            <p className="text-[10px] text-gray-600 pt-2 border-t border-gray-700 leading-relaxed">
              Compared to last session ·{" "}
              {(() => {
                const keys = Object.keys(stats) as (keyof CharacterStats)[];
                const rising = keys.filter(
                  (k) => stats[k] - prevSnap.stats[k] > 2,
                );
                const falling = keys.filter(
                  (k) => stats[k] - prevSnap.stats[k] < -2,
                );
                if (rising.length === 0 && falling.length === 0)
                  return "all stats stable";
                const parts = [];
                if (rising.length > 0)
                  parts.push(
                    `${rising.map((k) => STAT_META[k].label).join(", ")} ↑`,
                  );
                if (falling.length > 0)
                  parts.push(
                    `${falling.map((k) => STAT_META[k].label).join(", ")} ↓`,
                  );
                return parts.join(" · ");
              })()}
            </p>
          )}
        </section>

        {/* ── Signals + Suggestions ──────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Signals detail */}
          <section className="bg-gray-800/80 rounded-2xl p-5 border border-gray-700">
            <h2 className="font-semibold text-white mb-4">
              What {character.name} is experiencing
            </h2>
            <div className="space-y-3">
              {character.signals.map((signal) => {
                const m = SIGNAL_META[signal];
                return (
                  <div
                    key={signal}
                    className={`rounded-xl p-3.5 border ${m.bg}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span>{m.icon}</span>
                      <span
                        className="text-xs font-semibold"
                        style={{ color: m.color }}
                      >
                        {m.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      {m.desc(character.name)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Suggestions */}
          <section className="bg-gray-800/80 rounded-2xl p-5 border border-gray-700">
            <h2 className="font-semibold text-white mb-1">
              Character Insights
            </h2>
            <p className="text-[10px] text-gray-500 mb-4">
              Observations from {character.name}&apos;s journey
            </p>
            <div className="space-y-3">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: palette.glow }}
                  />
                  <p className="text-sm text-gray-300 leading-relaxed">{s}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* ── Trend graph ────────────────────────────────────────────────────── */}
      <section className="bg-gray-800/80 rounded-2xl p-5 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Stat Trends</h2>
          <span className="text-[10px] text-gray-500">
            Last {character.statHistory.length} recorded sessions
          </span>
        </div>
        <TrendGraph history={character.statHistory} />
      </section>

      {/* ── About ──────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-5 border border-gray-700/50 bg-gray-800/40">
        <h2 className="font-semibold text-gray-300 mb-2 text-sm">
          How this works
        </h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          {character.name}&apos;s stats are derived from the last 30 days of your
          calendar activity — weighted toward what&apos;s recent. Stats drift gently
          when an area goes quiet and recover quickly when attention returns.
          Every choice of where to spend time is a tradeoff, not a mistake.
          There are no failure states here, only different kinds of seasons.
        </p>
      </div>
    </div>
  );
}
