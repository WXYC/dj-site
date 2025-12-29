#!/usr/bin/env node

/**
 * Post-build script for Cloudflare Pages compatibility
 * Creates _worker.js and _routes.json required by Cloudflare Pages
 */

const fs = require('fs');
const path = require('path');

// Create _worker.js entry point
const workerContent = `// Cloudflare Pages _worker.js entry point
// This imports the actual OpenNext worker
import worker from '../worker.js';
export default worker;
`;

const assetsDir = path.join(__dirname, '..', '.open-next', 'assets');
const workerPath = path.join(assetsDir, '_worker.js');

try {
  fs.writeFileSync(workerPath, workerContent);
  console.log('✓ Created _worker.js for Cloudflare Pages');
} catch (error) {
  console.error('Failed to create _worker.js:', error);
  process.exit(1);
}

// Create _routes.json to route all dynamic requests to worker
const routesConfig = {
  version: 1,
  include: ["/*"],
  exclude: [
    "/_next/static/*",
    "/favicon.ico",
    "/icon.ico",
    "/*.png",
    "/*.jpg",
    "/*.jpeg",
    "/*.gif",
    "/*.svg",
    "/*.webp",
    "/fonts/*"
  ]
};

const routesPath = path.join(assetsDir, '_routes.json');

try {
  fs.writeFileSync(routesPath, JSON.stringify(routesConfig, null, 2));
  console.log('✓ Created _routes.json for Cloudflare Pages');
} catch (error) {
  console.error('Failed to create _routes.json:', error);
  process.exit(1);
}

