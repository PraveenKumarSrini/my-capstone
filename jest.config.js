const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: './' })

/** @type {import('jest').Config} */
const customConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^tests/(.*)$': '<rootDir>/tests/$1',
  },
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/src/**/*.test.tsx',
    '<rootDir>/src/**/*.test.ts',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/**/layout.tsx',   // Next.js layout wrappers — E2E scope
    '!src/app/**/page.tsx',     // Next.js page entry points — E2E scope
    '!src/middleware.ts',       // Next.js middleware — E2E scope
    '!src/worker.ts',           // Background process — integration/E2E scope
  ],
  coverageThreshold: {
    global: { lines: 80 },
  },
  // Integration tests share a single postgres-test DB — sequential execution
  // prevents clearDatabase() in one suite from racing with inserts in another.
  maxWorkers: 1,
}

module.exports = createJestConfig(customConfig)
