module.exports = {
    projects: [
        {
            // Functions tests need to run serially due to emulator contention
            displayName: 'functions',
            rootDir: __dirname,
            preset: 'ts-jest',
            testEnvironment: 'node',
            testMatch: ['**/functions.test.ts'],
            maxWorkers: 1,
            setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
        },
        {
            // All other tests can run in parallel
            displayName: 'other',
            rootDir: __dirname,
            preset: 'ts-jest',
            testEnvironment: 'node',
            testPathIgnorePatterns: ['functions.test.ts'],
            setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
        }
    ]
};
