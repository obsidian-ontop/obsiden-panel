import { Module } from '@nestjs/common';
import { ClientServersController } from './client-servers.controller';
import { AdminServersController } from './admin-servers.controller';
import { ServersService } from './servers.service';
import { VersionsService } from './versions.service';
import { AuthModule } from '../auth/auth.module';
import { WingsRemoteModule } from '../wings-remote/wings-remote.module';

@Module({
  imports: [AuthModule, WingsRemoteModule],
  controllers: [ClientServersController, AdminServersController],
  providers: [ServersService, VersionsService],
  exports: [ServersService, VersionsService],
})
export class ServersModule {}
