class App {
    constructor() {
        this.workspace = {
            activeLeaf: {
                view: {
                    editor: {
                        getCursor: () => ({ line: 0, ch: 0 }),
                        getLine: () => '',
                        replaceRange: jest.fn()
                    }
                }
            }
        };
    }
}

class Editor {
    constructor() {
        this.getCursor = jest.fn();
        this.getLine = jest.fn();
        this.replaceRange = jest.fn();
    }
}

class MarkdownView {
    constructor() {
        this.editor = new Editor();
    }
}

class Notice {
    constructor(message) {
        this.message = message;
    }
}

class Plugin {
    constructor(app, manifest) {
        this.app = app;
        this.manifest = manifest;
    }

    loadData() {
        return Promise.resolve({});
    }

    saveData(data) {
        return Promise.resolve();
    }
}

class PluginSettingTab {
    constructor(app, plugin) {
        this.app = app;
        this.plugin = plugin;
    }
}

class Setting {
    constructor(containerEl) {
        this.containerEl = containerEl;
    }

    setName(name) {
        this.name = name;
        return this;
    }

    setDesc(desc) {
        this.desc = desc;
        return this;
    }

    addText(callback) {
        callback({ setValue: jest.fn(), onChange: jest.fn() });
        return this;
    }

    addToggle(callback) {
        callback({ setValue: jest.fn(), onChange: jest.fn() });
        return this;
    }

    addButton(callback) {
        callback({ setButtonText: jest.fn(), onClick: jest.fn() });
        return this;
    }
}

class FuzzySuggestModal {
    constructor(app, items, resolve) {
        this.app = app;
        this.items = items;
        this.resolve = resolve;
    }

    onOpen() {}
    getItems() { return this.items; }
    getItemText(item) { return item.name; }
    onChooseItem(item) { this.resolve(item); }
}

const requestUrl = jest.fn();

module.exports = {
    App,
    Editor,
    MarkdownView,
    Notice,
    Plugin,
    PluginSettingTab,
    Setting,
    FuzzySuggestModal,
    requestUrl
}; 