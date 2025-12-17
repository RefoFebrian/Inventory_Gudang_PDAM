import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Role, TransactionStatus, TransactionType } from '@prisma/client';
import { GetTransactionsFilterDto } from './dto/get-transactions-filter.dto';

@Injectable()
export class ItemsService {
  constructor(private prisma: PrismaService) {}

  //  CRUD BARANG
  async create(createItemDto: CreateItemDto, userId: number) {
    try {
      return await this.prisma.item.create({
        data: {
          ...createItemDto,
          userId,         
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        const target = error.meta?.target;
        if (target && (target as string[]).includes('itemCode')) {
             throw new BadRequestException(`Barang dengan kode ${createItemDto.itemCode} sudah terdaftar!`);
        }
        throw new BadRequestException('Data unik duplikat ditemukan');
      }
      throw error;
    }
  }

  async findAll(search?: string) {
    const searchFilter: any = {};
    
    if (search) {
      searchFilter.OR = [
        { name: { contains: search } }, 
        { itemCode: { contains: search } },
      ];
    }

    return this.prisma.item.findMany({
      where: {
        deletedAt: null,
        ...searchFilter,
      },
      select: {
        id: true,          
        itemCode: true,    
        name: true,        
        quantity: true,   
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async findOne(id: number) {
    const item = await this.prisma.item.findFirst({
      where: {
        id: id,
        deletedAt: null, 
      },
      select: {
        id: true,
        itemCode: true,
        name: true,
        description: true, 
        quantity: true,
        createdAt: true,   
        updatedAt: true,   
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });
    if (!item) {
      throw new NotFoundException(`Barang dengan ID ${id} tidak ditemukan`);
    }
    return item;
  }

  async update(id: number, updateItemDto: UpdateItemDto) {
    return this.prisma.item.update({
      where: { id },
      data: updateItemDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id); 

    const transactionCount = await this.prisma.stockTransaction.count({
      where: { itemId: id },
    });

    if (transactionCount > 0) {
      // Soft delete
      // Hanya update deletedAt, data tidak hilang tapi tersembunyi
      await this.prisma.item.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      });
      
      return { 
        message: 'Barang berhasil diarsipkan karena memiliki riwayat transaksi.' 
      };

    } else {
      // Hard delete barang yang tidak memiliki riwayat transaksi barang
      await this.prisma.item.delete({
        where: { id },
      });

      return { 
        message: 'Barang berhasil dihapus' 
      };
    }
  }

  // HELPER NOMOR SURAT OTOMATIS

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

  // STOCK MANAGEMENT 

  // Tambah Stok (Barang Masuk)
  async addStock(
    id: number,
    quantity: number,
    userId: number,
    notes?: string,
    externalParty?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Pastikan barang ada dan aktif
      const item = await tx.item.findFirst({ where: { id, deletedAt: null } });
      if (!item) throw new NotFoundException('Barang tidak ditemukan');

      // Generate No Surat
      const docNo = await this.generateDocumentNo('IN');

      // Update jumlah barang di tabel Item
      const updatedItem = await tx.item.update({
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
          status: TransactionStatus.APPROVED,
          notes: notes,
          documentNo: docNo,
          externalParty: externalParty,
        },
      });
      return { item: updatedItem, transaction };
    });
  }

  // Kurangi Stok (Barang Keluar)
  async reduceStock(
    id: number,
    quantity: number,
    userId: number,
    userRole: Role,
    notes: string,
    externalParty: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Cek barang ada dan aktif?
      const currentItem = await tx.item.findFirst({ where: { id, deletedAt: null } });
      if (!currentItem) throw new NotFoundException('Barang tidak ditemukan');

      // Tentukan Status & Aksi berdasarkan Role
      let status: TransactionStatus = TransactionStatus.APPROVED;

      if (userRole === Role.USER) {
        status = TransactionStatus.PENDING;
      } else {
        // Kalau Admin, Cek stok cukup gak? Lalu kurangi.
        if (currentItem.quantity < quantity) {
          throw new BadRequestException(`Stok tidak cukup! Sisa stok: ${currentItem.quantity}`);
        }
        await tx.item.update({
          where: { id },
          data: { quantity: { decrement: quantity } },
        });
      }

      // Generate No Surat
      const docNo = await this.generateDocumentNo('OUT');

      // Simpan Transaksi
      const transaction = await tx.stockTransaction.create({
        data: {
          itemId: id,
          userId: userId,
          quantity: quantity,
          type: TransactionType.OUT,
          status: status,
          notes: notes,
          documentNo: docNo,
          externalParty: externalParty,
        },
      });

      return {
        message: userRole === Role.USER
            ? 'Permintaan barang berhasil dibuat, menunggu persetujuan Admin.'
            : 'Stok berhasil dikurangi.',
        transaction,
      };
    });
  }

  // REPORTING & PDF HELPERS

  // Ambil Semua Transaksi dengan Filter
  async findAllTransactions(filterDto: GetTransactionsFilterDto) {
    const { startDate, endDate, type, status } = filterDto;

    // Objek Filter Prisma
    const whereClause: any = {};

    // 1. Filter Tanggal (Range)
    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate),
        lte: new Date(new Date(endDate).setHours(23, 59, 59)),
      };
    } else if (startDate) {
      // Jika hanya hari ini kirim startDate
      whereClause.createdAt = {
        gte: new Date(new Date(startDate).setHours(0, 0, 0)),
        lte: new Date(new Date(startDate).setHours(23, 59, 59)),
      };
    }

    // Filter Tipe & Status
    if (type) whereClause.type = type;
    if (status) whereClause.status = status;

    // Eksekusi Query
    return await this.prisma.stockTransaction.findMany({
      where: whereClause,
      include: {
        item: true,
        user: {
          select: { id: true, username: true, name: true },
        },
        approver: { 
          select: { id: true, username: true, name: true }, 
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Helper untuk mengambil satu data transaksi buat PDF & Detail Transaksi
  async findTransactionById(id: number) {
    const transaction = await this.prisma.stockTransaction.findUnique({
      where: { id },
      include: {
        item: true,
        user: { select: { id: true, name: true, username: true } },
        approver: { select: { id: true, name: true } },
      },
    });

    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');
    return transaction;
  }

  // APPROVAL TRANSAKSI 
  async updateTransactionStatus(
    transactionId: number,
    status: 'APPROVED' | 'REJECTED',
    adminId: number, 
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Ambil data transaksi target
      const transaction = await tx.stockTransaction.findUnique({
        where: { id: transactionId },
        include: { item: true },
      });

      if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');

      //  Cek hanya transaksi PENDING
      if (transaction.status !== 'PENDING') {
        throw new BadRequestException(
          `Tidak bisa mengubah transaksi yang statusnya sudah ${transaction.status}`,
        );
      }

      if (status === 'REJECTED') {
        return await tx.stockTransaction.update({
          where: { id: transactionId },
          data: {
            status: 'REJECTED',
            approvedById: adminId,
          },
        });
      } else {
        if (transaction.item.quantity < transaction.quantity) {
          throw new BadRequestException(
            `Gagal Approve. Stok barang sisa ${transaction.item.quantity}, tapi permintaan ${transaction.quantity}`,
          );
        }

        await tx.item.update({
          where: { id: transaction.itemId },
          data: { quantity: { decrement: transaction.quantity } },
        });

        return await tx.stockTransaction.update({
          where: { id: transactionId },
          data: { 
            status: 'APPROVED',
            approvedById: adminId
          },
        });
      }
    });
  }
}
