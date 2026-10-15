'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../../../../../lib/api';
import { Network, Server, Key, Copy, Check } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../../components/ui/card';
import { Badge } from '../../../../../components/ui/badge';

export default function ServerNetworkPage({
  params,
}: {
  params: { uuid: string };
}) {
  const uuid = params.uuid;

  const { data: server, isLoading } = useQuery({
    queryKey: ['server', uuid],
    queryFn: () => fetchApi(`/api/client/servers/${uuid}`),
  });

  const [copied, setCopied] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-text-muted">Loading network configuration...</div>;
  }

  return (
    <div className="space-y-6">
      {/* SFTP Connection Details */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>SFTP Connection Details</CardTitle>
            <CardDescription>
              Connect with any SFTP client (FileZilla, Cyberduck, WinSCP) using your Obsidian account password.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-3 bg-surface-elevated border border-border rounded-control">
            <span className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">
              SFTP Host / FQDN
            </span>
            <div className="flex items-center justify-between font-mono text-xs text-text-primary">
              <span>{server?.node.fqdn}</span>
              <button
                onClick={() => copyToClipboard(server?.node.fqdn, 'host')}
                className="text-text-muted hover:text-text-primary"
              >
                {copied === 'host' ? <Check className="w-3.5 h-3.5 text-status-running" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="p-3 bg-surface-elevated border border-border rounded-control">
            <span className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">
              SFTP Port
            </span>
            <div className="flex items-center justify-between font-mono text-xs text-text-primary">
              <span>{server?.node.daemonSftpPort || 2022}</span>
              <button
                onClick={() => copyToClipboard(String(server?.node.daemonSftpPort || 2022), 'port')}
                className="text-text-muted hover:text-text-primary"
              >
                {copied === 'port' ? <Check className="w-3.5 h-3.5 text-status-running" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="p-3 bg-surface-elevated border border-border rounded-control">
            <span className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">
              SFTP Username
            </span>
            <div className="flex items-center justify-between font-mono text-xs text-text-primary">
              <span>{server?.owner.username}.{server?.uuidShort}</span>
              <button
                onClick={() => copyToClipboard(`${server?.owner.username}.${server?.uuidShort}`, 'user')}
                className="text-text-muted hover:text-text-primary"
              >
                {copied === 'user' ? <Check className="w-3.5 h-3.5 text-status-running" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Network Allocations List */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Network Allocations</CardTitle>
            <CardDescription>
              IP addresses and ports bound to this game container on the Wings host.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="space-y-2">
          {/* Primary allocation */}
          <div className="flex items-center justify-between p-3.5 bg-surface-elevated border border-border rounded-control">
            <div className="flex items-center gap-3">
              <Network className="w-4 h-4 text-primary" />
              <div>
                <span className="font-mono text-xs font-semibold text-text-primary">
                  {server?.allocation.alias || server?.allocation.ip}:{server?.allocation.port}
                </span>
                {server?.allocation.alias && (
                  <span className="text-[11px] text-text-muted ml-2 font-mono">
                    ({server?.allocation.ip}:{server?.allocation.port})
                  </span>
                )}
              </div>
            </div>
            <Badge variant="info">PRIMARY ALLOCATION</Badge>
          </div>

          {/* Additional allocations */}
          {server?.allocations
            ?.filter((a: any) => a.id !== server?.allocationId)
            .map((alloc: any) => (
              <div
                key={alloc.id}
                className="flex items-center justify-between p-3.5 bg-surface-elevated/40 border border-border/80 rounded-control"
              >
                <div className="flex items-center gap-3">
                  <Network className="w-4 h-4 text-text-muted" />
                  <span className="font-mono text-xs text-text-primary">
                    {alloc.alias || alloc.ip}:{alloc.port}
                  </span>
                </div>
                <Badge variant="default">SECONDARY</Badge>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}
