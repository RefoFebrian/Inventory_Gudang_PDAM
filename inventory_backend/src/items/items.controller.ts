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
  Query,
  Res,
} from '@nestjs/common';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { AuthGuard } from '@nestjs/passport';
import { StockUpdateDto } from './dto/stock-update.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { GetTransactionsFilterDto } from './dto/get-transactions-filter.dto';
import { PdfService } from 'src/common/service/pdf.service';
import type { Response } from 'express';
import { UpdateTransactionStatusDto } from './dto/update-transaction.dto';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('items')
export class ItemsController {
  constructor(
    private readonly itemsService: ItemsService,
    private readonly pdfService: PdfService,
  ) {}

  // REPORT & HISTORY
  @Get('history')
  @ResponseMessage('Berhasil mengambil data riwayat transaksi')
  getTransactions(@Query() filterDto: GetTransactionsFilterDto) {
    return this.itemsService.findAllTransactions(filterDto);
  }

  // Get Detail Transaksi
  @Get('transactions/:id')
  @ResponseMessage('Berhasil mengambil detail transaksi')
  async findOneTransaction(@Param('id') id: string) {
    return this.itemsService.findTransactionById(+id);
  }

  // Download PDF Bukti Transaksi/Surat Jalan
  @Get('transactions/:id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    // Ambil Data
    const transaction = await this.itemsService.findTransactionById(+id);

    // Generate PDF
    this.pdfService.generateTransactionPdf(transaction, res);
  }

  // Update Status Transaksi
  @Roles(Role.ADMIN)
  @Patch('transactions/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTransactionStatusDto,
    @Request() req,
  ) {
    return this.itemsService.updateTransactionStatus(
      +id,
      dto.status,
      req.user.userId,
    );
  }

  // STOCK MANAGEMENT

  // Barang Masuk Restock
  @Roles(Role.ADMIN)
  @Post(':id/in')
  async stockIn(
    @Param('id') id: string,
    @Body() dto: StockUpdateDto,
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

  // Barang Keluar (Request)
  @Post(':id/out')
  async stockOut(
    @Param('id') id: string,
    @Body() dto: StockUpdateDto,
    @Request() req,
  ) {
    try {
      return await this.itemsService.reduceStock(
        +id,
        dto.quantity,
        req.user.userId,
        req.user.role,
        dto.notes || '-',
        dto.externalParty,
      );
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // CRUD BARANG

  @Roles(Role.ADMIN)
  @Post('createItem')
  create(@Body() createItemDto: CreateItemDto, @Request() req) {
    return this.itemsService.create(createItemDto, req.user.userId);
  }

  @Get()
  @ResponseMessage('Berhasil Mendapat Data Barang')
  findAll(@Query('search') search?: string) {
    return this.itemsService.findAll(search);
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.itemsService.findOne(+id);
  }
}
