import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { ServersService } from './servers.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Admin Servers')
@ApiCookieAuth()
@UseGuards(SessionGuard, AdminGuard)
@Controller('api/admin/servers')
export class AdminServersController {
  constructor(private readonly serversService: ServersService) {}

  @Post()
  @ApiOperation({ summary: 'Provision a new server onto a Wings node' })
  async createServer(
    @Body()
    dto: {
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
      startOnCompletion?: boolean;
    },
  ) {
    return this.serversService.createServer(dto);
  }

  @Post(':uuid/reinstall')
  @ApiOperation({ summary: 'Trigger server reinstallation' })
  async reinstallServer(@Param('uuid') uuid: string) {
    return this.serversService.reinstallServer(uuid);
  }

  @Delete(':uuid')
  @ApiOperation({ summary: 'Delete a server, its files, and container from Wings' })
  async deleteServer(@Param('uuid') uuid: string) {
    return this.serversService.deleteServer(uuid);
  }
}
