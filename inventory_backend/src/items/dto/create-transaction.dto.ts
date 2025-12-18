import { IsEnum, IsInt, IsArray, ValidateNested, Min, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '@prisma/client';

// Validasi per Item (Anak)
export class TransactionItemDto {
  @IsInt()
  itemId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}

// Validasi Header (Induk)
export class CreateTransactionDto {
  @IsEnum(TransactionType)
  type: TransactionType;

  @IsOptional()
  @IsString()
  notes?: string;
  
  @IsOptional()
  @IsString()
  externalParty?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionItemDto)
  items: TransactionItemDto[];
}