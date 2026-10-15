import { Module } from '@nestjs/common';
import { ClientServersController } from './client-servers.controller';
import { AdminServersController } from './admin-servers.controller';
import { ServersService } from './servers.service';
import { AuthModule } from '../auth/auth.module';
import { WingsRemoteModule } from '../wings-remote/wings-remote.module';

@Module({
  imports: [AuthModule, WingsRemoteModule],
  controllers: [ClientServersController, AdminServersController],
  providers: [ServersService],
  exports: [ServersService],
})
export class ServersModule {}
