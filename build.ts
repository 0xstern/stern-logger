#!/usr/bin/env bun
/* eslint-disable n/no-process-exit */
import fs from 'node:fs/promises';
import path from 'node:path';

import { color } from 'bun';

// ANSI Color Definitions
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const RESET_BOLD = '\x1b[22m';

const COLOR_SUCCESS = color('#95a863', 'ansi-256') ?? '';
const COLOR_ERROR = color('red', 'ansi') ?? '';

// Check Characters
const CHECK_MARK = `${COLOR_SUCCESS}✓${RESET}`;
const CROSS_MARK = `${COLOR_ERROR}✖${RESET}`;

console.log(`${BOLD}Stern Logger - Build Process${RESET_BOLD}${RESET}`);

// Configuration
const BYTES_PER_KILOBYTE = 1024;
const FILE_SIZE_DECIMAL_PLACES = 2;

const outDir = './dist';
const target = 'node' as const;
const sourcemap = 'linked' as const;
const minify = true;
const external = [
  'pino',
  'pino-pretty',
  'pino-roll',
  '@opentelemetry/api',
  'pino-abstract-transport',
];

// Entry points for different builds
const entryPoints = [
  // Main entry point
  { name: 'index', path: 'src/index.ts', outputName: 'index' },
  // Browser entry point
  {
    name: 'browser',
    path: 'src/browser/index.ts',
    outputName: 'browser/index',
  },
  // Transport entry points
  {
    name: 'loki',
    path: 'src/transports/loki.ts',
    outputName: 'transports/loki',
  },
  // Utility entry points
  {
    name: 'metrics',
    path: 'src/utils/metrics.ts',
    outputName: 'utils/metrics',
  },
];

async function cleanOutputDirectory(): Promise<void> {
  console.log(`\nCleaning output directory...${RESET}`);
  try {
    await fs.rm(outDir, { recursive: true, force: true });
    console.log(
      `  ${CHECK_MARK} Removed existing directory: ${outDir}${RESET}`,
    );
  } catch (error: unknown) {
    if (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      error.code !== 'ENOENT'
    ) {
      console.error(
        `  ${CROSS_MARK} Error during cleanup: ${COLOR_ERROR}${error}${RESET}`,
      );
      process.exit(1);
    } else {
      console.log(`  ${CHECK_MARK} Directory did not exist: ${outDir}${RESET}`);
    }
  }
  await fs.mkdir(outDir, { recursive: true });
  console.log(`  ${CHECK_MARK} Created directory: ${outDir}${RESET}`);
}

/**
 * Formats file size in kilobytes
 *
 * @param bytes - File size in bytes
 * @returns Formatted string with KB suffix
 */
function formatFileSize(bytes: number): string {
  return (bytes / BYTES_PER_KILOBYTE).toFixed(FILE_SIZE_DECIMAL_PLACES);
}

/**
 * Ensures output directory exists for an entry point
 *
 * @param entryOutputName - Output name for the entry point
 */
async function ensureOutputDir(entryOutputName: string): Promise<void> {
  const outputDir = path.dirname(path.join(outDir, entryOutputName));
  await fs.mkdir(outputDir, { recursive: true });
}

/**
 * Builds a single module in specified format
 *
 * @param entry - Entry point configuration
 * @param entry.name - Entry point name
 * @param entry.path - Entry point source path
 * @param entry.outputName - Output file name
 * @param format - Module format (esm or cjs)
 */
async function buildModule(
  entry: { name: string; path: string; outputName: string },
  format: 'esm' | 'cjs',
): Promise<void> {
  const extension = format === 'esm' ? '.mjs' : '.js';

  // Create nested directory if needed
  await ensureOutputDir(entry.outputName);

  const result = await Bun.build({
    entrypoints: [entry.path],
    outdir: outDir,
    target,
    format,
    sourcemap,
    minify,
    external,
    naming: `${entry.outputName}.js`,
  });

  if (!result.success) {
    console.error(
      `  ${CROSS_MARK} ${COLOR_ERROR}Failed to build ${entry.outputName} (${format.toUpperCase()})${RESET}`,
    );
    for (const log of result.logs) {
      console.error(`    ${COLOR_ERROR}${log.message}${RESET}`);
    }
    throw new Error(`Build failed for ${entry.outputName}`);
  }

  // Rename .js to .mjs for ESM builds
  if (format === 'esm') {
    await fs.rename(
      path.join(outDir, `${entry.outputName}.js`),
      path.join(outDir, `${entry.outputName}.mjs`),
    );
    await fs.rename(
      path.join(outDir, `${entry.outputName}.js.map`),
      path.join(outDir, `${entry.outputName}.mjs.map`),
    );
  }

  const output = result.outputs[0];
  if (output === undefined) {
    throw new Error(`No output generated for ${format} build`);
  }

  const fileSizeKB = formatFileSize(output.size);
  console.log(
    `    ${CHECK_MARK} ${entry.outputName}${extension} (${fileSizeKB} KB)${RESET}`,
  );
}

