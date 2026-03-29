"use client";
import { useAppStore } from "@/store/appStore";

const DOT  = { fontFamily: "var(--font-dot)"  } as const;
const MONO = { fontFamily: "var(--font-mono)" } as const;

const TABS = [
  { id: "dashboard",     label: "Dashboard"     },
  { id: "calendar",      label: "Calendar"      },
  { id: "opportunities", label: "Opportunities" },
  { id: "character",     label: "Character"     },
  { id: "preferences",   label: "Preferences"   },
] as const;

interface NavProps {
  userEmail?: string | null;
  onSignOut?: () => void;
}

export default function Navigation({ userEmail, onSignOut }: NavProps) {
  const { activeTab, setActiveTab, conflicts, opportunities } = useAppStore();
  const unresolvedConflicts = conflicts.length;
  const undecidedOpps = opportunities.filter(
    (o) => o.interested === null && o.category !== "ignore",
  ).length;

  return (
    <nav className="bg-gray-950 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-12">
          <span style={DOT} className="text-white text-xl tracking-widest uppercase">
            LifeStrat
          </span>
          <div className="flex items-center gap-1">
            {TABS.map((tab) => {
              const badge =
                tab.id === "dashboard" && unresolvedConflicts > 0
                  ? unresolvedConflicts
                  : tab.id === "opportunities" && undecidedOpps > 0
                    ? undecidedOpps
                    : null;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={DOT}
                  className={`relative px-3 h-12 text-sm transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? "border-indigo-500 text-white"
                      : "border-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <span className="hidden sm:inline">{tab.label}</span>
                  {badge && (
                    <span
                      className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center font-bold"
                      style={MONO}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
            {userEmail && (
              <div className="flex items-center gap-2 ml-3 pl-3 border-l border-gray-800">
                <span className="text-xs text-gray-600 hidden md:inline" style={MONO}>
                  {userEmail}
                </span>
                <button
                  onClick={onSignOut}
                  className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1"
                  style={MONO}
                >
                  sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
