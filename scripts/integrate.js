#!/usr/bin/env node

/**
 * Hale Commenting System - Auto Integration Script
 * 
 * This script automatically integrates the commenting system into a PatternFly React Seed project
 * by modifying the necessary files using AST parsing.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Check Node.js version (fetch is only available natively in Node 18+)
function checkNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  
  if (majorVersion < 18) {
    console.error('❌ Error: Node.js version 18 or higher is required.');
    console.error(`   Current version: ${nodeVersion}`);
    console.error('   The webpack middleware uses native fetch() which requires Node 18+.');
    console.error('   Please upgrade Node.js: https://nodejs.org/\n');
    process.exit(1);
  }
  
  if (majorVersion === 18) {
    console.log('⚠️  Warning: Node.js 18 detected. Some features may work better with Node 20+.\n');
  }
}

// Run version check immediately
checkNodeVersion();

// Check if required dependencies are available
let parser, traverse, generate, types;
try {
  parser = require('@babel/parser').parse;
  traverse = require('@babel/traverse').default;
  generate = require('@babel/generator').default;
  types = require('@babel/types');
} catch (e) {
  console.error('❌ Error: @babel/parser, @babel/traverse, @babel/generator, and @babel/types are required.');
  console.error('   These should be included with hale-commenting-system package.');
  console.error('   If the error persists, please report this issue.');
  process.exit(1);
}

const readline = require('readline');

// Check for inquirer (better prompts)
let inquirer;
try {
  inquirer = require('inquirer');
} catch (e) {
  // Fallback to basic readline if inquirer not available
  inquirer = null;
}

// Check for node-fetch (for API validation)
let fetch;
try {
  fetch = require('node-fetch');
} catch (e) {
  fetch = null;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// Use inquirer if available, otherwise fallback to basic question
async function prompt(questions) {
  if (inquirer) {
    return await inquirer.prompt(questions);
  }
  // Fallback implementation for basic prompts
  const result = {};
  for (const q of questions) {
    let valid = false;
    let answer;
    
    while (!valid) {
      if (q.type === 'list') {
        console.log(`\n${q.message}:`);
        q.choices.forEach((choice, idx) => {
          const name = typeof choice === 'string' ? choice : choice.name;
          console.log(`  ${idx + 1}. ${name}`);
        });
        answer = await question(`Select (1-${q.choices.length}): `);
        const idx = parseInt(answer) - 1;
        if (idx >= 0 && idx < q.choices.length) {
          result[q.name] = q.choices[idx]?.value || q.choices[idx];
          valid = true;
        } else {
          console.log('   ❌ Invalid selection. Please try again.');
        }
      } else if (q.type === 'confirm') {
        answer = await question(`${q.message} (Y/n): `);
        result[q.name] = answer.toLowerCase() !== 'n' && answer.toLowerCase() !== 'no';
        valid = true;
      } else if (q.type === 'password') {
        answer = await question(`${q.message}: `);
        result[q.name] = answer;
        if (q.validate) {
          const validation = q.validate(answer);
          if (validation === true) {
            valid = true;
          } else {
            console.log(`   ❌ ${validation}`);
          }
        } else {
          valid = true;
        }
      } else {
        answer = await question(`${q.message}${q.default ? ` (${q.default})` : ''}: `);
        const value = answer.trim() || q.default || '';
        if (q.validate) {
          const validation = q.validate(value);
          if (validation === true) {
            result[q.name] = value;
            valid = true;
          } else {
            console.log(`   ❌ ${validation}`);
          }
        } else {
          result[q.name] = value;
          valid = true;
        }
      }
    }
  }
  return result;
}

function findFile(filename, startDir = process.cwd()) {
  // For index.tsx, prioritize src/app/index.tsx over src/index.tsx
  // because src/app/index.tsx contains the App component with Router
  if (filename === 'index.tsx') {
    const appIndexPath = path.join(startDir, 'src', 'app', filename);
    if (fs.existsSync(appIndexPath)) {
      return appIndexPath;
    }
  }
  
  const possiblePaths = [
    path.join(startDir, filename),
    path.join(startDir, 'src', filename),
    path.join(startDir, 'src', 'app', filename),
    // Support for AppLayout subdirectory
    path.join(startDir, 'src', 'app', 'AppLayout', filename),
  ];

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}

// ============================================================================
// Detection Functions
// ============================================================================

function detectPatternFlySeed() {
  const cwd = process.cwd();
  
  // Check for webpack config files
  const hasWebpack = 
    fs.existsSync(path.join(cwd, 'webpack.config.js')) ||
    fs.existsSync(path.join(cwd, 'webpack.dev.js')) ||
    fs.existsSync(path.join(cwd, 'webpack.common.js'));

  // Check for src/app directory
  const hasAppDir = fs.existsSync(path.join(cwd, 'src', 'app'));

  // Check for PatternFly dependencies in package.json
  let hasPatternFly = false;
  try {
    const packageJsonPath = path.join(cwd, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      hasPatternFly = !!(
        deps['@patternfly/react-core'] ||
        deps['@patternfly/react-icons']
      );
    }
  } catch {
    // Ignore errors
  }

  return hasWebpack && hasAppDir && hasPatternFly;
}

function detectGitRemote() {
  const cwd = process.cwd();
  
  // Check if .git exists
  if (!fs.existsSync(path.join(cwd, '.git'))) {
    return null;
  }

  try {
    // Get remote URL
    const remoteUrl = execSync('git remote get-url origin', { 
      cwd, 
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();

    if (!remoteUrl) {
      return null;
    }

    // Parse GitHub URL (supports https://, git@, and ssh formats)
    const githubMatch = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
    
    if (githubMatch) {
      const owner = githubMatch[1];
      const repo = githubMatch[2].replace(/\.git$/, '');
      
      // Try to detect if it's a fork by checking if upstream exists
      let isFork = false;
      try {
        execSync('git remote get-url upstream', { 
          cwd, 
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore']
        });
        isFork = true;
      } catch {
        // Check if repo name matches patternfly-react-seed (likely a fork)
        isFork = repo.includes('patternfly-react-seed') || repo.includes('pfseed');
      }

      return {
        owner,
        repo,
        url: remoteUrl,
        isFork
      };
    }
  } catch (error) {
    // Git command failed or not a git repo
    return null;
  }

  return null;
}

function detectProjectSetup() {
  const gitInfo = detectGitRemote();
  
  if (!gitInfo) {
    return 'none';
  }

  // Check if it looks like a fork (has patternfly-react-seed in name or has upstream)
  if (gitInfo.isFork || gitInfo.repo?.includes('patternfly-react-seed')) {
    return 'forked';
  }

  // Check if it's a clone of the original
  if (gitInfo.owner === 'patternfly' && gitInfo.repo === 'patternfly-react-seed') {
    return 'cloned';
  }

  // Has git remote but unclear
  return 'unknown';
}

// ============================================================================
// Validation Functions
// ============================================================================

async function validateGitHubCredentials(clientId, clientSecret, owner, repo) {
  if (!fetch) {
    console.log('   ⚠️  node-fetch not available, skipping validation');
    return true; // Skip validation if fetch not available
  }

  try {
    const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
    const response = await fetch(repoUrl, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'hale-commenting-system'
      }
    });

    if (response.ok) {
      return true;
    }

    if (response.status === 404) {
      console.error(`   Repository ${owner}/${repo} not found or not accessible`);
      return false;
    }

    console.error(`   GitHub API error: ${response.status}`);
    return false;
  } catch (error) {
    console.error(`   Error validating GitHub: ${error.message}`);
    return false;
  }
}

async function validateJiraCredentials(baseUrl, apiToken, email) {
  if (!fetch) {
    console.log('   ⚠️  node-fetch not available, skipping validation');
    return true; // Skip validation if fetch not available
  }

  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/rest/api/2/myself`;
    
    const authHeader = email
      ? `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`
      : `Bearer ${apiToken}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
        'User-Agent': 'hale-commenting-system'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Authenticated as: ${data.displayName || data.name || 'User'}`);
      return true;
    }

    if (response.status === 401 || response.status === 403) {
      console.error(`   Authentication failed. Check your token and email (if required).`);
      return false;
    }

    console.error(`   Jira API error: ${response.status}`);
    return false;
  } catch (error) {
    console.error(`   Error validating Jira: ${error.message}`);
    return false;
  }
}

// ============================================================================
// File Generation Functions
// ============================================================================

function generateFiles(config) {
  const cwd = process.cwd();

  // Generate .env file (client-safe)
  const envPath = path.join(cwd, '.env');
  
  let envContent = `# Hale Commenting System Configuration
# Client-safe environment variables (these are exposed to the browser)

`;

  if (config.github && config.github.clientId) {
    envContent += `# GitHub OAuth (client-side; safe to expose)
# Get your Client ID from: https://github.com/settings/developers
# 1. Click "New OAuth App"
# 2. Fill in the form (Homepage: http://localhost:9000, Callback: http://localhost:9000/api/github-oauth-callback)
# 3. Copy the Client ID
VITE_GITHUB_CLIENT_ID=${config.github.clientId}

# Target repo for Issues/Comments
VITE_GITHUB_OWNER=${config.github.owner || config.owner}
VITE_GITHUB_REPO=${config.github.repo || config.repo}

`;
  } else {
    envContent += `# GitHub OAuth (client-side; safe to expose)
# Get your Client ID from: https://github.com/settings/developers
# 1. Click "New OAuth App"
# 2. Fill in the form (Homepage: http://localhost:9000, Callback: http://localhost:9000/api/github-oauth-callback)
# 3. Copy the Client ID
VITE_GITHUB_CLIENT_ID=

# Target repo for Issues/Comments
VITE_GITHUB_OWNER=${config.owner}
VITE_GITHUB_REPO=${config.repo}

`;
  }

  if (config.jira && config.jira.baseUrl) {
    envContent += `# Jira Base URL
# For Red Hat Jira, use: https://issues.redhat.com
VITE_JIRA_BASE_URL=${config.jira.baseUrl}
`;
  } else {
    envContent += `# Jira Base URL
# For Red Hat Jira, use: https://issues.redhat.com
VITE_JIRA_BASE_URL=
`;
  }

  // Check if .env exists and append or create
  if (fs.existsSync(envPath)) {
    const existing = fs.readFileSync(envPath, 'utf-8');
    // Only add if not already present
    if (!existing.includes('VITE_GITHUB_CLIENT_ID')) {
      fs.appendFileSync(envPath, '\n' + envContent);
      console.log('   ✅ Updated .env file');
    } else {
      console.log('   ⚠️  .env already contains commenting system config');
    }
  } else {
    fs.writeFileSync(envPath, envContent);
    console.log('   ✅ Created .env file');
  }
  
  // Note about empty values
  if (!config.github || !config.jira) {
    console.log('   ℹ️  Some values are empty - see comments in .env for setup instructions');
  }

  // Generate .env.server file (secrets)
  const envServerPath = path.join(cwd, '.env.server');
  
  let envServerContent = `# Hale Commenting System - Server Secrets
# ⚠️  DO NOT COMMIT THIS FILE - It contains sensitive credentials
# This file is automatically added to .gitignore

`;

  if (config.github && config.github.clientSecret) {
    envServerContent += `# GitHub OAuth Client Secret (server-only)
# Get this from your GitHub OAuth App settings: https://github.com/settings/developers
# Click on your OAuth App, then "Generate a new client secret"
GITHUB_CLIENT_SECRET=${config.github.clientSecret}

`;
  } else {
    envServerContent += `# GitHub OAuth Client Secret (server-only)
# Get this from your GitHub OAuth App settings: https://github.com/settings/developers
# Click on your OAuth App, then "Generate a new client secret"
GITHUB_CLIENT_SECRET=

`;
  }

  if (config.jira && config.jira.apiToken) {
    envServerContent += `# Jira API Token (server-only)
# For Red Hat Jira, generate a Personal Access Token:
# 1. Visit: https://issues.redhat.com/secure/ViewProfile.jspa
# 2. Click "Personal Access Tokens" in the left sidebar
# 3. Click "Create token"
# 4. Give it a name and remove expiration
# 5. Copy the token
JIRA_API_TOKEN=${config.jira.apiToken}
`;
  } else {
    envServerContent += `# Jira API Token (server-only)
# For Red Hat Jira, generate a Personal Access Token:
# 1. Visit: https://issues.redhat.com/secure/ViewProfile.jspa
# 2. Click "Personal Access Tokens" in the left sidebar
# 3. Click "Create token"
# 4. Give it a name and remove expiration
# 5. Copy the token
JIRA_API_TOKEN=
`;
  }

  if (config.jira && config.jira.email) {
    envServerContent += `JIRA_EMAIL=${config.jira.email}\n`;
  }

  if (fs.existsSync(envServerPath)) {
    const existing = fs.readFileSync(envServerPath, 'utf-8');
    if (!existing.includes('GITHUB_CLIENT_SECRET')) {
      fs.appendFileSync(envServerPath, '\n' + envServerContent);
      console.log('   ✅ Updated .env.server file');
    } else {
      console.log('   ⚠️  .env.server already contains commenting system config');
    }
  } else {
    fs.writeFileSync(envServerPath, envServerContent);
    console.log('   ✅ Created .env.server file');
  }
  
  // Note about empty values
  if (!config.github || !config.jira) {
    console.log('   ℹ️  Some values are empty - see comments in .env.server for setup instructions');
  }

  // Ensure .env.server is in .gitignore
  const gitignorePath = path.join(cwd, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
    if (!gitignore.includes('.env.server')) {
      fs.appendFileSync(gitignorePath, '\n.env.server\n');
      console.log('   ✅ Added .env.server to .gitignore');
    }
  } else {
    fs.writeFileSync(gitignorePath, '.env.server\n');
    console.log('   ✅ Created .gitignore with .env.server');
  }
}

function createCommentsComponent() {
  const cwd = process.cwd();
  const commentsDir = path.join(cwd, 'src', 'app', 'Comments');
  const commentsFile = path.join(commentsDir, 'Comments.tsx');

  // Check if already exists
  if (fs.existsSync(commentsFile)) {
    return; // Already exists, skip
  }

  // Create directory if it doesn't exist
  if (!fs.existsSync(commentsDir)) {
    fs.mkdirSync(commentsDir, { recursive: true });
  }

  // Read the Comments component from the package and modify the import
  // The file is in the package at src/app/Comments/Comments.tsx
  const scriptDir = __dirname || path.dirname(require.resolve('./integrate.js'));
  const packageCommentsFile = path.join(scriptDir, '..', 'src', 'app', 'Comments', 'Comments.tsx');
  
  let commentsComponentContent;
  if (fs.existsSync(packageCommentsFile)) {
    // Read from package and replace import path
    commentsComponentContent = fs.readFileSync(packageCommentsFile, 'utf8')
      .replace(/from ['"]@app\/commenting-system['"]/g, "from 'hale-commenting-system'");
  } else {
    // Fallback: create a minimal version (shouldn't happen if package is properly built)
    console.log('   ⚠️  Comments component not found in package, skipping creation');
    return;
  }

  fs.writeFileSync(commentsFile, commentsComponentContent);
  console.log('   ✅ Created Comments component');
}

function integrateWebpackMiddleware() {
  const cwd = process.cwd();
  const webpackDevPath = path.join(cwd, 'webpack.dev.js');

  if (!fs.existsSync(webpackDevPath)) {
    console.log('   ⚠️  webpack.dev.js not found. Cannot auto-integrate.');
    return;
  }

  // Read webpack.dev.js
  let webpackContent = fs.readFileSync(webpackDevPath, 'utf-8');

  // Check if already integrated
  if (webpackContent.includes('/api/github-oauth-callback') || webpackContent.includes('/api/jira-issue')) {
    console.log('   ⚠️  webpack.dev.js already appears to have commenting system integration');
    return;
  }

  // Webpack middleware template (inline since we don't have a separate template file)
  // Note: This middleware uses native fetch() which requires Node.js 18+
  const middlewareCode = `
      // Load env vars for local OAuth/token exchange without bundling secrets into the client.
      // Note: Requires Node.js 18+ for native fetch() support
      try {
        const dotenv = require('dotenv');
        dotenv.config({ path: path.resolve(__dirname, '.env') });
        dotenv.config({ path: path.resolve(__dirname, '.env.server'), override: true });
      } catch (e) {
        // no-op
      }

      const express = require('express');
      devServer.app.use(express.json());

      // GitHub OAuth Callback
      devServer.app.get('/api/github-oauth-callback', async (req, res) => {
        try {
          const code = req.query.code;
          if (!code) {
            return res.status(400).send('Missing ?code from GitHub OAuth callback.');
          }

          const clientId = process.env.VITE_GITHUB_CLIENT_ID;
          const clientSecret = process.env.GITHUB_CLIENT_SECRET;

          if (!clientId || !clientSecret) {
            return res.status(500).send('Missing GitHub OAuth credentials.');
          }

          const tokenResp = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              client_id: clientId,
              client_secret: clientSecret,
              code,
            }),
          });

          const tokenData = await tokenResp.json();
          if (!tokenResp.ok || tokenData.error) {
            return res.status(500).send(\`OAuth token exchange failed: \${tokenData.error || tokenResp.statusText}\`);
          }

          const accessToken = tokenData.access_token;
          if (!accessToken) {
            return res.status(500).send('OAuth token exchange did not return an access_token.');
          }

          const userResp = await fetch('https://api.github.com/user', {
            headers: {
              'Accept': 'application/vnd.github+json',
              'Authorization': \`token \${accessToken}\`,
              'User-Agent': 'hale-commenting-system',
            },
          });
          const user = await userResp.json();
          if (!userResp.ok) {
            return res.status(500).send(\`Failed to fetch GitHub user: \${user.message || userResp.statusText}\`);
          }

          const login = encodeURIComponent(user.login || '');
          const avatar = encodeURIComponent(user.avatar_url || '');
          const token = encodeURIComponent(accessToken);

          return res.redirect(\`/#/auth-callback?token=\${token}&login=\${login}&avatar=\${avatar}\`);
        } catch (err) {
          console.error(err);
          return res.status(500).send('Unhandled OAuth callback error. See dev server logs.');
        }
      });

      // GitHub API Proxy
      devServer.app.post('/api/github-api', async (req, res) => {
        try {
          const { token, method, endpoint, data } = req.body || {};
          if (!token) return res.status(401).json({ message: 'Missing token' });
          if (!method || !endpoint) return res.status(400).json({ message: 'Missing method or endpoint' });

          const url = \`https://api.github.com\${endpoint}\`;
          const resp = await fetch(url, {
            method,
            headers: {
              'Accept': 'application/vnd.github+json',
              'Authorization': \`token \${token}\`,
              'User-Agent': 'hale-commenting-system',
              ...(data ? { 'Content-Type': 'application/json' } : {}),
            },
            body: data ? JSON.stringify(data) : undefined,
          });

          const text = await resp.text();
          const maybeJson = (() => {
            try {
              return JSON.parse(text);
            } catch {
              return text;
            }
          })();

          return res.status(resp.status).json(maybeJson);
        } catch (err) {
          console.error(err);
          return res.status(500).json({ message: 'Unhandled github-api proxy error. See dev server logs.' });
        }
      });

      // Jira Issue Proxy
      devServer.app.get('/api/jira-issue', async (req, res) => {
        try {
          const key = String(req.query.key || '').trim();
          if (!key) return res.status(400).json({ message: 'Missing ?key (e.g. ABC-123)' });

          const baseUrl = (process.env.VITE_JIRA_BASE_URL || 'https://issues.redhat.com').replace(/\\/+$/, '');
          const email = process.env.JIRA_EMAIL;
          const token = process.env.JIRA_API_TOKEN;

          if (!token) {
            return res.status(500).json({
              message: 'Missing JIRA_API_TOKEN. For local dev, put it in .env.server (gitignored).',
            });
          }

          const authHeader = email
            ? \`Basic \${Buffer.from(\`\${email}:\${token}\`).toString('base64')}\`
            : \`Bearer \${token}\`;

          const buildUrl = (apiVersion) =>
            \`\${baseUrl}/rest/api/\${apiVersion}/issue/\${encodeURIComponent(key)}?fields=summary,status,assignee,issuetype,priority,created,updated,description&expand=renderedFields\`;

          const commonHeaders = {
            'Accept': 'application/json',
            'Authorization': authHeader,
            'User-Agent': 'hale-commenting-system',
          };

          const fetchOnce = async (apiVersion) => {
            const r = await fetch(buildUrl(apiVersion), { headers: commonHeaders, redirect: 'manual' });
            const text = await r.text();
            const contentType = String(r.headers.get('content-type') || '');
            const looksLikeHtml =
              contentType.includes('text/html') ||
              String(text || '').trim().startsWith('<');
            return { r, text, contentType, looksLikeHtml };
          };

          const preferV2 = baseUrl.includes('issues.redhat.com');
          const firstVersion = preferV2 ? '2' : '3';
          const secondVersion = preferV2 ? '3' : '2';

          let attempt = await fetchOnce(firstVersion);
          if (
            attempt.r.status === 404 ||
            attempt.r.status === 302 ||
            attempt.looksLikeHtml ||
            attempt.r.status === 401 ||
            attempt.r.status === 403
          ) {
            const fallback = await fetchOnce(secondVersion);
            if (fallback.r.ok || attempt.looksLikeHtml || attempt.r.status === 302) {
              attempt = fallback;
            }
          }

          const resp = attempt.r;
          const payloadText = attempt.text;
          const contentType = attempt.contentType;

          const payload = (() => {
            try {
              return JSON.parse(payloadText);
            } catch {
              return { message: payloadText };
            }
          })();

          if (!resp.ok) {
            const looksLikeHtml =
              contentType.includes('text/html') ||
              String(payloadText || '').trim().startsWith('<');

            if (looksLikeHtml) {
              return res.status(resp.status).json({
                message:
                  resp.status === 401 || resp.status === 403
                    ? 'Unauthorized to Jira. Your token/auth scheme may be incorrect for this Jira instance.'
                    : \`Jira request failed (\${resp.status}).\`,
                hint: email
                  ? 'You are using Basic auth (JIRA_EMAIL + JIRA_API_TOKEN). If this Jira uses PAT/Bearer tokens, remove JIRA_EMAIL and set only JIRA_API_TOKEN.'
                  : baseUrl.includes('issues.redhat.com')
                    ? 'You are using Bearer auth (JIRA_API_TOKEN). For issues.redhat.com, ensure you are using a PAT that works with REST API v2 and that JIRA_EMAIL is NOT set.'
                    : 'You are using Bearer auth (JIRA_API_TOKEN). If this Jira uses Jira Cloud API tokens, set JIRA_EMAIL as well.',
              });
            }

            return res.status(resp.status).json({
              message: payload?.message || \`Jira request failed (\${resp.status}).\`,
            });
          }

          const issue = payload;
          const fields = issue.fields || {};
          const renderedFields = issue.renderedFields || {};

          return res.json({
            key: issue.key,
            url: \`\${baseUrl}/browse/\${issue.key}\`,
            summary: fields.summary || '',
            status: fields.status?.name || '',
            assignee: fields.assignee?.displayName || '',
            issueType: fields.issuetype?.name || '',
            priority: fields.priority?.name || '',
            created: fields.created || '',
            updated: fields.updated || '',
            description: renderedFields.description || fields.description || '',
          });
        } catch (err) {
          console.error(err);
          return res.status(500).json({ message: 'Unhandled jira-issue proxy error. See dev server logs.' });
        }
      });
`;

  // Find the setupMiddlewares function and inject our code
  // Try multiple patterns to match different webpack.dev.js structures
  const setupMiddlewaresPatterns = [
    /(setupMiddlewares\s*:\s*\([^)]+\)\s*=>\s*\{)/,  // Arrow function
    /(setupMiddlewares\s*:\s*function\s*\([^)]+\)\s*\{)/,  // Function declaration
    /(setupMiddlewares\s*:\s*\([^)]+\)\s*\{)/,  // Shorthand method
  ];
  
  let match = null;
  for (const pattern of setupMiddlewaresPatterns) {
    match = webpackContent.match(pattern);
    if (match) break;
  }

  if (!match) {
    // If setupMiddlewares doesn't exist, we need to add it to devServer config
    // Check if devServer config exists
    const devServerMatch = webpackContent.match(/(devServer\s*:\s*\{)/);
    if (devServerMatch) {
      // Add setupMiddlewares to devServer config
      const insertIndex = devServerMatch.index + devServerMatch[0].length;
      const before = webpackContent.substring(0, insertIndex);
      const after = webpackContent.substring(insertIndex);
      
      const setupMiddlewaresCode = `
    setupMiddlewares: (middlewares, devServer) => {
      if (!devServer || !devServer.app) {
        return middlewares;
      }
${middlewareCode}
      return middlewares;
    },`;
      
      webpackContent = before + setupMiddlewaresCode + '\n' + after;
      fs.writeFileSync(webpackDevPath, webpackContent);
      console.log('   ✅ Added setupMiddlewares to webpack.dev.js');
      return;
    } else {
      console.log('   ⚠️  Could not find setupMiddlewares or devServer config in webpack.dev.js');
      console.log('   📋 Manual integration required. See webpack middleware documentation\n');
      return;
    }
  }

  // Find where to inject (after express.json() setup, before return middlewares)
  const expressJsonMatch = webpackContent.match(/devServer\.app\.use\(express\.json\(\)\);/);
  
  if (expressJsonMatch) {
    // Inject after express.json()
    const insertIndex = expressJsonMatch.index + expressJsonMatch[0].length;
    const before = webpackContent.substring(0, insertIndex);
    const after = webpackContent.substring(insertIndex);
    
    webpackContent = before + middlewareCode + '\n' + after;
    fs.writeFileSync(webpackDevPath, webpackContent);
    console.log('   ✅ Updated webpack.dev.js with server middleware');
  } else {
    // Try to inject at the beginning of setupMiddlewares
    const insertIndex = match.index + match[0].length;
    const before = webpackContent.substring(0, insertIndex);
    const after = webpackContent.substring(insertIndex);
    
    // Add dotenv loading and express setup if not present
    let fullMiddlewareCode = middlewareCode;
    
    // Check if dotenv is already loaded
    if (!webpackContent.includes('dotenv.config')) {
      fullMiddlewareCode = `// Load env vars for local OAuth/token exchange
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.resolve(__dirname, '.env') });
  dotenv.config({ path: path.resolve(__dirname, '.env.server'), override: true });
} catch (e) {
  // no-op
}

const express = require('express');
devServer.app.use(express.json());

` + middlewareCode;
    } else if (!webpackContent.includes('express.json()')) {
      fullMiddlewareCode = `const express = require('express');
devServer.app.use(express.json());

` + middlewareCode;
    }

    webpackContent = before + '\n' + fullMiddlewareCode + '\n' + after;
    fs.writeFileSync(webpackDevPath, webpackContent);
    console.log('   ✅ Updated webpack.dev.js with server middleware');
  }
}

function getPackageVersion() {
  try {
    // Get the script's directory and find package.json relative to it
    const scriptDir = __dirname || path.dirname(require.resolve('./integrate.js'));
    const packageJsonPath = path.join(scriptDir, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version || 'unknown';
  } catch (e) {
    // Fallback: try to find package.json in current working directory or parent
    try {
      const cwdPackageJson = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(cwdPackageJson)) {
        const packageJson = JSON.parse(fs.readFileSync(cwdPackageJson, 'utf8'));
        if (packageJson.name === 'hale-commenting-system') {
          return packageJson.version || 'unknown';
        }
      }
    } catch (e2) {
      // ignore
    }
    return 'unknown';
  }
}

function modifyIndexTsx(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check if already integrated
  if (content.includes('CommentProvider') && content.includes('GitHubAuthProvider')) {
    console.log('   ⚠️  Already integrated (providers found)');
    return false;
  }

  try {
    const ast = parser(content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties']
    });

    let hasCommentProvider = false;
    let hasGitHubAuthProvider = false;
    let hasCommentImport = false;
    let routerElement = null;

    // Check existing imports and find Router element
    traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value;
        if (source.includes('commenting-system') || source.includes('@app/commenting-system') || source.includes('hale-commenting-system')) {
          hasCommentImport = true;
          // Check if providers are imported
          path.node.specifiers.forEach(spec => {
            if (spec.imported && spec.imported.name === 'CommentProvider') {
              hasCommentProvider = true;
            }
            if (spec.imported && spec.imported.name === 'GitHubAuthProvider') {
              hasGitHubAuthProvider = true;
            }
          });
        }
      },
      JSXElement(path) {
        if (path.node.openingElement.name.name === 'Router') {
          routerElement = path;
        }
      }
    });

    // Add imports if missing
    if (!hasCommentImport) {
      // Find last import declaration
      let lastImportIndex = -1;
      for (let i = ast.program.body.length - 1; i >= 0; i--) {
        if (ast.program.body[i].type === 'ImportDeclaration') {
          lastImportIndex = i;
          break;
        }
      }
      const importIndex = lastImportIndex >= 0 ? lastImportIndex + 1 : 0;
      
      const providerImports = types.importDeclaration(
        [
          types.importSpecifier(types.identifier('CommentProvider'), types.identifier('CommentProvider')),
          types.importSpecifier(types.identifier('GitHubAuthProvider'), types.identifier('GitHubAuthProvider'))
        ],
        types.stringLiteral('hale-commenting-system')
      );
      
      ast.program.body.splice(importIndex, 0, providerImports);
    } else if (!hasCommentProvider || !hasGitHubAuthProvider) {
      // Update existing import
      traverse(ast, {
        ImportDeclaration(path) {
          const source = path.node.source.value;
          if (source.includes('commenting-system') || source.includes('@app/commenting-system') || source.includes('hale-commenting-system')) {
            const specifiers = path.node.specifiers || [];
            if (!hasCommentProvider) {
              specifiers.push(types.importSpecifier(types.identifier('CommentProvider'), types.identifier('CommentProvider')));
            }
            if (!hasGitHubAuthProvider) {
              specifiers.push(types.importSpecifier(types.identifier('GitHubAuthProvider'), types.identifier('GitHubAuthProvider')));
            }
            path.node.specifiers = specifiers;
          }
        }
      });
    }

    // Wrap Router content with providers
    if (routerElement) {
      const routerChildren = routerElement.node.children;
      
      // Check if already wrapped
      if (routerChildren.length > 0 && 
          routerChildren[0].type === 'JSXElement' && 
          routerChildren[0].openingElement.name.name === 'GitHubAuthProvider') {
        console.log('   ⚠️  Already integrated (providers found in JSX)');
        return false;
      }

      // Create provider wrappers
      const commentProvider = types.jsxElement(
        types.jsxOpeningElement(types.jsxIdentifier('CommentProvider'), []),
        types.jsxClosingElement(types.jsxIdentifier('CommentProvider')),
        routerChildren
      );

      const gitHubAuthProvider = types.jsxElement(
        types.jsxOpeningElement(types.jsxIdentifier('GitHubAuthProvider'), []),
        types.jsxClosingElement(types.jsxIdentifier('GitHubAuthProvider')),
        [commentProvider]
      );

      routerElement.node.children = [gitHubAuthProvider];
    }

    const output = generate(ast, {
      retainLines: false,
      compact: false
    }, content);

    fs.writeFileSync(filePath, output.code);
    return true;
  } catch (error) {
    console.error(`   ❌ Error modifying ${filePath}:`, error.message);
    return false;
  }
}

function modifyRoutesTsx(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check if Comments route already exists with actual routes
  // Use a more sophisticated check that looks for the route path
  if (content.includes("label: 'Comments'") || content.includes('label: "Comments"')) {
    // Check if it has routes with the /comments path
    if (content.includes("path: '/comments'") || content.includes('path: "/comments"')) {
      console.log('   ⚠️  Already integrated (Comments route found)');
      return false;
    }
    // If Comments group exists but has no routes, continue to add them
    console.log('   ℹ️  Comments group exists but has no routes, adding route...');
  }

  try {
    const ast = parser(content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties']
    });

    let routesArray = null;

    traverse(ast, {
      VariableDeclarator(path) {
        if (path.node.id.name === 'routes' && path.node.init.type === 'ArrayExpression') {
          routesArray = path.node.init;
        }
      }
    });

    if (routesArray) {
      // Check if Comments component is imported
      let hasCommentsImport = false;
      let commentsImportName = 'Comments';
      
      traverse(ast, {
        ImportDeclaration(path) {
          const source = path.node.source.value;
          if (source.includes('Comments') || source.includes('@app/Comments')) {
            hasCommentsImport = true;
            // Get the imported name
            path.node.specifiers.forEach(spec => {
              if (spec.type === 'ImportSpecifier' && spec.imported.name === 'Comments') {
                commentsImportName = spec.local.name;
              }
            });
          }
        }
      });

      // Add Comments import if missing
      if (!hasCommentsImport) {
        let lastImportIndex = -1;
        for (let i = ast.program.body.length - 1; i >= 0; i--) {
          if (ast.program.body[i].type === 'ImportDeclaration') {
            lastImportIndex = i;
            break;
          }
        }
        const importIndex = lastImportIndex >= 0 ? lastImportIndex + 1 : 0;
        
        const commentsImport = types.importDeclaration(
          [types.importSpecifier(types.identifier('Comments'), types.identifier('Comments'))],
          types.stringLiteral('@app/Comments/Comments')
        );
        
        ast.program.body.splice(importIndex, 0, commentsImport);
      }

      // Check if Comments route group already exists
      let existingCommentsGroup = null;
      let existingCommentsRoutes = null;
      
      for (const element of routesArray.elements) {
        if (element.type === 'ObjectExpression') {
          const labelProp = element.properties.find(
            prop => prop.key && prop.key.name === 'label' && 
            prop.value && prop.value.value === 'Comments'
          );
          if (labelProp) {
            existingCommentsGroup = element;
            const routesProp = element.properties.find(
              prop => prop.key && prop.key.name === 'routes'
            );
            if (routesProp && routesProp.value.type === 'ArrayExpression') {
              existingCommentsRoutes = routesProp.value;
            }
            break;
          }
        }
      }

      // Create the Comments route item
      const commentsRouteElement = types.jsxElement(
        types.jsxOpeningElement(types.jsxIdentifier(commentsImportName), [], true),
        null,
        []
      );

      const commentsRouteItem = types.objectExpression([
        types.objectProperty(types.identifier('element'), commentsRouteElement),
        types.objectProperty(types.identifier('exact'), types.booleanLiteral(true)),
        types.objectProperty(types.identifier('label'), types.stringLiteral('View all')),
        types.objectProperty(types.identifier('path'), types.stringLiteral('/comments')),
        types.objectProperty(types.identifier('title'), types.stringLiteral('Hale Commenting System | Comments'))
      ]);

      if (existingCommentsGroup && existingCommentsRoutes) {
        // Add route to existing Comments group
        existingCommentsRoutes.elements.push(commentsRouteItem);
      } else {
        // Create new Comments route group
        const commentsRoute = types.objectExpression([
          types.objectProperty(types.identifier('label'), types.stringLiteral('Comments')),
          types.objectProperty(types.identifier('routes'), types.arrayExpression([commentsRouteItem]))
        ]);
        routesArray.elements.push(commentsRoute);
      }
    }

    const output = generate(ast, {
      retainLines: false,
      compact: false
    }, content);

    fs.writeFileSync(filePath, output.code);
    return true;
  } catch (error) {
    console.error(`   ❌ Error modifying ${filePath}:`, error.message);
    return false;
  }
}

function modifyAppLayoutTsx(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Check if already integrated - look for the comprehensive integration
  if (content.includes('useComments') && content.includes('useGitHubAuth') &&
      content.includes('setCommentsEnabled') && content.includes('setFloatingWidgetMode')) {
    console.log('   ⚠️  Already integrated (full commenting system controls found)');
    return false;
  }

  try {
    // Step 1: Add imports using string manipulation (more reliable for complex imports)

    // Check and add PatternFly imports
    const patternflyImportRegex = /from\s+['"]@patternfly\/react-core['"]/;
    const patternflyMatch = content.match(patternflyImportRegex);

    if (patternflyMatch) {
      // Find the import statement
      const importMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+['"]@patternfly\/react-core['"]/);
      if (importMatch) {
        const imports = importMatch[1];
        // Add Switch if not present
        if (!imports.includes('Switch')) {
          const newImports = imports.trim() + ',\n  Switch';
          content = content.replace(
            /import\s+\{([^}]+)\}\s+from\s+['"]@patternfly\/react-core['"]/,
            `import {${newImports}\n} from '@patternfly/react-core'`
          );
        }
      }
    }

    // Check and add PatternFly icons imports
    const iconsImportRegex = /from\s+['"]@patternfly\/react-icons['"]/;
    const iconsMatch = content.match(iconsImportRegex);

    if (iconsMatch) {
      const importMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+['"]@patternfly\/react-icons['"]/);
      if (importMatch) {
        const imports = importMatch[1];
        // Add icons if not present
        let newImports = imports.trim();
        if (!imports.includes('ExternalLinkAltIcon')) {
          newImports += ', ExternalLinkAltIcon';
        }
        if (!imports.includes('GithubIcon')) {
          newImports += ', GithubIcon';
        }
        if (newImports !== imports.trim()) {
          content = content.replace(
            /import\s+\{([^}]+)\}\s+from\s+['"]@patternfly\/react-icons['"]/,
            `import { ${newImports} } from '@patternfly/react-icons'`
          );
        }
      }
    }

    // Add commenting system imports
    if (!content.includes('hale-commenting-system')) {
      // Find where to insert (after other imports)
      const lastImportMatch = content.match(/import[^;]*;(?=\s*(?:interface|const|export|function))/g);
      if (lastImportMatch) {
        const lastImport = lastImportMatch[lastImportMatch.length - 1];
        const insertPos = content.indexOf(lastImport) + lastImport.length;
        const commentingImport = `\nimport { CommentOverlay, CommentPanel, useComments, useGitHubAuth } from "hale-commenting-system";`;
        content = content.slice(0, insertPos) + commentingImport + content.slice(insertPos);
      }
    } else {
      // Update existing import to include all needed items
      const commentingImportMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+["']hale-commenting-system["']/);
      if (commentingImportMatch) {
        const imports = commentingImportMatch[1];
        let newImports = imports.split(',').map(i => i.trim());

        const needed = ['CommentOverlay', 'CommentPanel', 'useComments', 'useGitHubAuth'];
        needed.forEach(item => {
          if (!newImports.includes(item)) {
            newImports.push(item);
          }
        });

        content = content.replace(
          /import\s+\{[^}]+\}\s+from\s+["']hale-commenting-system["']/,
          `import { ${newImports.join(', ')} } from "hale-commenting-system"`
        );
      }
    }

    // Step 2: Add hooks to the component
    // Find the AppLayout function/component
    const componentMatch = content.match(/(const\s+AppLayout[^=]+=\s*\([^)]*\)\s*=>\s*\{)/);
    if (componentMatch) {
      const componentStart = content.indexOf(componentMatch[0]);
      const afterComponentStart = componentStart + componentMatch[0].length;

      // Check if hooks are already added
      if (!content.includes('const { commentsEnabled, setCommentsEnabled')) {
        // Find where to insert hooks (after existing useState declarations)
        const stateMatch = content.slice(afterComponentStart).match(/const\s+\[[^\]]+\]\s*=\s*React\.useState/);
        let hookInsertPos;

        if (stateMatch) {
          const statePos = content.indexOf(stateMatch[0], afterComponentStart);
          const semicolonPos = content.indexOf(';', statePos);
          hookInsertPos = semicolonPos + 1;
        } else {
          hookInsertPos = afterComponentStart;
        }

        const hooks = `
  const { commentsEnabled, setCommentsEnabled, drawerPinnedOpen, setDrawerPinnedOpen, floatingWidgetMode, setFloatingWidgetMode } = useComments();
  const { isAuthenticated, user, login, logout } = useGitHubAuth();
`;
        content = content.slice(0, hookInsertPos) + hooks + content.slice(hookInsertPos);
      }
    }

    // Step 3: Add the special renderNavGroup logic
    // Find the renderNavGroup function
    const renderNavGroupMatch = content.match(/const\s+renderNavGroup\s*=\s*\([^)]+\)\s*=>\s*\{?/);
    if (renderNavGroupMatch && !content.includes("group.label === 'Comments'")) {
      const funcStart = content.indexOf(renderNavGroupMatch[0]);
      const funcStartBrace = content.indexOf('{', funcStart) || content.indexOf('(', funcStart);

      // Insert the special Comments handling at the start of the function
      const specialHandling = `
    // Special handling for Comments group
    if (group.label === 'Comments') {
      return (
        <NavExpandable
          key={\`\${group.label}-\${groupIndex}\`}
          id={\`\${group.label}-\${groupIndex}\`}
          title="Hale Commenting System"
          isActive={group.routes.some((route) => route.path === location.pathname)}
        >
          <NavItem
            onClick={(e) => {
              e.stopPropagation();
              setFloatingWidgetMode(!floatingWidgetMode);
              if (!floatingWidgetMode) {
                setDrawerPinnedOpen(false);
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ExternalLinkAltIcon />
              <span>{floatingWidgetMode ? 'Close widget' : 'Pop out'}</span>
            </div>
          </NavItem>
          <NavItem>
            <div
              data-comment-controls
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '1rem' }}
            >
              <span>Enable Comments</span>
              <Switch
                id="comments-enabled-switch"
                isChecked={commentsEnabled}
                onChange={(_event, checked) => {
                  setCommentsEnabled(checked);
                  if (checked) {
                    setDrawerPinnedOpen(true);
                  }
                }}
                aria-label="Enable or disable comments"
              />
            </div>
          </NavItem>
          <NavItem>
            <div
              data-comment-controls
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '1rem' }}
            >
              <span>Page info drawer</span>
              <Switch
                id="page-info-drawer-switch"
                isChecked={drawerPinnedOpen}
                onChange={(_event, checked) => setDrawerPinnedOpen(checked)}
                aria-label="Pin page info drawer open"
              />
            </div>
          </NavItem>
          <NavItem>
            <div
              data-comment-controls
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '1rem' }}
            >
              {isAuthenticated ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <GithubIcon />
                    {user?.login ? \`@\${user.login}\` : 'Signed in'}
                  </span>
                  <Button variant="link" isInline onClick={logout}>
                    Sign out
                  </Button>
                </div>
              ) : (
                <Button variant="link" isInline icon={<GithubIcon />} onClick={login}>
                  Sign in with GitHub
                </Button>
              )}
            </div>
          </NavItem>
          {group.routes.map((route, idx) => route.label && renderNavItem(route, idx))}
        </NavExpandable>
      );
    }

    // Default handling for other groups
`;

      content = content.slice(0, funcStartBrace + 1) + specialHandling + content.slice(funcStartBrace + 1);
    }

    // Step 4: Wrap Page children if not already done
    if (!content.includes('<CommentPanel>')) {
      // Find the return statement with Page
      const pageMatch = content.match(/<Page[^>]*>/);
      if (pageMatch) {
        const pageStart = content.indexOf(pageMatch[0]);
        const pageEnd = content.indexOf('</Page>', pageStart);

        if (pageEnd > pageStart) {
          // Extract children between Page tags
          const pageOpenTagEnd = content.indexOf('>', pageStart) + 1;
          const children = content.slice(pageOpenTagEnd, pageEnd);

          // Wrap with CommentPanel and add CommentOverlay
          const wrappedChildren = `
      <CommentPanel>
        <CommentOverlay />
        ${children.trim()}
      </CommentPanel>
    `;

          content = content.slice(0, pageOpenTagEnd) + wrappedChildren + content.slice(pageEnd);
        }
      }
    }

    fs.writeFileSync(filePath, content);
    return true;
  } catch (error) {
    console.error(`   ❌ Error modifying ${filePath}:`, error.message);
    console.error(error.stack);
    return false;
  }
}

async function main() {
  const version = getPackageVersion();
  const title = `Hale Commenting System (v.${version})`;
  const titleLength = title.length;
  const borderLength = Math.max(titleLength + 4, 54);
  const padding = Math.floor((borderLength - titleLength - 2) / 2);
  
  console.log('\n' + '╔' + '═'.repeat(borderLength - 2) + '╗');
  console.log('║' + ' '.repeat(padding) + title + ' '.repeat(borderLength - titleLength - padding - 2) + '║');
  console.log('╚' + '═'.repeat(borderLength - 2) + '╝\n');

  // Welcome & Explanation
  console.log('🚀 Welcome to Hale Commenting System!\n');
  console.log('This commenting system allows you to:');
  console.log('  • Add comments directly on your design pages');
  console.log('  • Sync comments with GitHub Issues');
  console.log('  • Link Jira tickets to pages');
  console.log('  • Store design goals and context\n');
  
  console.log('Why GitHub?');
  console.log('  We use GitHub Issues to store and sync all comments. When you add a comment');
  console.log('  on a page, it creates a GitHub Issue. This allows comments to persist, sync');
  console.log('  across devices, and be managed like any other GitHub Issue.\n');
  
  console.log('Why Jira?');
  console.log('  You can link Jira tickets to specific pages or sections. This helps connect');
  console.log('  design work to development tracking and provides context for reviewers.\n');

  // Step 1: Project Status Check
  console.log('📋 Step 1: Project Setup Check\n');
  
  const hasProject = await prompt([
    {
      type: 'list',
      name: 'hasProject',
      message: 'Do you have a PatternFly Seed project set up locally?',
      choices: [
        { name: 'Yes, I have it set up', value: 'yes' },
        { name: 'No, I need help setting it up', value: 'no' }
      ]
    }
  ]);

  if (hasProject.hasProject === 'no') {
    console.log('\n📚 Setting up PatternFly Seed:\n');
    console.log('1. Fork the PatternFly Seed repository:');
    console.log('   Visit: https://github.com/patternfly/patternfly-react-seed');
    console.log('   Click "Fork" in the top right\n');
    console.log('2. Clone your fork locally:');
    console.log('   git clone https://github.com/YOUR_USERNAME/patternfly-react-seed.git');
    console.log('   cd patternfly-react-seed\n');
    console.log('3. Install dependencies:');
    console.log('   npm install\n');
    console.log('4. Run this setup again:');
    console.log('   npx hale-commenting-system init\n');
    rl.close();
    return;
  }

  // Check if it's actually a PF Seed project
  if (!detectPatternFlySeed()) {
    console.error('❌ Error: This doesn\'t appear to be a PatternFly Seed project.');
    console.error('Please run this command from a PatternFly Seed project directory.');
    rl.close();
    process.exit(1);
  }

  // Detect project setup type
  const gitInfo = detectGitRemote();
  const setupType = detectProjectSetup();
  
  let projectSetup = 'unknown';
  let owner = gitInfo?.owner;
  let repo = gitInfo?.repo;

  if (setupType === 'none' || !gitInfo) {
    // No git remote - need to set up
    const setupAnswer = await prompt([
      {
        type: 'list',
        name: 'setupType',
        message: 'How did you set up your PatternFly Seed project?',
        choices: [
          { name: 'I forked the PatternFly Seed repo on GitHub', value: 'forked' },
          { name: 'I cloned the PatternFly Seed repo locally', value: 'cloned' },
          { name: 'I\'m not sure', value: 'unknown' }
        ]
      }
    ]);
    projectSetup = setupAnswer.setupType;
  } else {
    projectSetup = setupType;
  }

  // Handle different setup types
  if (projectSetup === 'forked') {
    // Ask for owner/repo if not detected
    if (!owner || !repo) {
      const forkAnswers = await prompt([
        {
          type: 'input',
          name: 'owner',
          message: 'What is your GitHub username or organization name?',
          default: owner,
          validate: (input) => {
            if (!input.trim()) return 'Owner is required';
            return true;
          }
        },
        {
          type: 'input',
          name: 'repo',
          message: 'What is the name of your forked repository?',
          default: repo,
          validate: (input) => {
            if (!input.trim()) return 'Repository name is required';
            return true;
          }
        }
      ]);
      owner = forkAnswers.owner;
      repo = forkAnswers.repo;
    } else {
      console.log(`\n✅ Detected repository: ${owner}/${repo}\n`);
    }
  } else if (projectSetup === 'cloned') {
    console.log('\n📝 Since you cloned the repo, you\'ll need to create your own GitHub repository.\n');
    console.log('Steps:');
    console.log('1. Create a new repository on GitHub');
    console.log('2. Add it as a remote: git remote add origin <your-repo-url>');
    console.log('3. Push your code: git push -u origin main\n');
    
    const hasCreated = await prompt([
      {
        type: 'confirm',
        name: 'created',
        message: 'Have you created and pushed to your GitHub repository?',
        default: false
      }
    ]);

    if (!hasCreated.created) {
      console.log('\nPlease complete the steps above and run this setup again.');
      rl.close();
      return;
    }

    // Ask for owner/repo
    const repoAnswers = await prompt([
      {
        type: 'input',
        name: 'owner',
        message: 'What is your GitHub username or organization name?',
        validate: (input) => {
          if (!input.trim()) return 'Owner is required';
          return true;
        }
      },
      {
        type: 'input',
        name: 'repo',
        message: 'What is the name of your GitHub repository?',
        validate: (input) => {
          if (!input.trim()) return 'Repository name is required';
          return true;
        }
      }
    ]);
    owner = repoAnswers.owner;
    repo = repoAnswers.repo;
  } else if (projectSetup === 'unknown') {
    // Try to detect from git
    if (gitInfo && gitInfo.owner && gitInfo.repo) {
      console.log(`\n✅ Detected repository: ${gitInfo.owner}/${gitInfo.repo}\n`);
      owner = gitInfo.owner;
      repo = gitInfo.repo;
    } else {
      // Ask for owner/repo
      const repoAnswers = await prompt([
        {
          type: 'input',
          name: 'owner',
          message: 'What is your GitHub username or organization name?',
          validate: (input) => {
            if (!input.trim()) return 'Owner is required';
            return true;
          }
        },
        {
          type: 'input',
          name: 'repo',
          message: 'What is the name of your GitHub repository?',
          validate: (input) => {
            if (!input.trim()) return 'Repository name is required';
            return true;
          }
        }
      ]);
      owner = repoAnswers.owner;
      repo = repoAnswers.repo;
    }
  }

  // Step 2: GitHub OAuth Setup (Optional)
  console.log('\n📦 Step 2: GitHub Integration (Optional)\n');
  console.log('GitHub integration allows comments to sync with GitHub Issues.');
  console.log('You can set this up now or add it later.\n');
  
  const setupGitHub = await prompt([
    {
      type: 'confirm',
      name: 'setup',
      message: 'Do you want to set up GitHub integration now?',
      default: true
    }
  ]);

  let githubConfig = null;
  let githubValid = false;

  if (setupGitHub.setup) {
    console.log('\nTo sync comments with GitHub Issues, we need to authenticate with GitHub.');
    console.log('This requires creating a GitHub OAuth App.\n');
    console.log('Instructions:');
    console.log('1. Visit: https://github.com/settings/developers');
    console.log('2. Click "New OAuth App"');
    console.log('3. Fill in the form:');
    console.log('   - Application name: Your app name (e.g., "My Design Comments")');
    console.log('   - Homepage URL: http://localhost:9000 (or your dev server URL)');
    console.log('   - Authorization callback URL: http://localhost:9000/api/github-oauth-callback');
    console.log('4. Click "Register application"');
    console.log('5. Copy the Client ID and generate a Client Secret\n');
    
    const githubAnswers = await prompt([
      {
        type: 'input',
        name: 'clientId',
        message: 'GitHub OAuth Client ID:',
        validate: (input) => {
          if (!input.trim()) return 'Client ID is required';
          return true;
        }
      },
      {
        type: 'password',
        name: 'clientSecret',
        message: 'GitHub OAuth Client Secret:',
        mask: '*',
        validate: (input) => {
          if (!input.trim()) return 'Client Secret is required';
          return true;
        }
      }
    ]);

    // Validate GitHub credentials
    console.log('\n🔍 Validating GitHub credentials...');
    githubValid = await validateGitHubCredentials(
      githubAnswers.clientId,
      githubAnswers.clientSecret,
      owner,
      repo
    );

    if (!githubValid) {
      console.error('❌ GitHub validation failed. Please check your credentials and try again.');
      rl.close();
      process.exit(1);
    }
    console.log('✅ GitHub credentials validated!\n');

    githubConfig = {
      clientId: githubAnswers.clientId,
      clientSecret: githubAnswers.clientSecret,
      owner: owner,
      repo: repo
    };
  } else {
    console.log('\n⏭️  Skipping GitHub setup. You can add it later by editing .env and .env.server files.\n');
  }

  // Step 3: Jira Setup (Optional)
  console.log('🎫 Step 3: Jira Integration (Optional)\n');
  console.log('Jira integration allows you to link Jira tickets to pages in your design.');
  console.log('You can set this up now or add it later.\n');
  
  const setupJira = await prompt([
    {
      type: 'confirm',
      name: 'setup',
      message: 'Do you want to set up Jira integration now?',
      default: true
    }
  ]);

  let jiraConfig = null;
  let jiraValid = false;

  if (setupJira.setup) {
    console.log('\nFor Red Hat Jira, generate a Personal Access Token:');
    console.log('1. Visit: https://issues.redhat.com/secure/ViewProfile.jspa');
    console.log('2. Click "Personal Access Tokens" in the left sidebar');
    console.log('3. Click "Create token"');
    console.log('4. Give it a name (e.g., "Hale Commenting System")');
    console.log('5. Remove expiration (or set a long expiration)');
    console.log('6. Click "Create" and copy the token\n');
    console.log('Note: We use Bearer token authentication (no email required for Red Hat Jira).\n');

    const jiraAnswers = await prompt([
      {
        type: 'input',
        name: 'baseUrl',
        message: 'Jira Base URL (press Enter for Red Hat Jira):',
        default: 'https://issues.redhat.com',
        validate: (input) => {
          if (!input.trim()) return 'Base URL is required';
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        }
      },
      {
        type: 'password',
        name: 'apiToken',
        message: 'Jira API Token:',
        mask: '*',
        validate: (input) => {
          if (!input.trim()) return 'API Token is required';
          return true;
        }
      }
    ]);

    // Validate Jira credentials
    console.log('\n🔍 Validating Jira credentials...');
    jiraValid = await validateJiraCredentials(
      jiraAnswers.baseUrl,
      jiraAnswers.apiToken,
      undefined // No email for Bearer token
    );

    if (!jiraValid) {
      console.error('❌ Jira validation failed. Please check your credentials and try again.');
      rl.close();
      process.exit(1);
    }
    console.log('✅ Jira credentials validated!\n');

    jiraConfig = {
      baseUrl: jiraAnswers.baseUrl,
      apiToken: jiraAnswers.apiToken,
      email: undefined
    };
  } else {
    console.log('\n⏭️  Skipping Jira setup. You can add it later by editing .env and .env.server files.\n');
  }

  // Step 4: Generate files
  console.log('📝 Step 4: Generating configuration files...\n');
  generateFiles({
    github: githubConfig,
    jira: jiraConfig,
    owner: owner,
    repo: repo
  });

  // Step 5: Integrate into project
  console.log('\n🔧 Step 5: Integrating into PatternFly Seed project...\n');
  
  console.log('This will modify the following files:');
  console.log('  • src/app/index.tsx');
  console.log('  • src/app/routes.tsx');
  console.log('  • src/app/AppLayout/AppLayout.tsx');
  console.log('  • webpack.dev.js\n');

  const indexPath = findFile('index.tsx');
  const routesPath = findFile('routes.tsx');
  const appLayoutPath = findFile('AppLayout/AppLayout.tsx') || findFile('AppLayout.tsx');

  if (!indexPath) {
    console.error('❌ Could not find src/app/index.tsx');
    rl.close();
    process.exit(1);
  }
  if (!routesPath) {
    console.error('❌ Could not find src/app/routes.tsx');
    rl.close();
    process.exit(1);
  }
  if (!appLayoutPath) {
    console.error('❌ Could not find src/app/AppLayout/AppLayout.tsx');
    rl.close();
    process.exit(1);
  }

  console.log('✓ Modifying files...\n');

  let successCount = 0;
  let skippedCount = 0;

  // Modify index.tsx
  console.log(`📝 ${indexPath}`);
  if (modifyIndexTsx(indexPath)) {
    console.log('   ✅ Added providers');
    successCount++;
  } else {
    skippedCount++;
  }

  // Create Comments component first (needed for routes)
  console.log('\n📝 Creating Comments component...');
  createCommentsComponent();

  // Modify routes.tsx
  console.log(`\n📝 ${routesPath}`);
  if (modifyRoutesTsx(routesPath)) {
    console.log('   ✅ Added Comments route');
    successCount++;
  } else {
    skippedCount++;
  }

  // Modify AppLayout.tsx
  console.log(`\n📝 ${appLayoutPath}`);
  if (modifyAppLayoutTsx(appLayoutPath)) {
    console.log('   ✅ Added CommentPanel and CommentOverlay');
    successCount++;
  } else {
    skippedCount++;
  }

  // Integrate webpack middleware
  console.log('\n📝 webpack.dev.js');
  integrateWebpackMiddleware();

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   ✅ Integration Complete!                                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (successCount > 0) {
    console.log(`✓ Modified ${successCount} file(s)`);
  }
  if (skippedCount > 0) {
    console.log(`⚠️  ${skippedCount} file(s) already integrated or skipped`);
  }

  console.log('\nNext steps:');
  console.log('1. Start your dev server: npm run start:dev');
  console.log('   (If it\'s already running, restart it to load the new configuration)');
  console.log('2. The commenting system will be available in your app!\n');

  if (!githubConfig || !jiraConfig) {
    console.log('📝 To add integrations later:');
    if (!githubConfig) {
      console.log('   • GitHub: Edit .env and .env.server files (see comments in files for instructions)');
    }
    if (!jiraConfig) {
      console.log('   • Jira: Edit .env and .env.server files (see comments in files for instructions)');
    }
    console.log('   • Then restart your dev server\n');
  }

  rl.close();
}

main().catch((error) => {
  console.error('\n❌ Integration failed:', error.message);
  rl.close();
  process.exit(1);
});