/**
 * Builds all modules in parallel (both ESM and CJS formats)
 * Significantly faster than sequential builds
 */
async function buildAllModules(): Promise<void> {
  console.log(`\n${BOLD}Building ESM modules...${RESET_BOLD}${RESET}`);

  // Build all ESM modules in parallel
  const esmPromises = entryPoints.map(async (entry) => {
    console.log(`  Building ${entry.outputName}.mjs...${RESET}`);
    return buildModule(entry, 'esm');
  });

  await Promise.all(esmPromises);

  console.log(`\n${BOLD}Building CommonJS modules...${RESET_BOLD}${RESET}`);

  // Build all CJS modules in parallel
  const cjsPromises = entryPoints.map(async (entry) => {
    console.log(`  Building ${entry.outputName}.js...${RESET}`);
    return buildModule(entry, 'cjs');
  });

  await Promise.all(cjsPromises);
}

async function buildTypes(): Promise<void> {
  console.log(
    `\n${BOLD}Generating TypeScript declarations...${RESET_BOLD}${RESET}`,
  );

  const proc = Bun.spawn(
    [
      'bunx',
      'tsc',
      '--project',
      'tsconfig.build.json',
      '--declaration',
      '--emitDeclarationOnly',
      '--outDir',
      'dist',
    ],
    { stdout: 'pipe', stderr: 'pipe' },
  );

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    console.error(
      `  ${CROSS_MARK} ${COLOR_ERROR}TypeScript compilation failed:${RESET}`,
    );
    console.error(`    ${COLOR_ERROR}${stderr}${RESET}`);
    process.exit(1);
  }

  console.log(
    `  ${CHECK_MARK} Generated type declarations in ${outDir}${RESET}`,
  );
}

/**
 * Copy static JavaScript files that are not TypeScript sources
 * These files need to be available at runtime
 */
async function copyStaticFiles(): Promise<void> {
  console.log(`\n${BOLD}Copying static files...${RESET_BOLD}${RESET}`);

  // Copy pino-pretty-formatter.js to dist/utils
  const formatterSrc = 'src/utils/pino-pretty-formatter.js';
  const formatterDest = 'dist/utils/pino-pretty-formatter.js';

  try {
    await fs.copyFile(formatterSrc, formatterDest);
    console.log(
      `  ${CHECK_MARK} Copied pino-pretty-formatter.js to ${outDir}/utils${RESET}`,
    );
  } catch (error: unknown) {
    console.error(
      `  ${CROSS_MARK} ${COLOR_ERROR}Failed to copy static files:${RESET}`,
      error,
    );
    process.exit(1);
  }
}

async function listBuildArtifacts(
  dir: string,
  prefix: string = '',
): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(dir, entry.name);
    const stats = await fs.stat(fullPath);

    if (entry.isDirectory()) {
      console.log(`  ${CHECK_MARK} ${prefix}${entry.name}/`);
      await listBuildArtifacts(fullPath, `${prefix}${entry.name}/`);
    } else {
      const sizeKB = (stats.size / BYTES_PER_KILOBYTE).toFixed(
        FILE_SIZE_DECIMAL_PLACES,
      );
      console.log(
        `  ${CHECK_MARK} ${prefix}${entry.name} (${sizeKB} KB)${RESET}`,
      );
    }
  }
}

async function executeBuildProcess(): Promise<void> {
  await cleanOutputDirectory();
  await buildAllModules();
  await buildTypes();
  await copyStaticFiles();

  console.log(`\n${BOLD}Build artifacts:${RESET_BOLD}${RESET}`);
  await listBuildArtifacts(outDir);
}

// Script Execution
executeBuildProcess()
  .then(() => {
    console.log(
      `\n${CHECK_MARK} ${BOLD}${COLOR_SUCCESS}Build completed successfully${RESET_BOLD}${RESET}`,
    );
  })
  .catch((err) => {
    console.error(
      `\n${CROSS_MARK} ${BOLD}${COLOR_ERROR}Build failed:${RESET_BOLD}${RESET}`,
      err,
    );
    process.exit(1);
  });
