import { 
  App, 
  FuzzySuggestModal, 
  Notice, 
  Plugin, 
  PluginSettingTab, 
  Setting, 
  requestUrl, 
  Editor, 
  TextComponent, 
  ToggleComponent 
} from 'obsidian';
import { AsanaPluginSettings, DEFAULT_SETTINGS, AsanaSettingTab } from './settings/settings';

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
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor) => {
        menu.addItem((item) => {
          item.setTitle('Create Asana Task')
            .setIcon('checkmark')
            .onClick(() => this.createAsanaTask(editor));
        });
      })
    );

    // // Load the CSS
    // this.addStyles();
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

  // // Method to load styles
  // addStyles() {
  //   this.registerCss();
  // }

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

    // Extract indented lines for the description
    // @TODO - Find a good way to handle descriptions
    // const cursor = editor.getCursor();
    // const lines = editor.getValue().split('\n'); // All lines in the editor
    // const taskLine = cursor.line;
    // let description = '';

    // // Collect subsequent indented lines
    // for (let i = taskLine + 1; i < lines.length; i++) {
    //   const line = lines[i];
    //   if (/^\s+[-*]/.test(line)) {
    //     // Indented list item, add to description
    //     description += line.trim() + '\n';
    //   } else if (line.trim() === '') {
    //     // Empty line, continue looking for more indented lines
    //     continue;
    //   } else {
    //     // No longer an indented line, stop processing
    //     break;
    //   }
    // }

    // description = description.trim(); // Remove any trailing whitespace

    // console.log(`Description: ${description}`);

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
      // if (!workspace) return null;
      if (!workspace) {
        new Notice('Workspace selection was canceled.');
        return null;
      }

      // Fetch projects in the workspace
      const projectsResponse = await requestUrl({
        url: `https://app.asana.com/api/1.0/workspaces/${workspace.gid}/projects?is_archived=false`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const projects = projectsResponse.json.data;

      const projectOptions = projects.map((p: any) => ({ name: p.name, gid: p.gid }));

      const project = await this.promptForSelection('Select Project', projectOptions);

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
        sectionGid: selectedSection ? selectedSection.gid : '',
        projectName: project.name,
        sectionName: selectedSection ? selectedSection.name : '',
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
    options: Array<{ name: string; gid: string }>
  ): Promise<{ name: string; gid: string } | null> {
    console.log(`PROMPT START - Prompting selection for: ${title}`);
    return new Promise((resolve) => {
      const modal = new FuzzySelectModal(this.app, title, options, (selectedItem) => {
        if (selectedItem) {
          console.log(`PROMPT RESULT - Selected: ${selectedItem.name} (gid: ${selectedItem.gid})`);
        } else {
          console.log(`PROMPT RESULT - Selection canceled for: ${title}`);
        }
        resolve(selectedItem);
      });
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
class FuzzySelectModal extends FuzzySuggestModal<{ name: string; gid: string; isPinned?: boolean }> {
  private resolve: (value: { name: string; gid: string } | null) => void;
  private items: Array<{ name: string; gid: string; isPinned?: boolean }>;
  private title: string;
  private selectedItem: { name: string; gid: string } | null = null;
  private resolved: boolean = false; // Tracks if resolve has been handled

  constructor(
    app: App,
    title: string,
    items: Array<{ name: string; gid: string; isPinned?: boolean }>,
    resolve: (value: { name: string; gid: string } | null) => void
  ) {
    super(app);
    this.title = title;
    this.items = items;
    this.resolve = resolve;
  }

  onOpen() {
    super.onOpen();
    this.setTitle('herer is the titme');
    this.setPlaceholder(this.title);
    // this.setInstructions('here is the instruction');
  }

  getItems(): Array<{ name: string; gid: string; isPinned?: boolean }> {
    return this.items;
  }

  getItemText(item: { name: string; gid: string; isPinned?: boolean }): string {
    return item.isPinned ? `📌 ${item.name}` : item.name;
  }

  // Should this be async or not?
  onChooseItem(item: { name: string; gid: string }, evt: MouseEvent | KeyboardEvent) {
    if (!this.resolved) {
      console.log(`ITEM CHOSEN - ${item.name} (gid: ${item.gid})`);
      this.selectedItem = item;
      this.resolved = true; // Mark as resolved
      this.resolve(item); // Resolve with the selected item
    } else {
      console.warn(`ITEM CHOSEN MULTIPLE TIMES - Ignoring extra selection: ${item.name}`);
    }
  }
}