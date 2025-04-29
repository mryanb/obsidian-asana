module.exports = {
    testEnvironment: 'node',
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: 'tsconfig.json'
        }]
    },
    testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    moduleNameMapper: {
        '^obsidian$': '<rootDir>/tests/__mocks__/obsidian.js'
    },
    setupFiles: ['<rootDir>/tests/setup.js'],
    transformIgnorePatterns: [
        'node_modules/(?!(obsidian)/)'
    ],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/'
    ]
}; 