import { IsNotEmpty, IsString, IsOptional, IsInt, Min } from 'class-validator';

export class CreateItemDto {

  @IsString()
  @IsNotEmpty()
  itemCode: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0) // Stok tidak boleh negatif
  quantity: number;
}
