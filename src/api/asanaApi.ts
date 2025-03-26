import { requestUrl } from 'obsidian';
import { AsanaPluginSettings } from '../settings/settings';

// Asana API Base URL
const ASANA_API_BASE_URL = 'https://app.asana.com/api/1.0';

/**
 * Fetches a list of workspaces from Asana.
 * @param settings - The plugin settings containing the Asana API token.
 * @returns A list of workspaces.
 */
export async function fetchAsanaWorkspaces(settings: AsanaPluginSettings) {
  const token = settings.asanaToken;

  try {
    const response = await requestUrl({
      url: `${ASANA_API_BASE_URL}/workspaces`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status >= 200 && response.status < 300) {
      return response.json.data; // Return workspace list
    } else {
      throw new Error(`Asana API Error: ${response.text}`);
    }
  } catch (error) {
    console.error('Failed to fetch Asana workspaces:', error);
    throw new Error('Failed to retrieve workspaces from Asana');
  }
}

/**
 * Fetches a list of projects for a given workspace in Asana.
 * @param workspaceGid - The Asana workspace ID.
 * @param settings - The plugin settings containing the Asana API token.
 * @returns A list of projects.
 */
export async function fetchAsanaProjects(
  workspaceGid: string,
  settings: AsanaPluginSettings
) {
  const token = settings.asanaToken;

  try {
    const response = await requestUrl({
      url: `${ASANA_API_BASE_URL}/workspaces/${workspaceGid}/projects${settings.showArchivedProjects ? '' : '?is_archived=false'}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status >= 200 && response.status < 300) {
      return response.json.data; // Return list of projects
    } else {
      throw new Error(`Asana API Error: ${response.text}`);
    }
  } catch (error) {
    console.error('Failed to fetch Asana projects:', error);
    throw new Error('Failed to retrieve projects from Asana');
  }
}

/**
 * Fetches a list of sections for a given project in Asana.
 * @param projectGid - The Asana project ID.
 * @param settings - The plugin settings containing the Asana API token.
 * @returns A list of sections.
 */
export async function fetchAsanaSections(
  projectGid: string,
  settings: AsanaPluginSettings
) {
  const token = settings.asanaToken;

  try {
    const response = await requestUrl({
      url: `${ASANA_API_BASE_URL}/projects/${projectGid}/sections`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status >= 200 && response.status < 300) {
      return response.json.data; // Return list of sections
    } else {
      throw new Error(`Asana API Error: ${response.text}`);
    }
  } catch (error) {
    console.error('Failed to fetch Asana sections:', error);
    throw new Error('Failed to retrieve sections from Asana');
  }
}

/**
 * Creates a task in Asana using the API.
 * @param taskName - The name of the task.
 * @param workspaceGid - The workspace GID.
 * @param projectGid - The project GID.
 * @param sectionGid - The section GID.
 * @param settings - The plugin settings, including API token.
 * @returns The response data containing the task details.
 */
export async function createTaskInAsana(
  taskName: string,
  workspaceGid: string,
  projectGid: string,
  sectionGid: string,
  settings: AsanaPluginSettings
) {
  const token = settings.asanaToken;

  try {
    // Create task in Asana
    const response = await requestUrl({
      url: `${ASANA_API_BASE_URL}/tasks`,
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

      // Move task to the selected section (if provided)
      if (sectionGid) {
        await requestUrl({
          url: `${ASANA_API_BASE_URL}/sections/${sectionGid}/addTask`,
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
      }

      // Fetch task details to get `permalink_url`
      const taskResponse = await requestUrl({
        url: `${ASANA_API_BASE_URL}/tasks/${taskGid}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return taskResponse.json.data;
    } else {
      throw new Error(`Asana API Error: ${response.text}`);
    }
  } catch (error) {
    console.error('Failed to create Asana task:', error);
    throw new Error('Failed to create task in Asana');
  }
}