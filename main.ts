import { 
  App, 
  Modal, 
  Notice, 
  Plugin, 
  PluginSettingTab, 
  Setting, 
  requestUrl, 
  Editor, 
  TextComponent, 
  ToggleComponent 
} from 'obsidian';

/**
 * Interface for plugin settings.
 */
interface AsanaPluginSettings {
  asanaToken: string;
  markTaskAsCompleted: boolean;
  pinnedProjects: string[]; // Array of project IDs or names
  enableMarkdownLink: boolean;
}

/**
 * Default settings for the plugin.
 */
const DEFAULT_SETTINGS: AsanaPluginSettings = {
  asanaToken: '',
  markTaskAsCompleted: false,
  pinnedProjects: [],
  enableMarkdownLink: true,
};

/**
 * Main plugin class.
 */
export default class AsanaPlugin extends Plugin {
  settings: AsanaPluginSettings;

  async onload() {
    console.log('Loading Asana Task Creator plugin');

    // Load settings
    await this.loadSettings();

    // Add command to the command palette
    this.addCommand({
      id: 'create-asana-task',
      name: 'Create Asana Task',
      editorCallback: (editor: Editor) => this.createAsanaTask(editor),
    });

    // Add settings tab
    this.addSettingTab(new AsanaSettingTab(this.app, this));

    // Add right-click context menu option (requires Obsidian API version 0.13.0 or higher)
    // Uncomment the following lines if your Obsidian version supports registering editor menu items
    /*
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor) => {
        menu.addItem((item) => {
          item.setTitle('Create Asana Task')
            .setIcon('checkmark')
            .onClick(() => this.createAsanaTask(editor));
        });
      })
    );
    */
  }

  onunload() {
    console.log('Unloading Asana Task Creator plugin');
  }

  /**
   * Loads plugin settings from disk.
   */
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  /**
   * Saves plugin settings to disk.
   */
  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * Main function to create an Asana task.
   * @param editor The current editor instance.
   */
  async createAsanaTask(editor: Editor) {
    // Get the selected text or the current line
    let selectedText = editor.getSelection();

    // Use current line if no selected text
    if (!selectedText) {
      console.log('No selected text, using the current line');
      const cursor = editor.getCursor();
      selectedText = editor.getLine(cursor.line);
    }

    // Remove leading whitespace, then any list markers and checkboxes
    selectedText = selectedText
      .replace(/^\s*(?:[-*]\s*)?(?:\[[ xX]\]\s*)?/, '')
      .trim();

    // Prompt the user to select workspace, project, and section
    const taskDetails = await this.promptForTaskDetails();
    if (!taskDetails) {
      return;
    }

    const { workspaceGid, projectGid, sectionGid } = taskDetails;

    // Create the task in Asana
    try {
      const response = await this.createTaskInAsana(
        selectedText,
        workspaceGid,
        projectGid,
        sectionGid
      );

      // Update the editor with the Asana task link
      this.updateEditorWithTaskLink(
        editor,
        response.permalink_url,
        taskDetails.projectName,
        taskDetails.sectionName
      );

      // Optionally mark the task as completed based on settings
      if (this.settings.markTaskAsCompleted) {
        this.markTaskAsCompleted(editor);
      }
    } catch (error) {
      new Notice(`Error creating Asana task: ${error.message}`);
    }
  }

