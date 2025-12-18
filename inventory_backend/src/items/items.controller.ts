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
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, TransactionType } from '@prisma/client';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { GetTransactionsFilterDto } from './dto/get-transactions-filter.dto';
import { PdfService } from 'src/common/service/pdf.service';
import type { Response } from 'express';
import { UpdateTransactionStatusDto } from './dto/update-transaction.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('items') 
export class ItemsController {
  constructor(
    private readonly itemsService: ItemsService,
    private readonly pdfService: PdfService,
  ) {}

  // TRANSAKSI (BULK) - IN & OUT
  @Post('transactions')
  @ResponseMessage('Transaksi berhasil dibuat')
  async createTransaction(@Body() dto: CreateTransactionDto, @Request() req) {
    if (dto.type === TransactionType.IN && req.user.role !== Role.ADMIN) {
    throw new HttpException(
      'Akses Ditolak: Hanya Admin yang boleh melakukan Restock (Barang Masuk)!', 
      HttpStatus.FORBIDDEN
    );
  }
    return this.itemsService.createTransaction(req.user.userId, req.user.role, dto);
  }

  // Approval Status
  @Roles(Role.ADMIN)
  @Patch('transactions/:id/status')
  @ResponseMessage('Status transaksi berhasil diperbarui')
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

  // HISTORY & REPORT
  @Get('history')
  @ResponseMessage('Berhasil mengambil data riwayat transaksi')
  getTransactions(@Query() filterDto: GetTransactionsFilterDto) {
    return this.itemsService.findAllTransactions(filterDto);
  }

  @Get('transactions/:id')
  @ResponseMessage('Berhasil mengambil detail transaksi')
  async findOneTransaction(@Param('id') id: string) {
    return this.itemsService.findTransactionById(+id);
  }

  @Get('transactions/:id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const transaction = await this.itemsService.findTransactionById(+id);
    this.pdfService.generateTransactionPdf(transaction, res);
  }

  // MASTER DATA BARANG (CRUD)

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
}