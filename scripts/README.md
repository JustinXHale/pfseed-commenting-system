# Hale Commenting System - Integration Script

This script automatically integrates the Hale Commenting System into a PatternFly React Seed project.

## Usage

After installing the package:

```bash
npm install hale-commenting-system
npx hale-commenting-system init
```

## What it does

The script automatically modifies three files:

1. **src/app/index.tsx**
   - Adds imports for `CommentProvider` and `GitHubAuthProvider`
   - Wraps the Router with the providers

2. **src/app/routes.tsx**
   - Adds a "Comments" route group to the navigation

3. **src/app/AppLayout/AppLayout.tsx**
   - Adds imports for `CommentPanel` and `CommentOverlay`
   - Wraps the Page content with CommentPanel and CommentOverlay

## Requirements

The script requires the following Babel packages (should be in devDependencies):
- `@babel/core`
- `@babel/traverse`
- `@babel/generator`
- `@babel/types`

## Notes

- The script is idempotent - it can be run multiple times safely
- It detects if integration is already complete and skips those files
- No backups are created (users should use git for version control)

