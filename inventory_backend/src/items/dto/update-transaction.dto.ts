import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateTransactionStatusDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';
}
