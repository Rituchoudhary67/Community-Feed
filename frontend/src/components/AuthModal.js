import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ isOpen, onClose }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Please fill in both fields.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(username.trim(), password.trim());
      } else {
        await register(username.trim(), password.trim());
      }
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error ||
                  err.response?.data?.username?.[0] ||
                  err.response?.data?.password?.[0] ||
                  (mode === 'login' ? 'Invalid credentials' : 'Registration failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="relative bg-surface-raised border border-border-subtle rounded-2xl w-full max-w-sm mx-4 animate-slideUp shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Decorative glow */}
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-accent rounded-full blur-3xl opacity-10 pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-like-red rounded-full blur-3xl opacity-8 pointer-events-none" />

          <div className="relative p-6">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
            >
              ✕
            </button>

            {/* Logo / Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm font-display">P</span>
                </div>
                <span className="text-lg font-bold text-text-primary font-display">Playto</span>
              </div>
              <p className="text-text-muted text-sm">
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </p>
            </div>

            {/* Mode toggle */}
            <div className="flex gap-1 bg-surface rounded-lg p-1 mb-5">
              <button
                onClick={() => { setMode('login'); setError(''); }}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all
                  ${mode === 'login' ? 'bg-surface-raised text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
              >
                Log In
              </button>
              <button
                onClick={() => { setMode('register'); setError(''); }}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all
                  ${mode === 'register' ? 'bg-surface-raised text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
              >
                Sign Up
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1 font-medium">Username</label>
                <input
                  ref={inputRef}
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="your_username"
                  autoComplete="off"
                  className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm
                             focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1 font-medium">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm
                             focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-colors"
                />
              </div>

              {error && (
                <p className="text-like-red text-xs bg-like-red-glow rounded-lg px-3 py-2 animate-fadeIn">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent hover:bg-accent-hover text-white font-semibold text-sm py-2.5 rounded-lg
                           disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-1"
              >
                {loading ? '...' : mode === 'login' ? 'Log In' : 'Create Account'}
              </button>
            </form>

            {/* Demo accounts hint */}
            <div className="mt-4 pt-3 border-t border-border-subtle">
              <p className="text-xs text-text-muted text-center">
                Demo accounts: <span className="text-accent">alice</span> / <span className="text-accent">password123</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
