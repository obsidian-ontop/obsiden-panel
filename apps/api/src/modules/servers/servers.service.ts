import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WingsRemoteService } from '../wings-remote/wings-remote.service';
import { AuthService } from '../auth/auth.service';
import { WingsClient } from '@obsidian/wings-adapter';
import * as crypto from 'crypto';

@Injectable()
export class ServersService {
  private readonly logger = new Logger(ServersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wingsRemoteService: WingsRemoteService,
    private readonly authService: AuthService,
  ) {}

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

  // ─── Listing ───────────────────────────────────────────────────────

  async listClientServers(userId: number, isAdmin: boolean) {
    const servers = await this.prisma.server.findMany({
      where: isAdmin
        ? {}
        : {
            OR: [
              { userId },
              { subusers: { some: { userId } } },
            ],
          },
      include: {
        node: {
          select: { id: true, name: true, fqdn: true },
        },
        allocation: {
          select: { id: true, ip: true, port: true, alias: true },
        },
        egg: {
          select: { id: true, name: true },
        },
        owner: {
          select: { id: true, username: true, email: true },
        },
        subusers: {
          where: { userId },
          select: { permissions: true },
        },
      },
      orderBy: { id: 'desc' },
    });

    return servers.map((s) => ({
      id: s.id,
      uuid: s.uuid,
      uuidShort: s.uuidShort,
      name: s.name,
      description: s.description,
      status: s.status,
      node: s.node.name,
      allocation: `${s.allocation.alias || s.allocation.ip}:${s.allocation.port}`,
      owner: s.owner ? { id: s.owner.id, username: s.owner.username, email: s.owner.email } : null,
      limits: {
        memory: s.memory,
        swap: s.swap,
        disk: s.disk,
        io: s.io,
        cpu: s.cpu,
        threads: s.threads,
      },
      isOwner: s.userId === userId,
      permissions: isAdmin || s.userId === userId ? ['*'] : s.subusers[0]?.permissions || [],
      createdAt: s.createdAt,
    }));
  }

  async getServerByUuid(uuid: string) {
    const server = await this.prisma.server.findUnique({
      where: { uuid },
      include: {
        node: true,
        allocation: true,
        allocations: {
          select: { id: true, ip: true, port: true, alias: true, notes: true },
        },
        egg: {
          include: { variables: true },
        },
        nest: {
          select: { id: true, name: true },
        },
        owner: {
          select: { id: true, uuid: true, username: true, email: true },
        },
        variables: {
          include: {
            variable: true,
          },
        },
        subusers: {
          include: {
            user: {
              select: { id: true, uuid: true, username: true, email: true },
            },
          },
        },
      },
    });

    if (!server) {
      throw new NotFoundException(`Server with UUID ${uuid} not found`);
    }

    return server;
  }

  // ─── Provisioning ──────────────────────────────────────────────────

