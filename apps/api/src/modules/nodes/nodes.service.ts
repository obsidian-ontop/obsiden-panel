import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { WingsClient } from '@obsidian/wings-adapter';
import * as crypto from 'crypto';
import * as yaml from 'yaml';

@Injectable()
export class NodesService {
  private readonly logger = new Logger(NodesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async listNodes() {
    const nodes = await this.prisma.node.findMany({
      include: {
        location: {
          select: { id: true, short: true, long: true },
        },
        _count: {
          select: {
            servers: true,
            allocations: true,
          },
        },
        servers: {
          select: {
            memory: true,
            disk: true,
            status: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    return nodes.map((node) => {
      const allocatedMemory = node.servers.reduce((sum, s) => sum + s.memory, 0);
      const allocatedDisk = node.servers.reduce((sum, s) => sum + s.disk, 0);

      const { servers, ...nodeData } = node;
      return {
        ...nodeData,
        stats: {
          totalServers: node._count.servers,
          totalAllocations: node._count.allocations,
          allocatedMemory,
          allocatedDisk,
          memoryUsagePercent:
            node.memory > 0
              ? Math.round((allocatedMemory / (node.memory * (1 + node.memoryOverallocate / 100))) * 100)
              : 0,
          diskUsagePercent:
            node.disk > 0
              ? Math.round((allocatedDisk / (node.disk * (1 + node.diskOverallocate / 100))) * 100)
              : 0,
        },
      };
    });
  }

  async getNodeById(id: number) {
    const node = await this.prisma.node.findUnique({
      where: { id },
      include: {
        location: true,
        allocations: {
          select: {
            id: true,
            ip: true,
            port: true,
            alias: true,
            serverId: true,
            server: {
              select: { id: true, uuid: true, name: true },
            },
          },
          orderBy: [{ ip: 'asc' }, { port: 'asc' }],
        },
        servers: {
          select: {
            id: true,
            uuid: true,
            name: true,
            status: true,
            memory: true,
            disk: true,
            cpu: true,
            owner: {
              select: { id: true, username: true, email: true },
            },
          },
        },
        _count: {
          select: {
            servers: true,
            allocations: true,
          },
        },
      },
    });

    if (!node) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }

    return node;
  }

  async createNode(dto: {
    name: string;
    description?: string;
    locationId: number;
    fqdn: string;
    scheme?: string;
    behindProxy?: boolean;
    daemonPort?: number;
    daemonSftpPort?: number;
    daemonBase?: string;
    memory: number;
    memoryOverallocate?: number;
    disk: number;
    diskOverallocate?: number;
    uploadSize?: number;
  }) {
    const location = await this.prisma.location.findUnique({
      where: { id: dto.locationId },
    });
    if (!location) {
      throw new BadRequestException(`Location with ID ${dto.locationId} does not exist`);
    }

    const daemonTokenId = crypto.randomBytes(8).toString('hex');
    const daemonToken = crypto.randomBytes(32).toString('hex');

    return this.prisma.node.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || '',
        locationId: dto.locationId,
        fqdn: dto.fqdn.trim().toLowerCase(),
        scheme: dto.scheme || 'https',
        behindProxy: dto.behindProxy ?? false,
        daemonPort: dto.daemonPort || 8080,
        daemonSftpPort: dto.daemonSftpPort || 2022,
        daemonBase: dto.daemonBase || '/var/lib/pterodactyl/volumes',
        memory: dto.memory,
        memoryOverallocate: dto.memoryOverallocate ?? 0,
        disk: dto.disk,
        diskOverallocate: dto.diskOverallocate ?? 0,
        uploadSize: dto.uploadSize || 100,
        daemonTokenId,
        daemonToken,
      },
      include: {
        location: true,
      },
    });
  }

  async updateNode(
    id: number,
    dto: {
      name?: string;
      description?: string;
      locationId?: number;
      fqdn?: string;
      scheme?: string;
      behindProxy?: boolean;
      daemonPort?: number;
      daemonSftpPort?: number;
      daemonBase?: string;
      memory?: number;
      memoryOverallocate?: number;
      disk?: number;
      diskOverallocate?: number;
      uploadSize?: number;
      resetToken?: boolean;
    },
  ) {
    await this.getNodeById(id);

    if (dto.locationId) {
      const location = await this.prisma.location.findUnique({
        where: { id: dto.locationId },
      });
      if (!location) {
        throw new BadRequestException(`Location with ID ${dto.locationId} does not exist`);
      }
    }

    const updateData: any = { ...dto };
    delete updateData.resetToken;

    if (dto.resetToken) {
      updateData.daemonTokenId = crypto.randomBytes(8).toString('hex');
      updateData.daemonToken = crypto.randomBytes(32).toString('hex');
    }

    return this.prisma.node.update({
      where: { id },
      data: updateData,
      include: {
        location: true,
      },
    });
  }

  async deleteNode(id: number) {
    const node = await this.getNodeById(id);

    if (node._count.servers > 0) {
      throw new BadRequestException(
        `Cannot delete node '${node.name}'. It still has ${node._count.servers} server(s) assigned. Delete or transfer servers first.`,
      );
    }

    await this.prisma.allocation.deleteMany({
      where: { nodeId: id },
    });

    await this.prisma.node.delete({ where: { id } });
    return { success: true, message: `Node ${node.name} and allocations deleted` };
  }

  async getNodeConfigurationYaml(id: number): Promise<string> {
    const node = await this.prisma.node.findUnique({
      where: { id },
    });

    if (!node) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }

    const appUrl = this.configService.get<string>('APP_URL', 'http://127.0.0.1:3000');

    const configObject = {
      debug: false,
      uuid: node.uuid,
      token_id: node.daemonTokenId,
      token: node.daemonToken,
      api: {
        host: '0.0.0.0',
        port: node.daemonPort,
        ssl: {
          enabled: node.scheme === 'https',
          cert: `/etc/letsencrypt/live/${node.fqdn}/fullchain.pem`,
          key: `/etc/letsencrypt/live/${node.fqdn}/privkey.pem`,
        },
        upload_limit: node.uploadSize,
      },
      system: {
        root_directory: '/var/lib/pterodactyl',
        log_directory: '/var/log/pterodactyl',
        data: node.daemonBase,
        archive_directory: '/var/lib/pterodactyl/archives',
        backup_directory: '/var/lib/pterodactyl/backups',
        sftp: {
          bind_port: node.daemonSftpPort,
        },
      },
      allowed_mounts: [],
      remote: appUrl,
    };

    return yaml.stringify(configObject, { indent: 2 });
  }

  async testNodeConnection(id: number) {
    const node = await this.prisma.node.findUnique({
      where: { id },
    });

    if (!node) {
      throw new NotFoundException(`Node with ID ${id} not found`);
    }

    const client = new WingsClient({
      scheme: node.scheme as 'http' | 'https',
      fqdn: node.fqdn,
      daemonListen: node.daemonPort,
      daemonToken: node.daemonToken,
      timeout: 10000,
    });

    try {
      const systemInfo = await client.getSystemInfo();
      return {
        online: true,
        message: 'Successfully connected to Wings daemon',
        systemInfo,
      };
    } catch (error: any) {
      this.logger.warn(`Failed connection test to node ${node.id} (${node.fqdn}): ${error.message}`);
      return {
        online: false,
        message: `Failed to connect to Wings daemon: ${error.message}`,
        statusCode: error.statusCode,
      };
    }
  }

  getWingsClient(node: {
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
}
