
import { Plugin, MarkdownView, Notice } from 'obsidian';
import { InvoiceSettingsTab } from './src/settings';
import { InvoiceGenerator } from './src/invoice-generator';
import { TimeTrackerParser } from './src/time-tracker-parser';
import { InvoiceOptionsModal } from './src/invoice-modal';

interface InvoiceSettings {
  companyName: string;
  companyAddress: string;
  companyLogo: string;
  hourlyRate: number;
  billingTerms: string;
  memo: string;
  invoiceDirectory: string;
}

const DEFAULT_SETTINGS: InvoiceSettings = {
  companyName: '',
  companyAddress: '',
  companyLogo: '',
  hourlyRate: 100,
  billingTerms: 'Net 30',
  memo: '',
  invoiceDirectory: 'Invoices/YYYY/MM'
};

export default class SimpleTimeTrackerInvoicePlugin extends Plugin {
  settings: InvoiceSettings;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new InvoiceSettingsTab(this.app, this));

    this.registerMarkdownPostProcessor((element, context) => {
      const bottomContainers = element.querySelectorAll('.simple-time-tracker-bottom');
      
      bottomContainers.forEach((bottomContainer) => {
        if (bottomContainer.querySelector('button[data-invoice-button]')) {
          return;
        }

        const parentContainer = bottomContainer.closest('.simple-time-tracker-container') || 
                               bottomContainer.parentElement;
        
        if (parentContainer) {
          const table = parentContainer.querySelector('.simple-time-tracker-table');
          if (table) {
            const jsonData = this.extractDataFromTable(table);
            if (jsonData) {
              this.addInvoiceButton(bottomContainer, jsonData);
            }
          }
        }
      });
    });
  }

  private extractDataFromTable(table: Element): string | null {
    const entries: any[] = [];
    
    const rows = table.querySelectorAll('tr');
    
    for (let i = 1; i < Math.min(rows.length, 1001); i++) {
      const row = rows[i];
      const cells = row.querySelectorAll('td');
      
      if (cells.length >= 4) {
        const nameSpan = cells[0].querySelector('span');
        const name = this.sanitizeText(nameSpan?.textContent?.trim() || 'Unknown Task');
        
        const marginLeft = nameSpan?.style.marginLeft || '0em';
        const level = Math.min(Math.max(parseInt(marginLeft.replace('em', '')) || 0, 0), 10);
        
        const startSpan = cells[1].querySelector('span');
        const startTimeText = startSpan?.textContent?.trim();
        
        const endSpan = cells[2].querySelector('span');
        const endTimeText = endSpan?.textContent?.trim();
        
        const startTime = this.parseTimeTrackerDate(startTimeText);
        const endTime = this.parseTimeTrackerDate(endTimeText);
        
        entries.push({
          name,
          startTime,
          endTime,
          level
        });
      }
    }

    if (entries.length > 0) {
      return JSON.stringify({ entries });
    }

    return null;
  }

  private sanitizeText(text: string): string {
    if (!text) return '';
    return text
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .replace(/[<>]/g, '')
      .substring(0, 500);
  }

  private parseTimeTrackerDate(dateStr: string | undefined): string | null {
    if (!dateStr || dateStr.trim() === '') {
      return null;
    }
    
    try {
      const parts = dateStr.split(' ');
      if (parts.length !== 2) return null;
      
      const datePart = parts[0];
      const timePart = parts[1];
      
      if (!/^\d{2}-\d{2}-\d{2}$/.test(datePart) || !/^\d{2}:\d{2}:\d{2}$/.test(timePart)) {
        return null;
      }
      
      const dateComponents = datePart.split('-');
      if (dateComponents.length !== 3) return null;
      
      let year = parseInt(dateComponents[0]);
      const month = parseInt(dateComponents[1]);
      const day = parseInt(dateComponents[2]);
      
      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
      }
      
      if (year < 50) {
        year += 2000;
      } else {
        year += 1900;
      }
      
      if (year < 1900 || year > 2100) {
        return null;
      }
      
      const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${timePart}`;
      
      const date = new Date(isoDate);
      if (isNaN(date.getTime())) {
        return null;
      }
      
      return isoDate;
    } catch (error) {
      return null;
    }
  }

  private addInvoiceButton(bottomContainer: Element, jsonData: string) {
    const button = document.createElement('button');
    button.textContent = 'Create Invoice';
    button.className = 'mod-cta';
    button.setAttribute('data-invoice-button', 'true');
    
    button.style.cssText = `
      margin: 10px 5px 10px 5px;
    `;

    button.addEventListener('click', async () => {
      try {
        const parser = new TimeTrackerParser();
        const entries = parser.parse(jsonData);
        
        if (entries.length === 0) {
          new Notice('No time entries found to generate invoice');
          return;
        }
        
        new InvoiceOptionsModal(this.app, async (options) => {
          try {
            const generator = new InvoiceGenerator(this.settings, this.app);
            await generator.generateInvoice(entries, options);
            
            new Notice('Invoice generated successfully!');
          } catch (error) {
            console.error('Error generating invoice:', error);
            new Notice(`Error generating invoice: ${error.message}`);
          }
        }).open();
        
      } catch (error) {
        console.error('Error generating invoice:', error);
        new Notice(`Error generating invoice: ${error.message}`);
      }
    });

    bottomContainer.appendChild(button);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
