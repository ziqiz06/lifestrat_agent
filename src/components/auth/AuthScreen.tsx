'use client';
import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

interface Props {
  onAuthenticated: (user: { id: string; email?: string }) => void;
}

export default function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  const supabase = createClient();

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setConfirmSent(true);
      } else {
        console.log('Attempting login to:', process.env.NEXT_PUBLIC_SUPABASE_URL);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        console.log('Login result:', JSON.stringify({ user: data?.user?.id, error: error?.message }));
        if (error) throw error;
        onAuthenticated({ id: data.user.id, email: data.user.email });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🧭 LifeStrat</h1>
          <p className="text-gray-400 text-sm">Your personal AI life strategy assistant</p>
        </div>

        {confirmSent ? (
          <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 text-center">
            <div className="text-4xl mb-3">📬</div>
            <h2 className="text-white font-semibold mb-2">Check your email</h2>
            <p className="text-gray-400 text-sm">We sent a confirmation link to <span className="text-indigo-400">{email}</span>. Click it to activate your account, then log in.</p>
            <button
              onClick={() => { setConfirmSent(false); setMode('login'); }}
              className="mt-4 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Back to login →
            </button>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
            {/* Tab toggle */}
            <div className="flex rounded-lg bg-gray-900 p-1 mb-6">
              {(['login', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(''); }}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                    mode === m ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {m === 'login' ? 'Log In' : 'Sign Up'}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none text-sm"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="w-full bg-gray-700 text-white rounded-lg p-3 border border-gray-600 focus:border-indigo-500 focus:outline-none text-sm"
                  placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                />
              </div>

              {error && (
                <p className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg p-2">{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading || !email || !password}
                className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-colors"
              >
                {loading ? 'Please wait...' : mode === 'login' ? 'Log In →' : 'Create Account →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
