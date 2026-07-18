/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    moduleNameMapper: {
        '^@config/(.*)$': '<rootDir>/src/config/$1',
        '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
        '^@utils/(.*)$': '<rootDir>/src/utils/$1',
        '^@modules/(.*)$': '<rootDir>/src/modules/$1',
        '^@cache/(.*)$': '<rootDir>/src/cache/$1',
        '^@common/(.*)$': '<rootDir>/src/common/$1',
        '^@routes/(.*)$': '<rootDir>/src/routes/$1',
        '^@validators/(.*)$': '<rootDir>/src/validators/$1',
    },
    testMatch: ['**/tests/unit/**/*.test.ts'],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/app.ts',
        '!src/routes/**',
    ],
}
