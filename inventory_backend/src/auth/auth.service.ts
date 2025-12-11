import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  // Fungsi untuk Login
  async signIn(username: string, pass: string) {
    // 1. Cari user berdasarkan email
    // (Kita perlu menambahkan method findByEmail di UsersService nanti, lihat Langkah 4.5)
    const user = await this.usersService.findByUsername(username);

    if (!user) {
      throw new UnauthorizedException('Username tidak ditemukan');
    }

    // 2. Cek apakah password cocok
    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Password salah');
    }

    // 3. Jika oke, buatkan payload (isi token)
    const payload = { sub: user.id, username: user.username, name: user.name, role:user.role };

    // 4. Return tokennya
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}
