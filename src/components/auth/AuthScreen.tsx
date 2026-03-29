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

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // On success the browser redirects — no further action needed here.
  };

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

              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-gray-700" />
                <span className="text-xs text-gray-500">or</span>
                <div className="flex-1 h-px bg-gray-700" />
              </div>

              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
