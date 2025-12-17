import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class StockUpdateDto {
  @IsInt()
  @Min(1, { message: 'Jumlah minimal 1' })
  quantity: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsNotEmpty({ message: 'Pihak eksternal (Vendor/Peminta) wajib diisi' })
  externalParty: string;
}
