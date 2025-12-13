import { Module } from '@nestjs/common';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';
import { PdfService } from 'src/common/service/pdf.service';

@Module({
  controllers: [ItemsController],
  providers: [
    ItemsService,
    PdfService
  ],
})
export class ItemsModule {}
