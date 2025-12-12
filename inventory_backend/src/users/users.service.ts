import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    try {
      // 1. Hash Password
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

      // 2. Simpan ke Database
      return await this.prisma.user.create({
        data: {
          ...createUserDto,
          password: hashedPassword,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Username sudah digunakan, silakan pilih yang lain.',
          );
        }
      }
      throw new InternalServerErrorException('Terjadi kesalahan pada server');
    }
  }

  // 2. READ ALL
  async findAll() {
    return this.prisma.user.findMany();
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  // 3. READ ONE
  async findOne(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  // 4. UPDATE
  async update(id: number, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  // 5. DELETE
  async remove(id: number) {
    return this.prisma.user.delete({
      where: { id },
    });
  }
}
