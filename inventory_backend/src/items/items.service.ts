import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType } from '@prisma/client';

@Injectable()
export class ItemsService {
  constructor(private prisma: PrismaService) {}

  async create(createItemDto: CreateItemDto, userId: number) {
    return this.prisma.item.create({
      data: {
        ...createItemDto,
        userId,
      },
    });
  }

  async findAll() {
    return this.prisma.item.findMany({
      include: { user: true },
    });
  }

  async findOne(id: number) {
    return this.prisma.item.findUnique({
      where: { id },
    });
  }

  async update(id: number, updateItemDto: UpdateItemDto) {
    return this.prisma.item.update({
      where: { id },
      data: updateItemDto,
    });
  }

  async remove(id: number) {
    return this.prisma.item.delete({
      where: { id },
    });
  }

  // ==========================================================
  // LOGIC TRANSAKSI & NOMOR SURAT (YANG ERROR TADI)
  // ==========================================================

  // 1. Helper Private: Membuat Nomor Surat Otomatis
  // Format: TYPE/YYYYMMDD/XXX (Contoh: IN/20231210/001)
  private async generateDocumentNo(type: 'IN' | 'OUT'): Promise<string> {
    const now = new Date();
    // Ambil tanggal format YYYYMMDD
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

    // Hitung berapa transaksi tipe ini HARI INI
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));

    const count = await this.prisma.stockTransaction.count({
      where: {
        type: type === 'IN' ? TransactionType.IN : TransactionType.OUT,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Urutan = jumlah + 1. Dipadding 3 digit (001)
    const sequence = (count + 1).toString().padStart(3, '0');

    return `${type}/${dateStr}/${sequence}`;
  }

  //  Tambah Stok (Barang Masuk)
  async addStock(
    id: number,
    quantity: number,
    userId: number,
    notes?: string,
    externalParty?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Generate No Surat 
      const docNo = await this.generateDocumentNo('IN');

      // Update jumlah barang di tabel Item
      const item = await tx.item.update({
        where: { id },
        data: { quantity: { increment: quantity } },
      });

      // Catat di Buku Log (StockTransaction)
      const transaction = await tx.stockTransaction.create({
        data: {
          itemId: id,
          userId: userId,
          quantity: quantity,
          type: TransactionType.IN,
          notes: notes,
          documentNo: docNo,
          externalParty: externalParty, 
        },
      });

      return { item, transaction };
    });
  }

  // Kurangi Stok (Barang Keluar)
  async reduceStock(
    id: number,
    quantity: number,
    userId: number,
    notes?: string,
    externalParty?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Cek stok 
      const currentItem = await tx.item.findUnique({ where: { id } });
      if (!currentItem || currentItem.quantity < quantity) {
        throw new BadRequestException('Stok barang tidak mencukupi!');
      }

      // Generate No Surat
      const docNo = await this.generateDocumentNo('OUT');

      // Kurangi jumlah barang
      const item = await tx.item.update({
        where: { id },
        data: { quantity: { decrement: quantity } },
      });

      // Catat di Buku Log
      const transaction = await tx.stockTransaction.create({
        data: {
          itemId: id,
          userId: userId,
          quantity: quantity,
          type: TransactionType.OUT,
          notes: notes,
          documentNo: docNo,
          externalParty: externalParty,
        },
      });

      return { item, transaction };
    });
  }
}
