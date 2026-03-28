'use client';
import { useAppStore } from '@/store/appStore';
import { CalendarTask, Conflict } from '@/types';

const WEEK_DATES = [
  '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31',
  '2026-04-01', '2026-04-02', '2026-04-03',
];

const DAY_LABELS: Record<string, string> = {
  '2026-03-28': 'Sat Mar 28',
  '2026-03-29': 'Sun Mar 29',
  '2026-03-30': 'Mon Mar 30',
  '2026-03-31': 'Tue Mar 31',
  '2026-04-01': 'Wed Apr 1',
  '2026-04-02': 'Thu Apr 2',
  '2026-04-03': 'Fri Apr 3',
};

function TaskChip({ task, hasConflict }: { task: CalendarTask; hasConflict: boolean }) {
  return (
    <div
      className={`rounded-lg px-3 py-2 mb-2 border-l-4 ${hasConflict ? 'border-red-500 bg-red-900/20' : ''}`}
      style={{ borderLeftColor: hasConflict ? '#ef4444' : task.color, backgroundColor: hasConflict ? undefined : `${task.color}20` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: task.color }}>{task.startTime}–{task.endTime}</span>
        {hasConflict && <span className="text-xs text-red-400 font-bold">⚠️ CONFLICT</span>}
      </div>
      <p className="text-sm text-white font-medium mt-0.5">{task.title}</p>
    </div>
  );
}

function ConflictBanner({ conflict, onResolve }: { conflict: Conflict; onResolve: (keepId: string) => void }) {
  return (
    <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-red-400 text-xl">⚠️</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-300 mb-1">Scheduling Conflict Detected</p>
          <p className="text-sm text-gray-300 mb-3">{conflict.reason}</p>
          <div className="space-y-1 mb-3">
            {conflict.suggestions.map((s, i) => (
              <p key={i} className="text-xs text-gray-400">• {s}</p>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => onResolve(conflict.taskAId)}
              className="text-xs bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-600/50 rounded px-3 py-1.5 transition-colors"
            >
              Keep &quot;{conflict.taskATitle}&quot;
            </button>
            <button
              onClick={() => onResolve(conflict.taskBId)}
              className="text-xs bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-600/50 rounded px-3 py-1.5 transition-colors"
            >
              Keep &quot;{conflict.taskBTitle}&quot;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CalendarView() {
  const { calendarTasks, conflicts, resolveConflict } = useAppStore();

  const conflictTaskIds = new Set(conflicts.flatMap((c) => [c.taskAId, c.taskBId]));

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Weekly Plan</h1>
          <p className="text-sm text-gray-400 mt-0.5">Mar 28 – Apr 3, 2026</p>
        </div>
        <div className="flex items-center gap-2">
          {conflicts.length > 0 && (
            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-800/50">
              {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
            {calendarTasks.length} tasks
          </span>
        </div>
      </div>

      {/* Conflict banners */}
      {conflicts.map((c) => (
        <ConflictBanner key={c.id} conflict={c} onResolve={(keepId) => resolveConflict(c.id, keepId)} />
      ))}

      {/* Weekly grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {WEEK_DATES.map((date) => {
          const dayTasks = calendarTasks
            .filter((t) => t.date === date)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

          return (
            <div key={date} className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-white">{DAY_LABELS[date]}</h3>
                <span className="text-xs text-gray-500">{dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''}</span>
              </div>
              {dayTasks.length === 0 ? (
                <p className="text-xs text-gray-600 italic">Nothing scheduled</p>
              ) : (
                dayTasks.map((task) => (
                  <TaskChip key={task.id} task={task} hasConflict={conflictTaskIds.has(task.id)} />
                ))
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-3">
        {[
          { label: 'Internship', color: '#10b981' },
          { label: 'Academic', color: '#3b82f6' },
          { label: 'Networking', color: '#ec4899' },
          { label: 'Event/Workshop', color: '#6366f1' },
          { label: 'Career Fair', color: '#f97316' },
          { label: 'Entertainment', color: '#f59e0b' },
          { label: 'Deadline', color: '#ef4444' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-gray-400">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
