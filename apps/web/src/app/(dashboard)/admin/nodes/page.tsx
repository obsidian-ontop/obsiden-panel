'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../lib/api';
import {
  HardDrive,
  Plus,
  Activity,
  CheckCircle,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Server,
  FileCode,
  X,
  Trash2,
  Network,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { formatMemory } from '../../../../lib/utils';

// Corner metallic hex screw/rivet component for skeuomorphic server chassis
function HexRivet() {
  return (
    <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-zinc-300 via-zinc-600 to-zinc-900 border border-zinc-700/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.9)] flex items-center justify-center">
      <div className="w-[4px] h-[0.75px] bg-zinc-900 rotate-45" />
    </div>
  );
}

// Skeuomorphic discrete multi-segment tactile LED bar for nodes
function SkeuomorphicNodeBar({
  percent,
  color = 'cyan',
}: {
  percent: number;
  color?: 'cyan' | 'amber' | 'emerald' | 'purple';
}) {
  const total = 16;
  const active = Math.round((Math.max(0, Math.min(100, percent)) / 100) * total);

  return (
    <div className="relative p-1 rounded bg-[#06080d] border border-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.95),0_1px_0_rgba(255,255,255,0.06)] overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[35%] bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
      <div className="flex items-center gap-[2.5px]">
        {Array.from({ length: total }).map((_, idx) => {
          const isLit = idx < active;
          const isWarning = idx >= 11 && idx < 14;
          const isCritical = idx >= 14;

          let litStyle = 'bg-[#06b6d4] shadow-[0_0_8px_#06b6d4,inset_0_1px_1px_#a5f3fc]';
          if (color === 'emerald') litStyle = 'bg-[#10b981] shadow-[0_0_8px_#10b981,inset_0_1px_1px_#a7f3d0]';
          if (color === 'amber') litStyle = 'bg-[#f59e0b] shadow-[0_0_8px_#f59e0b,inset_0_1px_1px_#fde68a]';
          if (color === 'purple') litStyle = 'bg-[#a855f7] shadow-[0_0_8px_#a855f7,inset_0_1px_1px_#e9d5ff]';

          if (isWarning) litStyle = 'bg-[#f59e0b] shadow-[0_0_8px_#f59e0b,inset_0_1px_1px_#fde68a]';
          if (isCritical) litStyle = 'bg-[#ef4444] shadow-[0_0_8px_#ef4444,inset_0_1px_1px_#fecaca]';

          const unlitStyle = isCritical ? 'bg-[#290d0d]' : isWarning ? 'bg-[#281809]' : 'bg-[#09121c]';

          return (
            <div
              key={idx}
              className={`flex-1 h-2 rounded-[1px] transition-all duration-150 ${isLit ? litStyle : unlitStyle}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function NodeHeartbeatBadge({ nodeId }: { nodeId: number }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['node-heartbeat', nodeId],
    queryFn: () => fetchApi(`/api/admin/nodes/${nodeId}/test-connection`, { method: 'POST' }),
    refetchInterval: 12000,
    retry: false,
  });

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#070a10] border border-black shadow-[inset_0_1px_3px_rgba(0,0,0,0.9)] text-[10px] font-mono text-zinc-400">
        <span className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse" />
        POLLING...
      </span>
    );
  }

  if (data?.online) {
    return (
      <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#070a10] border border-black shadow-[inset_0_1px_3px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.06)] text-[10px] font-mono text-emerald-400 font-bold">
        {/* Optical jewel LED lens */}
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-running opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 shadow-[0_0_8px_#10b981]"></span>
        </span>
        WINGS ONLINE {data.systemInfo?.version ? `(${data.systemInfo.version})` : ''}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#070a10] border border-black shadow-[inset_0_1px_3px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.06)] text-[10px] font-mono text-rose-400 font-bold">
      <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_#ef4444]"></span>
      WINGS OFFLINE
    </span>
  );
}

export default function AdminNodesPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [configNodeId, setConfigNodeId] = useState<number | null>(null);
  const [allocationsNodeId, setAllocationsNodeId] = useState<number | null>(null);
  const [copiedConfig, setCopiedConfig] = useState(false);

  // Form state for node creation
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [locationId, setLocationId] = useState<number>(1);
  const [fqdn, setFqdn] = useState('');
  const [scheme, setScheme] = useState('https');
  const [behindProxy, setBehindProxy] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [daemonPort, setDaemonPort] = useState(8080);
  const [daemonSftpPort, setDaemonSftpPort] = useState(2022);
  const [memory, setMemory] = useState(16384);
  const [memoryOverallocate, setMemoryOverallocate] = useState(0);
  const [disk, setDisk] = useState(102400);
  const [diskOverallocate, setDiskOverallocate] = useState(0);
  const [uploadSize, setUploadSize] = useState(100);

  // Initial port allocations options
  const [createAllocations, setCreateAllocations] = useState(true);
  const [initialIp, setInitialIp] = useState('0.0.0.0');
  const [initialPorts, setInitialPorts] = useState('25565-25575');

  // In-modal quick allocation state
  const [newAllocIp, setNewAllocIp] = useState('0.0.0.0');
  const [newAllocPorts, setNewAllocPorts] = useState('');

  // Queries
  const { data: nodes, isLoading } = useQuery<any[]>({
    queryKey: ['admin-nodes'],
    queryFn: () => fetchApi('/api/admin/nodes'),
  });

  const { data: locations } = useQuery<any[]>({
    queryKey: ['admin-locations'],
    queryFn: () => fetchApi('/api/admin/locations'),
  });

  const { data: nodeConfigYaml, isLoading: isConfigLoading } = useQuery<{ yaml: string }>({
    queryKey: ['node-config-yaml', configNodeId],
    queryFn: () => fetchApi(`/api/admin/nodes/${configNodeId}/configuration`),
    enabled: configNodeId !== null,
  });

  const { data: nodeAllocations, isLoading: isAllocationsLoading } = useQuery<any[]>({
    queryKey: ['admin-node-allocations', allocationsNodeId],
    queryFn: () => fetchApi(`/api/admin/nodes/${allocationsNodeId}/allocations`),
    enabled: allocationsNodeId !== null,
  });

  // Create node mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const newNode = await fetchApi('/api/admin/nodes', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          locationId: Number(locationId),
          fqdn,
          scheme,
          behindProxy,
          daemonPort: Number(daemonPort),
          daemonSftpPort: Number(daemonSftpPort),
          memory: Number(memory),
          memoryOverallocate: Number(memoryOverallocate),
          disk: Number(disk),
          diskOverallocate: Number(diskOverallocate),
          uploadSize: Number(uploadSize),
        }),
      });

      // Optionally create initial port allocations
      if (createAllocations && initialPorts.trim() && newNode?.id) {
        try {
          await fetchApi(`/api/admin/nodes/${newNode.id}/allocations`, {
            method: 'POST',
            body: JSON.stringify({
              ip: initialIp.trim() || '0.0.0.0',
              ports: initialPorts.split(',').map((p) => p.trim()),
            }),
          });
        } catch (e: any) {
          console.warn('Initial allocations failed:', e.message);
        }
      }

      return newNode;
    },
    onSuccess: () => {
      setShowCreateModal(false);
      setName('');
      setDescription('');
      setFqdn('');
      queryClient.invalidateQueries({ queryKey: ['admin-nodes'] });
    },
    onError: (err: any) => {
      alert(`Failed to create node: ${err.message}`);
    },
  });

  // Quick add allocation mutation
  const addAllocMutation = useMutation({
    mutationFn: async () => {
      if (!allocationsNodeId || !newAllocPorts.trim()) return;
      return fetchApi(`/api/admin/nodes/${allocationsNodeId}/allocations`, {
        method: 'POST',
        body: JSON.stringify({
          ip: newAllocIp.trim() || '0.0.0.0',
          ports: newAllocPorts.split(',').map((p) => p.trim()),
        }),
      });
    },
    onSuccess: (data: any) => {
      setNewAllocPorts('');
      queryClient.invalidateQueries({ queryKey: ['admin-node-allocations', allocationsNodeId] });
      queryClient.invalidateQueries({ queryKey: ['admin-nodes'] });
      alert(`Successfully added ${data.created || 'port'} allocation(s)!`);
    },
    onError: (err: any) => {
      alert(`Failed to add allocation: ${err.message}`);
    },
  });

  // Delete allocation mutation
  const deleteAllocMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/api/admin/allocations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-node-allocations', allocationsNodeId] });
      queryClient.invalidateQueries({ queryKey: ['admin-nodes'] });
    },
    onError: (err: any) => {
      alert(err.message);
    },
  });

  // Test connection mutation
  const testConnMutation = useMutation({
    mutationFn: (nodeId: number) =>
      fetchApi(`/api/admin/nodes/${nodeId}/test-connection`, { method: 'POST' }),
    onSuccess: (data: any) => {
      if (data.online) {
        alert(`✅ Wings Online!\nVersion: ${data.systemInfo?.version}\nOS: ${data.systemInfo?.os}\nCPUs: ${data.systemInfo?.cpu_count}`);
      } else {
        alert(`❌ Connection Failed:\n${data.message}`);
      }
    },
  });

  // Delete node mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/api/admin/nodes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-nodes'] });
    },
    onError: (err: any) => {
      alert(err.message);
    },
  });

  const copyYaml = () => {
    if (nodeConfigYaml?.yaml) {
      navigator.clipboard.writeText(nodeConfigYaml.yaml);
      setCopiedConfig(true);
      setTimeout(() => setCopiedConfig(false), 2000);
    }
  };

  const selectedAllocNode = nodes?.find((n) => n.id === allocationsNodeId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Nodes Management
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Configure host machines, resource limits, and network port pools running Pterodactyl Wings
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/admin/allocations">
            <Button variant="secondary" size="md">
              <Network className="w-4 h-4" /> All Allocations
            </Button>
          </Link>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              if (locations?.length) setLocationId(locations[0].id);
              setShowCreateModal(true);
            }}
          >
            <Plus className="w-4 h-4" /> Register Node
          </Button>
        </div>
      </div>

      {/* Wings Config Modal */}
      {configNodeId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-surface border border-border rounded-card p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-text-primary">
                  Official Wings Configuration (config.yml)
                </h3>
              </div>
              <button
                onClick={() => setConfigNodeId(null)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-text-muted">
              Save this exact file on your hosting node to <code className="text-primary font-mono bg-surface-elevated px-1 py-0.5 rounded">/etc/pterodactyl/config.yml</code> and start Wings with <code className="text-text-primary font-mono bg-surface-elevated px-1 py-0.5 rounded">systemctl start wings</code>.
            </p>

            <div className="relative">
              <pre className="p-4 bg-[#090909] border border-border rounded-control font-mono text-xs text-text-primary max-h-80 overflow-y-auto">
                {isConfigLoading ? 'Generating configuration...' : nodeConfigYaml?.yaml}
              </pre>
              <button
                onClick={copyYaml}
                className="absolute top-3 right-3 px-2.5 py-1 bg-surface-elevated hover:bg-surface border border-border rounded text-xs text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors"
              >
                {copiedConfig ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-status-running" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy YAML
                  </>
                )}
              </button>
            </div>

            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setConfigNodeId(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Node In-Page Allocations Manager Modal */}
      {allocationsNodeId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-surface border border-border rounded-card p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-sm font-bold text-text-primary">
                    Port Allocations &mdash; {selectedAllocNode?.name}
                  </h3>
                  <p className="text-[11px] text-text-muted font-mono">{selectedAllocNode?.fqdn}</p>
                </div>
              </div>
              <button
                onClick={() => setAllocationsNodeId(null)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Add Ports */}
            <div className="p-3 bg-surface-elevated border border-border rounded-control space-y-2">
              <span className="text-xs font-semibold text-text-primary block">Quick Add Port Allocations</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-text-muted block mb-0.5">IP Address</label>
                  <input
                    type="text"
                    value={newAllocIp}
                    onChange={(e) => setNewAllocIp(e.target.value)}
                    placeholder="0.0.0.0 or Node IP"
                    className="w-full px-2.5 py-1.5 bg-surface border border-border rounded text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-text-muted block mb-0.5">Ports (e.g. 25565 or 25565-25575)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newAllocPorts}
                      onChange={(e) => setNewAllocPorts(e.target.value)}
                      placeholder="25565, 25566, 25570-25580"
                      className="flex-1 px-2.5 py-1.5 bg-surface border border-border rounded text-xs text-text-primary font-mono focus:outline-none focus:border-primary"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={addAllocMutation.isPending || !newAllocPorts.trim()}
                      onClick={() => addAllocMutation.mutate()}
                    >
                      {addAllocMutation.isPending ? 'Adding...' : 'Add Ports'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Allocations Table */}
            <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[350px] border border-border rounded-control">
              {isAllocationsLoading ? (
                <div className="p-8 text-center text-xs text-text-muted">Loading allocations...</div>
              ) : (nodeAllocations || []).length === 0 ? (
                <div className="p-8 text-center text-xs text-text-muted">
                  No allocations found on this node. Use the quick add form above to allocate port pools.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-elevated border-b border-border text-text-muted font-medium sticky top-0">
                    <tr>
                      <th className="px-3 py-2">IP Address</th>
                      <th className="px-3 py-2">Port</th>
                      <th className="px-3 py-2">Alias</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {nodeAllocations?.map((alloc: any) => (
                      <tr key={alloc.id} className="hover:bg-surface-elevated/40">
                        <td className="px-3 py-2 font-mono text-text-primary">{alloc.ip}</td>
                        <td className="px-3 py-2 font-mono font-bold text-primary">{alloc.port}</td>
                        <td className="px-3 py-2 text-text-muted">{alloc.alias || '&mdash;'}</td>
                        <td className="px-3 py-2">
                          {alloc.serverId ? (
                            <Badge variant="success">Assigned (Server #{alloc.serverId})</Badge>
                          ) : (
                            <Badge variant="outline">Available</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {!alloc.serverId && (
                            <button
                              onClick={() => deleteAllocMutation.mutate(alloc.id)}
                              className="text-text-muted hover:text-status-error transition-colors p-1"
                              title="Delete Port"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-[11px] text-text-muted">
                Total allocations: <strong>{nodeAllocations?.length || 0}</strong>
              </span>
              <Button variant="secondary" size="sm" onClick={() => setAllocationsNodeId(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Node Modal (Full Pterodactyl Options) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-xl bg-surface border border-border rounded-card p-6 space-y-4 shadow-2xl my-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-primary" /> Register Wings Node
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs max-h-[70vh] overflow-y-auto pr-1">
              {/* Section 1: Basic Node Info */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider">
                  1. Basic Details
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Node Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. US-Node-01"
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Location *</label>
                    <select
                      value={locationId}
                      onChange={(e) => setLocationId(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                    >
                      {locations?.map((l: any) => (
                        <option key={l.id} value={l.id}>
                          {l.short} &mdash; {l.long}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-text-secondary font-medium block mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Ryzen 9 7950X, 128GB DDR5, High Performance Node"
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Section 2: Host & Connectivity */}
              <div className="space-y-3 pt-2 border-t border-border">
                <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider">
                  2. Connectivity & Security
                </h4>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-text-secondary font-medium block mb-1">FQDN or Host IP *</label>
                    <input
                      type="text"
                      required
                      value={fqdn}
                      onChange={(e) => setFqdn(e.target.value)}
                      placeholder="node1.example.com"
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Scheme</label>
                    <select
                      value={scheme}
                      onChange={(e) => setScheme(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                    >
                      <option value="https">https (SSL)</option>
                      <option value="http">http (Non-SSL)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Daemon Listen Port</label>
                    <input
                      type="number"
                      value={daemonPort}
                      onChange={(e) => setDaemonPort(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Daemon SFTP Port</label>
                    <input
                      type="number"
                      value={daemonSftpPort}
                      onChange={(e) => setDaemonSftpPort(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-text-secondary">
                    <input
                      type="checkbox"
                      checked={behindProxy}
                      onChange={(e) => setBehindProxy(e.target.checked)}
                      className="rounded border-border bg-surface-elevated text-primary focus:ring-0"
                    />
                    <span>Behind Proxy (Cloudflare / SSL terminator)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-text-secondary">
                    <input
                      type="checkbox"
                      checked={maintenanceMode}
                      onChange={(e) => setMaintenanceMode(e.target.checked)}
                      className="rounded border-border bg-surface-elevated text-primary focus:ring-0"
                    />
                    <span>Maintenance Mode</span>
                  </label>
                </div>
              </div>

              {/* Section 3: Hardware Resources & Overallocation */}
              <div className="space-y-3 pt-2 border-t border-border">
                <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider">
                  3. Hardware Allocations & Limits
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Total Memory (MiB)</label>
                    <input
                      type="number"
                      value={memory}
                      onChange={(e) => setMemory(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Memory Overallocate (%)</label>
                    <input
                      type="number"
                      value={memoryOverallocate}
                      onChange={(e) => setMemoryOverallocate(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Total Disk Space (MiB)</label>
                    <input
                      type="number"
                      value={disk}
                      onChange={(e) => setDisk(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-text-secondary font-medium block mb-1">Disk Overallocate (%)</label>
                    <input
                      type="number"
                      value={diskOverallocate}
                      onChange={(e) => setDiskOverallocate(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-text-secondary font-medium block mb-1">Max Web Upload Size (MiB)</label>
                  <input
                    type="number"
                    value={uploadSize}
                    onChange={(e) => setUploadSize(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              {/* Section 4: Initial Port Allocations (Like Pterodactyl) */}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider">
                    4. Initial Port Allocation (Pterodactyl Style)
                  </h4>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-text-secondary">
                    <input
                      type="checkbox"
                      checked={createAllocations}
                      onChange={(e) => setCreateAllocations(e.target.checked)}
                      className="rounded border-border bg-surface-elevated text-primary focus:ring-0"
                    />
                    <span>Create ports immediately</span>
                  </label>
                </div>

                {createAllocations && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-surface-elevated border border-border rounded-control">
                    <div>
                      <label className="text-text-secondary font-medium block mb-1">Allocation IP</label>
                      <input
                        type="text"
                        value={initialIp}
                        onChange={(e) => setInitialIp(e.target.value)}
                        placeholder="0.0.0.0 or Node IP"
                        className="w-full px-3 py-2 bg-surface border border-border rounded-control text-text-primary font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-text-secondary font-medium block mb-1">Ports Range / List</label>
                      <input
                        type="text"
                        value={initialPorts}
                        onChange={(e) => setInitialPorts(e.target.value)}
                        placeholder="25565-25575 or 25565, 25566"
                        className="w-full px-3 py-2 bg-surface border border-border rounded-control text-text-primary font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                    <p className="text-[10px] text-text-muted col-span-2">
                      Tip: Specify individual ports separated by commas, or port ranges using hyphens (e.g. <code className="text-primary font-mono">25565-25575, 27015-27020</code>).
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={createMutation.isPending || !name || !fqdn}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Registering...' : 'Register Node'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Nodes List / Zero State */}
      {isLoading ? (
        <div className="p-8 text-center text-xs text-text-muted">Loading nodes...</div>
      ) : (nodes || []).length === 0 ? (
        <div className="border border-border/80 border-dashed rounded-card p-12 text-center bg-surface/30">
          <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-text-muted mx-auto mb-4">
            <HardDrive className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-text-primary">
            No nodes connected
          </h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto mt-1 mb-6">
            Register your first Wings game-hosting node. Once registered, you will be given an official configuration file to paste onto the daemon machine.
          </p>
          <Button
            variant="primary"
            onClick={() => {
              if (locations?.length) setLocationId(locations[0].id);
              setShowCreateModal(true);
            }}
          >
            <Plus className="w-4 h-4" /> Register First Node
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {nodes?.map((node) => (
            <div
              key={node.id}
              className="bg-gradient-to-b from-[#1c222d] via-[#141821] to-[#0c0f16] border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.8)] rounded-card p-5 relative overflow-hidden flex flex-col justify-between gap-4"
            >
              {/* Top Faceplate Header with Screws */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-[#070a10] border border-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.08)] flex items-center justify-center text-primary">
                    <Server className="w-5 h-5 drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-sm font-bold font-mono tracking-tight text-text-primary drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        {node.name}
                      </h3>
                      <NodeHeartbeatBadge nodeId={node.id} />
                    </div>
                    <p className="text-xs font-mono text-zinc-400 mt-0.5">
                      {node.scheme}://{node.fqdn}:{node.daemonPort} &bull; <span className="text-primary font-semibold">{node.location?.short}</span>
                    </p>
                  </div>
                </div>

                {/* Tactile Hardware Action Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setAllocationsNodeId(node.id)}
                    title="Manage Port Allocations for this Node"
                    className="px-2.5 py-1 rounded bg-gradient-to-b from-[#222938] to-[#141824] border border-white/10 hover:border-primary/50 text-text-secondary hover:text-text-primary shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)] text-xs font-mono font-medium flex items-center gap-1.5 transition-all"
                  >
                    <Network className="w-3.5 h-3.5 text-primary" /> Allocations
                  </button>
                  <button
                    onClick={() => testConnMutation.mutate(node.id)}
                    title="Test authenticated connection to Wings daemon"
                    className="px-2.5 py-1 rounded bg-gradient-to-b from-[#222938] to-[#141824] border border-white/10 hover:border-primary/50 text-text-secondary hover:text-text-primary shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)] text-xs font-mono font-medium flex items-center gap-1.5 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-400" /> Test
                  </button>
                  <button
                    onClick={() => setConfigNodeId(node.id)}
                    title="View Wings config.yml"
                    className="px-2.5 py-1 rounded bg-gradient-to-b from-[#222938] to-[#141824] border border-white/10 hover:border-primary/50 text-text-secondary hover:text-text-primary shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)] text-xs font-mono font-medium flex items-center gap-1.5 transition-all"
                  >
                    <FileCode className="w-3.5 h-3.5 text-sky-400" /> Config
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete node ${node.name}?`)) {
                        deleteMutation.mutate(node.id);
                      }
                    }}
                    className="p-1.5 rounded bg-gradient-to-b from-[#2a1719] to-[#1a0f11] border border-rose-500/20 text-zinc-400 hover:text-rose-400 shadow-[0_2px_4px_rgba(0,0,0,0.5)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)] transition-colors"
                    title="Delete Node"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Skeuomorphic Resource Allocation Gauges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-3 border-t border-white/[0.06]">
                {/* Memory Allocation Gauge */}
                <div className="p-3 rounded-md bg-[#07090e] border border-black shadow-[inset_0_2px_5px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.06)] space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Activity className="w-3 h-3 text-cyan-400" /> Memory Pool
                    </span>
                    <span className="text-cyan-400 font-bold drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]">
                      {Math.round(node.stats.memoryUsagePercent)}%
                    </span>
                  </div>
                  <SkeuomorphicNodeBar percent={node.stats.memoryUsagePercent} color="cyan" />
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                    <span>ALLOCATED</span>
                    <span className="text-zinc-300 font-bold">
                      {formatMemory(node.stats.allocatedMemory)} / {formatMemory(node.memory)}
                    </span>
                  </div>
                </div>

                {/* Disk Allocation Gauge */}
                <div className="p-3 rounded-md bg-[#07090e] border border-black shadow-[inset_0_2px_5px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.06)] space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <HardDrive className="w-3 h-3 text-amber-400" /> Storage Pool
                    </span>
                    <span className="text-amber-400 font-bold drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]">
                      {Math.round(node.stats.diskUsagePercent)}%
                    </span>
                  </div>
                  <SkeuomorphicNodeBar percent={node.stats.diskUsagePercent} color="amber" />
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                    <span>ALLOCATED</span>
                    <span className="text-zinc-300 font-bold">
                      {formatMemory(node.stats.allocatedDisk)} / {formatMemory(node.disk)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Skeuomorphic Real-time Telemetry Spectrum Analyzer */}
              <div className="p-3 rounded-md bg-[#05070c] border border-black shadow-[inset_0_3px_6px_rgba(0,0,0,0.95),0_1px_0_rgba(255,255,255,0.06)] relative overflow-hidden">
                <div
                  className="absolute inset-0 pointer-events-none opacity-20 z-10"
                  style={{
                    background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.8), rgba(0,0,0,0.8) 1px, transparent 1px, transparent 2px)',
                  }}
                />
                <div className="flex items-center justify-between text-[10.5px] font-mono mb-2 relative z-20">
                  <span className="text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 font-bold">
                    <Activity className="w-3 h-3 text-emerald-400" /> Daemon Telemetry Analyzer
                  </span>
                  <span className="text-[10px] text-zinc-500 uppercase">12s Pulse</span>
                </div>

                <div className="h-10 w-full flex items-end gap-1.5 pt-1 relative z-20">
                  {[25, 45, 30, 60, 40, 75, 50, Math.round(node.stats.memoryUsagePercent || 15), Math.round(node.stats.diskUsagePercent || 10)].map((val, idx) => (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col justify-end gap-[1px] h-full"
                    >
                      <div
                        className="w-full rounded-[1px] transition-all duration-500 bg-emerald-400 shadow-[0_0_8px_#10b981]"
                        style={{ height: `${Math.max(15, Math.min(val, 100))}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Chassis Details Bar with Hex Screws */}
              <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[11px] font-mono text-zinc-400">
                <div className="flex items-center gap-2">
                  <HexRivet />
                  <span>SERVERS: <strong className="text-text-primary">{node.stats.totalServers}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span>PORTS: <strong className="text-text-primary">{node.stats.totalAllocations}</strong></span>
                  <button
                    onClick={() => setAllocationsNodeId(node.id)}
                    className="text-primary hover:underline font-semibold"
                  >
                    (Manage)
                  </button>
                  <HexRivet />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
