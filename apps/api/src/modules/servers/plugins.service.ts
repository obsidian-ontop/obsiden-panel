import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WingsClient } from '@obsidian/wings-adapter';
import * as path from 'path';

export interface PluginItem {
  id: string;
  pluginId: string;
  source: 'spigot' | 'modrinth';
  name: string;
  tagline: string;
  description?: string;
  author: string;
  downloads: number;
  rating: number;
  iconUrl: string | null;
  testedVersions: string[];
  sourceUrl: string;
  premium: boolean;
}

export interface InstalledPlugin {
  name: string;
  size: number;
  modified: string;
  isEnabled: boolean;
}

@Injectable()
export class PluginsService {
  private readonly logger = new Logger(PluginsService.name);
  private readonly userAgent = 'ObsidianPanel/1.0 (support@obsidianpanel.com)';

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
   * Search and list plugins from SpigotMC (Spiget API) and Modrinth API.
   */
  async searchPlugins(
    query: string = '',
    source: 'all' | 'spigot' | 'modrinth' = 'all',
    page: number = 1,
  ): Promise<{ plugins: PluginItem[]; page: number; total: number; hasMore: boolean }> {
    const q = query.trim();
    const headers = { 'User-Agent': this.userAgent, Accept: 'application/json' };
    const limit = 24;

    const results: PluginItem[] = [];
    let spigotTotal = 0;
    let modrinthTotal = 0;

    // 1. SpigotMC via Spiget API
    if (source === 'all' || source === 'spigot') {
      try {
        const spigotSize = source === 'all' ? 14 : limit;
        const spigotUrl = q
          ? `https://api.spiget.org/v2/search/resources/${encodeURIComponent(q)}?size=${spigotSize}&page=${page}&sort=-downloads`
          : `https://api.spiget.org/v2/resources?size=${spigotSize}&page=${page}&sort=-downloads`;

        const spigotRes = await fetch(spigotUrl, { headers });
        if (spigotRes.ok) {
          const spigotData = await spigotRes.json();
          if (Array.isArray(spigotData)) {
            spigotTotal = spigotData.length * 10;
            for (const item of spigotData) {
              results.push({
                id: `spigot:${item.id}`,
                pluginId: String(item.id),
                source: 'spigot',
                name: item.name || 'Unnamed Spigot Plugin',
                tagline: item.tag || '',
                author: item.author?.id ? `Author #${item.author.id}` : 'SpigotMC Author',
                downloads: item.downloads || 0,
                rating: item.rating?.average ? Number(item.rating.average.toFixed(1)) : 5.0,
                iconUrl: item.icon?.data
                  ? `data:image/png;base64,${item.icon.data}`
                  : item.icon?.url || null,
                testedVersions: Array.isArray(item.testedVersions) ? item.testedVersions : [],
                sourceUrl: `https://www.spigotmc.org/resources/${item.id}/`,
                premium: Boolean(item.premium),
              });
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Spiget search failed: ${err.message}`);
      }
    }

    // 2. Modrinth API v2
    if (source === 'all' || source === 'modrinth') {
      try {
        const modrinthLimit = source === 'all' ? 14 : limit;
        const offset = (page - 1) * modrinthLimit;
        const modrinthUrl = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(
          q,
        )}&facets=[[%22project_type:plugin%22]]&limit=${modrinthLimit}&offset=${offset}`;

        const modRes = await fetch(modrinthUrl, { headers });
        if (modRes.ok) {
          const modData: any = await modRes.json();
          if (modData?.hits && Array.isArray(modData.hits)) {
            modrinthTotal = modData.total_hits || modData.hits.length;
            for (const item of modData.hits) {
              results.push({
                id: `modrinth:${item.project_id}`,
                pluginId: item.project_id,
                source: 'modrinth',
                name: item.title || 'Unnamed Modrinth Plugin',
                tagline: item.description || '',
                author: item.author || 'Modrinth Creator',
                downloads: item.downloads || 0,
                rating: item.follows ? Math.min(5, Math.round((item.follows / 50) * 10) / 10 + 3.5) : 4.8,
                iconUrl: item.icon_url || null,
                testedVersions: item.versions ? item.versions.split(' ').slice(0, 5) : [],
                sourceUrl: `https://modrinth.com/plugin/${item.slug || item.project_id}`,
                premium: false,
              });
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Modrinth search failed: ${err.message}`);
      }
    }

    // Sort combined results by popularity/downloads
    if (source === 'all') {
      results.sort((a, b) => b.downloads - a.downloads);
    }

    return {
      plugins: results,
      page,
      total: spigotTotal + modrinthTotal,
      hasMore: results.length >= (source === 'all' ? 20 : limit),
    };
  }

  /**
   * List all currently installed plugins in /plugins folder on the server.
   */
  async getInstalledPlugins(serverUuid: string): Promise<InstalledPlugin[]> {
    const server = await this.prisma.server.findUnique({
      where: { uuid: serverUuid },
      include: { node: true },
    });
    if (!server) throw new NotFoundException('Server not found');

    const client = this.getWingsClient(server.node);

    try {
      const files = await client.listFiles(server.uuid, '/plugins');
      if (!Array.isArray(files)) return [];

      return files
        .filter((f) => f.name.endsWith('.jar') || f.name.endsWith('.jar.disabled'))
        .map((f) => ({
          name: f.name,
          size: f.size,
          modified: f.modified,
          isEnabled: !f.name.endsWith('.disabled'),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (err: any) {
      // /plugins directory may not exist yet if server was freshly created
      return [];
    }
  }

  /**
   * Install a plugin directly into /plugins on the server.
   */
  async installPlugin(
    serverUuid: string,
    dto: {
      source: 'spigot' | 'modrinth';
      pluginId: string;
      fileName?: string;
    },
  ): Promise<{ success: boolean; fileName: string; message: string }> {
    const server = await this.prisma.server.findUnique({
      where: { uuid: serverUuid },
      include: { node: true },
    });
    if (!server) throw new NotFoundException('Server not found');

    const client = this.getWingsClient(server.node);

    // Ensure /plugins folder exists
    try {
      await client.createFolder(server.uuid, '/', 'plugins');
    } catch {
      // Ignore if folder already exists
    }

    let downloadUrl = '';
    let resolvedFileName = dto.fileName?.trim() || '';

    if (dto.source === 'spigot') {
      // Get Spiget details for safe clean name
      try {
        const infoRes = await fetch(`https://api.spiget.org/v2/resources/${dto.pluginId}`, {
          headers: { 'User-Agent': this.userAgent },
        });
        if (infoRes.ok) {
          const info: any = await infoRes.json();
          if (!resolvedFileName && info.name) {
            resolvedFileName = `${info.name.replace(/[^a-zA-Z0-9_\-\.]/g, '_')}.jar`;
          }
        }
      } catch (err) {
        this.logger.warn(`Spiget info fetch fallback: ${err}`);
      }

      if (!resolvedFileName) {
        resolvedFileName = `spigot-${dto.pluginId}.jar`;
      }
      downloadUrl = `https://api.spiget.org/v2/resources/${dto.pluginId}/download`;
    } else if (dto.source === 'modrinth') {
      // Fetch latest version download from Modrinth
      const verRes = await fetch(
        `https://api.modrinth.com/v2/project/${dto.pluginId}/version`,
        { headers: { 'User-Agent': this.userAgent } },
      );
      if (!verRes.ok) {
        throw new BadRequestException('Failed to find compatible version on Modrinth');
      }
      const versions = await verRes.json();
      if (!Array.isArray(versions) || versions.length === 0 || !versions[0]?.files?.[0]?.url) {
        throw new BadRequestException('No downloadable JAR file found for this Modrinth plugin');
      }

      const fileObj = versions[0].files[0];
      downloadUrl = fileObj.url;
      resolvedFileName = fileObj.filename || `${dto.pluginId}.jar`;
    }

    if (!resolvedFileName.endsWith('.jar')) {
      resolvedFileName += '.jar';
    }

    this.logger.log(
      `Installing ${dto.source} plugin ${dto.pluginId} -> /plugins/${resolvedFileName} for server ${server.uuid}`,
    );

    // Download the binary buffer and write directly to Wings filesystem to guarantee reliability
    try {
      const resp = await fetch(downloadUrl, {
        headers: { 'User-Agent': this.userAgent },
      });
      if (!resp.ok) {
        throw new Error(`Download endpoint returned HTTP ${resp.status}`);
      }
      const arrayBuffer = await resp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      await client.writeFile(server.uuid, `/plugins/${resolvedFileName}`, buffer);

      return {
        success: true,
        fileName: resolvedFileName,
        message: `Successfully installed "${resolvedFileName}" into /plugins directory!`,
      };
    } catch (dlErr: any) {
      // Try Wings pullFile as fallback
      try {
        await client.pullFile(server.uuid, downloadUrl, '/plugins', resolvedFileName, true);
        return {
          success: true,
          fileName: resolvedFileName,
          message: `Successfully pulled "${resolvedFileName}" into /plugins directory!`,
        };
      } catch (pullErr: any) {
        throw new BadRequestException(`Failed to download plugin: ${dlErr.message}`);
      }
    }
  }

  /**
   * Uninstall (delete) a plugin from /plugins.
   */
  async uninstallPlugin(
    serverUuid: string,
    fileName: string,
  ): Promise<{ success: boolean; message: string }> {
    const server = await this.prisma.server.findUnique({
      where: { uuid: serverUuid },
      include: { node: true },
    });
    if (!server) throw new NotFoundException('Server not found');

    const client = this.getWingsClient(server.node);
    const cleanFileName = path.basename(fileName);

    await client.deleteFiles(server.uuid, '/plugins', [cleanFileName]);

    return {
      success: true,
      message: `Plugin "${cleanFileName}" uninstalled successfully.`,
    };
  }

  /**
   * Toggle plugin (enable/disable by renaming .jar <-> .jar.disabled).
   */
  async togglePlugin(
    serverUuid: string,
    fileName: string,
  ): Promise<{ success: boolean; fileName: string; isEnabled: boolean }> {
    const server = await this.prisma.server.findUnique({
      where: { uuid: serverUuid },
      include: { node: true },
    });
    if (!server) throw new NotFoundException('Server not found');

    const client = this.getWingsClient(server.node);
    const cleanName = path.basename(fileName);

    let newName: string;
    let isEnabled: boolean;

    if (cleanName.endsWith('.disabled')) {
      newName = cleanName.replace(/\.disabled$/, '');
      isEnabled = true;
    } else {
      newName = `${cleanName}.disabled`;
      isEnabled = false;
    }

    await client.renameFiles(server.uuid, '/plugins', [{ from: cleanName, to: newName }]);

    return {
      success: true,
      fileName: newName,
      isEnabled,
    };
  }
}
