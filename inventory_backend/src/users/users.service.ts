import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const saltRounds = 10;

    // 2. Hash password yang dikirim user
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      saltRounds,
    );

    // 3. Simpan ke database dengan password yang SUDAH di-hash
    // Kita ganti field password asli dengan hashed password
    return this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
      },
    });
  }

  // 2. READ ALL
  async findAll() {
    return this.prisma.user.findMany();
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
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
