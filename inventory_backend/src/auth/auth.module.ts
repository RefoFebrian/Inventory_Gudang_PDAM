import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module'; // Import UsersModule
import { JwtModule } from '@nestjs/jwt';
import { JwtChecking } from './jwt.checking';

@Module({
  imports: [
    UsersModule, // Agar Auth bisa cek data User
    JwtModule.register({
      global: true, // Agar JWT service bisa dipakai di mana saja
      secret: process.env.JWT_SECRET, // Ambil dari .env
      signOptions: { expiresIn: '1d' }, // Token valid selama 1 hari
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtChecking],
})
export class AuthModule {}
