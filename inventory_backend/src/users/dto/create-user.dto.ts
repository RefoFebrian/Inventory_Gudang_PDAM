import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";


export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, {message: 'Password minimal 8 karakter'})
  password: string;

  @IsString()
  @IsOptional()
  name?: string;
}
