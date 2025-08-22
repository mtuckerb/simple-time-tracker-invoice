
import { App, Notice, normalizePath, moment } from "obsidian"
import { InvoiceOptions } from './invoice-modal';

export interface TimeEntry {
  name: string
  startTime: string | null
  endTime: string | null
  level?: number
}

export interface InvoiceSettings {
  companyName: string
  companyAddress: string
  companyLogo: string
  hourlyRate: number
  billingTerms: string
  memo: string
  invoiceDirectory: string
}

export class InvoiceGenerator {
  constructor(private settings: InvoiceSettings, private app: App) {}

  async generateInvoice(entries: TimeEntry[], options?: InvoiceOptions): Promise<void> {
    try {
      const pdfBuffer = await this.generatePDF(entries, options);
      const filePath = this.generateFilePath();
      
      await this.ensureDirectoryExists(filePath);
      const file = await this.app.vault.createBinary(filePath, pdfBuffer);
      
      new Notice(`Invoice saved to: ${filePath}`);
      
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
      
    } catch (error) {
      console.error("Error generating invoice:", error)
      throw new Error(`Failed to generate invoice: ${error.message}`)
    }
  }

  private generateFilePath(): string {
    let directory = this.settings.invoiceDirectory || 'Invoices/YYYY/MM';
    directory = moment().format(directory);
    
    const invoiceNumber = this.generateInvoiceNumber();
    const companyName = this.settings.companyName || 'Company';
    const safeCompanyName = this.sanitizeFilename(companyName);
    const filename = `${safeCompanyName}-invoice-${invoiceNumber}.pdf`;
    
    const fullPath = `${directory}/${filename}`;
    return normalizePath(fullPath);
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  private async ensureDirectoryExists(filePath: string): Promise<void> {
    const pathParts = filePath.split('/');
    pathParts.pop();
    
    if (pathParts.length === 0) return;
    
    const dirPath = normalizePath(pathParts.join('/'));
    
    const dirExists = await this.app.vault.adapter.exists(dirPath);
    if (dirExists) return;
    
    try {
      await this.createDirectoryRecursive(dirPath);
    } catch (error) {
      if (!error.message.includes("already exists")) {
        throw error;
      }
    }
  }

  private async createDirectoryRecursive(dirPath: string): Promise<void> {
    const parts = dirPath.split('/').filter(part => part.length > 0);
    let currentPath = '';
    
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const normalizedPath = normalizePath(currentPath);
      
      const exists = await this.app.vault.adapter.exists(normalizedPath);
      if (!exists) {
        try {
          await this.app.vault.createFolder(normalizedPath);
        } catch (error) {
          if (!error.message.includes("already exists")) {
            throw error;
          }
        }
      }
    }
  }

  private async generatePDF(entries: TimeEntry[], options?: InvoiceOptions): Promise<ArrayBuffer> {
    try {
      const { jsPDF } = require('jspdf');
      require('jspdf-autotable');
      
      const doc = new jsPDF();
      this.addPDFContent(doc, entries, options);
      
      const pdfBlob = doc.output('arraybuffer');
      return pdfBlob;
      
    } catch (error) {
      throw new Error(`PDF generation failed: ${error.message}`);
    }
  }

