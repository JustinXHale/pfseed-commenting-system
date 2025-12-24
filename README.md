# Hale Commenting System

A commenting system for PatternFly React applications that allows designers and developers to add comments directly on design pages, sync with GitHub Issues, and link Jira tickets.

## Features

- **Pin-based commenting** - Click anywhere on a page to add a comment pin
- **Thread discussions** - Organize comments into threads with replies
- **GitHub Integration** - Sync comments with GitHub Issues automatically
- **Jira Integration** - Link Jira tickets to specific pages or sections
- **PatternFly Design** - Built with PatternFly React components
- **Responsive** - Works on desktop and mobile devices
- **Easy Integration** - Automated setup script for seamless installation

## Installation

```bash
npm install hale-commenting-system
```

## Quick Start

1. **Install the package:**
   ```bash
   npm install hale-commenting-system
   ```

2. **Run the integration script:**
   ```bash
   npx hale-commenting-system init
   ```

3. **Follow the interactive setup:**
   - The script will guide you through project setup
   - Optionally configure GitHub OAuth integration
   - Optionally configure Jira integration
   - Configuration files (`.env` and `.env.server`) will be created automatically

4. **Start your dev server:**
   ```bash
   npm run start:dev
   ```

## Usage

After running the integration script, the commenting system will be available in your PatternFly React Seed application.

### Adding Comments

- **Click anywhere** on a page to add a comment pin
- **View all comments** in the "Comments" menu item in the sidebar
- **Reply to comments** to create discussion threads
- **Navigate to pins** using the "Go to pin" button in the comments view

### GitHub Integration (Optional)

When configured, comments automatically sync with GitHub Issues:
- Each comment thread becomes a GitHub Issue
- Replies sync as Issue comments
- Status changes (open/closed) sync between the app and GitHub

### Jira Integration (Optional)

When configured, you can:
- Link Jira tickets to specific pages or sections
- View ticket details in the commenting panel
- Track design work alongside development tickets

## Configuration

The integration script creates two configuration files:

### `.env`
Contains client-side configuration (safe to commit):
- GitHub OAuth client ID
- Jira base URL
- Other public configuration

### `.env.server`
Contains server-side secrets (should NOT be committed):
- GitHub OAuth client secret
- Jira API tokens
- Other sensitive credentials

**Important:** The `.env.server` file is automatically added to `.gitignore` to prevent committing secrets.

See the generated files for detailed setup instructions.

## Requirements

- **PatternFly React Seed** project (or compatible PatternFly React application)
- **Node.js 18+** (required for webpack middleware with native `fetch()` support)
- **React 18+**

## What Gets Integrated

The integration script automatically modifies your project:

1. **`src/app/index.tsx`** - Adds `CommentProvider` and `GitHubAuthProvider`
2. **`src/app/routes.tsx`** - Adds "Comments" route group with "View all" route
3. **`src/app/AppLayout/AppLayout.tsx`** - Adds `CommentPanel` and `CommentOverlay` components
4. **`webpack.dev.js`** - Adds middleware for GitHub OAuth and Jira API proxying
5. **`src/app/Comments/Comments.tsx`** - Creates the Comments view component
6. **`.env` and `.env.server`** - Creates configuration files

## Development

### Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run start:dev
```

### Building for Production

```bash
# Run production build
npm run build

# Start production server
npm run start
```

## License

MIT

## Support

For issues, questions, or contributions, please visit the [repository](https://github.com/patternfly/patternfly-react-seed).