  async createServer(dto: {
    name: string;
    description?: string;
    ownerId: number;
    nodeId: number;
    allocationId: number;
    additionalAllocationIds?: number[];
    eggId: number;
    nestId: number;
    dockerImage?: string;
    startup?: string;
    environment?: Record<string, string>;
    memory: number;
    swap?: number;
    disk: number;
    io?: number;
    cpu: number;
    threads?: string;
    databases?: number;
    allocationsLimit?: number;
    backups?: number;
  }) {
    const owner = await this.prisma.user.findUnique({ where: { id: dto.ownerId } });
    if (!owner) throw new BadRequestException(`User ${dto.ownerId} does not exist`);

    const node = await this.prisma.node.findUnique({ where: { id: dto.nodeId } });
    if (!node) throw new BadRequestException(`Node ${dto.nodeId} does not exist`);

    const egg = await this.prisma.egg.findUnique({
      where: { id: dto.eggId },
      include: { variables: true },
    });
    if (!egg) throw new BadRequestException(`Egg ${dto.eggId} does not exist`);

    // Verify primary allocation is unassigned and on this node
    const primaryAlloc = await this.prisma.allocation.findFirst({
      where: { id: dto.allocationId, nodeId: dto.nodeId, serverId: null },
    });
    if (!primaryAlloc) {
      throw new ConflictException(`Allocation ${dto.allocationId} is already assigned or not found on this node`);
    }

    const uuid = crypto.randomUUID();
    const uuidShort = uuid.substring(0, 8);

    let defaultDockerImage = 'ghcr.io/pterodactyl/yolks:java_17';
    try {
      const parsedImages = typeof egg.dockerImages === 'object' && egg.dockerImages !== null
        ? egg.dockerImages as Record<string, string>
        : {};
      defaultDockerImage = Object.values(parsedImages)[0] || defaultDockerImage;
    } catch {}

    const dockerImage = dto.dockerImage || defaultDockerImage;
    const startup = dto.startup || egg.startup;

    const createdServer = await this.prisma.$transaction(async (tx) => {
      const s = await tx.server.create({
        data: {
          uuid,
          uuidShort,
          name: dto.name.trim(),
          description: dto.description?.trim() || '',
          status: 'installing',
          userId: dto.ownerId,
          nodeId: dto.nodeId,
          allocationId: dto.allocationId,
          eggId: dto.eggId,
          nestId: dto.nestId,
          dockerImage,
          startup,
          memory: dto.memory,
          swap: dto.swap ?? 0,
          disk: dto.disk,
          io: dto.io ?? 500,
          cpu: dto.cpu,
          threads: dto.threads || null,
          databaseLimit: dto.databases ?? 0,
          allocationLimit: dto.allocationsLimit ?? 0,
          backupLimit: dto.backups ?? 0,
        },
      });

      // Assign primary and additional allocations
      const allAllocationIds = [dto.allocationId, ...(dto.additionalAllocationIds || [])];
      await tx.allocation.updateMany({
        where: { id: { in: allAllocationIds } },
        data: { serverId: s.id },
      });

      // Setup server variables
      for (const eggVar of egg.variables) {
        const val = dto.environment?.[eggVar.envVariable] ?? eggVar.defaultValue;
        await tx.serverVariable.create({
          data: {
            serverId: s.id,
            variableId: eggVar.id,
            variableValue: String(val),
          },
        });
      }

      return s;
    });

    // Provision on Wings using Wings installer payload { uuid, start_on_completion }
    try {
      const client = this.getWingsClient(node);
      await client.createServer({
        uuid: createdServer.uuid,
        start_on_completion: false,
      });
      this.logger.log(`Server ${createdServer.uuid} successfully provisioned to Wings node ${node.name}`);
    } catch (err: any) {
      this.logger.error(`Failed to push server ${createdServer.uuid} to Wings: ${err.message}`);
      // Clean up database completely so rejected server is not saved or left dangling in panel
      try {
        await this.prisma.$transaction([
          this.prisma.allocation.updateMany({
            where: { serverId: createdServer.id },
            data: { serverId: null },
          }),
          this.prisma.serverVariable.deleteMany({
            where: { serverId: createdServer.id },
          }),
          this.prisma.server.delete({
            where: { id: createdServer.id },
          }),
        ]);
        this.logger.log(`Rolled back server ${createdServer.uuid} from database after Wings rejection`);
      } catch (cleanupErr: any) {
        this.logger.error(`Failed to clean up rejected server ${createdServer.uuid}: ${cleanupErr.message}`);
      }

      throw new BadRequestException(
        `Wings daemon rejected server creation: ${err.message}. Server was not created.`,
      );
    }

    return this.getServerByUuid(createdServer.uuid);
  }

  // ─── Lifecycle & Power ─────────────────────────────────────────────

  async sendPowerAction(uuid: string, action: 'start' | 'stop' | 'restart' | 'kill') {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    await client.sendPowerAction(server.uuid, action);
    return { success: true, action };
  }

