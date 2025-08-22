
import { App, Modal, Setting } from 'obsidian';

export interface InvoiceOptions {
  flatRateAmount?: number;
}

export class InvoiceOptionsModal extends Modal {
  private result: InvoiceOptions = {};
  private onSubmit: (result: InvoiceOptions) => void;

  constructor(app: App, onSubmit: (result: InvoiceOptions) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Invoice Options' });

    // Flat rate setting
    new Setting(contentEl)
      .setName('Flat Rate Amount (Optional)')
      .setDesc('Enter a flat rate amount to override hourly billing. Leave empty to use hourly rates.')
      .addText(text => text
        .setPlaceholder('e.g., 2500.00')
        .onChange(value => {
          const amount = parseFloat(value);
          if (!isNaN(amount) && amount > 0) {
            this.result.flatRateAmount = amount;
          } else {
            delete this.result.flatRateAmount;
          }
        }));

    // Buttons
    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.marginTop = '20px';

    const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelButton.onclick = () => this.close();

    const generateButton = buttonContainer.createEl('button', { 
      text: 'Generate Invoice',
      cls: 'mod-cta'
    });
    generateButton.onclick = () => {
      this.onSubmit(this.result);
      this.close();
    };
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
