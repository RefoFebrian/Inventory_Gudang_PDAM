import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';

@Injectable()
export class PdfService {
  generateTransactionPdf(transaction: any, res: Response) {
    // Setup PDF Stream
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const filename = `Surat_${transaction.documentNo.replace(/\//g, '-')}.pdf`;

    // Set Header Response agar browser download
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    doc.pipe(res);

    // Layout PDF
    // Kop Surat
    doc.fontSize(20).text('PDAM - SISTEM INVENTORI GUDANG', { align: 'center' });
    doc.fontSize(14).text('BERITA ACARA TRANSAKSI BARANG', { align: 'center' });
    doc.moveDown();
    doc.lineWidth(2).moveTo(50, 100).lineTo(550, 100).stroke();
    doc.moveDown();

    // Info Dokumen
    doc.fontSize(12);
    const date = transaction.createdAt.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    doc.text(`Nomor Dokumen : ${transaction.documentNo}`);
    doc.text(`Tanggal       : ${date}`);
    doc.text(
      `Tipe Transaksi: ${transaction.type === 'IN' ? 'BARANG MASUK' : 'BARANG KELUAR'}`,
    );
    doc.text(`Pihak Terkait : ${transaction.externalParty}`);
    doc.moveDown();

    // Rincian Barang
    const startY = doc.y;
    doc.rect(50, startY, 500, 100).stroke();

    doc.text(`Nama Barang   : ${transaction.item.name}`, 60, startY + 10);
    doc.text(`Jumlah        : ${transaction.quantity} Unit`, 60, startY + 30);
    doc.text(`Catatan       : ${transaction.notes || '-'}`, 60, startY + 50);
    doc.text(`Status        : ${transaction.status}`, 60, startY + 70);

    doc.moveDown(8);

    // Tanda Tangan
    const signY = doc.y;
    doc.text('Dibuat Oleh,', 50, signY);
    doc.moveDown(3);
    doc.text(
      `( ${transaction.user.name || transaction.user.username} )`,
      50,
      doc.y,
    );

    doc.text('Mengetahui / Penerima,', 350, signY);
    doc.moveDown(3);
    doc.text('( ................................. )', 350, doc.y);

    // Akhir Dokumen
    doc.end();
  }
}
