module.exports = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: 'src',
    testRegex: '.*\\.spec\\.ts$',
    transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
    },
    moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/$1',
        '^common/(.*)$': '<rootDir>/common/$1',
        '^modules/(.*)$': '<rootDir>/modules/$1',
        '^prisma/(.*)$': '<rootDir>/prisma/$1',
        '^utils/(.*)$': '<rootDir>/utils/$1',
        '^generated/(.*)$': '<rootDir>/../generated/$1',
    },
    testEnvironment: 'node',
};
