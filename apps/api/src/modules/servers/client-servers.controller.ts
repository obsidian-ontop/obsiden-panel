import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { ServersService } from './servers.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { ServerAccessGuard, RequirePermissions } from './guards/server-access.guard';
import { PERMISSIONS } from '@obsidian/permissions';

@ApiTags('Client Servers')
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('api/client/servers')
export class ClientServersController {
  constructor(private readonly serversService: ServersService) {}

  @Get()
  @ApiOperation({ summary: 'List servers accessible to current user' })
  async listServers(@Req() req: any) {
    return this.serversService.listClientServers(req.user.id, req.user.isAdmin);
  }

  @Get(':uuid')
  @UseGuards(ServerAccessGuard)
  @ApiOperation({ summary: 'Get details for a specific server' })
  async getServer(@Param('uuid') uuid: string) {
    return this.serversService.getServerByUuid(uuid);
  }

  @Get(':uuid/ws')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(PERMISSIONS.CONTROL_CONSOLE)
  @ApiOperation({ summary: 'Get WebSocket credentials for live console and metrics' })
  async getWebSocketCredentials(@Param('uuid') uuid: string, @Req() req: any) {
    return this.serversService.getWebSocketCredentials(uuid, req.user);
  }

  @Post(':uuid/power')
  @UseGuards(ServerAccessGuard)
  @ApiOperation({ summary: 'Send power action (start, stop, restart, kill)' })
  async sendPowerAction(
    @Param('uuid') uuid: string,
    @Body() body: { action: 'start' | 'stop' | 'restart' | 'kill' },
  ) {
    return this.serversService.sendPowerAction(uuid, body.action);
  }

  @Post(':uuid/command')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(PERMISSIONS.CONTROL_CONSOLE)
  @ApiOperation({ summary: 'Send command to game console' })
  async sendCommand(
    @Param('uuid') uuid: string,
    @Body() body: { command: string },
  ) {
    return this.serversService.sendConsoleCommand(uuid, body.command);
  }

  // ─── Files ─────────────────────────────────────────────────────────

  @Get(':uuid/files/list')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(PERMISSIONS.FILE_READ)
  @ApiOperation({ summary: 'List files in directory' })
  async listFiles(
    @Param('uuid') uuid: string,
    @Query('directory') directory?: string,
  ) {
    return this.serversService.listFiles(uuid, directory || '/');
  }

  @Get(':uuid/files/contents')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(PERMISSIONS.FILE_READ)
  @ApiOperation({ summary: 'Get file content' })
  async getFileContents(
    @Param('uuid') uuid: string,
    @Query('file') file: string,
  ) {
    return this.serversService.getFileContents(uuid, file);
  }

  @Post(':uuid/files/write')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(PERMISSIONS.FILE_UPDATE)
  @ApiOperation({ summary: 'Write file content' })
  async writeFile(
    @Param('uuid') uuid: string,
    @Query('file') file: string,
    @Body() body: { content: string },
  ) {
    return this.serversService.writeFile(uuid, file, body.content);
  }

  @Post(':uuid/files/rename')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(PERMISSIONS.FILE_UPDATE)
  @ApiOperation({ summary: 'Rename or move files' })
  async renameFiles(
    @Param('uuid') uuid: string,
    @Body() body: { root: string; files: Array<{ from: string; to: string }> },
  ) {
    return this.serversService.renameFiles(uuid, body.root, body.files);
  }

  @Post(':uuid/files/delete')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(PERMISSIONS.FILE_DELETE)
  @ApiOperation({ summary: 'Delete files or folders' })
  async deleteFiles(
    @Param('uuid') uuid: string,
    @Body() body: { root: string; files: string[] },
  ) {
    return this.serversService.deleteFiles(uuid, body.root, body.files);
  }

  // ─── Backups ───────────────────────────────────────────────────────

  @Get(':uuid/backups')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(PERMISSIONS.BACKUP_READ)
  @ApiOperation({ summary: 'List server backups' })
  async listBackups(@Param('uuid') uuid: string) {
    return this.serversService.listBackups(uuid);
  }

  @Post(':uuid/backups')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(PERMISSIONS.BACKUP_CREATE)
  @ApiOperation({ summary: 'Create a backup' })
  async createBackup(
    @Param('uuid') uuid: string,
    @Body() body: { name?: string; ignored?: string },
  ) {
    return this.serversService.createBackup(uuid, body.name, body.ignored);
  }

  @Delete(':uuid/backups/:backupUuid')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(PERMISSIONS.BACKUP_DELETE)
  @ApiOperation({ summary: 'Delete backup' })
  async deleteBackup(
    @Param('uuid') uuid: string,
    @Param('backupUuid') backupUuid: string,
  ) {
    return this.serversService.deleteBackup(uuid, backupUuid);
  }

  @Post(':uuid/backups/:backupUuid/restore')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(PERMISSIONS.BACKUP_RESTORE)
  @ApiOperation({ summary: 'Restore server from backup' })
  async restoreBackup(
    @Param('uuid') uuid: string,
    @Param('backupUuid') backupUuid: string,
    @Body() body: { truncateDirectory?: boolean },
  ) {
    return this.serversService.restoreBackup(uuid, backupUuid, body.truncateDirectory);
  }

  // ─── Subusers ──────────────────────────────────────────────────────

  @Get(':uuid/subusers')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'List server subusers' })
  async listSubusers(@Param('uuid') uuid: string) {
    return this.serversService.listSubusers(uuid);
  }

  @Post(':uuid/subusers')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(PERMISSIONS.USER_CREATE)
  @ApiOperation({ summary: 'Add a subuser' })
  async addSubuser(
    @Param('uuid') uuid: string,
    @Body() body: { email: string; permissions: string[] },
  ) {
    return this.serversService.addSubuser(uuid, body.email, body.permissions);
  }

  @Patch(':uuid/subusers/:subuserId')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(PERMISSIONS.USER_UPDATE)
  @ApiOperation({ summary: 'Update subuser permissions' })
  async updateSubuser(
    @Param('uuid') uuid: string,
    @Param('subuserId', ParseIntPipe) subuserId: number,
    @Body() body: { permissions: string[] },
  ) {
    return this.serversService.updateSubuser(uuid, subuserId, body.permissions);
  }

  @Delete(':uuid/subusers/:subuserId')
  @UseGuards(ServerAccessGuard)
  @RequirePermissions(PERMISSIONS.USER_DELETE)
  @ApiOperation({ summary: 'Remove a subuser' })
  async deleteSubuser(
    @Param('uuid') uuid: string,
    @Param('subuserId', ParseIntPipe) subuserId: number,
  ) {
    return this.serversService.deleteSubuser(uuid, subuserId);
  }
}
