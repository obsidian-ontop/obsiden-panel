'use client';

import React from 'react';
import { Search, Command, Bell } from 'lucide-react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  onOpenCommandPalette?: () => void;
}

export function Header({
  title,
  subtitle,
  children,
  onOpenCommandPalette,
}: HeaderProps) {
  return (
    <header className="h-16 px-8 border-b border-border bg-surface/50 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
      <div>
        {title && (
          <h2 className="text-base font-semibold text-text-primary tracking-tight">
            {title}
          </h2>
        )}
        {subtitle && (
          <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Search / Command palette launcher */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-3 px-3 py-1.5 bg-surface border border-border rounded-control text-xs text-text-muted hover:border-border-focus transition-colors shadow-sm"
        >
          <Search className="w-3.5 h-3.5 text-text-muted" />
          <span>Search or jump to...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-surface-elevated border border-border rounded text-text-secondary font-mono">
            ⌘K
          </kbd>
        </button>

        {children}
      </div>
    </header>
  );
}
