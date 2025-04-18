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
import { 
  fetchAsanaWorkspaces, 
  fetchAsanaProjects, 
  fetchAsanaSections, 
  createTaskInAsana, 
  fetchAsanaUser,
  fetchUserTaskListGid
} from './api/asanaApi';
import { FuzzySelectModal } from './ui/FuzzySelectModal';

interface Project {
  name: string;
  gid: string;
  isMyTasks?: boolean;
}

/**
 * Main plugin class.
 */
export default class AsanaPlugin extends Plugin {
  settings: AsanaPluginSettings;

  async onload() {
    // Load settings
    await this.loadSettings();

    // Add command to the command palette
    this.addCommand({
      id: 'create-asana-task',
      name: 'Create task',
      editorCallback: (editor: Editor) => this.createAsanaTask(editor),
    });

    // Add settings tab
    this.addSettingTab(new AsanaSettingTab(this.app, this));

    // Add right-click context menu option (requires Obsidian API version 0.13.0 or higher)
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor) => {
        menu.addItem((item) => {
          item.setTitle('Create Asana task')
            .setIcon('checkmark')
            .onClick(() => this.createAsanaTask(editor));
        });
      })
    );

    // // Load the CSS
    // this.addStyles();
  }

  onunload() {
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
      const response = await createTaskInAsana(
        selectedText,
        workspaceGid,
        projectGid,
        sectionGid,
        this.settings
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
      // Fetch workspaces and user data in parallel
      const [workspaces, userData] = await Promise.all([
        fetchAsanaWorkspaces(this.settings),
        fetchAsanaUser(this.settings)
      ]);

      // Prompt for workspace selection
      const workspace = await this.promptForSelection(
        'Select workspace',
        workspaces.map((ws: any) => ({ name: ws.name, gid: ws.gid }))
      );
      
      if (!workspace) {
        new Notice('Workspace selection was canceled.');
        return null;
      }

      // Fetch projects using the refactored function
      const projects = await fetchAsanaProjects(workspace.gid, this.settings);

      // Ensure pinned projects are sorted to the top
      const pinnedProjectIds = new Set(this.settings.pinnedProjects);

      // Add "My Tasks" as a special project option
      const myTasksProject = { 
        name: "My Tasks", 
        gid: userData.gid, 
        isPinned: this.settings.pinMyTasks, 
        isMyTasks: true 
      };

      // Separate pinned and non-pinned projects
      const pinnedProjects = projects
        .filter((p: any) => pinnedProjectIds.has(p.gid) || pinnedProjectIds.has(p.name))
        .map((p: any) => ({ name: p.name, gid: p.gid, isPinned: true }));

      const otherProjects = projects
        .filter((p: any) => !pinnedProjectIds.has(p.gid) && !pinnedProjectIds.has(p.name))
        .map((p: any) => ({ name: p.name, gid: p.gid, isPinned: false }));

      // Combine My Tasks (if pinned), pinned projects, and other projects
      const projectOptions = this.settings.pinMyTasks 
        ? [myTasksProject, ...pinnedProjects, ...otherProjects]
        : [...pinnedProjects, myTasksProject, ...otherProjects];

      // Prompt for project selection
      const project = await this.promptForSelection('Select project', projectOptions);

      if (!project) {
        new Notice('Project selection was canceled.');
        return null;
      }

      let sections;
      let selectedSection: { name: string; gid: string } | null = null;

      // Fetch sections based on whether this is My Tasks or a regular project
      const projectWithType = project as Project;
      if (projectWithType.isMyTasks) {
        const taskListGid = await fetchUserTaskListGid(workspace.gid, this.settings);
        sections = await fetchAsanaSections(taskListGid, this.settings);
      } else {
        sections = await fetchAsanaSections(projectWithType.gid, this.settings);
      }

      // Check the number of sections
      if (sections.length > 1) {
        // Prompt user to select a section
        selectedSection = await this.promptForSelection(
          'Select section',
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
        new Notice('No sections found. Skipping section selection.');
      }

      return {
        workspaceGid: workspace.gid,
        projectGid: projectWithType.isMyTasks ? '' : projectWithType.gid,
        sectionGid: selectedSection ? selectedSection.gid : '',
        projectName: projectWithType.name,
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
    return new Promise((resolve) => {
      const modal = new FuzzySelectModal(this.app, title, options, (selectedItem) => {
        // if (selectedItem) {
        //   console.log(`PROMPT RESULT - Selected: ${selectedItem.name} (gid: ${selectedItem.gid})`);
        // } else {
        //   console.log(`PROMPT RESULT - Selection canceled for: ${title}`);
        // }
        resolve(selectedItem);
      });
      modal.open();
    });
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