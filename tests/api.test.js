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
            },
            throw: false
        });
    });

    test('fetchAsanaWorkspaces rethrows transport errors', async () => {
        requestUrl.mockRejectedValueOnce(new Error('API Error'));

        await expect(fetchAsanaWorkspaces(mockSettings)).rejects.toThrow('API Error');
    });

    test('fetchAsanaWorkspaces surfaces the Asana error body', async () => {
        requestUrl.mockResolvedValueOnce({
            status: 401,
            text: 'Not Authorized'
        });

        await expect(fetchAsanaWorkspaces(mockSettings))
            .rejects.toThrow('Asana API Error (401): Not Authorized');
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
            url: 'https://app.asana.com/api/1.0/workspaces/workspace-1/projects?limit=100&archived=false',
            method: 'GET',
            headers: {
                Authorization: 'Bearer test-token'
            },
            throw: false
        });
    });

    // Regression guard for issue #1: Asana rejects `is_archived` with a 400,
    // which broke project listing for every user on default settings.
    test('fetchAsanaProjects filters with `archived`, never `is_archived`', async () => {
        requestUrl.mockResolvedValueOnce({ status: 200, json: { data: [] } });

        await fetchAsanaProjects('workspace-1', mockSettings);

        const { url } = requestUrl.mock.calls[0][0];
        expect(url).toContain('archived=false');
        expect(url).not.toContain('is_archived');
    });

    test('fetchAsanaProjects omits the archived filter when archived projects are shown', async () => {
        requestUrl.mockResolvedValueOnce({ status: 200, json: { data: [] } });

        await fetchAsanaProjects('workspace-1', {
            ...mockSettings,
            showArchivedProjects: true
        });

        expect(requestUrl.mock.calls[0][0].url).not.toContain('archived');
    });

    test('fetchAsanaProjects pages through next_page offsets', async () => {
        requestUrl.mockResolvedValueOnce({
            status: 200,
            json: {
                data: [{ gid: '1', name: 'Project 1' }],
                next_page: { offset: 'page-2' }
            }
        });
        requestUrl.mockResolvedValueOnce({
            status: 200,
            json: {
                data: [{ gid: '2', name: 'Project 2' }],
                next_page: null
            }
        });

        const result = await fetchAsanaProjects('workspace-1', mockSettings);

        expect(result).toEqual([
            { gid: '1', name: 'Project 1' },
            { gid: '2', name: 'Project 2' }
        ]);
        expect(requestUrl).toHaveBeenCalledTimes(2);
        expect(requestUrl.mock.calls[0][0].url).not.toContain('offset=');
        expect(requestUrl.mock.calls[1][0].url).toContain('offset=page-2');
    });

    test('fetchAsanaProjects stops if Asana repeats a cursor', async () => {
        requestUrl.mockResolvedValue({
            status: 200,
            json: {
                data: [{ gid: '1', name: 'Project 1' }],
                next_page: { offset: 'stuck' }
            }
        });

        const result = await fetchAsanaProjects('workspace-1', mockSettings);

        // Second page returns the same cursor, so pagination must terminate.
        expect(requestUrl).toHaveBeenCalledTimes(2);
        expect(result).toHaveLength(2);
    });

    test('fetchAsanaProjects surfaces the Asana error body', async () => {
        requestUrl.mockResolvedValueOnce({
            status: 400,
            text: 'Unrecognized query parameter(s): is_archived'
        });

        await expect(fetchAsanaProjects('workspace-1', mockSettings))
            .rejects.toThrow('Asana API Error (400): Unrecognized query parameter(s): is_archived');
    });

    test('fetchAsanaSections handles successful response', async () => {
        const mockSections = [{ gid: '1', name: 'Untitled section' }];
        requestUrl.mockResolvedValueOnce({
            status: 200,
            json: { data: mockSections }
        });

        const result = await fetchAsanaSections('project-1', mockSettings);
        expect(result).toEqual(mockSections);
        expect(requestUrl).toHaveBeenCalledWith({
            url: 'https://app.asana.com/api/1.0/projects/project-1/sections',
            method: 'GET',
            headers: {
                Authorization: 'Bearer test-token'
            },
            throw: false
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
            }),
            throw: false
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
            }),
            throw: false
        });

        // Verify task details fetch call
        expect(requestUrl).toHaveBeenNthCalledWith(3, {
            url: `https://app.asana.com/api/1.0/tasks/${mockTaskGid}`,
            method: 'GET',
            headers: {
                Authorization: 'Bearer test-token'
            },
            throw: false
        });
    });

    test('createTaskInAsana rethrows transport errors', async () => {
        requestUrl.mockRejectedValueOnce(new Error('API Error'));

        await expect(createTaskInAsana(
            'Test Task',
            'workspace-1',
            'project-1',
            'section-1',
            mockSettings
        )).rejects.toThrow('API Error');
    });

    test('createTaskInAsana surfaces the Asana error body', async () => {
        requestUrl.mockResolvedValueOnce({
            status: 403,
            text: 'Forbidden'
        });

        await expect(createTaskInAsana(
            'Test Task',
            'workspace-1',
            'project-1',
            'section-1',
            mockSettings
        )).rejects.toThrow('Asana API Error (403): Forbidden');
    });

    // `throw: false` makes every status our own responsibility. Without an
    // explicit check the task is created but silently never filed into the
    // chosen section, and the user still gets a success link.
    test('createTaskInAsana throws when adding the task to a section fails', async () => {
        requestUrl.mockResolvedValueOnce({
            status: 201,
            json: { data: { gid: '1234' } }
        });
        requestUrl.mockResolvedValueOnce({
            status: 404,
            text: 'section: Not a recognized ID'
        });

        await expect(createTaskInAsana(
            'Test Task',
            'workspace-1',
            'project-1',
            'section-1',
            mockSettings
        )).rejects.toThrow('Asana API Error (404): section: Not a recognized ID');
    });

    test('createTaskInAsana throws when the task details fetch fails', async () => {
        requestUrl.mockResolvedValueOnce({
            status: 201,
            json: { data: { gid: '1234' } }
        });
        requestUrl.mockResolvedValueOnce({
            status: 200,
            json: { data: { gid: '1234' } }
        });
        requestUrl.mockResolvedValueOnce({
            status: 500,
            text: 'Server Error'
        });

        await expect(createTaskInAsana(
            'Test Task',
            'workspace-1',
            'project-1',
            'section-1',
            mockSettings
        )).rejects.toThrow('Asana API Error (500): Server Error');
    });

    test('createTaskInAsana skips the section call when no section is given', async () => {
        requestUrl.mockResolvedValueOnce({
            status: 201,
            json: { data: { gid: '1234' } }
        });
        requestUrl.mockResolvedValueOnce({
            status: 200,
            json: { data: { gid: '1234', permalink_url: 'https://app.asana.com/0/1/1' } }
        });

        await createTaskInAsana('Test Task', 'workspace-1', '', '', mockSettings);

        expect(requestUrl).toHaveBeenCalledTimes(2);
        // No project means My Tasks, which assigns to the current user.
        expect(JSON.parse(requestUrl.mock.calls[0][0].body).data).toEqual({
            name: 'Test Task',
            workspace: 'workspace-1',
            assignee: 'me'
        });
    });
});
