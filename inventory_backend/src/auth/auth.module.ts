import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module'; 
import { JwtModule } from '@nestjs/jwt';
import { JwtChecking } from './jwt.checking';

@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      global: true, // Agar JWT service bisa dipakai di mana saja
      secret: process.env.JWT_SECRET, 
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtChecking],
})
export class AuthModule {}
