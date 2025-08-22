
import { App, PluginSettingTab, Setting } from 'obsidian';
import SimpleTimeTrackerInvoicePlugin from '../main';

export class InvoiceSettingsTab extends PluginSettingTab {
  plugin: SimpleTimeTrackerInvoicePlugin;

  constructor(app: App, plugin: SimpleTimeTrackerInvoicePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl('h2', { text: 'Simple Time Tracker Invoice Settings' });

    new Setting(containerEl)
      .setName('Company Name')
      .setDesc('Your company or business name')
      .addText(text => text
        .setPlaceholder('Your Company Name')
        .setValue(this.plugin.settings.companyName)
        .onChange(async (value) => {
          this.plugin.settings.companyName = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Company Address')
      .setDesc('Your company address (use line breaks for multiple lines)')
      .addTextArea(text => text
        .setPlaceholder('123 Main St\nCity, State 12345\nCountry')
        .setValue(this.plugin.settings.companyAddress)
        .onChange(async (value) => {
          this.plugin.settings.companyAddress = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Hourly Rate')
      .setDesc('Default hourly rate for billing')
      .addText(text => text
        .setPlaceholder('100')
        .setValue(this.plugin.settings.hourlyRate.toString())
        .onChange(async (value) => {
          const rate = parseFloat(value);
          if (!isNaN(rate) && rate >= 0) {
            this.plugin.settings.hourlyRate = rate;
            await this.plugin.saveSettings();
          }
        }));

    new Setting(containerEl)
      .setName('Payment Terms')
      .setDesc('Default payment terms (e.g., Net 30, Due on receipt)')
      .addText(text => text
        .setPlaceholder('Net 30')
        .setValue(this.plugin.settings.billingTerms)
        .onChange(async (value) => {
          this.plugin.settings.billingTerms = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Default Memo')
      .setDesc('Default memo/notes to include on invoices')
      .addTextArea(text => text
        .setPlaceholder('Thank you for your business!')
        .setValue(this.plugin.settings.memo)
        .onChange(async (value) => {
          this.plugin.settings.memo = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Invoice Directory')
      .setDesc('Directory where invoices will be saved. Use moment.js format tokens for date-based folders.')
      .addText(text => text
        .setPlaceholder('Invoices/YYYY/MM')
        .setValue(this.plugin.settings.invoiceDirectory)
        .onChange(async (value) => {
          this.plugin.settings.invoiceDirectory = value || 'Invoices/YYYY/MM';
          await this.plugin.saveSettings();
        }));

    // Add examples section
    const examplesEl = containerEl.createEl('div', { cls: 'setting-item-description' });
    examplesEl.createEl('strong', { text: 'Directory Examples:' });
    examplesEl.createEl('br');
    examplesEl.createEl('code', { text: 'Invoices/YYYY/MM' });
    examplesEl.createEl('span', { text: ' → Invoices/2024/01' });
    examplesEl.createEl('br');
    examplesEl.createEl('code', { text: 'Billing/YYYY' });
    examplesEl.createEl('span', { text: ' → Billing/2024' });
    examplesEl.createEl('br');
    examplesEl.createEl('code', { text: 'Documents/Invoices' });
    examplesEl.createEl('span', { text: ' → Documents/Invoices' });
    examplesEl.createEl('br');
    examplesEl.createEl('small', { text: 'Filename will be automatically generated as: {company}-invoice-{invoice-number}.pdf' });
  }
}
