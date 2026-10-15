'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../lib/api';
import { Server, Plus, Cpu, HardDrive, Activity, ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Card } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { formatMemory } from '../../../../lib/utils';
import Link from 'next/link';

export default function AdminServersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [nodeId, setNodeId] = useState<number | null>(null);
  const [allocationId, setAllocationId] = useState<number | null>(null);
  const [nestId, setNestId] = useState<number | null>(null);
  const [eggId, setEggId] = useState<number | null>(null);
  const [memory, setMemory] = useState(2048);
  const [cpu, setCpu] = useState(100);
  const [disk, setDisk] = useState(10240);

  // Queries
  const { data: servers, isLoading: isServersLoading } = useQuery<any[]>({
    queryKey: ['client-servers'],
    queryFn: () => fetchApi('/api/client/servers'),
  });

  const { data: users } = useQuery<any>({
    queryKey: ['admin-users-all'],
    queryFn: () => fetchApi('/api/admin/users?perPage=100'),
  });

  const { data: nodes } = useQuery<any[]>({
    queryKey: ['admin-nodes'],
    queryFn: () => fetchApi('/api/admin/nodes'),
  });

  const { data: allocations } = useQuery<any[]>({
    queryKey: ['admin-allocations', nodeId],
    queryFn: () => fetchApi(`/api/admin/nodes/${nodeId}/allocations?assigned=false`),
    enabled: nodeId !== null,
  });

  const { data: nests } = useQuery<any[]>({
    queryKey: ['admin-nests'],
    queryFn: () => fetchApi('/api/admin/nests'),
  });

  const { data: eggs } = useQuery<any[]>({
    queryKey: ['admin-eggs', nestId],
    queryFn: () => fetchApi(`/api/admin/eggs?nestId=${nestId}`),
    enabled: nestId !== null,
  });

  // Provisioning mutation
  const provisionMutation = useMutation({
    mutationFn: () =>
      fetchApi('/api/admin/servers', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          ownerId: Number(ownerId),
          nodeId: Number(nodeId),
          allocationId: Number(allocationId),
          nestId: Number(nestId),
          eggId: Number(eggId),
          memory: Number(memory),
          cpu: Number(cpu),
          disk: Number(disk),
        }),
      }),
    onSuccess: (data: any) => {
      setShowModal(false);
      alert('Server provisioned successfully to Wings node!');
      queryClient.invalidateQueries({ queryKey: ['client-servers'] });
      router.push(`/servers/${data.uuid}`);
    },
    onError: (err: any) => {
      alert(`Provisioning failed: ${err.message}`);
    },
  });

  const handleOpenModal = () => {
    if (users?.data?.length) setOwnerId(users.data[0].id);
    if (nodes?.length) setNodeId(nodes[0].id);
    if (nests?.length) setNestId(nests[0].id);
    setShowModal(true);
  };

  React.useEffect(() => {
    if (allocations?.length) setAllocationId(allocations[0].id);
  }, [allocations]);

  React.useEffect(() => {
    if (eggs?.length) setEggId(eggs[0].id);
  }, [eggs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Server Provisioning & Infrastructure
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Deploy game instances across Wings hosting nodes with resource limits
          </p>
        </div>

        <Button variant="primary" size="md" onClick={handleOpenModal}>
          <Plus className="w-4 h-4" /> Provision New Server
        </Button>
      </div>

      {/* Provisioning Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-xl bg-surface border border-border rounded-card p-6 space-y-4 my-8 shadow-2xl">
            <h3 className="text-sm font-bold text-text-primary">Deploy Game Server</h3>
            <p className="text-xs text-text-muted">
              Select an owner, node, unassigned allocation, and game egg to instruct Wings to build the container.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-text-secondary font-medium block mb-1">Server Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vanilla Minecraft SMP"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-text-secondary font-medium block mb-1">Owner</label>
                  <select
                    value={ownerId || ''}
                    onChange={(e) => setOwnerId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                  >
                    {users?.data?.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.username} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-text-secondary font-medium block mb-1">Target Node</label>
                  <select
                    value={nodeId || ''}
                    onChange={(e) => setNodeId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                  >
                    {nodes?.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} ({n.fqdn})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-text-secondary font-medium block mb-1">Primary Allocation</label>
                <select
                  value={allocationId || ''}
                  onChange={(e) => setAllocationId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary font-mono"
                >
                  {(allocations || []).length === 0 ? (
                    <option value="">No unassigned allocations available on this node</option>
                  ) : (
                    allocations?.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.ip}:{a.port} {a.alias ? `(${a.alias})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-text-secondary font-medium block mb-1">Nest</label>
                  <select
                    value={nestId || ''}
                    onChange={(e) => setNestId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                  >
                    {nests?.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-text-secondary font-medium block mb-1">Egg</label>
                  <select
                    value={eggId || ''}
                    onChange={(e) => setEggId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary focus:outline-none focus:border-primary"
                  >
                    {(eggs || []).length === 0 ? (
                      <option value="">No eggs in this nest</option>
                    ) : (
                      eggs?.map((e: any) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Resource Quotas */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                <div>
                  <label className="text-text-secondary font-medium block mb-1">Memory (MiB)</label>
                  <input
                    type="number"
                    value={memory}
                    onChange={(e) => setMemory(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary font-mono focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-text-secondary font-medium block mb-1">CPU Limit (%)</label>
                  <input
                    type="number"
                    value={cpu}
                    onChange={(e) => setCpu(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary font-mono focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-text-secondary font-medium block mb-1">Disk Space (MiB)</label>
                  <input
                    type="number"
                    value={disk}
                    onChange={(e) => setDisk(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-text-primary font-mono focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={provisionMutation.isPending || !name || !nodeId || !allocationId || !eggId}
                onClick={() => provisionMutation.mutate()}
              >
                {provisionMutation.isPending ? 'Provisioning...' : 'Provision Server'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Servers Table */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {isServersLoading ? (
          <div className="p-8 text-center text-xs text-text-muted">Loading servers...</div>
        ) : (servers || []).length === 0 ? (
          <div className="p-12 text-center text-xs text-text-muted">
            No servers provisioned yet. Click &quot;Provision New Server&quot; to deploy your first container.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated/40 border-b border-border text-[10px] uppercase font-medium text-text-muted">
              <tr>
                <th className="px-5 py-3">Server Name</th>
                <th className="px-5 py-3">Node</th>
                <th className="px-5 py-3">Address</th>
                <th className="px-5 py-3">Memory</th>
                <th className="px-5 py-3">CPU</th>
                <th className="px-5 py-3">Disk</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {servers?.map((server: any) => (
                <tr key={server.uuid} className="hover:bg-surface-elevated/20 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-text-primary flex items-center gap-2">
                    <Server className="w-4 h-4 text-primary" />
                    <Link href={`/servers/${server.uuid}`} className="hover:text-primary transition-colors">
                      {server.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary">
                    {server.node}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[11px] text-text-secondary">
                    {server.allocation}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[11px] text-text-secondary">
                    {formatMemory(server.limits.memory)}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[11px] text-text-secondary">
                    {server.limits.cpu}%
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[11px] text-text-secondary">
                    {formatMemory(server.limits.disk)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link href={`/servers/${server.uuid}`}>
                      <Button variant="secondary" size="sm">
                        View <ExternalLink className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
