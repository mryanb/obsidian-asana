import { App, Notice, PluginSettingTab, Setting, TextComponent, ToggleComponent } from 'obsidian';
import AsanaPlugin from '../main';

/**
 * Interface defining plugin settings.
 */
export interface AsanaPluginSettings {
  asanaToken: string;
  markTaskAsCompleted: boolean;
  pinnedProjects: string[];
  enableMarkdownLink: boolean;
}

/**
 * Default settings for the plugin.
 */
export const DEFAULT_SETTINGS: AsanaPluginSettings = {
  asanaToken: '',
  markTaskAsCompleted: false,
  pinnedProjects: [],
  enableMarkdownLink: true,
};

/**
 * Settings tab for configuring the plugin.
 */
export class AsanaSettingTab extends PluginSettingTab {
  plugin: AsanaPlugin;

  constructor(app: App, plugin: AsanaPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Asana Task Creator Settings' });

    new Setting(containerEl)
      .setName('Status Check')
      .setDesc('check whether API key is saved. It does not guarantee that the API key is valid or invalid.')
      .addButton(button => {
        button.setButtonText('API Check').onClick(async () => {
          if (this.plugin.settings.asanaToken.length) {
            new Notice('API key exist.');
          } else {
            new Notice('API key does not exist.');
          }
        });
      });

    // Personal Access Token Setting (Secure Input)
    const patDesc = document.createDocumentFragment();
    patDesc.createDiv({ text: 'Enter your Asana Personal Access Token.' });
    patDesc.createDiv({
      text: 'For security reasons, the saved API key is not shown in the input field after saving.',
    });

    let tempKeyValue = '';
    new Setting(containerEl)
      .setName('Asana Personal Access Token')
      .setDesc(patDesc)
      .addText((text: TextComponent) => {
        text.inputEl.type = 'password'; // Hide input value
        text.setValue('').onChange(async (value) => {
          tempKeyValue = value; // Store temporarily until saved
        });
      })
      .addButton((button) => {
        button.setButtonText('Save Key').onClick(async () => {
          this.plugin.settings.asanaToken = tempKeyValue.trim();
          await this.plugin.saveSettings();
          new Notice('Asana API Key Saved');
          tempKeyValue = ''; // Clear stored value
        });
      });

    // Toggle: Mark Task as Completed
    new Setting(containerEl)
      .setName('Mark Task as Completed')
      .setDesc('Automatically mark the task as completed in Obsidian after creating it in Asana.')
      .addToggle((toggle: ToggleComponent) => {
        toggle.setValue(this.plugin.settings.markTaskAsCompleted)
          .onChange(async (value: boolean) => {
            this.plugin.settings.markTaskAsCompleted = value;
            await this.plugin.saveSettings();
          });
      });

    // Toggle: Enable Markdown Link
    new Setting(containerEl)
      .setName('Enable Markdown Link')
      .setDesc('Insert a markdown link to the task in the note after task creation.')
      .addToggle((toggle: ToggleComponent) => {
        toggle.setValue(this.plugin.settings.enableMarkdownLink)
          .onChange(async (value: boolean) => {
            this.plugin.settings.enableMarkdownLink = value;
            await this.plugin.saveSettings();
          });
      });

    // Pinned Projects Input (Scalable TextArea)
    new Setting(containerEl)
      .setName('Pinned Projects')
      .setDesc('Enter project names or IDs to pin them in the project selection modal.')
      .addTextArea((textArea) => {
        textArea.inputEl.setAttribute('style', 'min-height: 100px; max-height: 300px; width: 100%; overflow-y: auto; resize: vertical;');
        textArea.setPlaceholder('Enter project names/IDs, one per line')
          .setValue(this.plugin.settings.pinnedProjects.join('\n'))
          .onChange(async (value: string) => {
            this.plugin.settings.pinnedProjects = value.split('\n').map((item) => item.trim());
            await this.plugin.saveSettings();
          });
      });
  }
}