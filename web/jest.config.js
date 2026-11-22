const nextJest = require('next/jest.js');

module.exports = nextJest({ dir: './' })({
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' }
});
