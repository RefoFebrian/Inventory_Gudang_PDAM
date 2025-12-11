import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { AuthGuard } from '@nestjs/passport';
import { StockUpdateDto } from './dto/stock-update.dto';
import { RolesGuard } from '../auth/roles.guard'; // Gunakan ../ agar path relative aman
import { Roles } from '../auth/roles.decorator'; // Gunakan ../ agar path relative aman
import { Role } from '@prisma/client';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() createItemDto: CreateItemDto, @Request() req) {
    return this.itemsService.create(createItemDto, req.user.userId);
  }

  @Get()
  findAll() {
    return this.itemsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.itemsService.findOne(+id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateItemDto: UpdateItemDto) {
    return this.itemsService.update(+id, updateItemDto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.itemsService.remove(+id);
  }

  // ENDPOINT: Barang Masuk (Restock) - ADMIN ONLY
  @Roles(Role.ADMIN)
  @Post(':id/in')
  async stockIn(
    @Param('id') id: string,
    @Body() dto: StockUpdateDto, // Namakan 'dto' agar ringkas
    @Request() req,
  ) {
    return this.itemsService.addStock(
      +id,
      dto.quantity,
      req.user.userId,
      dto.notes || '-',
      dto.externalParty,
    );
  }

  // ENDPOINT: Barang Keluar (Request) - USER & ADMIN
  @Post(':id/out')
  async stockOut(
    @Param('id') id: string,
    @Body() dto: StockUpdateDto, // <--- PERBAIKAN: Namakan 'dto' agar variabel 'dto.quantity' dikenali
    @Request() req,
  ) {
    try {
      // Tambahkan 'await' agar try-catch bisa menangkap error
      return await this.itemsService.reduceStock(
        +id,
        dto.quantity,
        req.user.userId,
        req.user.role, // Kirim Role User ke Service
        dto.notes || '-',
        dto.externalParty,
      );
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}
