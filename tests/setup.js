// Mock the global window object
global.window = {
    document: {
        createElement: jest.fn(),
        createDocumentFragment: jest.fn()
    }
};

// Mock the global document object
global.document = {
    createElement: jest.fn(),
    createDocumentFragment: jest.fn()
};

// Mock console.error to prevent test output pollution
console.error = jest.fn(); 