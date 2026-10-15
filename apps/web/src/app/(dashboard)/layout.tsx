'use client';

import React, { useState } from 'react';
import { Sidebar } from '../../components/layout/sidebar';
import { Header } from '../../components/layout/header';
import { CommandPalette } from '../../components/layout/command-palette';
import { useAuth } from '../../contexts/auth-context';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  // Redirect to login if unauthenticated
  React.useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  const handleResendVerification = async () => {
    if (!user?.email) return;
    setResendingEmail(true);
    setResendStatus(null);
    try {
      const res = await (await import('../../lib/api')).fetchApi('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: user.email }),
      });
      setResendStatus(res.message || 'Verification link sent!');
    } catch (err: any) {
      setResendStatus(err.message || 'Failed to send verification link.');
    } finally {
      setResendingEmail(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs text-text-muted font-mono">Loading Obsidian Panel...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-text-primary flex">
      {/* Fixed Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen bg-background">
        <Header onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
        <main className="flex-1 p-8 overflow-y-auto">
          {/* Unverified email warning banner */}
          {user && !user.emailVerifiedAt && !user.isAdmin && (
            <div className="mb-6 p-4 rounded-card bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-200">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Email Verification Required
                </div>
                <p className="text-xs text-text-muted">
                  Your email address (<span className="text-text-primary font-mono">{user.email}</span>) is unverified. Please check your inbox to verify your account.
                </p>
                {resendStatus && (
                  <p className="text-[11px] font-medium text-primary mt-1">{resendStatus}</p>
                )}
              </div>
              <button
                type="button"
                disabled={resendingEmail}
                onClick={handleResendVerification}
                className="shrink-0 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-control text-xs font-medium text-amber-200 transition-colors disabled:opacity-50"
              >
                {resendingEmail ? 'Sending...' : 'Resend Verification Email'}
              </button>
            </div>
          )}

          {children}
        </main>
      </div>

      {/* Global Cmd+K Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
}
