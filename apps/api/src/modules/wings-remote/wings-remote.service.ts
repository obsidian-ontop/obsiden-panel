import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Node, Server, Egg, EggVariable, Allocation, ServerVariable } from '@prisma/client';

type ServerWithRelations = Server & {
  egg: Egg & { variables: EggVariable[] };
  variables: ServerVariable[];
  allocations: Allocation[];
  allocation: Allocation;
  mounts: Array<{ mount: { source: string; target: string; readOnly: boolean } }>;
};

/**
 * Service responsible for transforming internal database models into the
 * exact JSON structures that unmodified Wings v1.11.13 expects.
 *
 * DO NOT change the output schema without verifying against the pinned
 * Wings source. Incorrect structures will break server provisioning.
 */
@Injectable()
export class WingsRemoteService {
  private readonly logger = new Logger(WingsRemoteService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build the server configuration payload that Wings expects from
   * GET /api/remote/servers/{uuid} and the list endpoint.
   *
   * Maps to ServerConfigurationResponse in Wings remote/types.go
   */
  buildServerConfiguration(server: ServerWithRelations): {
    settings: Record<string, unknown>;
    process_configuration: Record<string, unknown>;
  } {
    const settings = this.buildServerSettings(server);
    const processConfiguration = this.buildProcessConfiguration(server.egg);

    return {
      settings,
      process_configuration: processConfiguration,
    };
  }

  /**
   * Build the 'settings' portion of the server config.
   * Maps to the JSON structure Wings deserializes into its server.Configuration type.
   */
  private buildServerSettings(server: ServerWithRelations): Record<string, unknown> {
    // Build environment variables by merging egg defaults with server overrides
    const environment: Record<string, string> = {};
    for (const eggVar of server.egg.variables) {
      environment[eggVar.envVariable] = eggVar.defaultValue;
    }
    for (const serverVar of server.variables) {
      const eggVar = server.egg.variables.find(v => v.id === serverVar.variableId);
      if (eggVar) {
        environment[eggVar.envVariable] = serverVar.variableValue;
      }
    }

    // Always include these standard environment variables
    environment['STARTUP'] = server.startup;
    environment['SERVER_MEMORY'] = String(server.memory);
    environment['SERVER_IP'] = server.allocation.ip;
    environment['SERVER_PORT'] = String(server.allocation.port);
    environment['P_SERVER_LOCATION'] = ''; // Will be populated from node location
    environment['P_SERVER_UUID'] = server.uuid;
    environment['P_SERVER_ALLOCATION_LIMIT'] = String(server.allocationLimit);

    // Build allocation mappings: { "ip": [port1, port2, ...] }
    const allServerAllocations = [server.allocation, ...server.allocations.filter(a => a.id !== server.allocationId)];
    const mappings: Record<string, number[]> = {};
    for (const alloc of allServerAllocations) {
      if (!mappings[alloc.ip]) {
        mappings[alloc.ip] = [];
      }
      mappings[alloc.ip]!.push(alloc.port);
    }

    // Resolve startup command template variables
    let invocation = server.startup;
    for (const [key, value] of Object.entries(environment)) {
      invocation = invocation.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), value);
    }

