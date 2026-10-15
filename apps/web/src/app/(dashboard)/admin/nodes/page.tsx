'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { formatMemory } from '../../../../lib/utils';

export default function AdminNodesPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [configNodeId, setConfigNodeId] = useState<number | null>(null);
  const [copiedConfig, setCopiedConfig] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [locationId, setLocationId] = useState<number>(1);
  const [fqdn, setFqdn] = useState('');
  const [scheme, setScheme] = useState('https');
  const [daemonPort, setDaemonPort] = useState(8080);
  const [daemonSftpPort, setDaemonSftpPort] = useState(2022);
  const [memory, setMemory] = useState(16384);
  const [disk, setDisk] = useState(102400);

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

  // Create node mutation
  const createMutation = useMutation({
    mutationFn: () =>
      fetchApi('/api/admin/nodes', {
        method: 'POST',
        body: JSON.stringify({
          name,
          locationId: Number(locationId),
          fqdn,
          scheme,
          daemonPort: Number(daemonPort),
          daemonSftpPort: Number(daemonSftpPort),
          memory: Number(memory),
          disk: Number(disk),
        }),
      }),
    onSuccess: () => {
      setShowCreateModal(false);
      setName('');
      setFqdn('');
      queryClient.invalidateQueries({ queryKey: ['admin-nodes'] });
    },
    onError: (err: any) => {
      alert(`Failed to create node: ${err.message}`);
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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Nodes Management
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Configure physical or virtual host machines running upstream Pterodactyl Wings
          </p>
        </div>

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
              Save this exact file on your hosting node to <code className="text-primary font-mono bg-surface-elevated px-1 py-0.5 rounded">/etc/pterodactyl/config.yml</code> and start the Wings service with <code className="text-text-primary font-mono bg-surface-elevated px-1 py-0.5 rounded">systemctl start wings</code>.
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

      {/* Create Node Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-surface border border-border rounded-card p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-text-primary">Register Wings Node</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-text-secondary font-medium block mb-1">Node Name</label>
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
                <label className="text-text-secondary font-medium block mb-1">Location</label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                >
                  {locations?.map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {l.short} — {l.long}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-text-secondary font-medium block mb-1">FQDN or Host IP</label>
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
                    <option value="https">https</option>
                    <option value="http">http</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-text-secondary font-medium block mb-1">Daemon Port</label>
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-text-secondary font-medium block mb-1">Memory (MiB)</label>
                  <input
                    type="number"
                    value={memory}
                    onChange={(e) => setMemory(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                  />
                </div>
                <div>
                  <label className="text-text-secondary font-medium block mb-1">Disk Space (MiB)</label>
                  <input
                    type="number"
                    value={disk}
                    onChange={(e) => setDisk(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={createMutation.isPending || !name || !fqdn}
                onClick={() => createMutation.mutate()}
              >
                Register Node
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {nodes?.map((node) => (
            <Card key={node.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-control bg-surface-elevated border border-border flex items-center justify-center text-primary">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">
                      {node.name}
                    </h3>
                    <p className="text-xs font-mono text-text-muted mt-0.5">
                      {node.scheme}://{node.fqdn}:{node.daemonPort} &bull; {node.location?.short}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => testConnMutation.mutate(node.id)}
                    title="Test authenticated connection to Wings daemon"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Test
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setConfigNodeId(node.id)}
                    title="View Wings config.yml"
                  >
                    <FileCode className="w-3.5 h-3.5" /> Config
                  </Button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete node ${node.name}?`)) {
                        deleteMutation.mutate(node.id);
                      }
                    }}
                    className="p-1.5 text-text-muted hover:text-status-error transition-colors rounded"
                    title="Delete Node"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Resource capacity usage bars */}
              <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-border/60">
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="text-text-muted">Memory Allocation</span>
                    <span className="font-mono text-text-primary">
                      {formatMemory(node.stats.allocatedMemory)} / {formatMemory(node.memory)}
                    </span>
                  </div>
                  <div className="w-full bg-surface-elevated rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all"
                      style={{ width: `${Math.min(node.stats.memoryUsagePercent, 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="text-text-muted">Disk Allocation</span>
                    <span className="font-mono text-text-primary">
                      {formatMemory(node.stats.allocatedDisk)} / {formatMemory(node.disk)}
                    </span>
                  </div>
                  <div className="w-full bg-surface-elevated rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-status-stopping h-full transition-all"
                      style={{ width: `${Math.min(node.stats.diskUsagePercent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 text-[11px] font-mono text-text-muted">
                <span>Total Servers: {node.stats.totalServers}</span>
                <span>Total Allocations: {node.stats.totalAllocations}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
