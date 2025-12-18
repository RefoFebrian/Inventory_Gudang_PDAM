import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';

@Injectable()
export class PdfService {
  generateTransactionPdf(transaction: any, res: Response) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const filename = `Surat_${transaction.documentNo.replace(/\//g, '-')}.pdf`;

    // 1. Setup Response Header
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    doc.pipe(res);

    // HEADER (KOP SURAT)
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('PDAM INVENTORY SYSTEM', 50, 50);
    
    doc
      .fontSize(10)
      .font('Helvetica')
      .text('Jl. Infrastruktur No. 1, Kota Coding', 50, 70)
      .text('Telp: 021-12345678 | Fax: 021-87654321', 50, 85);

    // Judul Dokumen
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(
        transaction.type === 'IN' ? 'BUKTI BARANG MASUK' : 'BUKTI PENGELUARAN BARANG', 
        250, 
        50, 
        { align: 'right' }
      );

    // Garis Pembatas Kop Surat
    doc
      .moveTo(50, 105)
      .lineTo(550, 105)
      .lineWidth(2)
      .stroke();

    // INFO DOKUMEN (Form Atas)
    const infoTopY = 120;
    doc.fontSize(10).font('Helvetica-Bold');

    // Kolom Kiri
    doc.text('No. Bukti', 50, infoTopY);
    doc.text(':', 130, infoTopY);
    doc.font('Helvetica').text(transaction.documentNo, 140, infoTopY);

    doc.font('Helvetica-Bold').text('Ditujukan Untuk', 50, infoTopY + 20);
    doc.text(':', 130, infoTopY + 20);
    doc.font('Helvetica').text(transaction.externalParty || '-', 140, infoTopY + 20);

    // Kolom Kanan
    const date = new Date(transaction.createdAt).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    doc.font('Helvetica-Bold').text('Tanggal', 350, infoTopY);
    doc.text(':', 430, infoTopY);
    doc.font('Helvetica').text(date, 440, infoTopY);

    doc.font('Helvetica-Bold').text('Catatan (Note)', 350, infoTopY + 20);
    doc.text(':', 430, infoTopY + 20);
    doc.font('Helvetica').text(transaction.notes || '-', 440, infoTopY + 20);

    // TABEL BARANG 
    const tableTop = 170;
    const itemNameX = 100;
    const qtyX = 350;
    const noteX = 420;

    doc.font('Helvetica-Bold');
    
    // Header Tabel
    doc.rect(50, tableTop, 500, 25).fill('#e0e0e0'); 
    doc.fillColor('black');
    doc.text('No.', 55, tableTop + 8);
    doc.text('Nama Barang', itemNameX, tableTop + 8);
    doc.text('Banyaknya', qtyX, tableTop + 8);
    doc.text('Keterangan', noteX, tableTop + 8);

    //  Isi Tabel
    let y = tableTop + 25;
    doc.font('Helvetica');

    // Loop data items array
    transaction.items.forEach((detail, i) => {
      // Baris
      doc.text(`${i + 1}`, 55, y + 8);
      // Nama Barang (detail.item.name)
      doc.text(detail.item.name, itemNameX, y + 8); 
      // Quantity
      doc.text(`${detail.quantity} Unit`, qtyX, y + 8);
      // Note per item jika ada atau kosong
      doc.text('-', noteX, y + 8);

      // Garis horizontal pemisah per baris
      doc
        .moveTo(50, y + 25)
        .lineTo(550, y + 25)
        .lineWidth(0.5)
        .stroke();
      
      y += 25;
    });

    // Garis Kotak Luar Tabel (Border)
    const tableHeight = y - tableTop;
    doc.rect(50, tableTop, 500, tableHeight).stroke();
    
    // Garis Vertikal (Pemisah Kolom)
    doc.moveTo(90, tableTop).lineTo(90, y).stroke();  // Setelah No
    doc.moveTo(340, tableTop).lineTo(340, y).stroke(); // Setelah Nama Barang
    doc.moveTo(410, tableTop).lineTo(410, y).stroke(); // Setelah Qty

    // TANDA TANGAN (Footer)
    // Posisi tanda tangan menyesuaikan panjang tabel
    const signY = y + 50; 

    // Kotak Kiri (Yang Mengeluarkan - Admin/User)
    doc.rect(50, signY, 200, 100).stroke();
    doc.font('Helvetica-Bold').text('Yang Mengeluarkan,', 55, signY + 10);
    doc.font('Helvetica').text('(Staff Gudang / Admin)', 55, signY + 25);
    
    // Nama User yang login/create
    doc.font('Helvetica-Bold').text(
        `( ${transaction.user.name || transaction.user.username} )`, 
        60, 
        signY + 80, 
        { align: 'center', width: 180 }
    );

    // Kotak Kanan (Mengetahui / Penerima)
    doc.rect(350, signY, 200, 100).stroke();
    doc.font('Helvetica-Bold').text('Mengetahui / Penerima,', 355, signY + 10);
    doc.font('Helvetica').text('(Pihak Luar / Supervisor)', 355, signY + 25);

    doc.font('Helvetica-Bold').text(
        '( ..................................... )', 
        360, 
        signY + 80, 
        { align: 'center', width: 180 }
    );

    doc.end();
  }
}