const { requestUrl } = require('obsidian');
const { 
    fetchAsanaWorkspaces,
    fetchAsanaProjects,
    fetchAsanaSections,
    createTaskInAsana
} = require('../src/api/asanaApi');

jest.mock('obsidian', () => ({
    requestUrl: jest.fn()
}));

describe('Asana API', () => {
    const mockSettings = {
        asanaToken: 'test-token',
        showArchivedProjects: false
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('fetchAsanaWorkspaces handles successful response', async () => {
        const mockWorkspaces = [{ id: '1', name: 'Workspace 1' }];
        requestUrl.mockResolvedValueOnce({
            status: 200,
            json: { data: mockWorkspaces }
        });

        const result = await fetchAsanaWorkspaces(mockSettings);
        expect(result).toEqual(mockWorkspaces);
        expect(requestUrl).toHaveBeenCalledWith({
            url: 'https://app.asana.com/api/1.0/workspaces',
            method: 'GET',
            headers: {
                Authorization: 'Bearer test-token'
            }
        });
    });

    test('fetchAsanaWorkspaces handles error response', async () => {
        requestUrl.mockRejectedValueOnce(new Error('API Error'));

        await expect(fetchAsanaWorkspaces(mockSettings)).rejects.toThrow('Failed to retrieve workspaces from Asana');
    });

    test('fetchAsanaProjects handles successful response', async () => {
        const mockProjects = [{ id: '1', name: 'Project 1' }];
        requestUrl.mockResolvedValueOnce({
            status: 200,
            json: { data: mockProjects }
        });

        const result = await fetchAsanaProjects('workspace-1', mockSettings);
        expect(result).toEqual(mockProjects);
        expect(requestUrl).toHaveBeenCalledWith({
            url: 'https://app.asana.com/api/1.0/workspaces/workspace-1/projects?is_archived=false',
            method: 'GET',
            headers: {
                Authorization: 'Bearer test-token'
            }
        });
    });

    test('createTaskInAsana handles successful response', async () => {
        // Mock initial task creation
        const mockTaskGid = '1234';
        requestUrl.mockResolvedValueOnce({
            status: 201,
            json: { data: { gid: mockTaskGid, name: 'Test Task' } }
        });

        // Mock section addition
        requestUrl.mockResolvedValueOnce({
            status: 200,
            json: { data: { gid: mockTaskGid } }
        });

        // Mock task details fetch
        const mockTaskDetails = {
            gid: mockTaskGid,
            name: 'Test Task',
            permalink_url: 'https://app.asana.com/0/1/1'
        };
        requestUrl.mockResolvedValueOnce({
            status: 200,
            json: { data: mockTaskDetails }
        });

        const result = await createTaskInAsana(
            'Test Task',
            'workspace-1',
            'project-1',
            'section-1',
            mockSettings
        );

        expect(result).toEqual(mockTaskDetails);
        expect(requestUrl).toHaveBeenCalledTimes(3);
        
        // Verify task creation call
        expect(requestUrl).toHaveBeenNthCalledWith(1, {
            url: 'https://app.asana.com/api/1.0/tasks',
            method: 'POST',
            headers: {
                Authorization: 'Bearer test-token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: {
                    name: 'Test Task',
                    workspace: 'workspace-1',
                    projects: ['project-1'],
                    assignee: undefined
                }
            })
        });

        // Verify section addition call
        expect(requestUrl).toHaveBeenNthCalledWith(2, {
            url: 'https://app.asana.com/api/1.0/sections/section-1/addTask',
            method: 'POST',
            headers: {
                Authorization: 'Bearer test-token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: {
                    task: mockTaskGid
                }
            })
        });

        // Verify task details fetch call
        expect(requestUrl).toHaveBeenNthCalledWith(3, {
            url: `https://app.asana.com/api/1.0/tasks/${mockTaskGid}`,
            method: 'GET',
            headers: {
                Authorization: 'Bearer test-token'
            }
        });
    });

    test('createTaskInAsana handles error response', async () => {
        requestUrl.mockRejectedValueOnce(new Error('API Error'));

        await expect(createTaskInAsana(
            'Test Task',
            'workspace-1',
            'project-1',
            'section-1',
            mockSettings
        )).rejects.toThrow('Failed to create task in Asana');
    });
}); 