    return {
      uuid: server.uuid,
      meta: {
        name: server.name,
        description: server.description,
      },
      suspended: server.status === 'suspended',
      environment,
      invocation,
      skip_egg_scripts: server.skipScripts,
      build: {
        memory_limit: server.memory,
        swap: server.swap,
        io_weight: server.io,
        cpu_limit: server.cpu,
        threads: server.threads,
        disk_space: server.disk,
        oom_disabled: server.oomDisabled,
      },
      container: {
        image: server.dockerImage,
        oom_disabled: server.oomDisabled,
        requires_rebuild: false,
      },
      allocations: {
        force_outgoing_ip: server.egg.forceOutgoingIp,
        default: {
          ip: server.allocation.ip,
          port: server.allocation.port,
        },
        mappings,
      },
      mounts: (server.mounts || []).map(sm => ({
        source: sm.mount.source,
        target: sm.mount.target,
        read_only: sm.mount.readOnly,
      })),
      egg: {
        id: server.egg.uuid,
        file_denylist: server.egg.fileDenylist,
      },
    };
  }

  /**
   * Build the process_configuration matching Wings' ProcessConfiguration type.
   */
  private buildProcessConfiguration(egg: Egg): Record<string, unknown> {
    // Parse config_startup from egg
    let startup = { done: [] as string[], user_interaction: [] as string[], strip_ansi: false };
    if (egg.configStartup && typeof egg.configStartup === 'object') {
      const cs = egg.configStartup as Record<string, unknown>;
      startup = {
        done: Array.isArray(cs.done) ? cs.done as string[] : typeof cs.done === 'string' ? [cs.done as string] : [],
        user_interaction: Array.isArray(cs.user_interaction) ? cs.user_interaction as string[] : [],
        strip_ansi: Boolean(cs.strip_ansi),
      };
    }

    // Parse stop configuration
    let stop = { type: 'command' as string, value: egg.stopCommand ?? 'stop' };
    if (egg.configStop && typeof egg.configStop === 'object') {
      const cs = egg.configStop as Record<string, unknown>;
      stop = {
        type: (cs.type as string) ?? 'command',
        value: (cs.value as string) ?? egg.stopCommand ?? 'stop',
      };
    }

    // Parse file configuration replacements
    let configs: Array<{
      parser: string;
      file: string;
      replace: Array<{ match: string; replace_with: string }>;
    }> = [];

    if (egg.configFiles) {
      try {
        const parsed = JSON.parse(egg.configFiles);
        if (typeof parsed === 'object' && parsed !== null) {
          for (const [file, fileConfig] of Object.entries(parsed)) {
            if (typeof fileConfig === 'object' && fileConfig !== null) {
              const fc = fileConfig as Record<string, unknown>;
              const parser = (fc.parser as string) ?? 'file';
              const find = fc.find as Record<string, string> | undefined;
              const replace: Array<{ match: string; replace_with: string }> = [];
              if (find) {
                for (const [match, replaceWith] of Object.entries(find)) {
                  replace.push({ match, replace_with: replaceWith });
                }
              }
              configs.push({ parser, file, replace });
            }
          }
        }
      } catch {
        this.logger.warn(`Failed to parse config_files for egg ${egg.id}`);
      }
    }

    return {
      startup,
      stop,
      configs,
    };
  }

  /**
   * Build the installation script response for Wings.
   * Maps to InstallationScript in Wings remote/types.go
   */
  buildInstallationScript(egg: Egg): {
    container_image: string;
    entrypoint: string;
    script: string;
  } {
    const container_image =
      egg.scriptContainer && egg.scriptContainer.trim() !== ''
        ? egg.scriptContainer
        : 'ghcr.io/pterodactyl/installers:alpine';
    const entrypoint =
      egg.scriptEntry && egg.scriptEntry.trim() !== '' ? egg.scriptEntry : 'ash';
    const script =
      egg.scriptInstall && egg.scriptInstall.trim() !== ''
        ? egg.scriptInstall
        : this.getDefaultInstallScript(egg.name);

    return {
      container_image,
      entrypoint,
      script,
    };
  }

  private getDefaultInstallScript(eggName: string): string {
    return `#!/bin/ash
# Obsidian Panel Default Installer
cd /mnt/server

if [ -z "\${SERVER_JARFILE}" ]; then
    SERVER_JARFILE="paper.jar"
fi

echo "Installing Minecraft server files..."
apk update && apk add --no-cache curl jq

if echo "${eggName}" | grep -iq "paper"; then
    if [ -z "\${MINECRAFT_VERSION}" ] || [ "\${MINECRAFT_VERSION}" = "latest" ]; then
        MINECRAFT_VERSION=$(curl -sSL https://api.papermc.io/v2/projects/paper | jq -r '.versions[-1]')
    fi
    if [ -z "\${BUILD_NUMBER}" ] || [ "\${BUILD_NUMBER}" = "latest" ]; then
        BUILD_NUMBER=$(curl -sSL https://api.papermc.io/v2/projects/paper/versions/\${MINECRAFT_VERSION} | jq -r '.builds[-1]')
    fi
    echo "Downloading Paper \${MINECRAFT_VERSION} build \${BUILD_NUMBER}..."
    DOWNLOAD_URL="https://api.papermc.io/v2/projects/paper/versions/\${MINECRAFT_VERSION}/builds/\${BUILD_NUMBER}/downloads/paper-\${MINECRAFT_VERSION}-\${BUILD_NUMBER}.jar"
    curl -o \${SERVER_JARFILE} -sSL \${DOWNLOAD_URL}
elif echo "${eggName}" | grep -iq "vanilla"; then
    MANIFEST_URL="https://launchermeta.mojang.com/mc/game/version_manifest_v2.json"
    if [ -z "\${VANILLA_VERSION}" ] || [ "\${VANILLA_VERSION}" = "latest" ]; then
        VANILLA_VERSION=$(curl -sSL \${MANIFEST_URL} | jq -r '.latest.release')
    fi
    VERSION_URL=$(curl -sSL \${MANIFEST_URL} | jq -r --arg ver "\${VANILLA_VERSION}" '.versions[] | select(.id == \$ver) | .url')
    DOWNLOAD_URL=$(curl -sSL \${VERSION_URL} | jq -r '.downloads.server.url')
    echo "Downloading Vanilla \${VANILLA_VERSION}..."
    curl -o \${SERVER_JARFILE} -sSL \${DOWNLOAD_URL}
else
    # Default fallback to latest Paper
    MINECRAFT_VERSION=$(curl -sSL https://api.papermc.io/v2/projects/paper | jq -r '.versions[-1]')
    BUILD_NUMBER=$(curl -sSL https://api.papermc.io/v2/projects/paper/versions/\${MINECRAFT_VERSION} | jq -r '.builds[-1]')
    echo "Downloading Paper \${MINECRAFT_VERSION} build \${BUILD_NUMBER}..."
    DOWNLOAD_URL="https://api.papermc.io/v2/projects/paper/versions/\${MINECRAFT_VERSION}/builds/\${BUILD_NUMBER}/downloads/paper-\${MINECRAFT_VERSION}-\${BUILD_NUMBER}.jar"
    curl -o \${SERVER_JARFILE} -sSL \${DOWNLOAD_URL}
fi

echo "eula=true" > eula.txt
echo "Installation complete!"
`;
  }

  /**
   * Get a server with all relations needed for Wings configuration.
   */
  async getServerForWings(uuid: string, nodeId: number): Promise<ServerWithRelations | null> {
    return this.prisma.server.findFirst({
      where: {
        uuid,
        nodeId,
      },
      include: {
        egg: {
          include: {
            variables: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        variables: true,
        allocation: true,
        allocations: true,
        mounts: {
          include: {
            mount: true,
          },
        },
      },
    }) as Promise<ServerWithRelations | null>;
  }

  /**
   * Get all servers for a node, paginated in the format Wings expects.
   */
  async getServersForNode(nodeId: number, page: number, perPage: number) {
    const [servers, total] = await Promise.all([
      this.prisma.server.findMany({
        where: { nodeId },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          egg: {
            include: {
              variables: {
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
          variables: true,
          allocation: true,
          allocations: true,
          mounts: {
            include: {
              mount: true,
            },
          },
        },
      }),
      this.prisma.server.count({ where: { nodeId } }),
    ]);

    const lastPage = Math.max(1, Math.ceil(total / perPage));

    return {
      data: (servers as ServerWithRelations[]).map(server => ({
        uuid: server.uuid,
        ...this.buildServerConfiguration(server),
      })),
      meta: {
        pagination: {
          current_page: page,
          from: total > 0 ? (page - 1) * perPage + 1 : null,
          last_page: lastPage,
          per_page: perPage,
          to: total > 0 ? Math.min(page * perPage, total) : null,
          total,
        },
      },
    };
  }
}