  /**
   * Prompts the user to select the workspace, project, and section.
   * @returns An object containing the selected workspace, project, and section IDs and names.
   */
  async promptForTaskDetails() {
    const token = this.settings.asanaToken;
    if (!token) {
      new Notice('Asana Personal Access Token not set in plugin settings.');
      return null;
    }

    try {
      // Fetch workspaces
      const workspacesResponse = await requestUrl({
        url: 'https://app.asana.com/api/1.0/workspaces',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const workspaces = workspacesResponse.json.data;

      // Prompt for workspace selection
      const workspace = await this.promptForSelection(
        'Select Workspace',
        workspaces.map((ws: any) => ({ name: ws.name, gid: ws.gid }))
      );
      if (!workspace) return null;

      // Fetch projects in the workspace
      const projectsResponse = await requestUrl({
        url: `https://app.asana.com/api/1.0/workspaces/${workspace.gid}/projects?archived=false`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const projects = projectsResponse.json.data;
      const pinnedProjects = this.settings.pinnedProjects; // Retrieve pinned projects from settings

      const project = await new Promise<{ name: string; gid: string } | null>((resolve) => {
        const modal = new SelectionModal(this.app, 'Select Project', projects, pinnedProjects, resolve);
        modal.open();
      });
      if (!project) {
        new Notice('Project selection was canceled.');
        return null;
      }

      // Fetch sections in the selected project,
      const sectionsResponse = await requestUrl({
        url: `https://app.asana.com/api/1.0/projects/${project.gid}/sections`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const sections = sectionsResponse.json.data;

      // Check the number of sections
      let selectedSection: { name: string; gid: string } | null = null;

      if (sections.length > 1) {
        // Prompt user to select a section
        selectedSection = await this.promptForSelection(
          'Select Section',
          sections.map((section: any) => ({ name: section.name, gid: section.gid }))
        );

        if (!selectedSection) {
          new Notice('Section selection was canceled.');
          return null; // Exit if the user cancels the selection
        }
      } else if (sections.length === 1) {
        // Automatically select the only section
        selectedSection = { name: sections[0].name, gid: sections[0].gid };
      } else {
        // No sections available, skip the section selection
        new Notice('No sections found in this project. Skipping section selection.');
      }

      return {
        workspaceGid: workspace.gid,
        projectGid: project.gid,
        sectionGid: selectedSection.gid,
        projectName: project.name,
        sectionName: selectedSection.name,
      };
    } catch (error) {
      new Notice(`Error fetching Asana data: ${error.message}`);
      return null;
    }
  }

  /**
   * Prompts the user to select an option from a list.
   * @param title The title of the prompt.
   * @param options The list of options to select from.
   * @returns The selected option.
   */
  async promptForSelection(
    title: string,
    options: Array<{ name: string; gid: string }>,
    pinned: string[] = [] // Add optional pinned parameter
  ): Promise<{ name: string; gid: string } | null> {
    return new Promise<{ name: string; gid: string } | null>((resolve) => {
      const modal = new SelectionModal(this.app as App, title, options, pinned, resolve);
      modal.open();
    });
  }

  /**
   * Creates a task in Asana using the API.
   * @param taskName The name of the task to create.
   * @param workspaceGid The workspace GID.
   * @param projectGid The project GID.
   * @param sectionGid The section GID.
   * @returns The response data from the API.
   */
  async createTaskInAsana(
    taskName: string,
    workspaceGid: string,
    projectGid: string,
    sectionGid: string
  ) {
    const token = this.settings.asanaToken;

    const response = await requestUrl({
      url: 'https://app.asana.com/api/1.0/tasks',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          name: taskName,
          projects: [projectGid],
          workspace: workspaceGid,
        },
      }),
    });

    if (response.status >= 200 && response.status < 300) {
      const taskGid = response.json.data.gid;

      // Move task to the selected section
      await requestUrl({
        url: `https://app.asana.com/api/1.0/sections/${sectionGid}/addTask`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            task: taskGid,
          },
        }),
      });

      // Fetch the task details to get the permalink_url
      const taskResponse = await requestUrl({
        url: `https://app.asana.com/api/1.0/tasks/${taskGid}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return taskResponse.json.data;
    } else {
      throw new Error(response.text);
    }
  }

  /**
   * Updates the editor by inserting a markdown link to the Asana task.
   * @param editor The current editor instance.
   * @param taskUrl The URL of the Asana task.
   * @param projectName The name of the Asana project.
   * @param sectionName The name of the Asana section.
   */
  updateEditorWithTaskLink(
    editor: Editor,
    taskUrl: string,
    projectName: string,
    sectionName: string
  ) {
    if (!this.settings.enableMarkdownLink) {
      // If the setting is disabled, do nothing
      return;
    }
    
    const linkText = `[asana#${projectName}/${sectionName}](${taskUrl})`;
    const selectedText = editor.getSelection();
    if (selectedText) {
      editor.replaceSelection(`${selectedText} ${linkText}`);
    } else {
      const cursor = editor.getCursor();
      const lineText = editor.getLine(cursor.line);
      editor.setLine(cursor.line, `${lineText} ${linkText}`);
    }
  }

  /**
   * Marks the task as completed in Obsidian by changing `- [ ]` to `- [x]`.
   * @param editor The current editor instance.
   */
  markTaskAsCompleted(editor: Editor) {
    const cursor = editor.getCursor();
    const lineText = editor.getLine(cursor.line);
    const completedLine = lineText.replace('- [ ]', '- [x]');
    editor.setLine(cursor.line, completedLine);
  }
}

/**
 * Modal for selection prompts.
 */
class SelectionModal extends Modal {
  title: string;
  options: Array<{ name: string; gid: string }>;
  pinned: string[];
  onSelect: (result: { name: string; gid: string } | null) => void;

  constructor(
    app: App,
    title: string,
    options: Array<{ name: string; gid: string }>,
    pinned: string[] = [],
    onSelect: (result: { name: string; gid: string } | null) => void
  ) {
    super(app);
    this.title = title;
    this.options = options;
    this.pinned = pinned;
    this.onSelect = onSelect;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty(); // Clear any existing content

    contentEl.createEl('h2', { text: this.title });

    // Create search input field
    const searchInput = contentEl.createEl('input', {
      type: 'text',
      placeholder: 'Type to search...',
    });
    searchInput.style.width = '100%';
    searchInput.style.marginBottom = '10px';

    // Create a container for the options
    const optionsContainer = contentEl.createEl('div');
    optionsContainer.style.maxHeight = '300px';
    optionsContainer.style.overflowY = 'auto';

    // Function to render options based on the search query
    const renderOptions = (query: string) => {
      optionsContainer.empty(); // Clear previous options

      const lowerQuery = query.toLowerCase();

      // Filter options based on the query
      const filteredOptions = this.options.filter((option) => {
        return option.name.toLowerCase().includes(lowerQuery);
      });

      // Separate pinned and unpinned options
      const pinnedOptions = filteredOptions.filter(
        (option) =>
          this.pinned.indexOf(option.gid) !== -1 ||
          this.pinned.indexOf(option.name) !== -1
      );
      const otherOptions = filteredOptions.filter(
        (option) =>
          this.pinned.indexOf(option.gid) === -1 &&
          this.pinned.indexOf(option.name) === -1
      );

      // Render pinned options
      if (pinnedOptions.length > 0) {
        optionsContainer.createEl('h3', { text: 'Pinned' });
        pinnedOptions.forEach((option) => {
          const button = optionsContainer.createEl('button', { text: option.name });
          button.style.display = 'block';
          button.style.width = '100%';
          button.style.marginBottom = '5px';
          button.onclick = () => {
            this.onSelect(option);
            this.close();
          };
        });
      }

      // Render other options
      if (otherOptions.length > 0) {
        if (pinnedOptions.length > 0) {
          optionsContainer.createEl('h3', { text: 'Others' });
        }
        otherOptions.forEach((option) => {
          const button = optionsContainer.createEl('button', { text: option.name });
          button.style.display = 'block';
          button.style.width = '100%';
          button.style.marginBottom = '5px';
          button.onclick = () => {
            this.onSelect(option);
            this.close();
          };
        });
      }

      // Handle no results
      if (filteredOptions.length === 0) {
        optionsContainer.createEl('p', { text: 'No results found.' });
      }
    };

    // Initial rendering of options
    renderOptions('');

    // Add event listener for search input
    searchInput.addEventListener('input', () => {
      const query = searchInput.value;
      renderOptions(query);
    });

    contentEl.appendChild(optionsContainer);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Plugin settings tab.
 */
class AsanaSettingTab extends PluginSettingTab {
  plugin: AsanaPlugin;

  constructor(app: App, plugin: AsanaPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl('h2', { text: 'Asana Task Creator Settings' });

    // Asana Personal Access Token Setting
    new Setting(containerEl)
      .setName('Asana Personal Access Token')
      .setDesc(
        'Enter your Asana Personal Access Token. You can create one in your Asana account settings.'
      )
      .addText((text: TextComponent) => {
        text.setPlaceholder('Enter your token') // Correct usage of TextComponent
          .setValue(this.plugin.settings.asanaToken)
          .onChange(async (value: string) => { // Explicitly type `value`
            this.plugin.settings.asanaToken = value.trim();
            await this.plugin.saveSettings();
          });
      });

    // Mark Task as Completed Setting
    new Setting(containerEl)
      .setName('Mark Task as Completed')
      .setDesc('Automatically mark the task as completed in Obsidian after creating it in Asana.')
      .addToggle((toggle: ToggleComponent) => {
        toggle.setValue(this.plugin.settings.markTaskAsCompleted)
          .onChange(async (value: boolean) => { // Explicitly type `value`
            this.plugin.settings.markTaskAsCompleted = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Enable Markdown Link')
      .setDesc('Insert a markdown link to the task record in the note after task creation.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableMarkdownLink).onChange(async (value) => {
          this.plugin.settings.enableMarkdownLink = value;
          await this.plugin.saveSettings();
        })
      );

    // Add pinned projects
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