  async sendConsoleCommand(uuid: string, command: string) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    await client.sendCommands(server.uuid, [command]);
    return { success: true };
  }

  async updateServerVariables(uuid: string, variables: Record<string, string>) {
    const server = await this.getServerByUuid(uuid);

    for (const [key, value] of Object.entries(variables)) {
      const eggVar = server.egg.variables.find((v) => v.envVariable === key);
      if (!eggVar) continue;

      const existing = server.variables.find((v) => v.variableId === eggVar.id);
      if (existing) {
        await this.prisma.serverVariable.update({
          where: { id: existing.id },
          data: { variableValue: String(value) },
        });
      } else {
        await this.prisma.serverVariable.create({
          data: {
            serverId: server.id,
            variableId: eggVar.id,
            variableValue: String(value),
          },
        });
      }
    }

    // Tell Wings to sync the updated configuration
    try {
      const client = this.getWingsClient(server.node);
      await client.syncServer(server.uuid);
      this.logger.log(`Server ${server.uuid} configuration synced to Wings after variable update`);
    } catch (err: any) {
      this.logger.warn(`Could not sync updated variables to Wings: ${err.message}`);
    }

    return this.getServerByUuid(uuid);
  }

  async reinstallServer(uuid: string) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);

    try {
      await client.reinstallServer(server.uuid);
    } catch (err: any) {
      // If server does not exist on Wings daemon (HTTP 404), provision it from scratch
      if (err.statusCode === 404 || err.message?.includes('404')) {
        this.logger.warn(
          `Server ${server.uuid} does not exist on Wings node ${server.node.name} (404). Re-provisioning server via createServer...`,
        );
        await client.createServer({
          uuid: server.uuid,
          start_on_completion: false,
        });
      } else {
        throw err;
      }
    }

    await this.prisma.server.update({
      where: { id: server.id },
      data: { status: 'installing' },
    });
    return { success: true, message: 'Server reinstallation triggered' };
  }

  async deleteServer(uuid: string) {
    const server = await this.getServerByUuid(uuid);

    try {
      const client = this.getWingsClient(server.node);
      await client.deleteServer(server.uuid);
    } catch (err: any) {
      this.logger.warn(`Wings server deletion error (proceeding with DB cleanup): ${err.message}`);
    }

    await this.prisma.$transaction([
      this.prisma.allocation.updateMany({
        where: { serverId: server.id },
        data: { serverId: null },
      }),
      this.prisma.serverVariable.deleteMany({ where: { serverId: server.id } }),
      this.prisma.subuser.deleteMany({ where: { serverId: server.id } }),
      this.prisma.backup.deleteMany({ where: { serverId: server.id } }),
      this.prisma.server.delete({ where: { id: server.id } }),
    ]);

    return { success: true, message: `Server ${server.name} deleted` };
  }

  // ─── WebSocket Token for Real-Time Console ─────────────────────────

  async getWebSocketCredentials(uuid: string, user: { id: number; uuid: string; isAdmin: boolean }) {
    const server = await this.getServerByUuid(uuid);

    let permissions = ['*'];
    if (!user.isAdmin && server.userId !== user.id) {
      const sub = server.subusers.find((s) => s.userId === user.id);
      permissions = sub ? sub.permissions : [];
    }

    const { token, socket } = await this.authService.generateWebSocketToken(
      server.uuid,
      server.node.id,
      user.id,
      user.uuid,
      permissions,
    );

    return {
      data: {
        token,
        socket,
      },
    };
  }

  // ─── Files ─────────────────────────────────────────────────────────

  async listFiles(uuid: string, directory: string = '/') {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    return client.listFiles(server.uuid, directory);
  }

  async getFileContents(uuid: string, filePath: string) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    return client.getFileContents(server.uuid, filePath);
  }

  async writeFile(uuid: string, filePath: string, content: string) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    await client.writeFile(server.uuid, filePath, content);
    return { success: true };
  }

  async renameFiles(uuid: string, root: string, files: Array<{ from: string; to: string }>) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    await client.renameFiles(server.uuid, root, files);
    return { success: true };
  }

  async deleteFiles(uuid: string, root: string, files: string[]) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    await client.deleteFiles(server.uuid, root, files);
    return { success: true };
  }

  async compressFiles(uuid: string, root: string, files: string[]) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    return client.compressFiles(server.uuid, root, files);
  }

  async decompressFile(uuid: string, root: string, file: string) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    await client.decompressFile(server.uuid, root, file);
    return { success: true };
  }

  async chmodFiles(uuid: string, root: string, files: Array<{ file: string; mode: string }>) {
    const server = await this.getServerByUuid(uuid);
    const client = this.getWingsClient(server.node);
    await client.chmodFiles(server.uuid, root, files);
    return { success: true };
  }

  // ─── Backups ───────────────────────────────────────────────────────

  async listBackups(uuid: string) {
    const server = await this.getServerByUuid(uuid);
    return this.prisma.backup.findMany({
      where: { serverId: server.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createBackup(uuid: string, name?: string, ignored?: string) {
    const server = await this.getServerByUuid(uuid);

    if (server.backupLimit > 0) {
      const count = await this.prisma.backup.count({ where: { serverId: server.id } });
      if (count >= server.backupLimit) {
        throw new BadRequestException(`Backup limit reached (${server.backupLimit})`);
      }
    }

    const backupUuid = crypto.randomUUID();
    const backup = await this.prisma.backup.create({
      data: {
        uuid: backupUuid,
        serverId: server.id,
        name: name?.trim() || `Backup at ${new Date().toISOString()}`,
        ignoredFiles: ignored ? ignored.split('\n').map((s) => s.trim()) : [],
        disk: 'wings',
        checksum: null,
        bytes: 0,
        isSuccessful: false,
      },
    });

    const client = this.getWingsClient(server.node);
    await client.createBackup(server.uuid, backupUuid, 'wings', ignored);

    return backup;
  }

  async deleteBackup(uuid: string, backupUuid: string) {
    const server = await this.getServerByUuid(uuid);
    const backup = await this.prisma.backup.findFirst({
      where: { uuid: backupUuid, serverId: server.id },
    });

    if (!backup) throw new NotFoundException('Backup not found');

    const client = this.getWingsClient(server.node);
    try {
      await client.deleteBackup(server.uuid, backupUuid);
    } catch (err: any) {
      this.logger.warn(`Failed to delete backup on Wings: ${err.message}`);
    }

    await this.prisma.backup.delete({ where: { id: backup.id } });
    return { success: true, message: 'Backup deleted' };
  }

  async restoreBackup(uuid: string, backupUuid: string, truncateDirectory: boolean = false) {
    const server = await this.getServerByUuid(uuid);
    const backup = await this.prisma.backup.findFirst({
      where: { uuid: backupUuid, serverId: server.id },
    });

    if (!backup) throw new NotFoundException('Backup not found');

    const client = this.getWingsClient(server.node);
    await client.restoreBackup(server.uuid, backupUuid, {
      adapter: (backup.disk as any) || 'wings',
      truncate_directory: truncateDirectory,
    });

    return { success: true, message: 'Backup restore initiated' };
  }

  // ─── Subusers ──────────────────────────────────────────────────────

  async listSubusers(uuid: string) {
    const server = await this.getServerByUuid(uuid);
    return this.prisma.subuser.findMany({
      where: { serverId: server.id },
      include: {
        user: {
          select: { id: true, uuid: true, username: true, email: true },
        },
      },
    });
  }

  async addSubuser(uuid: string, email: string, permissions: string[]) {
    const server = await this.getServerByUuid(uuid);
    const targetUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!targetUser) {
      throw new NotFoundException(`No user found with email '${email}'`);
    }

    if (targetUser.id === server.userId) {
      throw new BadRequestException('Cannot add the server owner as a subuser');
    }

    const existing = await this.prisma.subuser.findUnique({
      where: {
        userId_serverId: {
          userId: targetUser.id,
          serverId: server.id,
        },
      },
    });

    if (existing) {
      throw new ConflictException('User is already a subuser for this server');
    }

    return this.prisma.subuser.create({
      data: {
        serverId: server.id,
        userId: targetUser.id,
        permissions,
      },
      include: {
        user: { select: { id: true, uuid: true, username: true, email: true } },
      },
    });
  }

  async updateSubuser(uuid: string, subuserId: number, permissions: string[]) {
    const server = await this.getServerByUuid(uuid);
    const subuser = await this.prisma.subuser.findFirst({
      where: { id: subuserId, serverId: server.id },
    });

    if (!subuser) throw new NotFoundException('Subuser not found');

    return this.prisma.subuser.update({
      where: { id: subuserId },
      data: { permissions },
      include: {
        user: { select: { id: true, uuid: true, username: true, email: true } },
      },
    });
  }

  async deleteSubuser(uuid: string, subuserId: number) {
    const server = await this.getServerByUuid(uuid);
    const subuser = await this.prisma.subuser.findFirst({
      where: { id: subuserId, serverId: server.id },
    });

    if (!subuser) throw new NotFoundException('Subuser not found');

    await this.prisma.subuser.delete({ where: { id: subuserId } });
    return { success: true, message: 'Subuser removed' };
  }
}
