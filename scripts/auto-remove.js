#!/usr/bin/env node

/**
 * Automatic cleanup script that runs before npm uninstall
 * This ensures the user's app doesn't break when they uninstall the package
 */

const fs = require('fs');
const path = require('path');

// Determine project root based on where this script is running
// During preuninstall, CWD could be either:
// 1. The package directory: /path/to/project/node_modules/hale-commenting-system
// 2. The project directory: /path/to/project
let projectRoot;

if (process.cwd().includes('node_modules')) {
  // Running from inside node_modules/hale-commenting-system
  projectRoot = path.resolve(process.cwd(), '../..');
} else {
  // Running from project root
  projectRoot = process.cwd();
}

console.log('\n╔════════════════════════════════════════════════════╗');
console.log('║   Hale Commenting System - Auto Cleanup           ║');
console.log('╚════════════════════════════════════════════════════╝\n');
console.log('🧹 Removing integration before uninstall...\n');

let filesModified = 0;

try {
  // 1. Remove from src/app/index.tsx
  const indexPath = path.join(projectRoot, 'src/app/index.tsx');
  if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf8');
    const originalContent = content;

    // Remove the import
    content = content.replace(/import\s*{\s*CommentProvider\s*,\s*GitHubAuthProvider\s*}\s*from\s*["']hale-commenting-system["'];?\s*\n?/g, '');

    // Remove the providers from JSX - be more aggressive with whitespace handling
    content = content.replace(/<GitHubAuthProvider>\s*/g, '');
    content = content.replace(/\s*<\/GitHubAuthProvider>/g, '');
    content = content.replace(/<CommentProvider>\s*/g, '');
    content = content.replace(/\s*<\/CommentProvider>/g, '');

    if (content !== originalContent) {
      fs.writeFileSync(indexPath, content, 'utf8');
      console.log('✅ Cleaned up src/app/index.tsx');
      filesModified++;
    }
  }

  // 2. Remove from src/app/AppLayout/AppLayout.tsx
  const appLayoutPath = path.join(projectRoot, 'src/app/AppLayout/AppLayout.tsx');
  if (fs.existsSync(appLayoutPath)) {
    let content = fs.readFileSync(appLayoutPath, 'utf8');
    const originalContent = content;

    // Remove the import
    content = content.replace(/import\s*{\s*CommentPanel\s*,\s*CommentOverlay\s*}\s*from\s*["']hale-commenting-system["'];?\s*\n?/g, '');

    // Remove the components from JSX
    content = content.replace(/<CommentPanel>\s*/g, '');
    content = content.replace(/\s*<\/CommentPanel>/g, '');
    content = content.replace(/<CommentOverlay\s*\/>\s*/g, '');

    if (content !== originalContent) {
      fs.writeFileSync(appLayoutPath, content, 'utf8');
      console.log('✅ Cleaned up src/app/AppLayout/AppLayout.tsx');
      filesModified++;
    }
  }

  if (filesModified > 0) {
    console.log(`\n✅ Successfully cleaned up ${filesModified} file(s)`);
    console.log('   Your app will continue to work after uninstall.\n');
  } else {
    console.log('ℹ️  No integration found to clean up.\n');
  }
} catch (error) {
  // Don't block uninstall, but show the error
  console.error('⚠️  Error during automatic cleanup:');
  console.error('   ', error.message);
  console.error('\n   You may need to manually remove imports from your files.');
  console.error('   See: https://www.npmjs.com/package/hale-commenting-system#manual-uninstall\n');
}

// Always exit successfully so uninstall can proceed
process.exit(0);
