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
  Trash2,
  Copy,
  Check,
  Sparkles,
  AlertTriangle,
  RotateCw,
  Clock,
  ArrowUp,
  ArrowDown,
  Gauge,
} from 'lucide-react';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { formatBytes } from '../../../../lib/utils';

interface ServerMetrics {
  cpu_absolute: number;
  memory_bytes: number;
  memory_limit_bytes: number;
  disk_bytes: number;
  network: { rx_bytes: number; tx_bytes: number };
  state: string;
  uptime?: number;
}

// Corner metallic hex screw/rivet component for skeuomorphic chassis
function HexRivet() {
  return (
    <div className="w-2 h-2 rounded-full bg-gradient-to-br from-zinc-400 via-zinc-600 to-zinc-900 border border-zinc-700/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.9)] flex items-center justify-center">
      <div className="w-[3px] h-[0.75px] bg-zinc-900 rotate-45" />
    </div>
  );
}

// Skeuomorphic discrete 20-segment tactile LED gauge bar
function SkeuomorphicLedBar({
  percent,
  color = 'cyan',
}: {
  percent: number;
  color?: 'cyan' | 'emerald' | 'amber' | 'purple';
}) {
  const totalSegments = 20;
  const activeSegments = Math.round((Math.max(0, Math.min(100, percent)) / 100) * totalSegments);

  return (
    <div className="relative p-1 rounded bg-[#06080d] border border-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.95),0_1px_0_rgba(255,255,255,0.06)] overflow-hidden">
      {/* Subtle glass reflection sheen */}
      <div className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
      <div className="flex items-center gap-[2.5px]">
        {Array.from({ length: totalSegments }).map((_, idx) => {
          const isActive = idx < activeSegments;
          const isWarning = idx >= 14 && idx < 17;
          const isCritical = idx >= 17;

          let activeStyle = 'bg-[#06b6d4] shadow-[0_0_8px_#06b6d4,inset_0_1px_1px_#a5f3fc]';
          if (color === 'emerald') activeStyle = 'bg-[#10b981] shadow-[0_0_8px_#10b981,inset_0_1px_1px_#a7f3d0]';
          if (color === 'amber') activeStyle = 'bg-[#f59e0b] shadow-[0_0_8px_#f59e0b,inset_0_1px_1px_#fde68a]';
          if (color === 'purple') activeStyle = 'bg-[#a855f7] shadow-[0_0_8px_#a855f7,inset_0_1px_1px_#e9d5ff]';

          if (isWarning) activeStyle = 'bg-[#f59e0b] shadow-[0_0_8px_#f59e0b,inset_0_1px_1px_#fde68a]';
          if (isCritical) activeStyle = 'bg-[#ef4444] shadow-[0_0_8px_#ef4444,inset_0_1px_1px_#fecaca]';

          const inactiveStyle = isCritical
            ? 'bg-[#290d0d]'
            : isWarning
            ? 'bg-[#281809]'
            : 'bg-[#09121c]';

          return (
            <div
              key={idx}
              className={`flex-1 h-2 rounded-[1px] transition-all duration-150 ${
                isActive ? activeStyle : inactiveStyle
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

// Skeuomorphic CRT Oscilloscope / Telemetry Waveform Display
function SkeuomorphicOscilloscope({
  points,
  color = '#06b6d4',
}: {
  points: number[];
  color?: string;
}) {
  const max = Math.max(100, ...points);
  const min = 0;
  const range = max - min || 1;
  const height = 30;
  const width = 160;
  const step = width / (points.length - 1 || 1);

  const pathD = points
    .map((val, idx) => {
      const x = idx * step;
      const y = height - (val / range) * (height - 6) - 3;
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="relative h-8 w-full rounded bg-[#040608] border border-black shadow-[inset_0_2px_5px_rgba(0,0,0,0.95)] overflow-hidden">
      {/* CRT scanlines effect */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25 z-10"
        style={{
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.8), rgba(0,0,0,0.8) 1px, transparent 1px, transparent 2px)',
        }}
      />
      {/* Illuminated Grid lines */}
      <svg className="absolute inset-0 w-full h-full stroke-cyan-500/10 pointer-events-none" width="100%" height="100%">
        <line x1="0" y1="33%" x2="100%" y2="33%" strokeDasharray="2,2" />
        <line x1="0" y1="66%" x2="100%" y2="66%" strokeDasharray="2,2" />
        <line x1="25%" y1="0" x2="25%" y2="100%" strokeDasharray="2,2" />
        <line x1="50%" y1="0" x2="50%" y2="100%" strokeDasharray="2,2" />
        <line x1="75%" y1="0" x2="75%" y2="100%" strokeDasharray="2,2" />
      </svg>
      {/* Phosphor wave */}
      <svg className="w-full h-full overflow-visible relative z-0" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <path d={pathD} fill="none" stroke={color} strokeWidth="3" opacity="0.35" className="blur-[1.5px]" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
    </div>
  );
}


/**
 * Cleanly formats and colors raw console stream output:
 * - Completely suppresses noisy Docker download/extract layer spam
 * - Formats every daemon message, container prompt, and Minecraft log line onto its own clean line
 * - Applies sleek terminal coloring (sky blue daemon tags, cyan INFO, amber WARN, red ERROR)
 */
function formatConsoleLogs(chunk: string): string {
  if (!chunk) return '';

  let formatted = chunk;

  // 1. Completely strip Docker image layer download/extract progress spam
  formatted = formatted.replace(
    /(?:Downloading|Extracting)\s+\[[=>\s]+\]\s+[\d\.]+\s*(?:kB|MB|GB|B)\/[\d\.]+\s*(?:kB|MB|GB|B)/gi,
    ''
  );
  formatted = formatted.replace(
    /\b(?:Pulling fs layer|Download complete|Verifying Checksum|Pull complete|Waiting)\b\s*/gi,
    ''
  );
  formatted = formatted.replace(/Pulling from [^\r\n]*/gi, '');

  // If the chunk only contained stripped download progress noise, drop it completely
  if (!formatted.replace(/[\r\n\s]/g, '')) {
    return '';
  }

  // 2. Separate squashed lines: match any character that is NOT a newline before a tag/timestamp
  formatted = formatted
    // Break before ANY bracket timestamp: [15:50:01 INFO]: or [15:50:01] or [15:50:01.123]
    .replace(/([^\r\n])(\[\d{1,2}:\d{2}:\d{2})/g, '$1\r\n$2')
    // Break before [Pterodactyl Daemon]: or [Wings Daemon]:
    .replace(/([^\r\n])(\[(?:Pterodactyl|Wings) Daemon\]:)/gi, '$1\r\n$2')
    // Break before container shell prompt (container@pterodactyl:~$ or container@pterodactyl~)
    .replace(/([^\r\n])(container@[a-zA-Z0-9_\-]+[:~])/g, '$1\r\n$2')
    // Break before java version or openjdk info
    .replace(/([^\r\n])(openjdk version|OpenJDK Runtime|OpenJDK 64-Bit)/gi, '$1\r\n$2')
    // Break before header banners like *** Warning ... ***
    .replace(/([^\r\n])(\*{3,})/g, '$1\r\n$2')
    .replace(/(\*{3,})([^\r\n])/g, '$1\r\n$2')
    // Break before server starting commands or main entry
    .replace(/([^\r\n])(Starting (?:org\.bukkit|minecraft))/gi, '$1\r\n$2')
    // Break before sub-system tags like [ca.spottedleaf... or [bootstrap]
    .replace(/([^\r\n])(\[[a-zA-Z0-9_\.\-]+\s+[a-zA-Z0-9_\.\-]+\])/gi, '$1\r\n$2')
    // Break before Exception in thread
    .replace(/([^\r\n])(Exception in thread)/gi, '$1\r\n$2')
    // Break before stack trace entries (at java.base, at org.bukkit, etc.)
    .replace(/([^\r\n])(\s*at (?:java\.base|org\.bukkit|io\.papermc|net\.minecraft))/gi, '$1\r\n$2')
    // Break before crash/exit info
    .replace(/([^\r\n])(\[-+ Detected server process)/gi, '$1\r\n$2')
    .replace(/([^\r\n])(\[Pterodactyl Daemon\]: (?:Exit code|Out of memory|Aborting automatic restart))/gi, '$1\r\n$2');

  // 3. Normalize all line breaks to \r\n (prevent staircasing in xterm.js)
  formatted = formatted.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n');

  // 4. Colorize Minecraft logs:
  // [15:43:57 INFO]:
  formatted = formatted.replace(
    /\[(\d{1,2}:\d{2}:\d{2}(?:\.\d{1,4})?)\s+(INFO)\]:/g,
    '\x1b[38;2;100;116;139m[$1\x1b[0m \x1b[38;2;34;211;238m$2\x1b[38;2;100;116;139m]:\x1b[0m'
  );
  // [15:43:57 WARN]:
  formatted = formatted.replace(
    /\[(\d{1,2}:\d{2}:\d{2}(?:\.\d{1,4})?)\s+(WARN|WARNING)\]:/g,
    '\x1b[38;2;100;116;139m[$1\x1b[0m \x1b[38;2;251;191;36m$2\x1b[38;2;100;116;139m]:\x1b[0m'
  );
  // [15:43:57 ERROR]:
  formatted = formatted.replace(
    /\[(\d{1,2}:\d{2}:\d{2}(?:\.\d{1,4})?)\s+(ERROR|FATAL)\]:/g,
    '\x1b[38;2;100;116;139m[$1\x1b[0m \x1b[1;38;2;248;113;113m$2\x1b[38;2;100;116;139m]:\x1b[0m'
  );

  // 5. Highlight daemon tags with cool ANSI sky blue
  formatted = formatted.replace(
    /\[(Pterodactyl Daemon|Wings Daemon)\]:/g,
    '\x1b[38;2;56;189;248m[$1]:\x1b[0m'
  );

  // 6. Style container shell prompt in neon emerald + violet
  formatted = formatted.replace(
    /container@([a-zA-Z0-9_\-]+)[:~](\$|~)?/g,
    '\x1b[38;2;52;211;153mcontainer@$1\x1b[0m:\x1b[38;2;168;85;247m~\x1b[0m$'
  );

  // 7. Highlight fatal exceptions and version mismatch in vivid red
  formatted = formatted.replace(
    /(UnsupportedClassVersionError[^\r\n]*)/g,
    '\x1b[1;38;2;248;113;113m$1\x1b[0m'
  );
  formatted = formatted.replace(
    /(Exception in thread "[^"]+":?)/g,
    '\x1b[1;31m$1\x1b[0m'
  );

  // 8. Dim stack trace frames for clean readability
  formatted = formatted.replace(
    /(\s+at [^\r\n]+)/g,
    '\x1b[38;2;148;163;184m$1\x1b[0m'
  );

  return formatted;
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
  const [serverState, setServerState] = useState<string>('offline');
  const [javaMismatchDetected, setJavaMismatchDetected] = useState(false);
  const [isFixingJava, setIsFixingJava] = useState(false);
  const [copied, setCopied] = useState(false);

  const [cpuHistory, setCpuHistory] = useState<number[]>([12, 18, 15, 22, 19, 25, 20, 28, 22, 18, 24, 20, 16, 22, 28, 24, 20, 25, 22, 20]);
  const [uptimeMs, setUptimeMs] = useState<number>(0);

  const [metrics, setMetrics] = useState<ServerMetrics>({
    cpu_absolute: 0,
    memory_bytes: 0,
    memory_limit_bytes: 0,
    disk_bytes: 0,
    network: { rx_bytes: 0, tx_bytes: 0 },
    state: 'unknown',
    uptime: 0,
  });

  // Uptime active local second ticker
  useEffect(() => {
    if (serverState !== 'running') return;
    const interval = setInterval(() => {
      setUptimeMs((prev) => (prev > 0 ? prev + 1000 : 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [serverState]);

  const formatDigitalUptime = (ms: number) => {
    if (serverState !== 'running' || ms <= 0) {
      return { days: 0, hours: '00', mins: '00', secs: '00', label: '00:00:00' };
    }
    const totalSecs = Math.floor(ms / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hours = String(Math.floor((totalSecs % 86400) / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSecs % 60).padStart(2, '0');
    return {
      days,
      hours,
      mins,
      secs,
      label: days > 0 ? `${days}d ${hours}h ${mins}m` : `${hours}:${mins}:${secs}`,
    };
  };

  // Fetch WebSocket credentials
  const { data: wsCreds } = useQuery({
    queryKey: ['server-ws', uuid],
    queryFn: () => fetchApi<{ data: { socket: string; token: string } }>(`/api/client/servers/${uuid}/ws`),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch Server details to check dockerImage
  const { data: serverData } = useQuery({
    queryKey: ['server', uuid],
    queryFn: () => fetchApi(`/api/client/servers/${uuid}`),
  });

  // Initialize xterm.js dynamically in browser only
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
        lineHeight: 1.35,
        theme: {
          background: '#0a0d14',
          foreground: '#e2e8f0',
          cursor: '#06B6D4',
          selectionBackground: '#1e293b',
          black: '#0f172a',
          red: '#f87171',
          green: '#34d399',
          yellow: '#fbbf24',
          blue: '#60a5fa',
          magenta: '#c084fc',
          cyan: '#22d3ee',
          white: '#f8fafc',
        },
        convertEol: true,
        scrollback: 5000,
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();

      xtermInstance.current = term;
      fitAddonRef.current = fitAddon;

      term.writeln('\x1b[38;2;6;182;212m[Obsidian Console]\x1b[0m Initializing connection to Wings node...');

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
        xtermInstance.current?.writeln('\x1b[38;2;52;211;153m[Obsidian Console]\x1b[0m Connected to Wings daemon. Authenticating...');
        ws.send(JSON.stringify({ event: 'auth', args: [token] }));
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          switch (payload.event) {
            case 'auth success':
              xtermInstance.current?.writeln('\x1b[38;2;52;211;153m[Obsidian Console]\x1b[0m Authenticated successfully.\r\n');
              ws.send(JSON.stringify({ event: 'send logs', args: [null] }));
              ws.send(JSON.stringify({ event: 'send stats', args: [null] }));
              break;
            case 'jwt error':
              xtermInstance.current?.writeln(`\r\n\x1b[31m[Wings Auth Error] ${payload.args?.[0] || 'Authentication rejected'}\x1b[0m\r\n`);
              break;
            case 'console output': {
              const raw = payload.args?.[0] || '';
              if (raw.includes('UnsupportedClassVersionError') || raw.includes('class file version 65.0')) {
                setJavaMismatchDetected(true);
              }
              // Detect server active running state from Minecraft startup completion or TPS
              if (
                raw.includes(')! For help, type "help"') ||
                raw.includes('Done (') ||
                raw.includes('TPS from last') ||
                raw.includes('Starting Minecraft server on')
              ) {
                setServerState('running');
                window.dispatchEvent(
                  new CustomEvent('obsidian:server-status', {
                    detail: { uuid, status: 'running' },
                  }),
                );
                fetchApi(`/api/client/servers/${uuid}/state`, {
                  method: 'POST',
                  body: JSON.stringify({ state: 'running' }),
                }).catch(() => {});
              }
              // Detect server crash or stop
              if (
                raw.includes('Detected server process in a crashed state') ||
                raw.includes('Aborting automatic restart')
              ) {
                setServerState('offline');
                window.dispatchEvent(
                  new CustomEvent('obsidian:server-status', {
                    detail: { uuid, status: 'offline' },
                  }),
                );
                fetchApi(`/api/client/servers/${uuid}/state`, {
                  method: 'POST',
                  body: JSON.stringify({ state: 'offline' }),
                }).catch(() => {});
              }
              const formatted = formatConsoleLogs(raw);
              if (formatted) {
                xtermInstance.current?.write(formatted);
              }
              break;
            }
            case 'install output': {
              const formatted = formatConsoleLogs(payload.args?.[0] || '');
              xtermInstance.current?.write(formatted);
              break;
            }
            case 'install started':
              xtermInstance.current?.writeln('\r\n\x1b[33m[Obsidian Console] Server installation script started...\x1b[0m\r\n');
              setServerState('installing');
              window.dispatchEvent(
                new CustomEvent('obsidian:server-status', {
                  detail: { uuid, status: 'installing' },
                }),
              );
              break;
            case 'install completed':
              xtermInstance.current?.writeln('\r\n\x1b[32m[Obsidian Console] Server installation completed successfully! You can now start the server.\x1b[0m\r\n');
              setServerState('offline');
              window.dispatchEvent(
                new CustomEvent('obsidian:server-status', {
                  detail: { uuid, status: 'offline' },
                }),
              );
              break;
            case 'stats':
              if (payload.args?.[0]) {
                try {
                  const parsed = JSON.parse(payload.args[0]);
                  setMetrics((prev) => ({
                    ...prev,
                    ...parsed,
                    uptime: parsed.uptime ?? prev.uptime,
                  }));
                  if (typeof parsed.uptime === 'number' && parsed.uptime > 0) {
                    const norm = parsed.uptime > 100000000000
                      ? Date.now() - parsed.uptime
                      : parsed.uptime > 10000
                      ? parsed.uptime
                      : parsed.uptime * 1000;
                    setUptimeMs(norm);
                  }
                  if (typeof parsed.cpu_absolute === 'number') {
                    setCpuHistory((prev) => [...prev.slice(1), parsed.cpu_absolute]);
                  }
                  if (parsed.state) {
                    setServerState(parsed.state);
                    window.dispatchEvent(
                      new CustomEvent('obsidian:server-status', {
                        detail: { uuid, status: parsed.state },
                      }),
                    );
                  }
                } catch {}
              }
              break;
            case 'status': {
              const st = payload.args?.[0] || 'offline';
              setServerState(st);
              xtermInstance.current?.writeln(`\r\n\x1b[38;2;6;182;212m[Obsidian Console]\x1b[0m Server state: \x1b[1;33m${st}\x1b[0m\r\n`);
              window.dispatchEvent(
                new CustomEvent('obsidian:server-status', {
                  detail: { uuid, status: st },
                }),
              );
              fetchApi(`/api/client/servers/${uuid}/state`, {
                method: 'POST',
                body: JSON.stringify({ state: st }),
              }).catch(() => {});
              break;
            }
            case 'daemon message': {
              const formatted = formatConsoleLogs(`[Wings Daemon]: ${payload.args?.[0] || ''}`);
              xtermInstance.current?.writeln(`\r\n${formatted}`);
              break;
            }
            case 'daemon error': {
              xtermInstance.current?.writeln(`\r\n\x1b[1;31m[Wings Daemon Error] ${payload.args?.[0]}\x1b[0m\r\n`);
              break;
            }
            case 'token expiring':
              break;
          }
        } catch {
          xtermInstance.current?.write(formatConsoleLogs(event.data));
        }
      };

      ws.onerror = () => {
        setConnectionStatus('error');
        xtermInstance.current?.writeln('\r\n\x1b[31m[Obsidian Console] WebSocket error. Verify node connectivity & SSL certificates.\x1b[0m\r\n');
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        xtermInstance.current?.writeln('\r\n\x1b[33m[Obsidian Console] Connection closed.\x1b[0m\r\n');
      };

      return () => {
        ws.close();
      };
    } catch (err: any) {
      setConnectionStatus('error');
      xtermInstance.current?.writeln(`\r\n\x1b[31m[Obsidian Console] Failed to open WebSocket: ${err.message}\x1b[0m\r\n`);
    }
  }, [wsCreds, uuid]);

  // Handle command submission
  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'send command', args: [command] }));
    } else {
      fetchApi(`/api/client/servers/${uuid}/command`, {
        method: 'POST',
        body: JSON.stringify({ command }),
      });
    }

    setCommand('');
  };

  // Quick fix for Java 21 mismatch
  const handleFixJavaVersion = async () => {
    setIsFixingJava(true);
    try {
      xtermInstance.current?.writeln('\r\n\x1b[36m[Obsidian Console] Updating server container runtime to Java 21 (ghcr.io/pterodactyl/yolks:java_21)...\x1b[0m');
      await fetchApi(`/api/client/servers/${uuid}/startup`, {
        method: 'PATCH',
        body: JSON.stringify({ dockerImage: 'ghcr.io/pterodactyl/yolks:java_21' }),
      });
      xtermInstance.current?.writeln('\x1b[32m[Obsidian Console] Container image updated to Java 21 and synced to Wings! Dispatching start...\x1b[0m\r\n');
      await fetchApi(`/api/client/servers/${uuid}/power`, {
        method: 'POST',
        body: JSON.stringify({ action: 'start' }),
      });
      setJavaMismatchDetected(false);
      setServerState('starting');
      window.dispatchEvent(
        new CustomEvent('obsidian:server-status', {
          detail: { uuid, status: 'starting' },
        }),
      );
    } catch (err: any) {
      xtermInstance.current?.writeln(`\r\n\x1b[31m[Obsidian Console] Failed to switch Java version: ${err.message}\x1b[0m\r\n`);
    } finally {
      setIsFixingJava(false);
    }
  };

  // Clear console action
  const handleClearConsole = () => {
    xtermInstance.current?.clear();
  };

  // Copy console logs action
  const handleCopyLogs = () => {
    if (!xtermInstance.current) return;
    try {
      // Select all and copy
      xtermInstance.current.selectAll();
      const text = xtermInstance.current.getSelection();
      xtermInstance.current.clearSelection();
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy console logs', e);
    }
  };

  // Status visual helper
  const stateColor =
    serverState === 'running'
      ? 'bg-status-running text-status-running'
      : serverState === 'starting'
      ? 'bg-amber-400 text-amber-400'
      : serverState === 'stopping'
      ? 'bg-amber-500 text-amber-500'
      : 'bg-zinc-500 text-zinc-400';

  return (
    <div className="space-y-4">
      {/* Java 21 Quick-Fix Alert Banner if crash detected */}
      {javaMismatchDetected && (
        <div className="p-3.5 rounded-card bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-300">
                Java Runtime Mismatch Detected
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">
                Your Minecraft server requires <strong>Java 21</strong> (class file version 65.0), but is currently running on Java 17.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="primary"
            disabled={isFixingJava}
            onClick={handleFixJavaVersion}
            className="text-xs gap-1.5 shrink-0 self-start sm:self-auto bg-amber-500 hover:bg-amber-400 text-black font-semibold"
          >
            {isFixingJava ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {isFixingJava ? 'Applying Java 21...' : 'Switch to Java 21 & Start'}
          </Button>
        </div>
      )}

      {/* Skeuomorphic Hardware Instrument Modules */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Module 1: CPU Processor Unit */}
        <div className="bg-gradient-to-b from-[#181d27] via-[#121620] to-[#0a0d13] border border-white/10 shadow-[0_6px_16px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.8)] rounded-card p-3 relative overflow-hidden flex flex-col justify-between gap-2.5">
          {/* Top Chassis Bezel with Hex Screws */}
          <div className="flex items-center justify-between">
            <HexRivet />
            <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase flex items-center gap-1.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              <Cpu className="w-3 h-3 text-cyan-400" /> CPU Core
            </span>
            <HexRivet />
          </div>

          {/* Recessed VFD Digital Screen */}
          <div className="bg-[#05070c] border border-black shadow-[inset_0_2px_5px_rgba(0,0,0,0.95),0_1px_0_rgba(255,255,255,0.06)] rounded-md p-2 flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-semibold tracking-wider">LOAD</span>
            <span className="text-sm font-mono font-bold text-cyan-400 tracking-tight drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]">
              {metrics.cpu_absolute.toFixed(1)}%
            </span>
          </div>

          {/* 20-Segment Tactile LED Bar */}
          <SkeuomorphicLedBar percent={metrics.cpu_absolute} color="cyan" />

          {/* Recessed CRT Oscilloscope Trace */}
          <div className="pt-0.5">
            <SkeuomorphicOscilloscope points={cpuHistory} color="#06b6d4" />
          </div>

          {/* Bottom Chassis Bezel with Hex Screws */}
          <div className="flex items-center justify-between pt-0.5 border-t border-white/[0.04]">
            <HexRivet />
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">SMP RACK-01</span>
            <HexRivet />
          </div>
        </div>

        {/* Module 2: Memory Buffer Tank */}
        <div className="bg-gradient-to-b from-[#181d27] via-[#121620] to-[#0a0d13] border border-white/10 shadow-[0_6px_16px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.8)] rounded-card p-3 relative overflow-hidden flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <HexRivet />
            <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase flex items-center gap-1.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              <Activity className="w-3 h-3 text-emerald-400" /> RAM Reservoir
            </span>
            <HexRivet />
          </div>

          <div className="bg-[#05070c] border border-black shadow-[inset_0_2px_5px_rgba(0,0,0,0.95),0_1px_0_rgba(255,255,255,0.06)] rounded-md p-2 flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-semibold tracking-wider">USED</span>
            <span className="text-sm font-mono font-bold text-emerald-400 tracking-tight drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]">
              {formatBytes(metrics.memory_bytes)}
            </span>
          </div>

          {/* Memory Fill Percentage */}
          {(() => {
            const memPercent =
              metrics.memory_limit_bytes > 0
                ? (metrics.memory_bytes / metrics.memory_limit_bytes) * 100
                : 25;
            return (
              <>
                <SkeuomorphicLedBar percent={memPercent} color="emerald" />
                <div className="p-1.5 rounded bg-[#05070c] border border-black shadow-[inset_0_1px_3px_rgba(0,0,0,0.9)] flex items-center justify-between text-[10px] font-mono text-zinc-400">
                  <span className="text-zinc-500 uppercase">Limit:</span>
                  <span className="text-emerald-300 font-bold">
                    {metrics.memory_limit_bytes > 0 ? formatBytes(metrics.memory_limit_bytes) : 'UNLIMITED'}
                  </span>
                </div>
              </>
            );
          })()}

          <div className="flex items-center justify-between pt-0.5 border-t border-white/[0.04]">
            <HexRivet />
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">DDR5 ECC RAM</span>
            <HexRivet />
          </div>
        </div>

        {/* Module 3: Storage Unit */}
        <div className="bg-gradient-to-b from-[#181d27] via-[#121620] to-[#0a0d13] border border-white/10 shadow-[0_6px_16px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.8)] rounded-card p-3 relative overflow-hidden flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <HexRivet />
            <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase flex items-center gap-1.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              <HardDrive className="w-3 h-3 text-amber-400" /> NVMe Storage
            </span>
            <HexRivet />
          </div>

          <div className="bg-[#05070c] border border-black shadow-[inset_0_2px_5px_rgba(0,0,0,0.95),0_1px_0_rgba(255,255,255,0.06)] rounded-md p-2 flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-semibold tracking-wider">OCCUPIED</span>
            <span className="text-sm font-mono font-bold text-amber-400 tracking-tight drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]">
              {formatBytes(metrics.disk_bytes)}
            </span>
          </div>

          <SkeuomorphicLedBar percent={28} color="amber" />

          {/* Drive I/O indicator */}
          <div className="p-1.5 rounded bg-[#05070c] border border-black shadow-[inset_0_1px_3px_rgba(0,0,0,0.9)] flex items-center justify-between text-[10px] font-mono text-zinc-400">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  serverState === 'running'
                    ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-pulse'
                    : 'bg-zinc-700'
                }`}
              />
              <span className="text-zinc-500 uppercase">Drive I/O</span>
            </div>
            <span className="text-amber-300 font-semibold">PCIe Gen4</span>
          </div>

          <div className="flex items-center justify-between pt-0.5 border-t border-white/[0.04]">
            <HexRivet />
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">SOLID STATE</span>
            <HexRivet />
          </div>
        </div>

        {/* Module 4: Network Bandwidth Dual VU */}
        <div className="bg-gradient-to-b from-[#181d27] via-[#121620] to-[#0a0d13] border border-white/10 shadow-[0_6px_16px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.8)] rounded-card p-3 relative overflow-hidden flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <HexRivet />
            <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase flex items-center gap-1.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              <Wifi className="w-3 h-3 text-sky-400" /> Transceiver
            </span>
            <HexRivet />
          </div>

          <div className="bg-[#05070c] border border-black shadow-[inset_0_2px_5px_rgba(0,0,0,0.95),0_1px_0_rgba(255,255,255,0.06)] rounded-md p-2 flex flex-col gap-1 font-mono text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 flex items-center gap-1"><ArrowUp className="w-2.5 h-2.5 text-sky-400" /> TX</span>
              <span className="font-bold text-sky-300 drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]">
                {formatBytes(metrics.network.tx_bytes)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 flex items-center gap-1"><ArrowDown className="w-2.5 h-2.5 text-cyan-400" /> RX</span>
              <span className="font-bold text-cyan-300 drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]">
                {formatBytes(metrics.network.rx_bytes)}
              </span>
            </div>
          </div>

          <SkeuomorphicLedBar percent={35} color="cyan" />

          <div className="p-1.5 rounded bg-[#05070c] border border-black shadow-[inset_0_1px_3px_rgba(0,0,0,0.9)] flex items-center justify-between text-[10px] font-mono text-zinc-400">
            <span className="text-zinc-500 uppercase">LINK STATUS</span>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-status-running shadow-[0_0_8px_#34d399] animate-pulse'
                    : 'bg-zinc-700'
                }`}
              />
              <span className="text-zinc-300 uppercase font-semibold text-[9.5px]">
                {connectionStatus}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-0.5 border-t border-white/[0.04]">
            <HexRivet />
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">10 Gbps SFP+</span>
            <HexRivet />
          </div>
        </div>

        {/* Module 5: System Uptime Chronometer */}
        <div className="bg-gradient-to-b from-[#181d27] via-[#121620] to-[#0a0d13] border border-white/10 shadow-[0_6px_16px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.8)] rounded-card p-3 relative overflow-hidden flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <HexRivet />
            <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase flex items-center gap-1.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              <Clock className="w-3 h-3 text-purple-400" /> Chronometer
            </span>
            <HexRivet />
          </div>

          {/* Vintage/Modern LCD Digital Stopwatch Bay */}
          {(() => {
            const clock = formatDigitalUptime(uptimeMs);
            return (
              <div className="bg-[#040608] border border-black shadow-[inset_0_3px_6px_rgba(0,0,0,0.95),0_1px_0_rgba(255,255,255,0.06)] rounded-md p-2 flex flex-col items-center justify-center relative overflow-hidden">
                <div
                  className="absolute inset-0 pointer-events-none opacity-20"
                  style={{
                    background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.8), rgba(0,0,0,0.8) 1px, transparent 1px, transparent 2px)',
                  }}
                />
                <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 font-semibold mb-0.5">
                  SYSTEM UPTIME
                </span>
                <div className="flex items-center gap-1 font-mono font-bold text-base text-purple-400 tracking-wider drop-shadow-[0_0_10px_rgba(168,85,247,0.7)]">
                  {clock.days > 0 && <span className="text-xs text-purple-300 font-semibold">{clock.days}D</span>}
                  <span>{clock.hours}</span>
                  <span className="animate-pulse opacity-80 text-purple-300">:</span>
                  <span>{clock.mins}</span>
                  <span className="animate-pulse opacity-80 text-purple-300">:</span>
                  <span className="text-purple-300">{clock.secs}</span>
                </div>
              </div>
            );
          })()}

          <SkeuomorphicLedBar percent={serverState === 'running' ? 70 : 0} color="purple" />

          <div className="p-1.5 rounded bg-[#05070c] border border-black shadow-[inset_0_1px_3px_rgba(0,0,0,0.9)] flex items-center justify-between text-[10px] font-mono text-zinc-400">
            <span className="text-zinc-500 uppercase">CONTAINER</span>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  serverState === 'running'
                    ? 'bg-status-running shadow-[0_0_8px_#10b981] animate-pulse'
                    : serverState === 'starting'
                    ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                    : 'bg-zinc-700'
                }`}
              />
              <span
                className={`font-semibold uppercase text-[9.5px] ${
                  serverState === 'running' ? 'text-status-running' : 'text-zinc-400'
                }`}
              >
                {serverState}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-0.5 border-t border-white/[0.04]">
            <HexRivet />
            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">TCXO CLOCK</span>
            <HexRivet />
          </div>
        </div>
      </div>

      {/* Terminal View */}
      <div className="bg-surface border border-border rounded-card overflow-hidden shadow-2xl">
        {/* Terminal Header */}
        <div className="h-10 px-4 bg-surface-elevated/80 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className={`w-2 h-2 rounded-full ${stateColor.split(' ')[0]} ${serverState === 'running' ? 'animate-pulse' : ''}`} />
            <span className="text-xs font-mono text-text-secondary font-medium">
              wings-console:{uuid.slice(0, 8)}
            </span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">
              {serverState}
            </span>
          </div>

          {/* Quick Terminal Actions */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyLogs}
              title="Copy console logs"
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono text-text-muted hover:text-text-primary hover:bg-surface border border-transparent hover:border-border transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-status-running" />
                  <span className="text-status-running">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleClearConsole}
              title="Clear console output"
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono text-text-muted hover:text-text-primary hover:bg-surface border border-transparent hover:border-border transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* XTerm viewport with refined cyber theme */}
        <div className="p-3 bg-[#0a0d14]">
          <div ref={terminalRef} className="h-[480px] w-full" />
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
