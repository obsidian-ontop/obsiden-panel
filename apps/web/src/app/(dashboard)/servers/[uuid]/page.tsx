'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../../../../lib/api';
import {
  Cpu,
  Activity,
  HardDrive,
  Wifi,
  CornerDownLeft,
  Circle,
} from 'lucide-react';
import { Card } from '../../../../components/ui/card';
import { formatBytes } from '../../../../lib/utils';

interface ServerMetrics {
  cpu_absolute: number;
  memory_bytes: number;
  memory_limit_bytes: number;
  disk_bytes: number;
  network: { rx_bytes: number; tx_bytes: number };
  state: string;
}

export default function ServerConsolePage({
  params,
}: {
  params: { uuid: string };
}) {
  const uuid = params.uuid;
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [command, setCommand] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected' | 'error'
  >('connecting');

  const [metrics, setMetrics] = useState<ServerMetrics>({
    cpu_absolute: 0,
    memory_bytes: 0,
    memory_limit_bytes: 0,
    disk_bytes: 0,
    network: { rx_bytes: 0, tx_bytes: 0 },
    state: 'unknown',
  });

  // Fetch WebSocket credentials
  const { data: wsCreds } = useQuery({
    queryKey: ['server-ws', uuid],
    queryFn: () => fetchApi<{ data: { socket: string; token: string } }>(`/api/client/servers/${uuid}/ws`),
    staleTime: 5 * 60 * 1000,
  });

  // Initialize xterm.js dynamically in browser only (prevents SSR "self is not defined")
  useEffect(() => {
    if (!terminalRef.current) return;
    let isDisposed = false;
    let term: any = null;
    let fitAddon: any = null;
    let handleResize: any = null;

    Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
      import('@xterm/xterm/css/xterm.css' as any),
    ]).then(([{ Terminal: XTerm }, { FitAddon }]) => {
      if (isDisposed || !terminalRef.current) return;

      term = new XTerm({
        cursorBlink: true,
        cursorStyle: 'underline',
        fontFamily: 'JetBrains Mono, Menlo, monospace',
        fontSize: 12,
        lineHeight: 1.25,
        theme: {
          background: '#090909',
          foreground: '#F4F4F5',
          cursor: '#06B6D4',
          selectionBackground: '#272727',
          black: '#181818',
          red: '#EF4444',
          green: '#10B981',
          yellow: '#F59E0B',
          blue: '#3B82F6',
          magenta: '#8B5CF6',
          cyan: '#06B6D4',
          white: '#F4F4F5',
        },
        convertEol: true,
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();

      xtermInstance.current = term;
      fitAddonRef.current = fitAddon;

      term.writeln('\x1b[36m[Obsidian Console] Initializing connection to Wings node...\x1b[0m');

      handleResize = () => fitAddon.fit();
      window.addEventListener('resize', handleResize);
    }).catch((err) => {
      console.error('Failed to load xterm:', err);
    });

    return () => {
      isDisposed = true;
      if (handleResize) window.removeEventListener('resize', handleResize);
      if (term) term.dispose();
    };
  }, []);

  // Connect WebSocket to Wings daemon
  useEffect(() => {
    if (!wsCreds?.data) return;

    const { socket, token } = wsCreds.data;
    setConnectionStatus('connecting');

    try {
      const ws = new WebSocket(socket);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        xtermInstance.current?.writeln('\x1b[32m[Obsidian Console] Connected to Wings daemon. Authenticating...\x1b[0m');
        // Send authentication payload expected by Wings
        ws.send(JSON.stringify({ event: 'auth', args: [token] }));
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          switch (payload.event) {
            case 'auth success':
              xtermInstance.current?.writeln('\x1b[32m[Obsidian Console] Authenticated successfully.\x1b[0m\r\n');
              // Request scrollback logs and initial stats stream
              ws.send(JSON.stringify({ event: 'send logs', args: [null] }));
              ws.send(JSON.stringify({ event: 'send stats', args: [null] }));
              break;
            case 'jwt error':
              xtermInstance.current?.writeln(`\r\n\x1b[31m[Wings Auth Error] ${payload.args?.[0] || 'Authentication rejected'}\x1b[0m`);
              break;
            case 'console output':
              xtermInstance.current?.write(payload.args?.[0] || '');
              break;
            case 'install output':
              xtermInstance.current?.write(payload.args?.[0] || '');
              break;
            case 'install started':
              xtermInstance.current?.writeln('\r\n\x1b[33m[Obsidian Console] Server installation script started...\x1b[0m');
              break;
            case 'install completed':
              xtermInstance.current?.writeln('\r\n\x1b[32m[Obsidian Console] Server installation completed successfully! You can now start the server.\x1b[0m');
              break;
            case 'stats':
              if (payload.args?.[0]) {
                try {
                  const parsed = JSON.parse(payload.args[0]);
                  setMetrics(parsed);
                } catch {}
              }
              break;
            case 'status':
              xtermInstance.current?.writeln(`\r\n\x1b[33m[Obsidian Console] Server state: ${payload.args?.[0]}\x1b[0m`);
              break;
            case 'daemon message':
              xtermInstance.current?.writeln(`\r\n\x1b[36m[Wings Daemon] ${payload.args?.[0]}\x1b[0m`);
              break;
            case 'daemon error':
              xtermInstance.current?.writeln(`\r\n\x1b[31m[Wings Daemon Error] ${payload.args?.[0]}\x1b[0m`);
              break;
            case 'token expiring':
              break;
          }
        } catch {
          xtermInstance.current?.write(event.data);
        }
      };

      ws.onerror = () => {
        setConnectionStatus('error');
        xtermInstance.current?.writeln('\r\n\x1b[31m[Obsidian Console] WebSocket error. Verify node connectivity & SSL certificates.\x1b[0m');
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        xtermInstance.current?.writeln('\r\n\x1b[33m[Obsidian Console] Connection closed.\x1b[0m');
      };

      return () => {
        ws.close();
      };
    } catch (err: any) {
      setConnectionStatus('error');
      xtermInstance.current?.writeln(`\r\n\x1b[31m[Obsidian Console] Failed to open WebSocket: ${err.message}\x1b[0m`);
    }
  }, [wsCreds]);

  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'send command', args: [command] }));
    } else {
      // Fallback to REST command API
      fetchApi(`/api/client/servers/${uuid}/command`, {
        method: 'POST',
        body: JSON.stringify({ command }),
      });
    }

    setCommand('');
  };

  return (
    <div className="space-y-4">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-surface border-border">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-muted flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-primary" /> CPU Usage
            </span>
            <span className="text-xs font-mono font-medium text-text-primary">
              {metrics.cpu_absolute.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-surface-elevated rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-300"
              style={{ width: `${Math.min(metrics.cpu_absolute, 100)}%` }}
            />
          </div>
        </Card>

        <Card className="p-3.5 bg-surface border-border">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-muted flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-status-running" /> Memory
            </span>
            <span className="text-xs font-mono font-medium text-text-primary">
              {formatBytes(metrics.memory_bytes)}
            </span>
          </div>
          <div className="w-full bg-surface-elevated rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div
              className="bg-status-running h-full transition-all duration-300"
              style={{
                width: `${
                  metrics.memory_limit_bytes > 0
                    ? Math.min((metrics.memory_bytes / metrics.memory_limit_bytes) * 100, 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </Card>

        <Card className="p-3.5 bg-surface border-border">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-muted flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-status-stopping" /> Disk
            </span>
            <span className="text-xs font-mono font-medium text-text-primary">
              {formatBytes(metrics.disk_bytes)}
            </span>
          </div>
          <div className="w-full bg-surface-elevated rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div className="bg-status-stopping h-full" style={{ width: '15%' }} />
          </div>
        </Card>

        <Card className="p-3.5 bg-surface border-border">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-muted flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-status-starting" /> Network
            </span>
            <span className="text-xs font-mono font-medium text-text-primary">
              ↑ {formatBytes(metrics.network.tx_bytes)} &bull; ↓ {formatBytes(metrics.network.rx_bytes)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-2.5">
            <Circle
              className={`w-2 h-2 fill-current ${
                connectionStatus === 'connected'
                  ? 'text-status-running animate-pulse'
                  : connectionStatus === 'connecting'
                  ? 'text-status-starting'
                  : 'text-status-error'
              }`}
            />
            <span className="text-[10px] text-text-muted font-mono uppercase">
              {connectionStatus}
            </span>
          </div>
        </Card>
      </div>

      {/* Terminal View */}
      <div className="bg-surface border border-border rounded-card overflow-hidden shadow-2xl">
        {/* Terminal Header */}
        <div className="h-9 px-4 bg-surface-elevated/70 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-border-focus" />
            <span className="text-xs font-mono text-text-muted">
              wings-console:{uuid.slice(0, 8)}
            </span>
          </div>
          <span className="text-[10px] text-text-muted font-mono">
            Direct WebSocket Stream &bull; Wings v1.11.13
          </span>
        </div>

        {/* XTerm viewport */}
        <div className="p-3 bg-[#090909]">
          <div ref={terminalRef} className="h-[460px] w-full" />
        </div>

        {/* Console Command Input */}
        <form
          onSubmit={handleSendCommand}
          className="p-2.5 bg-surface-elevated/40 border-t border-border flex items-center gap-2"
        >
          <span className="text-primary font-mono text-sm pl-2">&gt;</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Type a command to send to server..."
            className="flex-1 bg-transparent text-xs text-text-primary font-mono placeholder:text-text-muted focus:outline-none"
          />
          <button
            type="submit"
            className="p-1.5 bg-surface-elevated hover:bg-surface border border-border rounded text-text-secondary hover:text-text-primary transition-colors"
          >
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
