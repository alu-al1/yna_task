/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: "node",
  testSequencer: '<rootDir>/jest.sequencer.js',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};