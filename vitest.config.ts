import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // 全局配置
    globals: true,
    environment: 'node', // 后端测试使用 node 环境
    
    // 测试文件匹配模式
    include: [
      'tests/unit/**/*.{test,spec}.{js,ts}',
      'tests/integration/**/*.{test,spec}.{js,ts}'
    ],
    
    // 排除模式
    exclude: [
      'node_modules',
      'dist',
      'build',
      '.idea',
      '.git',
      '.cache'
    ],
    
    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: [
        'server/services/**/*.js',
        'client/src/utils/**/*.ts',
        'client/src/hooks/**/*.ts'
      ],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    
    // 测试超时
    testTimeout: 10000,
    
    // 钩子超时
    hookTimeout: 10000,
    
    // 并行测试配置
    pool: 'threads',
    
    // 全局 setup 文件
    globalSetup: ['./tests/setup/global-setup.js'],
    
    // 每个测试文件的 setup
    setupFiles: ['./tests/setup/setup.js']
  },
  
  // 解析配置
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
      '@server': path.resolve(__dirname, './server'),
      '@client': path.resolve(__dirname, './client/src'),
      '@tests': path.resolve(__dirname, './tests')
    }
  },
  
  // TypeScript 配置
  esbuild: {
    target: 'node18'
  }
});
