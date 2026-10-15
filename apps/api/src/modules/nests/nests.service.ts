import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NestsService {
  constructor(private readonly prisma: PrismaService) {}

  async listNests() {
    return this.prisma.nest.findMany({
      orderBy: { id: 'asc' },
      include: {
        _count: {
          select: {
            eggs: true,
            servers: true,
          },
        },
      },
    });
  }

  async getNestById(id: number) {
    const nest = await this.prisma.nest.findUnique({
      where: { id },
      include: {
        eggs: {
          include: {
            _count: {
              select: { servers: true, variables: true },
            },
          },
        },
        _count: {
          select: { servers: true },
        },
      },
    });

    if (!nest) {
      throw new NotFoundException(`Nest with ID ${id} not found`);
    }

    return nest;
  }

  async createNest(dto: { name: string; description?: string }) {
    return this.prisma.nest.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
      },
    });
  }

  async updateNest(id: number, dto: { name?: string; description?: string }) {
    await this.getNestById(id);

    return this.prisma.nest.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        description: dto.description !== undefined ? dto.description.trim() : undefined,
      },
    });
  }

  async deleteNest(id: number) {
    const nest = await this.getNestById(id);

    if (nest.eggs.length > 0) {
      throw new BadRequestException(
        `Cannot delete nest '${nest.name}'. It contains ${nest.eggs.length} egg(s). Delete or reassign eggs first.`,
      );
    }

    await this.prisma.nest.delete({ where: { id } });
    return { success: true, message: `Nest ${nest.name} deleted` };
  }
}
