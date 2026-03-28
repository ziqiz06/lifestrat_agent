'use client';

interface Props {
  onSignIn: () => void;
}

export default function SignedOutPage({ onSignIn }: Props) {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-6">

        {/* Logo */}
        <div>
          <div className="text-6xl mb-4">🧭</div>
          <h1 className="text-4xl font-bold text-white mb-2">LifeStrat</h1>
          <p className="text-gray-400">Your personal AI life strategy assistant</p>
        </div>

        {/* Signed out card */}
        <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700 space-y-4">
          <div className="w-12 h-12 rounded-full bg-green-900/40 border border-green-700/50 flex items-center justify-center mx-auto">
            <span className="text-green-400 text-xl">✓</span>
          </div>
          <h2 className="text-white font-semibold text-lg">You've been signed out</h2>
          <p className="text-gray-400 text-sm">
            Your data is saved and will be ready when you return.
          </p>
          <button
            onClick={onSignIn}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors"
          >
            Sign back in →
          </button>
        </div>

        {/* Feature hints */}
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { icon: '🎯', label: 'Track opportunities' },
            { icon: '📅', label: 'Plan your week' },
            { icon: '🤖', label: 'AI strategy' },
          ].map((f) => (
            <div key={f.label} className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
              <div className="text-2xl mb-1">{f.icon}</div>
              <p className="text-xs text-gray-500">{f.label}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
