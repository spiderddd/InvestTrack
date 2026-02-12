/**
 * Setup file - runs before each test file
 * Import testing utilities and configure mocks here
 */

import { vi } from 'vitest';

// Mock console methods during tests to reduce noise
// Uncomment if needed
// global.console = {
//   ...console,
//   log: vi.fn(),
//   debug: vi.fn(),
//   info: vi.fn(),
//   warn: vi.fn(),
//   error: vi.fn(),
// };

// Global test utilities
global.testUtils = {
  /**
   * Compare floating point numbers with tolerance
   */
  expectCloseTo: (received, expected, precision = 2) => {
    const factor = Math.pow(10, precision);
    const roundedReceived = Math.round(received * factor) / factor;
    const roundedExpected = Math.round(expected * factor) / factor;
    return roundedReceived === roundedExpected;
  }
};

// Setup done
console.log('✅ Test setup complete');
