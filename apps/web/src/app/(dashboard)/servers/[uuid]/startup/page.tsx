'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../../../../../lib/api';
import { Terminal, Box, Sliders } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../../../components/ui/card';

export default function ServerStartupPage({
  params,
}: {
  params: { uuid: string };
}) {
  const uuid = params.uuid;

  const { data: server, isLoading } = useQuery({
    queryKey: ['server', uuid],
    queryFn: () => fetchApi(`/api/client/servers/${uuid}`),
  });

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-text-muted">Loading startup parameters...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Startup Command Card */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Startup Command</CardTitle>
            <CardDescription>
              The entrypoint command invoked inside the container when the game starts.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="p-3 bg-surface-elevated border border-border rounded-control font-mono text-xs text-primary">
          {server?.startup}
        </div>
      </Card>

      {/* Docker Image Selection */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Docker Container Image</CardTitle>
            <CardDescription>
              The runtime container environment executed on the Wings node.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="flex items-center gap-2 p-3 bg-surface-elevated border border-border rounded-control font-mono text-xs text-text-secondary">
          <Box className="w-4 h-4 text-text-muted" />
          <span>{server?.dockerImage}</span>
        </div>
      </Card>

      {/* Egg Environment Variables */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Environment Variables</CardTitle>
            <CardDescription>
              Configuration parameters provided by the game egg.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {server?.variables?.map((v: any) => (
            <div
              key={v.id}
              className="p-3 bg-surface-elevated border border-border rounded-control space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary">
                  {v.variable.name}
                </span>
                <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  {v.variable.envVariable}
                </span>
              </div>
              <p className="text-[11px] text-text-muted">
                {v.variable.description || 'No description provided.'}
              </p>
              <input
                type="text"
                readOnly
                value={v.variableValue}
                className="w-full px-2.5 py-1.5 bg-surface border border-border rounded text-xs font-mono text-text-primary focus:outline-none"
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
