const { App, Plugin } = require('obsidian');
const AsanaPlugin = require('../main').default;

describe('Asana Plugin', () => {
    let plugin;
    let app;

    beforeEach(async () => {
        app = new App();
        plugin = new AsanaPlugin(app, {});
        await plugin.loadSettings();
    });

    afterEach(() => {
        if (plugin.onunload) {
            plugin.onunload();
        }
    });

    test('Plugin loads successfully', () => {
        expect(plugin).toBeDefined();
        expect(plugin.settings).toBeDefined();
    });

    test('Default settings are set correctly', () => {
        expect(plugin.settings.asanaToken).toBe('');
        expect(plugin.settings.markTaskAsCompleted).toBe(false);
        expect(plugin.settings.pinnedProjects).toEqual([]);
        expect(plugin.settings.enableMarkdownLink).toBe(true);
        expect(plugin.settings.showArchivedProjects).toBe(false);
        expect(plugin.settings.pinMyTasks).toBe(true);
    });

    test('Settings can be saved and loaded', async () => {
        const testSettings = {
            asanaToken: 'test-token',
            markTaskAsCompleted: true,
            pinnedProjects: ['Project 1', 'Project 2'],
            enableMarkdownLink: false,
            showArchivedProjects: true,
            pinMyTasks: false
        };

        // Mock the loadData method to return our test settings
        plugin.loadData = jest.fn().mockResolvedValue(testSettings);
        
        // Load the settings
        await plugin.loadSettings();
        
        expect(plugin.settings).toEqual(testSettings);
    });
}); 