'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../../lib/api';
import { RotateCcw, Trash2, AlertTriangle, Info, Sliders } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';

export default function ServerSettingsPage({
  params,
}: {
  params: { uuid: string };
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const uuid = params.uuid;

  const { data: server, isLoading } = useQuery({
    queryKey: ['server', uuid],
    queryFn: () => fetchApi(`/api/client/servers/${uuid}`),
  });

  const mcVar = server?.variables?.find((v: any) =>
    ['MINECRAFT_VERSION', 'MC_VERSION', 'VANILLA_VERSION'].includes(v.variable.envVariable)
  );

  const [selectedVersion, setSelectedVersion] = useState<string>('latest');
  const [customVersion, setCustomVersion] = useState<string>('latest');

  useEffect(() => {
    if (mcVar?.variableValue) {
      setSelectedVersion(mcVar.variableValue);
      setCustomVersion(mcVar.variableValue);
    }
  }, [mcVar?.variableValue]);

  const updateVersionMutation = useMutation({
    mutationFn: (newVersion: string) =>
      fetchApi(`/api/client/servers/${uuid}/variables`, {
        method: 'PATCH',
        body: JSON.stringify({
          variables: {
            [mcVar?.variable.envVariable || 'MINECRAFT_VERSION']: newVersion,
          },
        }),
      }),
    onSuccess: () => {
      alert('Minecraft version updated and synchronized with Wings! Restart or reinstall the server to apply the changes.');
      queryClient.invalidateQueries({ queryKey: ['server', uuid] });
    },
    onError: (err: any) => {
      alert(`Failed to update Minecraft version: ${err.message}`);
    },
  });

  const reinstallMutation = useMutation({
    mutationFn: () =>
      fetchApi(`/api/admin/servers/${uuid}/reinstall`, {
        method: 'POST',
      }),
    onSuccess: () => {
      alert('Reinstallation initiated on Wings daemon.');
      router.push(`/servers/${uuid}`);
    },
    onError: (err: any) => {
      alert(`Reinstall failed: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      fetchApi(`/api/admin/servers/${uuid}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      alert('Server deleted.');
      router.push('/servers');
    },
    onError: (err: any) => {
      alert(`Deletion failed: ${err.message}`);
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-text-muted">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Information Card */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Server Details</CardTitle>
            <CardDescription>
              Internal identifiers and hardware limits for this instance.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
          <div className="p-3 bg-surface-elevated border border-border rounded-control">
            <span className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">
              UUID (Pterodactyl Wings)
            </span>
            <span className="text-text-primary break-all">{server?.uuid}</span>
          </div>

          <div className="p-3 bg-surface-elevated border border-border rounded-control">
            <span className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">
              Short Identifier
            </span>
            <span className="text-text-primary">{server?.uuidShort}</span>
          </div>
        </div>
      </Card>

      {/* Minecraft Version Setting Card */}
      {(mcVar || server?.egg?.name?.toLowerCase().includes('minecraft') || server?.nest?.name?.toLowerCase().includes('minecraft')) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/15 text-primary rounded-control mt-0.5">
                <Sliders className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <CardTitle>Minecraft Version</CardTitle>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-primary">
                    Current: {mcVar?.variableValue || 'latest'}
                  </span>
                </div>
                <CardDescription>
                  Change the Minecraft server version. Wings will synchronize this variable and use it for server builds and reinstallation.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-text-secondary font-medium block mb-1">
                  Preset Versions
                </label>
                <select
                  value={
                    ['latest', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2'].includes(
                      selectedVersion
                    )
                      ? selectedVersion
                      : 'custom'
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedVersion(val);
                    if (val !== 'custom') {
                      setCustomVersion(val);
                    }
                  }}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary focus:outline-none focus:border-primary font-mono"
                >
                  <option value="latest">Latest Release (latest)</option>
                  <option value="1.21.1">1.21.1 (Java 21)</option>
                  <option value="1.21">1.21 (Java 21)</option>
                  <option value="1.20.6">1.20.6 (Java 21)</option>
                  <option value="1.20.4">1.20.4 (Java 17)</option>
                  <option value="1.20.2">1.20.2 (Java 17)</option>
                  <option value="1.20.1">1.20.1 (Java 17)</option>
                  <option value="1.19.4">1.19.4 (Java 17)</option>
                  <option value="1.18.2">1.18.2 (Java 17)</option>
                  <option value="1.16.5">1.16.5 (Java 11 / 8)</option>
                  <option value="1.12.2">1.12.2 (Java 8)</option>
                  <option value="custom">Custom Version...</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-text-secondary font-medium block mb-1">
                  Version String
                </label>
                <input
                  type="text"
                  value={customVersion}
                  onChange={(e) => {
                    setCustomVersion(e.target.value);
                    setSelectedVersion(e.target.value);
                  }}
                  placeholder="e.g. 1.20.4"
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-control text-xs text-text-primary focus:outline-none focus:border-primary font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                size="sm"
                disabled={updateVersionMutation.isPending || !customVersion.trim()}
                onClick={() => {
                  updateVersionMutation.mutate(customVersion.trim());
                }}
              >
                {updateVersionMutation.isPending ? 'Syncing with Wings...' : 'Save & Sync Version'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Danger Zone: Reinstall */}
      <Card className="border-status-stopping/30 bg-status-stopping/5">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-status-stopping/15 text-status-stopping rounded-control mt-0.5">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-status-stopping">Reinstall Server</CardTitle>
              <CardDescription>
                Reruns the egg installation script inside the container. Some game files might be overwritten or deleted.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <div className="pt-2">
          <Button
            variant="secondary"
            className="border-status-stopping/40 text-status-stopping hover:bg-status-stopping/10"
            disabled={reinstallMutation.isPending}
            onClick={() => {
              if (confirm('Are you sure you want to reinstall this game server?')) {
                reinstallMutation.mutate();
              }
            }}
          >
            Reinstall Server
          </Button>
        </div>
      </Card>

      {/* Danger Zone: Delete */}
      <Card className="border-status-error/30 bg-status-error/5">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-status-error/15 text-status-error rounded-control mt-0.5">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-status-error">Delete Server</CardTitle>
              <CardDescription>
                Permanently deletes the server container, all game data, allocations, and backups from the Wings node. This action cannot be undone.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <div className="pt-2">
          <Button
            variant="danger"
            disabled={deleteMutation.isPending}
            onClick={() => {
              const confirmName = prompt(`Type "${server?.name}" to confirm permanent deletion:`);
              if (confirmName === server?.name) {
                deleteMutation.mutate();
              }
            }}
          >
            Delete Server Permanently
          </Button>
        </div>
      </Card>
    </div>
  );
}
