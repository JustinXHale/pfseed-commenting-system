#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const prompt = (questions) => {
  return new Promise((resolve) => {
    const answers = {};
    let currentIndex = 0;

    const askNext = () => {
      if (currentIndex >= questions.length) {
        rl.close();
        resolve(answers);
        return;
      }

      const q = questions[currentIndex];
      rl.question(q.message + ' ', (answer) => {
        answers[q.name] = answer.trim();
        currentIndex++;
        askNext();
      });
    };

    askNext();
  });
};

console.log('\n╔════════════════════════════════════════════════════╗');
console.log('║     Hale Commenting System - Uninstall Script      ║');
console.log('╚════════════════════════════════════════════════════╝\n');

console.log('⚠️  This will remove the Hale Commenting System from your project.\n');
console.log('The following changes will be reverted:');
console.log('  • Remove imports from src/app/index.tsx');
console.log('  • Remove imports from src/app/AppLayout/AppLayout.tsx');
console.log('  • Remove middleware from webpack.dev.js');
console.log('  • Keep .env and .env.server files (you can delete manually if needed)\n');

async function main() {
  const confirm = await prompt([
    {
      name: 'proceed',
      message: 'Do you want to proceed? (yes/no):',
    },
  ]);

  if (confirm.proceed.toLowerCase() !== 'yes' && confirm.proceed.toLowerCase() !== 'y') {
    console.log('\n❌ Uninstall cancelled.\n');
    rl.close();
    return;
  }

  console.log('\n🔧 Removing Hale Commenting System...\n');

  // Find project root
  const projectRoot = process.cwd();
  let filesModified = 0;

  // 1. Remove from src/app/index.tsx
  const indexPath = path.join(projectRoot, 'src/app/index.tsx');
  if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf8');
    const originalContent = content;

    // Remove the import
    content = content.replace(/import\s*{\s*CommentProvider\s*,\s*GitHubAuthProvider\s*}\s*from\s*["']hale-commenting-system["'];?\s*\n?/g, '');

    // Remove the providers from JSX
    content = content.replace(/<GitHubAuthProvider>\s*/g, '');
    content = content.replace(/<\/GitHubAuthProvider>/g, '');
    content = content.replace(/<CommentProvider>\s*/g, '');
    content = content.replace(/<\/CommentProvider>/g, '');

    if (content !== originalContent) {
      fs.writeFileSync(indexPath, content, 'utf8');
      console.log('✅ Removed from src/app/index.tsx');
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
    content = content.replace(/<\/CommentPanel>/g, '');
    content = content.replace(/<CommentOverlay\s*\/>\s*/g, '');

    if (content !== originalContent) {
      fs.writeFileSync(appLayoutPath, content, 'utf8');
      console.log('✅ Removed from src/app/AppLayout/AppLayout.tsx');
      filesModified++;
    }
  }

  // 3. Remove middleware from webpack.dev.js (optional - can be complex)
  const webpackPath = path.join(projectRoot, 'webpack.dev.js');
  if (fs.existsSync(webpackPath)) {
    console.log('ℹ️  webpack.dev.js - You may want to manually remove the middleware configuration');
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   ✅ Uninstall Complete!                                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log(`Modified ${filesModified} file(s)\n`);

  console.log('Next steps:');
  console.log('1. Run: npm uninstall hale-commenting-system');
  console.log('2. Restart your dev server: npm run start:dev');
  console.log('3. (Optional) Delete .env and .env.server if no longer needed\n');

  rl.close();
}

main().catch((err) => {
  console.error('❌ Error during uninstall:', err);
  rl.close();
  process.exit(1);
});
