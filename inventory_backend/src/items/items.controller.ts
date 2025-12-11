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

@UseGuards(AuthGuard('jwt'))
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  create(@Body() createItemDto: CreateItemDto, @Request() req) {
    const userId = req.user.userId;
    return this.itemsService.create(createItemDto, userId);
  }

  @Get()
  findAll() {
    return this.itemsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.itemsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateItemDto: UpdateItemDto) {
    return this.itemsService.update(+id, updateItemDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.itemsService.remove(+id);
  }

  // ENDPOINT: Barang Masuk
  @Post(':id/in')
  async stockIn(
    @Param('id') id: string,
    @Body() stockUpdateDto: StockUpdateDto,
    @Request() req,
  ) {
    return this.itemsService.addStock(
      +id,
      stockUpdateDto.quantity,
      req.user.userId,
      stockUpdateDto.notes,
      stockUpdateDto.externalParty, //  Kirim Nama Vendor
    );
  }

  // ENDPOINT: Barang Keluar
  @Post(':id/out')
  async stockOut(
    @Param('id') id: string,
    @Body() stockUpdateDto: StockUpdateDto,
    @Request() req,
  ) {
    try {
      return await this.itemsService.reduceStock(
        +id,
        stockUpdateDto.quantity,
        req.user.userId,
        stockUpdateDto.notes,
        stockUpdateDto.externalParty, // Kirim Nama Peminta
      );
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}
