'use client';
import { useAppStore } from '@/store/appStore';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '⚡' },
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'opportunities', label: 'Opportunities', icon: '🎯' },
  { id: 'preferences', label: 'Preferences', icon: '⚙️' },
] as const;

interface NavProps {
  userEmail?: string | null;
  onSignOut?: () => void;
}

export default function Navigation({ userEmail, onSignOut }: NavProps) {
  const { activeTab, setActiveTab, conflicts, opportunities } = useAppStore();
  const unresolvedConflicts = conflicts.length;
  const undecidedOpps = opportunities.filter((o) => o.interested === null && o.category !== 'ignore').length;

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <span className="text-white font-bold text-sm">🧭 LifeStrat</span>
          <div className="flex items-center">
            {TABS.map((tab) => {
              const badge =
                tab.id === 'dashboard' && unresolvedConflicts > 0
                  ? unresolvedConflicts
                  : tab.id === 'opportunities' && undecidedOpps > 0
                  ? undecidedOpps
                  : null;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-1.5 px-4 h-14 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                  {badge && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
            {userEmail && (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-700">
                <span className="text-xs text-gray-500 hidden md:inline">{userEmail}</span>
                <button
                  onClick={onSignOut}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
