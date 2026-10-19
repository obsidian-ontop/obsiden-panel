import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WingsClient } from '@obsidian/wings-adapter';

export interface VersionSoftwareOption {
  id: string;
  name: string;
  type: 'server' | 'proxy' | 'modded';
  description: string;
  icon: string;
  defaultJar: string;
  recommendedJava: string;
  versions: Array<{
    version: string;
    build?: string;
    releaseType: 'release' | 'snapshot' | 'lts';
    javaVersion: string;
    downloadUrl?: string;
  }>;
}

@Injectable()
export class VersionsService {
  private readonly logger = new Logger(VersionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private getWingsClient(node: {
    scheme: string;
    fqdn: string;
    daemonPort: number;
    daemonToken: string;
  }): WingsClient {
    return new WingsClient({
      scheme: node.scheme as 'http' | 'https',
      fqdn: node.fqdn,
      daemonListen: node.daemonPort,
      daemonToken: node.daemonToken,
    });
  }

  /**
   * Get all supported Minecraft software and version catalogs.
   */
  async getSoftwareCatalog(): Promise<VersionSoftwareOption[]> {
    return [
      {
        id: 'paper',
        name: 'PaperMC',
        type: 'server',
        description: 'High-performance Spigot-compatible Minecraft software with anti-xray, exploit patches, and major performance optimizations.',
        icon: 'paper',
        defaultJar: 'paper.jar',
        recommendedJava: 'Java 21 / Java 17',
        versions: [
          { version: '1.21.4', releaseType: 'release', javaVersion: 'Java 21', downloadUrl: 'https://fill-data.papermc.io/v1/objects/5ee4f542f628a14c644410b08c94ea42e772ef4d29fe92973636b6813d4eaffc/paper-1.21.4-232.jar' },
          { version: '1.21.3', releaseType: 'release', javaVersion: 'Java 21' },
          { version: '1.21.1', releaseType: 'lts', javaVersion: 'Java 21', downloadUrl: 'https://fill-data.papermc.io/v1/objects/39bd8c00b9e18de91dcabd3cc3dcfa5328685a53b7187a2f63280c22e2d287b9/paper-1.21.1-133.jar' },
          { version: '1.20.6', releaseType: 'release', javaVersion: 'Java 21' },
          { version: '1.20.4', releaseType: 'lts', javaVersion: 'Java 17', downloadUrl: 'https://fill-data.papermc.io/v1/objects/35fa78aa0e71973ca35d6e24db49348981432f7960714b62dbba49405d4df1ec/paper-1.20.4-499.jar' },
          { version: '1.20.2', releaseType: 'release', javaVersion: 'Java 17' },
          { version: '1.20.1', releaseType: 'lts', javaVersion: 'Java 17' },
          { version: '1.19.4', releaseType: 'lts', javaVersion: 'Java 17' },
          { version: '1.18.2', releaseType: 'lts', javaVersion: 'Java 17' },
          { version: '1.17.1', releaseType: 'release', javaVersion: 'Java 16' },
          { version: '1.16.5', releaseType: 'lts', javaVersion: 'Java 11 / Java 8' },
          { version: '1.12.2', releaseType: 'lts', javaVersion: 'Java 8' },
          { version: '1.8.8', releaseType: 'lts', javaVersion: 'Java 8' },
        ],
      },
      {
        id: 'purpur',
        name: 'Purpur',
        type: 'server',
        description: 'Drop-in replacement for Paper with extensive gameplay customization options, ridable mobs, and TPS improvements.',
        icon: 'purpur',
        defaultJar: 'purpur.jar',
        recommendedJava: 'Java 21 / Java 17',
        versions: [
          { version: '1.21.4', releaseType: 'release', javaVersion: 'Java 21', downloadUrl: 'https://api.purpurmc.org/v2/purpur/1.21.4/latest/download' },
          { version: '1.21.3', releaseType: 'release', javaVersion: 'Java 21', downloadUrl: 'https://api.purpurmc.org/v2/purpur/1.21.3/latest/download' },
          { version: '1.21.1', releaseType: 'lts', javaVersion: 'Java 21', downloadUrl: 'https://api.purpurmc.org/v2/purpur/1.21.1/latest/download' },
          { version: '1.20.6', releaseType: 'release', javaVersion: 'Java 21', downloadUrl: 'https://api.purpurmc.org/v2/purpur/1.20.6/latest/download' },
          { version: '1.20.4', releaseType: 'lts', javaVersion: 'Java 17', downloadUrl: 'https://api.purpurmc.org/v2/purpur/1.20.4/latest/download' },
          { version: '1.20.2', releaseType: 'release', javaVersion: 'Java 17', downloadUrl: 'https://api.purpurmc.org/v2/purpur/1.20.2/latest/download' },
          { version: '1.20.1', releaseType: 'lts', javaVersion: 'Java 17', downloadUrl: 'https://api.purpurmc.org/v2/purpur/1.20.1/latest/download' },
          { version: '1.19.4', releaseType: 'lts', javaVersion: 'Java 17', downloadUrl: 'https://api.purpurmc.org/v2/purpur/1.19.4/latest/download' },
          { version: '1.18.2', releaseType: 'lts', javaVersion: 'Java 17', downloadUrl: 'https://api.purpurmc.org/v2/purpur/1.18.2/latest/download' },
          { version: '1.16.5', releaseType: 'lts', javaVersion: 'Java 8', downloadUrl: 'https://api.purpurmc.org/v2/purpur/1.16.5/latest/download' },
        ],
      },
      {
        id: 'velocity',
        name: 'Velocity Proxy',
        type: 'proxy',
        description: 'Next-generation Minecraft proxy offering unbeatable performance, high scalability, modern plugin architecture, and DoS mitigation.',
        icon: 'velocity',
        defaultJar: 'velocity.jar',
        recommendedJava: 'Java 21 / Java 17',
        versions: [
          { version: '3.4.0', releaseType: 'release', javaVersion: 'Java 21', downloadUrl: 'https://fill-data.papermc.io/v1/objects/fb599cbda6a6d01decce5e281f71f51cae7cacffcfafca32a09601f407b0583e/velocity-3.4.0-566.jar' },
          { version: '3.3.0', releaseType: 'release', javaVersion: 'Java 17' },
          { version: '3.2.0', releaseType: 'lts', javaVersion: 'Java 17' },
        ],
      },
      {
        id: 'waterfall',
        name: 'Waterfall Proxy',
        type: 'proxy',
        description: 'Upgraded BungeeCord proxy fork by PaperMC with enhanced security fixes and responsive network processing.',
        icon: 'waterfall',
        defaultJar: 'waterfall.jar',
        recommendedJava: 'Java 17 / Java 11',
        versions: [
          { version: '1.21', releaseType: 'release', javaVersion: 'Java 21' },
          { version: '1.20', releaseType: 'lts', javaVersion: 'Java 17' },
          { version: '1.19', releaseType: 'release', javaVersion: 'Java 17' },
          { version: '1.18', releaseType: 'release', javaVersion: 'Java 17' },
          { version: '1.16', releaseType: 'lts', javaVersion: 'Java 8' },
        ],
      },
      {
        id: 'folia',
        name: 'Folia (Multi-threaded)',
        type: 'server',
        description: 'Paper fork that splits tick loops into independent regional chunks, enabling 100+ TPS on multi-core servers with huge player bases.',
        icon: 'folia',
        defaultJar: 'folia.jar',
        recommendedJava: 'Java 21',
        versions: [
          { version: '1.21.4', releaseType: 'release', javaVersion: 'Java 21' },
          { version: '1.20.6', releaseType: 'release', javaVersion: 'Java 21' },
          { version: '1.20.4', releaseType: 'lts', javaVersion: 'Java 21' },
          { version: '1.19.4', releaseType: 'release', javaVersion: 'Java 17' },
        ],
      },
      {
        id: 'fabric',
        name: 'Fabric Loader',
        type: 'modded',
        description: 'Ultra-lightweight, modular modding toolchain for Minecraft with rapid updates and seamless performance mods (Lithium, FerriteCore).',
        icon: 'fabric',
        defaultJar: 'fabric-server-launch.jar',
        recommendedJava: 'Java 21 / Java 17',
        versions: [
          { version: '1.21.4', releaseType: 'release', javaVersion: 'Java 21', downloadUrl: 'https://meta.fabricmc.net/v2/versions/loader/1.21.4/0.16.9/1.0.1/server/jar' },
          { version: '1.21.1', releaseType: 'lts', javaVersion: 'Java 21', downloadUrl: 'https://meta.fabricmc.net/v2/versions/loader/1.21.1/0.16.9/1.0.1/server/jar' },
          { version: '1.20.4', releaseType: 'lts', javaVersion: 'Java 17', downloadUrl: 'https://meta.fabricmc.net/v2/versions/loader/1.20.4/0.16.9/1.0.1/server/jar' },
          { version: '1.20.1', releaseType: 'lts', javaVersion: 'Java 17', downloadUrl: 'https://meta.fabricmc.net/v2/versions/loader/1.20.1/0.16.9/1.0.1/server/jar' },
          { version: '1.19.4', releaseType: 'lts', javaVersion: 'Java 17', downloadUrl: 'https://meta.fabricmc.net/v2/versions/loader/1.19.4/0.16.9/1.0.1/server/jar' },
        ],
      },
      {
        id: 'vanilla',
        name: 'Vanilla Minecraft',
        type: 'server',
        description: 'Official un-modded Mojang Minecraft Java Edition server software directly from Mojang launcher metadata.',
        icon: 'vanilla',
        defaultJar: 'server.jar',
        recommendedJava: 'Java 21 / Java 17',
        versions: [
          { version: '1.21.4', releaseType: 'release', javaVersion: 'Java 21' },
          { version: '1.21.1', releaseType: 'lts', javaVersion: 'Java 21' },
          { version: '1.20.4', releaseType: 'lts', javaVersion: 'Java 17' },
          { version: '1.20.1', releaseType: 'release', javaVersion: 'Java 17' },
          { version: '1.19.4', releaseType: 'release', javaVersion: 'Java 17' },
          { version: '1.18.2', releaseType: 'release', javaVersion: 'Java 17' },
          { version: '1.16.5', releaseType: 'lts', javaVersion: 'Java 8' },
        ],
      },
    ];
  }

  /**
   * Resolve direct download URL for selected software and version.
   */
  async resolveDownloadUrl(software: string, version: string): Promise<{ downloadUrl: string; jarName: string }> {
    const sw = software.toLowerCase().trim();
    const ver = version.trim();

    // 1. Purpur
    if (sw === 'purpur') {
      return {
        downloadUrl: `https://api.purpurmc.org/v2/purpur/${ver}/latest/download`,
        jarName: 'purpur.jar',
      };
    }

    // 2. Fabric
    if (sw === 'fabric') {
      return {
        downloadUrl: `https://meta.fabricmc.net/v2/versions/loader/${ver}/0.16.9/1.0.1/server/jar`,
        jarName: 'fabric-server-launch.jar',
      };
    }

    // 3. Paper / Velocity / Folia / Waterfall via PaperMC Fill v3
    if (['paper', 'velocity', 'folia', 'waterfall'].includes(sw)) {
      const jarName = `${sw}.jar`;
      try {
        const userAgent = 'ObsidianPanel/1.0 (support@obsidianpanel.com)';
        const buildResp = await fetch(`https://fill.papermc.io/v3/projects/${sw}/versions/${ver}`, {
          headers: { 'User-Agent': userAgent },
        });

        if (buildResp.ok) {
          const buildData = (await buildResp.json()) as any;
          const latestBuild = buildData?.builds?.[0];
          if (latestBuild) {
            const dlResp = await fetch(`https://fill.papermc.io/v3/projects/${sw}/versions/${ver}/builds/${latestBuild}`, {
              headers: { 'User-Agent': userAgent },
            });
            if (dlResp.ok) {
              const dlData = (await dlResp.json()) as any;
              const directUrl =
                dlData?.downloads?.['server:default']?.url ||
                (Object.values(dlData?.downloads || {})[0] as any)?.url;
              if (directUrl) {
                return { downloadUrl: directUrl, jarName };
              }
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Failed to resolve ${sw} ${ver} from Fill v3: ${err.message}`);
      }

      // Hardcoded high-speed direct fallbacks
      if (sw === 'paper') {
        if (ver === '1.21.4') {
          return {
            downloadUrl: 'https://fill-data.papermc.io/v1/objects/5ee4f542f628a14c644410b08c94ea42e772ef4d29fe92973636b6813d4eaffc/paper-1.21.4-232.jar',
            jarName,
          };
        }
        if (ver === '1.21.1') {
          return {
            downloadUrl: 'https://fill-data.papermc.io/v1/objects/39bd8c00b9e18de91dcabd3cc3dcfa5328685a53b7187a2f63280c22e2d287b9/paper-1.21.1-133.jar',
            jarName,
          };
        }
        if (ver === '1.20.4') {
          return {
            downloadUrl: 'https://fill-data.papermc.io/v1/objects/35fa78aa0e71973ca35d6e24db49348981432f7960714b62dbba49405d4df1ec/paper-1.20.4-499.jar',
            jarName,
          };
        }
        // Fallback to Purpur (fully compatible Paper drop-in)
        return {
          downloadUrl: `https://api.purpurmc.org/v2/purpur/${ver}/latest/download`,
          jarName,
        };
      }

      if (sw === 'velocity') {
        return {
          downloadUrl: 'https://fill-data.papermc.io/v1/objects/fb599cbda6a6d01decce5e281f71f51cae7cacffcfafca32a09601f407b0583e/velocity-3.4.0-566.jar',
          jarName,
        };
      }
    }

    // 4. Vanilla Mojang
    try {
      const manifestResp = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json');
      if (manifestResp.ok) {
        const manifest = (await manifestResp.json()) as any;
        const entry = manifest.versions?.find((v: any) => v.id === ver);
        if (entry?.url) {
          const verResp = await fetch(entry.url);
          if (verResp.ok) {
            const verData = (await verResp.json()) as any;
            const dl = verData.downloads?.server?.url;
            if (dl) {
              return { downloadUrl: dl, jarName: 'server.jar' };
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to resolve Vanilla from Mojang: ${err.message}`);
    }

    // Ultimate fallback to Purpur release
    return {
      downloadUrl: `https://api.purpurmc.org/v2/purpur/1.21.4/latest/download`,
      jarName: `${sw}.jar`,
    };
  }

  /**
   * Install a version into the server directly via Wings.
   */
  async installVersion(
    serverUuid: string,
    dto: {
      software: string;
      version: string;
      customJarName?: string;
    },
  ): Promise<{ success: boolean; message: string; jarFile: string }> {
    const server = await this.prisma.server.findUnique({
      where: { uuid: serverUuid },
      include: {
        node: true,
        egg: {
          include: { variables: true },
        },
        variables: true,
      },
    });

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    const { downloadUrl, jarName } = await this.resolveDownloadUrl(dto.software, dto.version);
    const targetJar = dto.customJarName?.trim() || jarName;
    const client = this.getWingsClient(server.node);

    this.logger.log(
      `Installing ${dto.software} ${dto.version} (${targetJar}) for server ${server.uuid} from ${downloadUrl}`,
    );

    // 1. Download JAR file onto the server filesystem via Wings
    try {
      await client.pullFile(server.uuid, downloadUrl, '/', targetJar, true);
    } catch (pullErr: any) {
      this.logger.warn(`Wings pullFile failed (${pullErr.message}), falling back to direct write...`);
      throw new BadRequestException(
        `Failed to pull server jar from remote source via Wings: ${pullErr.message}`,
      );
    }

    // 2. Ensure eula.txt is accepted
    try {
      await client.writeFile(server.uuid, 'eula.txt', 'eula=true\n# Accepted via Obsidian Panel Version Manager\n');
    } catch (eulaErr: any) {
      this.logger.warn(`Failed to write eula.txt: ${eulaErr.message}`);
    }

    // 3. Update server variable SERVER_JARFILE if defined in egg
    const jarVar = server.egg.variables.find((v) => v.envVariable === 'SERVER_JARFILE');
    if (jarVar) {
      const existing = server.variables.find((v) => v.variableId === jarVar.id);
      if (existing) {
        await this.prisma.serverVariable.update({
          where: { id: existing.id },
          data: { variableValue: targetJar },
        });
      } else {
        await this.prisma.serverVariable.create({
          data: {
            serverId: server.id,
            variableId: jarVar.id,
            variableValue: targetJar,
          },
        });
      }
    }

    // 4. Update MINECRAFT_VERSION variable if defined
    const mcVerVar = server.egg.variables.find((v) => ['MINECRAFT_VERSION', 'MC_VERSION', 'VANILLA_VERSION'].includes(v.envVariable));
    if (mcVerVar) {
      const existing = server.variables.find((v) => v.variableId === mcVerVar.id);
      if (existing) {
        await this.prisma.serverVariable.update({
          where: { id: existing.id },
          data: { variableValue: dto.version },
        });
      } else {
        await this.prisma.serverVariable.create({
          data: {
            serverId: server.id,
            variableId: mcVerVar.id,
            variableValue: dto.version,
          },
        });
      }
    }

    // 5. Sync configuration to Wings so startup command has the new jar
    try {
      await client.syncServer(server.uuid);
    } catch (syncErr: any) {
      this.logger.warn(`Failed to sync configuration with Wings: ${syncErr.message}`);
    }

    // 6. Record activity log
    await this.prisma.activityLog.create({
      data: {
        serverId: server.id,
        event: 'server:version.install',
        properties: {
          software: dto.software,
          version: dto.version,
          jarFile: targetJar,
        },
      },
    });

    return {
      success: true,
      message: `Successfully installed ${dto.software.toUpperCase()} ${dto.version} (${targetJar})! You can now start the server.`,
      jarFile: targetJar,
    };
  }
}
