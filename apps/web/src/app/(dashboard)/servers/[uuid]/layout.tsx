'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../lib/api';
import {
  Terminal,
  FolderOpen,
  Layers,
  Database,
  Calendar,
  Archive,
  Network,
  Play,
  Square,
  RotateCw,
  Power,
  Users,
  Settings,
  Puzzle,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { cn } from '../../../../lib/utils';

export default function ServerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { uuid: string };
}) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const uuid = params.uuid;

  const { data: server, isLoading } = useQuery({
    queryKey: ['server', uuid],
    queryFn: () => fetchApi(`/api/client/servers/${uuid}`),
    refetchInterval: 10000,
  });

  const [powerFeedback, setPowerFeedback] = useState<string | null>(null);
  const [liveState, setLiveState] = useState<string | null>(null);

  // Sync initial status from server query
  React.useEffect(() => {
    if (server?.liveStatus || server?.status) {
      setLiveState(server.liveStatus || server.status);
    }
  }, [server?.liveStatus, server?.status]);

  // Listen for real-time WebSocket status events from Console
  React.useEffect(() => {
    const handleStatusEvent = (e: any) => {
      if (e.detail?.uuid === uuid && e.detail?.status) {
        setLiveState(e.detail.status);
      }
    };
    window.addEventListener('obsidian:server-status', handleStatusEvent);
    return () => window.removeEventListener('obsidian:server-status', handleStatusEvent);
  }, [uuid]);

  const powerMutation = useMutation({
    mutationFn: (action: 'start' | 'stop' | 'restart' | 'kill') =>
      fetchApi(`/api/client/servers/${uuid}/power`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }),
    onMutate: (action) => {
      if (action === 'start') setLiveState('starting');
      if (action === 'restart') setLiveState('starting');
      if (action === 'stop') setLiveState('stopping');
      if (action === 'kill') setLiveState('offline');
    },
    onSuccess: (_, action) => {
      setPowerFeedback(`Power action '${action}' dispatched`);
      setTimeout(() => setPowerFeedback(null), 4000);
      queryClient.invalidateQueries({ queryKey: ['server', uuid] });
    },
    onError: (err: any) => {
      setPowerFeedback(`Failed: ${err.message || 'Action error'}`);
      setTimeout(() => setPowerFeedback(null), 6000);
    },
  });

  const navTabs = [
    { label: 'Console', href: `/servers/${uuid}`, icon: Terminal },
    { label: 'Files', href: `/servers/${uuid}/files`, icon: FolderOpen },
    { label: 'Versions', href: `/servers/${uuid}/versions`, icon: Layers },
    { label: 'Databases', href: `/servers/${uuid}/databases`, icon: Database },
    { label: 'Schedules', href: `/servers/${uuid}/schedules`, icon: Calendar },
    { label: 'Backups', href: `/servers/${uuid}/backups`, icon: Archive },
    { label: 'Network', href: `/servers/${uuid}/network`, icon: Network },
    { label: 'Startup', href: `/servers/${uuid}/startup`, icon: Play },
    { label: 'Users', href: `/servers/${uuid}/users`, icon: Users },
    { label: 'Settings', href: `/servers/${uuid}/settings`, icon: Settings },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-16 bg-surface/50 border border-border rounded-card animate-pulse" />
        <div className="h-96 bg-surface/30 border border-border rounded-card animate-pulse" />
      </div>
    );
  }

  if (!server) {
    return (
      <div className="p-12 text-center">
        <p className="text-text-muted text-sm">Server not found or access denied.</p>
        <Link href="/servers" className="mt-4 inline-block">
          <Button variant="secondary">Back to Servers</Button>
        </Link>
      </div>
    );
  }

  const currentStatus = (liveState || server.liveStatus || server.status || 'offline').toLowerCase();

  const renderStatusBadge = () => {
    switch (currentStatus) {
      case 'running':
      case 'online':
        return <Badge variant="success" className="animate-pulse">ONLINE</Badge>;
      case 'starting':
        return <Badge variant="warning" className="border-amber-500/30 text-amber-400 bg-amber-500/10">STARTING</Badge>;
      case 'stopping':
        return <Badge variant="warning" className="border-amber-500/30 text-amber-400 bg-amber-500/10">STOPPING</Badge>;
      case 'installing':
        return <Badge variant="warning">INSTALLING</Badge>;
      case 'install_failed':
        return <Badge variant="error">INSTALL FAILED</Badge>;
      case 'suspended':
        return <Badge variant="error">SUSPENDED</Badge>;
      case 'offline':
      default:
        return <Badge variant="default" className="text-text-muted">OFFLINE</Badge>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Server Header Banner */}
      <div className="bg-surface border border-border rounded-card p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/servers"
              className="p-2 rounded-control bg-surface-elevated border border-border text-text-muted hover:text-text-primary transition-colors"
              title="Back to server list"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold text-text-primary tracking-tight">
                  {server.name}
                </h1>
                {renderStatusBadge()}
              </div>
              <p className="text-xs font-mono text-text-muted mt-0.5">
                {(server.node?.fqdn || server.allocation?.alias || server.allocation?.ip)}:{server.allocation?.port} &bull; Node: {server.node?.name} &bull; ID: {server.uuidShort}
              </p>
            </div>
          </div>

          {/* Real-Time Power Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {powerFeedback && (
              <span
                className={`text-xs px-2.5 py-1 rounded border font-mono animate-fade-in ${
                  powerFeedback.startsWith('Failed')
                    ? 'bg-status-stopping/10 border-status-stopping/30 text-status-stopping'
                    : 'bg-primary/10 border-primary/30 text-primary'
                }`}
              >
                {powerFeedback}
              </span>
            )}
            <div className="flex items-center gap-2">
              <Button
              variant="secondary"
              size="sm"
              disabled={powerMutation.isPending}
              onClick={() => powerMutation.mutate('start')}
              className="text-status-running hover:border-status-running/40"
            >
              <Play className="w-3.5 h-3.5 fill-status-running" /> Start
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={powerMutation.isPending}
              onClick={() => powerMutation.mutate('restart')}
              className="text-primary hover:border-primary/40"
            >
              <RotateCw className="w-3.5 h-3.5" /> Restart
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={powerMutation.isPending}
              onClick={() => powerMutation.mutate('stop')}
              className="text-status-stopping hover:border-status-stopping/40"
            >
              <Square className="w-3.5 h-3.5 fill-status-stopping" /> Stop
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={powerMutation.isPending}
              onClick={() => {
                if (confirm('Force kill server process?')) {
                  powerMutation.mutate('kill');
                }
              }}
            >
              <Power className="w-3.5 h-3.5" /> Kill
            </Button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 mt-5 pt-4 border-t border-border/60 overflow-x-auto">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-control text-xs font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-surface-elevated text-primary border border-border'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-elevated/40',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div>{children}</div>
    </div>
  );
}
