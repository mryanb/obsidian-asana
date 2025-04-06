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
          workspace: workspaceGid,
          ...(projectGid ? { projects: [projectGid] } : {}), // Only include projects if projectGid is provided
          assignee: projectGid ? undefined : 'me', // Assign to me if it's a My Tasks task
        },
      }),
    });

    if (response.status >= 200 && response.status < 300) {
      const taskGid = response.json.data.gid;

      // Move task to the selected section if provided
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
    console.error('Failed to create task:', error);
    throw new Error('Failed to create task in Asana');
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
    });

    if (response.status >= 200 && response.status < 300) {
      console.log(response.json);
      return response.json.data;
    } else {
      throw new Error(`Asana API Error: ${response.text}`);
    }
  } catch (error) {
    console.error('Failed to fetch Asana user data:', error);
    throw new Error('Failed to retrieve user data from Asana');
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

  console.log(`Making API call to: ${ASANA_API_BASE_URL}/users/me/user_task_list?workspace=${workspaceGid}`);

  try {
    // First, get the user's task list for the workspace
    const taskListResponse = await requestUrl({
      url: `${ASANA_API_BASE_URL}/users/me/user_task_list?workspace=${workspaceGid}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('taskListResponse');
    console.log(taskListResponse);

    if (taskListResponse.status >= 200 && taskListResponse.status < 300) {
      const taskListGid = taskListResponse.json.data.gid;

      console.log('taskListGid');
      console.log(taskListGid);

      // Fetch sections using the same endpoint as projects, but with the task list GID
      const sectionsResponse = await requestUrl({
        url: `${ASANA_API_BASE_URL}/projects/${taskListGid}/sections`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (sectionsResponse.status >= 200 && sectionsResponse.status < 300) {
        return sectionsResponse.json.data;
      } else {
        throw new Error(`Failed to fetch sections: ${sectionsResponse.text}`);
      }
    } else {
      throw new Error(`Failed to fetch task list: ${taskListResponse.text}`);
    }
  } catch (error) {
    console.error('Failed to fetch My Tasks sections:', error);
    throw new Error('Failed to retrieve sections from My Tasks');
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
    });

    if (response.status >= 200 && response.status < 300) {
      return response.json.data.gid;
    } else {
      throw new Error(`Failed to fetch task list: ${response.text}`);
    }
  } catch (error) {
    console.error('Failed to fetch user task list:', error);
    throw new Error('Failed to retrieve user task list from Asana');
  }
}