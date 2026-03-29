"use client";
import { useEffect } from "react";

const MONO = { fontFamily: "var(--font-mono)" } as const;

export default function UndoToast({
  label,
  onUndo,
  onDismiss,
}: {
  label: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-800 border border-gray-600 shadow-xl px-4 py-3 text-sm"
      style={MONO}
    >
      <span className="text-gray-300 truncate max-w-xs">{label}</span>
      <button
        onClick={onUndo}
        className="text-indigo-400 hover:text-indigo-300 font-semibold shrink-0 transition-colors"
      >
        Undo
      </button>
      <button
        onClick={onDismiss}
        className="text-gray-500 hover:text-gray-400 shrink-0 transition-colors"
      >
        ✕
      </button>
    </div>
  );
}
