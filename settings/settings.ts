import { App, PluginSettingTab, Setting, TextComponent, ToggleComponent } from 'obsidian';
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

    // Personal Access Token Setting
    const patDesc = document.createDocumentFragment();
    patDesc.append(
      "Enter your Asana Personal Access Token. You can create one in the ",
      patDesc.createEl("a", {
        href: "https://app.asana.com/0/my-apps",
        text: "Asana My Apps",
      }),
      " section."
    );

    new Setting(containerEl)
      .setName('Asana Personal Access Token')
      .setDesc(patDesc)
      .addText((text: TextComponent) => {
        text.setPlaceholder('Enter your token')
          .setValue(this.plugin.settings.asanaToken)
          .onChange(async (value: string) => {
            this.plugin.settings.asanaToken = value.trim();
            await this.plugin.saveSettings();
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

    // Pinned Projects Input
    new Setting(containerEl)
      .setName('Pinned Projects')
      .setDesc('Enter project names or IDs to pin them in the project selection modal.')
      .addTextArea((textArea) =>
        textArea
          .setPlaceholder('Enter project names/IDs, one per line')
          .setValue(this.plugin.settings.pinnedProjects.join('\n'))
          .onChange(async (value: string) => {
            this.plugin.settings.pinnedProjects = value.split('\n').map((item) => item.trim());
            await this.plugin.saveSettings();
          })
      );
  }
}