  private addPDFContent(doc: any, entries: TimeEntry[], options?: InvoiceOptions): void {
    const totalHours = this.calculateTotalHours(entries);
    const isFlateRate = options?.flatRateAmount !== undefined;
    const subtotal = isFlateRate ? options.flatRateAmount : totalHours * this.settings.hourlyRate;
    const invoiceNumber = this.generateInvoiceNumber();
    const invoiceDate = new Date().toLocaleDateString();

    doc.setFontSize(24);
    doc.text("INVOICE", 200, 30, { align: "right" });

    doc.setFontSize(16);
    doc.text(this.escapeText(this.settings.companyName || "Your Company"), 20, 30);
    
    if (this.settings.companyAddress) {
      doc.setFontSize(10);
      const addressLines = this.settings.companyAddress.split('\n');
      addressLines.forEach((line, index) => {
        doc.text(this.escapeText(line), 20, 40 + (index * 5));
      });
    }

    doc.setFontSize(10);
    doc.text(`Invoice #: ${this.escapeText(invoiceNumber)}`, 200, 45, { align: "right" });
    doc.text(`Date: ${invoiceDate}`, 200, 52, { align: "right" });

    const tableData = entries.map(entry => {
      const duration = this.calculateEntryDuration(entry);
      const indent = '  '.repeat(Math.min(entry.level || 0, 10));
      
      const formatTime = (timeString: string | null): string => {
        if (!timeString) return '-';
        try {
          const date = new Date(timeString);
          if (isNaN(date.getTime())) return '-';
          return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          }) + ' ' + date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          });
        } catch {
          return '-';
        }
      };
      
      if (isFlateRate) {
        return [
          this.escapeText(indent + entry.name),
          formatTime(entry.startTime),
          formatTime(entry.endTime),
          duration.toFixed(2),
          '-',
          '-'
        ];
      } else {
        const amount = duration * this.settings.hourlyRate;
        return [
          this.escapeText(indent + entry.name),
          formatTime(entry.startTime),
          formatTime(entry.endTime),
          duration.toFixed(2),
          `${this.settings.hourlyRate.toFixed(2)}`,
          `${amount.toFixed(2)}`
        ];
      }
    });

    (doc as any).autoTable({
      head: [['Task', 'Start Time', 'End Time', 'Hours', 'Rate', 'Amount']],
      body: tableData,
      startY: 70,
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [249, 249, 249],
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 39 },
        2: { cellWidth: 39 },
        3: { cellWidth: 20, halign: 'right' },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 30, halign: 'right' },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 20;

    const summaryStartY = finalY;
    const summaryRightX = 190;
    doc.setFontSize(10);
    
    doc.text("Total Hours:", 140, summaryStartY);
    doc.text(totalHours.toFixed(2), summaryRightX, summaryStartY, { align: "right" });
    
    if (isFlateRate) {
      doc.text("Project Rate:", 140, summaryStartY + 7);
      doc.text(`${options.flatRateAmount!.toFixed(2)}`, summaryRightX, summaryStartY + 7, { align: "right" });
    } else {
      doc.text("Hourly Rate:", 140, summaryStartY + 7);
      doc.text(`${this.settings.hourlyRate.toFixed(2)}`, summaryRightX, summaryStartY + 7, { align: "right" });
    }
    
    doc.line(140, summaryStartY + 12, summaryRightX, summaryStartY + 12);
    
    doc.setFontSize(12);
    doc.text("Total Amount:", 140, summaryStartY + 20);
    
    const totalAmountStr = `${subtotal!.toFixed(2)}`;
    doc.text(totalAmountStr, summaryRightX, summaryStartY + 20, { align: "right" });

    let notesY = summaryStartY + 35;
    if (this.settings.memo) {
      doc.setFontSize(12);
      doc.text("Notes:", 20, notesY);
      doc.setFontSize(10);
      
      const memoLines = this.settings.memo.split('\n');
      memoLines.forEach((line, index) => {
        doc.text(this.escapeText(line), 20, notesY + 7 + (index * 5));
      });
      
      notesY += 7 + (memoLines.length * 5) + 10;
    }

    doc.setFontSize(10);
    doc.text(`Payment Terms: ${this.escapeText(this.settings.billingTerms)}`, 20, notesY);
    doc.text("Thank you for your business!", 20, notesY + 7);
  }

  private escapeText(text: string): string {
    if (!text) return '';
    return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').substring(0, 1000);
  }

  private calculateTotalHours(entries: TimeEntry[]): number {
    return entries.reduce((total, entry) => {
      return total + this.calculateEntryDuration(entry);
    }, 0);
  }

  private calculateEntryDuration(entry: TimeEntry): number {
    if (!entry.startTime || !entry.endTime) {
      return 0;
    }

    try {
      const start = new Date(entry.startTime);
      const end = new Date(entry.endTime);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return 0;
      }
      
      const diffMs = end.getTime() - start.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      return Math.max(0, Math.min(diffHours, 24 * 365));
    } catch {
      return 0;
    }
  }

  private generateInvoiceNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");
    const timestamp = Math.floor(Math.random() * 10000);
    return `${year}-${month}-${day}-${timestamp}`;
  }
}
