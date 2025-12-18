import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Role, TransactionStatus, TransactionType } from '@prisma/client';
import { GetTransactionsFilterDto } from './dto/get-transactions-filter.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class ItemsService {
  constructor(private prisma: PrismaService) {}

  // CRUD MASTER BARANG
  
  async create(createItemDto: CreateItemDto, userId: number) {
    try {
      return await this.prisma.item.create({
        data: { ...createItemDto, userId },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException(`Barang dengan kode tersebut sudah terdaftar!`);
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
      where: { deletedAt: null, ...searchFilter },
      select: { id: true, itemCode: true, name: true, quantity: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: number) {
    const item = await this.prisma.item.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: { select: { id: true, name: true, username: true } },
      }
    });
    if (!item) throw new NotFoundException(`Barang ID ${id} tidak ditemukan`);
    return item;
  }

  async update(id: number, updateItemDto: UpdateItemDto) {
    return this.prisma.item.update({
      where: { id },
      data: updateItemDto,
    });
  }

  async remove(id: number) {
    // Cek di tabel detail transaksi
    const transactionCount = await this.prisma.transactionItem.count({
      where: { itemId: id },
    });

    if (transactionCount > 0) {
      await this.prisma.item.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return { message: 'Barang diarsipkan (Soft Delete) karena memiliki riwayat.' };
    } else {
      await this.prisma.item.delete({ where: { id } });
      return { message: 'Barang berhasil dihapus permanen.'};
    }
  }

  // BULK TRANSACTION LOGIC

  private async generateDocumentNo(type: TransactionType): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Hitung header transaksi hari ini
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));

    const count = await this.prisma.transaction.count({
      where: {
        type: type,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    const sequence = (count + 1).toString().padStart(3, '0');
    return `${type}/${dateStr}/${sequence}`;
  }

  // Buat Bulk Transaksi
  async createTransaction(userId: number, role: Role, dto: CreateTransactionDto) {
    return this.prisma.$transaction(async (tx) => {
      
      // Tentukan Status Transaksi Awal
      let initialStatus: TransactionStatus = TransactionStatus.PENDING;

      if (dto.type === TransactionType.IN) {
        // Barang Masuk selalu Completed
        initialStatus = TransactionStatus.COMPLETED; 
      } else if (dto.type === TransactionType.OUT) {
        // Jika Admin yang minta barang keluar otomatis APPROVED
        // Jika User Biasa otomatis PENDING
        initialStatus = role === Role.ADMIN ? TransactionStatus.APPROVED : TransactionStatus.PENDING;
      }

      // Generate Doc No & Code
      const docNo = await this.generateDocumentNo(dto.type);
      const uniqueCode = `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Buat Header Transaksi
      const transaction = await tx.transaction.create({
        data: {
          code: uniqueCode,
          documentNo: docNo,
          type: dto.type,
          status: initialStatus,
          userId: userId,
          notes: dto.notes,
          externalParty: dto.externalParty,
          // Jika admin langsung approve oleh dirinya sendiri
          approvedById: initialStatus === TransactionStatus.APPROVED ? userId : null,
        },
      });

      // 4. Loop Detail Items
      for (const itemDto of dto.items) {
        const item = await tx.item.findUnique({ where: { id: itemDto.itemId } });
        if (!item) throw new NotFoundException(`Barang ID ${itemDto.itemId} tidak ditemukan`);

        // Kondisi Barang Masuk (IN)
        if (dto.type === TransactionType.IN) {
          await tx.item.update({
            where: { id: itemDto.itemId },
            data: { quantity: { increment: itemDto.quantity } },
          });
        }

        // Kondisi Barang Keluar (OUT)
        if (dto.type === TransactionType.OUT) {
          // Cek dulu stok cukup gak
          if (item.quantity < itemDto.quantity) {
            throw new BadRequestException(`Stok ${item.name} tidak cukup! Sisa: ${item.quantity}, Diminta: ${itemDto.quantity}`);
          }

          // Jika Role Admin Langsung Kurangi Stok
          if (role === Role.ADMIN) {
            await tx.item.update({
              where: { id: itemDto.itemId },
              data: { quantity: { decrement: itemDto.quantity } },
            });
          }
          // Jika Role User Jangan kurangi stok dulu (tunggu approval admin)
        }

        // Simpan Detail
        await tx.transactionItem.create({
          data: {
            transactionId: transaction.id,
            itemId: itemDto.itemId,
            quantity: itemDto.quantity,
          },
        });
      }

      return transaction;
    });
  }

  // APPROVAL & STATUS UPDATE
  async updateTransactionStatus(
    transactionId: number,
    status: 'APPROVED' | 'REJECTED',
    adminId: number, 
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Ambil transaksi beserta detail items-nya
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
        include: { items: { include: { item: true } } },
      });

      if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');
      if (transaction.status !== TransactionStatus.PENDING) {
        throw new BadRequestException(`Transaksi sudah ${transaction.status}, tidak bisa diubah.`);
      }

      // Kondisi REJECT
      if (status === 'REJECTED') {
        return await tx.transaction.update({
          where: { id: transactionId },
          data: { status: TransactionStatus.REJECTED, approvedById: adminId },
        });
      }

      // Kondisi APPROVE
      // Kita harus mengurangi stok untuk SETIAP item di keranjang
      for (const detail of transaction.items) {
        // Cek stok lagi untuk memastikan stok tidak ada yang mines
        if (detail.item.quantity < detail.quantity) {
          throw new BadRequestException(`Gagal Approve. Stok ${detail.item.name} sisa ${detail.item.quantity}, diminta ${detail.quantity}`);
        }

        // Kurangi Stok
        await tx.item.update({
          where: { id: detail.itemId },
          data: { quantity: { decrement: detail.quantity } },
        });
      }

      // Update Header jadi APPROVED
      return await tx.transaction.update({
        where: { id: transactionId },
        data: { status: TransactionStatus.APPROVED, approvedById: adminId },
      });
    });
  }

  // 4. REPORTING (Menyesuaikan Schema Baru)
  async findAllTransactions(filterDto: GetTransactionsFilterDto) {
    const { startDate, endDate, type, status } = filterDto;
    const whereClause: any = {};

    // Filter Tanggal
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0,0,0,0);
      const end = endDate ? new Date(endDate) : new Date(startDate);
      end.setHours(23,59,59,999);
      
      whereClause.createdAt = { gte: start, lte: end };
    }

    if (type) whereClause.type = type;
    if (status) whereClause.status = status;

    return await this.prisma.transaction.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, username: true } },
        approver: { select: { id: true, name: true } },
        items: { 
          include: {
            item: { select: { id: true, itemCode: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findTransactionById(id: number) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, username: true } },
        approver: { select: { id: true, name: true } },
        items: {
          include: {
            item: true
          }
        }
      },
    });
    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan');
    return transaction;
  }
}