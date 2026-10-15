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

  // Redirect to login if unauthenticated
  React.useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

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
