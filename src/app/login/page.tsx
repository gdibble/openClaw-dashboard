'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/');
        return;
      }

      const data = await res.json();
      setError(data.error || 'Invalid password');
    } catch {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111113]">
      <div className="w-full max-w-sm mx-4">
        {/* Terminal header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[#46a758] animate-pulse" />
            <span className="text-[#46a758] font-mono text-sm tracking-wider uppercase">
              OpenClaw
            </span>
          </div>
          <p className="text-[#697177] text-xs font-mono">
            Operator Authentication Required
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-[#697177] text-xs font-mono mb-2 uppercase tracking-wider"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter operator password"
              autoFocus
              required
              className="w-full px-4 py-3 bg-[#1a1a1c] border border-[#2a2a2e] rounded-lg
                         text-white font-mono text-sm placeholder:text-[#3a3a3e]
                         focus:outline-none focus:border-[#46a758] focus:ring-1 focus:ring-[#46a758]/30
                         transition-colors"
            />
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-xs font-mono">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full px-4 py-3 bg-[#46a758] hover:bg-[#3d9a4d] disabled:bg-[#2a2a2e]
                       disabled:text-[#697177] text-white font-mono text-sm rounded-lg
                       transition-colors focus:outline-none focus:ring-2 focus:ring-[#46a758]/50"
          >
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>

        <p className="mt-6 text-center text-[#3a3a3e] text-xs font-mono">
          Set DASHBOARD_SECRET to configure access
        </p>
      </div>
    </div>
  );
}
