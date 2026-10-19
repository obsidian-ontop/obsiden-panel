'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../../../../lib/api';
import {
  Layers,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  Server,
  Zap,
  Play,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Info,
  RefreshCw,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';
import { Badge } from '../../../../../components/ui/badge';
import { Input } from '../../../../../components/ui/input';

interface VersionItem {
  version: string;
  build?: string;
  releaseType: 'release' | 'snapshot' | 'lts';
  javaVersion: string;
  downloadUrl?: string;
}

interface SoftwareCatalog {
  id: string;
  name: string;
  type: 'server' | 'proxy' | 'modded';
  description: string;
  icon: string;
  defaultJar: string;
  recommendedJava: string;
  versions: VersionItem[];
}

export default function ServerVersionManagerPage({
  params,
}: {
  params: { uuid: string };
}) {
  const uuid = params.uuid;
  const queryClient = useQueryClient();

  const [selectedSoftwareId, setSelectedSoftwareId] = useState<string>('paper');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedReleaseType, setSelectedReleaseType] = useState<string>('all');
  const [installingVersion, setInstallingVersion] = useState<VersionItem | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch Server details for current jar & variables
  const { data: server } = useQuery({
    queryKey: ['server', uuid],
    queryFn: () => fetchApi(`/api/client/servers/${uuid}`),
  });

  // Fetch Version catalog
  const { data: catalog = [], isLoading } = useQuery<SoftwareCatalog[]>({
    queryKey: ['server-versions', uuid],
    queryFn: () => fetchApi<SoftwareCatalog[]>(`/api/client/servers/${uuid}/versions`),
    staleTime: 10 * 60 * 1000,
  });

  // Install version mutation
  const installMutation = useMutation({
    mutationFn: (payload: { software: string; version: string; customJarName?: string }) =>
      fetchApi(`/api/client/servers/${uuid}/versions/install`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data: any) => {
      setFeedback({
        type: 'success',
        message: data?.message || 'Software version installed successfully! You can now start the server.',
      });
      setInstallingVersion(null);
      queryClient.invalidateQueries({ queryKey: ['server', uuid] });
      queryClient.invalidateQueries({ queryKey: ['server-files', uuid] });
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        message: `Installation failed: ${err.message || 'Unknown network error'}`,
      });
      setInstallingVersion(null);
    },
  });

  const selectedSoftware = catalog.find((s) => s.id === selectedSoftwareId) || catalog[0];

  const filteredVersions = (selectedSoftware?.versions || []).filter((v) => {
    const matchesSearch = v.version.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedReleaseType === 'all' || v.releaseType === selectedReleaseType;
    return matchesSearch && matchesType;
  });

  // Find active jar
  const jarVar = server?.variables?.find((v: any) =>
    server?.egg?.variables?.some((ev: any) => ev.id === v.variableId && ev.envVariable === 'SERVER_JARFILE'),
  );
  const currentJar = jarVar?.variableValue || 'paper.jar';

  const handleInstallClick = (item: VersionItem) => {
    setInstallingVersion(item);
  };

  const confirmInstall = () => {
    if (!installingVersion || !selectedSoftware) return;
    setFeedback(null);
    installMutation.mutate({
      software: selectedSoftware.id,
      version: installingVersion.version,
      customJarName: selectedSoftware.defaultJar,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-card bg-surface border border-border">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold text-text-primary tracking-tight">Software Version Manager</h1>
            <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
              Blueprint Compatible
            </Badge>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Seamlessly switch between PaperMC, Purpur, Velocity, Fabric, or Vanilla builds with 1-click automatic installation.
          </p>
        </div>

        {/* Current Server Setup Badge */}
        <div className="flex items-center gap-3 p-2.5 px-4 rounded-control bg-surface-elevated border border-border">
          <div className="w-2 h-2 rounded-full bg-status-running animate-pulse" />
          <div className="text-left">
            <span className="text-[10px] text-text-muted uppercase tracking-wider block">Active Server JAR</span>
            <span className="text-xs font-mono font-medium text-text-primary">{currentJar}</span>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-control border text-xs flex items-center justify-between gap-3 animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-status-running/10 border-status-running/30 text-status-running'
              : 'bg-status-stopping/10 border-status-stopping/30 text-status-stopping'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          {feedback.type === 'success' && (
            <a
              href={`/servers/${uuid}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-status-running text-black font-semibold rounded text-[11px] hover:bg-status-running/90 transition-colors"
            >
              Go to Console <ArrowRight className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {/* Software Tabs Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {catalog.map((sw) => {
          const isSelected = sw.id === selectedSoftwareId;
          return (
            <button
              key={sw.id}
              onClick={() => {
                setSelectedSoftwareId(sw.id);
                setSearchQuery('');
              }}
              className={`p-3 rounded-card text-left transition-all border flex flex-col justify-between gap-1.5 ${
                isSelected
                  ? 'bg-primary/10 border-primary text-primary shadow-sm'
                  : 'bg-surface hover:bg-surface-elevated border-border text-text-muted hover:text-text-primary'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold truncate">{sw.name}</span>
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-surface-elevated text-text-muted border border-border">
                  {sw.type}
                </span>
              </div>
              <span className="text-[10px] text-text-muted truncate">{sw.recommendedJava}</span>
            </button>
          );
        })}
      </div>

      {/* Selected Software Details & Versions View */}
      {selectedSoftware && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
              <div>
                <div className="flex items-center gap-2.5">
                  <CardTitle>{selectedSoftware.name}</CardTitle>
                  <Badge variant="outline" className="text-[10px]">
                    Default: {selectedSoftware.defaultJar}
                  </Badge>
                </div>
                <CardDescription className="mt-1 text-xs">{selectedSoftware.description}</CardDescription>
              </div>

              {/* Filters & Search */}
              <div className="flex items-center gap-2">
                <div className="relative min-w-[180px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <Input
                    placeholder="Search version..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs bg-surface-elevated border-border"
                  />
                </div>

                <div className="flex items-center rounded-control bg-surface-elevated border border-border p-0.5 text-[11px]">
                  {['all', 'release', 'lts'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedReleaseType(type)}
                      className={`px-2.5 py-1 rounded capitalize transition-colors ${
                        selectedReleaseType === type
                          ? 'bg-primary text-black font-semibold'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>

          {/* Versions Table / Grid */}
          <div className="p-4 pt-0">
            {isLoading ? (
              <div className="p-12 text-center text-xs text-text-muted animate-pulse">
                Loading supported versions...
              </div>
            ) : filteredVersions.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">
                No versions found matching &quot;{searchQuery}&quot;.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredVersions.map((v) => {
                  const isCurrent = currentJar.includes(selectedSoftware.id) || v.version === server?.startup;
                  return (
                    <div
                      key={v.version}
                      className="p-3.5 rounded-control bg-surface-elevated border border-border hover:border-border-active transition-all flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-text-primary font-mono">{v.version}</span>
                          <span
                            className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-semibold ${
                              v.releaseType === 'lts'
                                ? 'bg-primary/20 text-primary border border-primary/30'
                                : 'bg-surface border border-border text-text-muted'
                            }`}
                          >
                            {v.releaseType}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-text-muted">
                          <Cpu className="w-3 h-3 text-text-muted" />
                          <span>{v.javaVersion}</span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleInstallClick(v)}
                        disabled={installMutation.isPending}
                        className="h-8 text-xs font-semibold gap-1.5 border-border hover:border-primary hover:text-primary transition-all"
                      >
                        <Download className="w-3.5 h-3.5" /> Install
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Installation Confirmation Modal */}
      {installingVersion && selectedSoftware && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-card max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-control bg-primary/10 border border-primary/30 text-primary">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary">Install Server Software</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Confirm downloading and updating your server build.
                </p>
              </div>
            </div>

            <div className="space-y-3 p-3.5 bg-surface-elevated border border-border rounded-control text-xs">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-text-muted">Software:</span>
                <span className="font-semibold text-text-primary">{selectedSoftware.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-text-muted">Version:</span>
                <span className="font-mono font-bold text-primary">{installingVersion.version}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-text-muted">Installed JAR:</span>
                <span className="font-mono text-text-primary">{selectedSoftware.defaultJar}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-muted">Required Java:</span>
                <span className="text-text-secondary">{installingVersion.javaVersion}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-control flex items-start gap-2 text-[11px] text-amber-400">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Installing this version will replace your active server JAR (<strong className="font-mono">{selectedSoftware.defaultJar}</strong>) and automatically configure <code className="font-mono">eula=true</code>. Your world files and player data will be preserved.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setInstallingVersion(null)}
                disabled={installMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={confirmInstall}
                disabled={installMutation.isPending}
                className="gap-2"
              >
                {installMutation.isPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Installing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Confirm & Install
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
