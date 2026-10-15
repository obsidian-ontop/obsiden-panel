'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../contexts/auth-context';
import {
  Server,
  User as UserIcon,
  Shield,
  Key,
  Activity,
  LayoutDashboard,
  MapPin,
  HardDrive,
  Network,
  Layers,
  Settings,
  LogOut,
  Hexagon,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const userNavItems = [
    { label: 'Servers', href: '/servers', icon: Server },
    { label: 'Account', href: '/account', icon: UserIcon },
    { label: 'Security', href: '/security', icon: Shield },
    { label: 'API Keys', href: '/api-keys', icon: Key },
    { label: 'Activity', href: '/activity', icon: Activity },
  ];

  const adminNavItems = [
    { label: 'Overview', href: '/admin', icon: LayoutDashboard },
    { label: 'Servers', href: '/admin/servers', icon: Server },
    { label: 'Users', href: '/admin/users', icon: UserIcon },
    { label: 'Locations', href: '/admin/locations', icon: MapPin },
    { label: 'Nodes', href: '/admin/nodes', icon: HardDrive },
    { label: 'Allocations', href: '/admin/allocations', icon: Network },
    { label: 'Nests & Eggs', href: '/admin/nests', icon: Layers },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-surface border-r border-border flex flex-col h-screen fixed left-0 top-0 z-40 select-none">
      {/* Brand Header */}
      <div className="h-16 px-6 border-b border-border flex items-center justify-between">
        <Link href="/servers" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-surface-elevated border border-border flex items-center justify-center text-primary group-hover:border-primary/50 transition-colors">
            <Hexagon className="w-5 h-5 fill-primary/10" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-text-primary">
              OBSIDIAN
            </h1>
            <p className="text-[10px] text-text-muted font-mono tracking-wider uppercase">
              Control Plane
            </p>
          </div>
        </Link>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* User Navigation */}
        <div className="space-y-1">
          <p className="px-3 text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">
            Management
          </p>
          {userNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/servers' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-control text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-surface-elevated text-text-primary border border-border/80'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
                )}
              >
                <Icon className={cn('w-4 h-4', isActive ? 'text-primary' : 'text-text-muted')} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Admin Navigation (Only shown to administrators) */}
        {user?.isAdmin && (
          <div className="space-y-1 pt-2 border-t border-border/50">
            <p className="px-3 text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">
              Administration
            </p>
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-control text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-surface-elevated text-text-primary border border-border/80'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive ? 'text-primary' : 'text-text-muted')} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-border bg-surface">
        <div className="flex items-center justify-between p-2 rounded-control bg-surface-elevated border border-border">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center font-mono text-xs font-bold text-primary shrink-0">
              {user?.username ? user.username.slice(0, 2).toUpperCase() : 'U'}
            </div>
            <div className="truncate">
              <p className="text-xs font-medium text-text-primary truncate">
                {user?.username || 'Loading...'}
              </p>
              <p className="text-[10px] text-text-muted truncate">
                {user?.isAdmin ? 'Administrator' : 'Customer'}
              </p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            title="Log Out"
            className="p-1.5 text-text-muted hover:text-status-error hover:bg-surface rounded-control transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
