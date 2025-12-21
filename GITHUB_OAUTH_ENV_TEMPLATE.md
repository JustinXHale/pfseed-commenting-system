## GitHub OAuth + Issue Sync env vars (local dev)

This project uses `dotenv-webpack`, which **inlines environment variables into the frontend bundle**.

### Create a local `.env` file

Create `patternfly-react-seed/.env` (this file is already in `.gitignore`):

```sh
# GitHub OAuth (client-side; safe to expose)
VITE_GITHUB_CLIENT_ID=YOUR_GITHUB_OAUTH_CLIENT_ID

# Target repo for Issues/Comments
VITE_GITHUB_OWNER=JustinXHale
VITE_GITHUB_REPO=pfseed-commenting-system
```

### Server-only secret (local dev)

Create `patternfly-react-seed/.env.server` (also gitignored) and add:

```sh
GITHUB_CLIENT_SECRET=YOUR_GITHUB_OAUTH_CLIENT_SECRET
```

## Jira (issues.redhat.com) env vars (local dev)

### Client-safe `.env`

Add:

```sh
VITE_JIRA_BASE_URL=https://issues.redhat.com
```

### Server-only `.env.server`

Add:

```sh
JIRA_EMAIL=YOUR_JIRA_ACCOUNT_EMAIL
JIRA_API_TOKEN=YOUR_JIRA_API_TOKEN
```

### Important: do NOT put secrets in `.env`

Do **NOT** put your GitHub OAuth **client secret** in `.env`.

Because webpack injects these variables into the browser bundle, any secret placed in `.env` would be exposed to end users.

When we wire up the OAuth code exchange step, the **client secret must live server-side** (Netlify/Vercel function environment variables, etc.).


