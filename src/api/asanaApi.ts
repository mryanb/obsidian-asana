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
      throw: false,
    });

    if (response.status >= 200 && response.status < 300) {
      return response.json.data; // Return workspace list
    } else {
      throw new Error(`Asana API Error (${response.status}): ${response.text}`);
    }
  } catch (error) {
    console.error('Failed to fetch Asana workspaces:', error);
    throw error;
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
  const allProjects: any[] = [];
  const archivedParam = settings.showArchivedProjects ? '' : '&archived=false';
  let offset: string | null = null;

  try {
    do {
      const offsetParam = offset ? `&offset=${encodeURIComponent(offset)}` : '';
      const url = `${ASANA_API_BASE_URL}/workspaces/${workspaceGid}/projects?limit=100${archivedParam}${offsetParam}`;

      const response = await requestUrl({
        url,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        throw: false,
      });

      if (response.status >= 200 && response.status < 300) {
        allProjects.push(...response.json.data);

        const nextOffset = response.json.next_page?.offset ?? null;
        // Defensive: a repeated cursor would loop forever and freeze Obsidian.
        offset = nextOffset === offset ? null : nextOffset;
      } else {
        throw new Error(`Asana API Error (${response.status}): ${response.text}`);
      }
    } while (offset);

    return allProjects;
  } catch (error) {
    console.error('Failed to fetch Asana projects:', error);
    throw error;
  }
}

/**
 * Fetches a list of sections for a given project or task list in Asana.
 * @param gid - The Asana project ID or task list ID.
 * @param settings - The plugin settings containing the Asana API token.
 * @returns A list of sections.
 */
export async function fetchAsanaSections(
  gid: string,
  settings: AsanaPluginSettings
) {
  const token = settings.asanaToken;

  try {
    const response = await requestUrl({
      url: `${ASANA_API_BASE_URL}/projects/${gid}/sections`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      throw: false,
    });

    if (response.status >= 200 && response.status < 300) {
      return response.json.data; // Return list of sections
    } else {
      throw new Error(`Asana API Error (${response.status}): ${response.text}`);
    }
  } catch (error) {
    console.error('Failed to fetch Asana sections:', error);
    throw error;
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
          workspace: workspaceGid,
          ...(projectGid ? { projects: [projectGid] } : {}), // Only include projects if projectGid is provided
          assignee: projectGid ? undefined : 'me', // Assign to me if it's a My Tasks task
        },
      }),
      throw: false,
    });

    if (response.status >= 200 && response.status < 300) {
      const taskGid = response.json.data.gid;

      // Move task to the selected section if provided
      if (sectionGid) {
        const sectionResponse = await requestUrl({
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
          throw: false,
        });

        if (sectionResponse.status < 200 || sectionResponse.status >= 300) {
          throw new Error(
            `Asana API Error (${sectionResponse.status}): ${sectionResponse.text}`
          );
        }
      }

      // Fetch task details to get `permalink_url`
      const taskResponse = await requestUrl({
        url: `${ASANA_API_BASE_URL}/tasks/${taskGid}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        throw: false,
      });

      if (taskResponse.status < 200 || taskResponse.status >= 300) {
        throw new Error(
          `Asana API Error (${taskResponse.status}): ${taskResponse.text}`
        );
      }

      return taskResponse.json.data;
    } else {
      throw new Error(`Asana API Error (${response.status}): ${response.text}`);
    }
  } catch (error) {
    console.error('Failed to create task:', error);
    throw error;
  }
}

/**
 * Fetches the current user's data from Asana.
 * @param settings - The plugin settings containing the Asana API token.
 * @returns The user data including gid.
 */
export async function fetchAsanaUser(settings: AsanaPluginSettings) {
  const token = settings.asanaToken;

  try {
    const response = await requestUrl({
      url: `${ASANA_API_BASE_URL}/users/me`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      throw: false,
    });

    if (response.status >= 200 && response.status < 300) {
      return response.json.data;
    } else {
      throw new Error(`Asana API Error (${response.status}): ${response.text}`);
    }
  } catch (error) {
    console.error('Failed to fetch Asana user data:', error);
    throw error;
  }
}

/**
 * Fetches a list of sections from a user's My Tasks in a specific workspace. https://developers.asana.com/reference/getusertasklist
 * @param workspaceGid - The Asana workspace ID.
 * @param userGid - The user's GID.
 * @param settings - The plugin settings containing the Asana API token.
 * @returns A list of sections.
 */
export async function fetchMyTasksSections(
  workspaceGid: string,
  userGid: string,
  settings: AsanaPluginSettings
) {
  const token = settings.asanaToken;

  try {
    // First, get the user's task list for the workspace
    const taskListResponse = await requestUrl({
      url: `${ASANA_API_BASE_URL}/users/me/user_task_list?workspace=${workspaceGid}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      throw: false,
    });

    if (taskListResponse.status >= 200 && taskListResponse.status < 300) {
      const taskListGid = taskListResponse.json.data.gid;

      // Fetch sections using the same endpoint as projects, but with the task list GID
      const sectionsResponse = await requestUrl({
        url: `${ASANA_API_BASE_URL}/projects/${taskListGid}/sections`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        throw: false,
      });

      if (sectionsResponse.status >= 200 && sectionsResponse.status < 300) {
        return sectionsResponse.json.data;
      } else {
        throw new Error(`Asana API Error (${sectionsResponse.status}): ${sectionsResponse.text}`);
      }
    } else {
      throw new Error(`Asana API Error (${taskListResponse.status}): ${taskListResponse.text}`);
    }
  } catch (error) {
    console.error('Failed to fetch My Tasks sections:', error);
    throw error;
  }
}

/**
 * Fetches the task list GID for a user in a specific workspace.
 * @param workspaceGid - The Asana workspace ID.
 * @param settings - The plugin settings containing the Asana API token.
 * @returns The task list GID.
 */
export async function fetchUserTaskListGid(
  workspaceGid: string,
  settings: AsanaPluginSettings
) {
  const token = settings.asanaToken;

  try {
    const response = await requestUrl({
      url: `${ASANA_API_BASE_URL}/users/me/user_task_list?workspace=${workspaceGid}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      throw: false,
    });

    if (response.status >= 200 && response.status < 300) {
      return response.json.data.gid;
    } else {
      throw new Error(`Asana API Error (${response.status}): ${response.text}`);
    }
  } catch (error) {
    console.error('Failed to fetch user task list:', error);
    throw error;
  }
}
