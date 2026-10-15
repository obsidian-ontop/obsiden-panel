import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { NodesService } from './nodes.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Nodes')
@ApiCookieAuth()
@UseGuards(SessionGuard, AdminGuard)
@Controller('api/admin/nodes')
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  @Get()
  @ApiOperation({ summary: 'List all nodes with usage metrics' })
  async listNodes() {
    return this.nodesService.listNodes();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get node details including allocations and servers' })
  async getNode(@Param('id', ParseIntPipe) id: number) {
    return this.nodesService.getNodeById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Register a new Wings node' })
  async createNode(
    @Body()
    dto: {
      name: string;
      description?: string;
      locationId: number;
      fqdn: string;
      scheme?: string;
      behindProxy?: boolean;
      isPublic?: boolean;
      daemonListen?: number;
      daemonSftp?: number;
      daemonBase?: string;
      memory: number;
      memoryOverallocate?: number;
      disk: number;
      diskOverallocate?: number;
      uploadSize?: number;
    },
  ) {
    return this.nodesService.createNode(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update node configuration' })
  async updateNode(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    dto: {
      name?: string;
      description?: string;
      locationId?: number;
      fqdn?: string;
      scheme?: string;
      behindProxy?: boolean;
      isPublic?: boolean;
      daemonListen?: number;
      daemonSftp?: number;
      daemonBase?: string;
      memory?: number;
      memoryOverallocate?: number;
      disk?: number;
      diskOverallocate?: number;
      uploadSize?: number;
      resetToken?: boolean;
    },
  ) {
    return this.nodesService.updateNode(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a node' })
  async deleteNode(@Param('id', ParseIntPipe) id: number) {
    return this.nodesService.deleteNode(id);
  }

  @Get(':id/configuration')
  @ApiOperation({ summary: 'Generate upstream Wings config.yml for this node' })
  async getConfiguration(@Param('id', ParseIntPipe) id: number) {
    const yaml = await this.nodesService.getNodeConfigurationYaml(id);
    return {
      yaml,
    };
  }

  @Post(':id/test-connection')
  @ApiOperation({ summary: 'Test authenticated HTTP connection to Wings daemon' })
  async testConnection(@Param('id', ParseIntPipe) id: number) {
    return this.nodesService.testNodeConnection(id);
  }
}
