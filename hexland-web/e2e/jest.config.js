module.exports = {
    preset: 'ts-jest',
    setupFilesAfterEnv: [
      "expect-playwright"
    ],
    testTimeout: 10000,
};
