import { getEnv } from '../utils/env';
import {
  IssueProviderAdapter,
  CreateIssueParams,
  IssueData,
  PutRepoFileParams,
  ProviderResult,
} from '../types/provider';

export interface GitLabUser {
  login: string;
  avatar: string;
}

export const GITLAB_TOKEN_STORAGE_KEY = 'gitlab_access_token';
export const GITLAB_USER_STORAGE_KEY = 'gitlab_user';

export const storeGitLabAuth = (token: string, user: GitLabUser) => {
  localStorage.setItem(GITLAB_TOKEN_STORAGE_KEY, token);
  localStorage.setItem(GITLAB_USER_STORAGE_KEY, JSON.stringify(user));
};

export const clearGitLabAuth = () => {
  localStorage.removeItem(GITLAB_TOKEN_STORAGE_KEY);
  localStorage.removeItem(GITLAB_USER_STORAGE_KEY);
};

export const getStoredToken = (): string | null => {
  return localStorage.getItem(GITLAB_TOKEN_STORAGE_KEY);
};

export const getStoredUser = (): GitLabUser | null => {
  const raw = localStorage.getItem(GITLAB_USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GitLabUser;
  } catch {
    return null;
  }
};

export const isGitLabConfigured = (): boolean => {
  const projectPath = getEnv('VITE_GITLAB_PROJECT_PATH');
  const baseUrl = getEnv('VITE_GITLAB_BASE_URL');
  return Boolean(getStoredToken() && projectPath && baseUrl);
};

export const diagnoseGitLabSetup = () => {
  const token = getStoredToken();
  const user = getStoredUser();
  const projectPath = getEnv('VITE_GITLAB_PROJECT_PATH');
  const baseUrl = getEnv('VITE_GITLAB_BASE_URL');

  console.log('🔍 GitLab Configuration Diagnostic:');
  console.log('  Token:', token ? `Present (${token.substring(0, 10)}...)` : 'Missing ❌');
  console.log('  User:', user ? `${user.login}` : 'Not logged in ❌');
  console.log('  Project Path:', projectPath || 'Missing ❌');
  console.log('  Base URL:', baseUrl || 'Missing ❌');
  console.log('  Full project URL:', projectPath && baseUrl ? `${baseUrl}/${projectPath}` : 'Incomplete ❌');
  console.log('\n💡 To fix 403 Forbidden error:');
  console.log('  1. Make sure you have maintainer/owner access to the project');
  console.log('  2. Check that issues are enabled on the project');
  console.log('  3. Re-authenticate to get a fresh token with correct scopes');
  console.log('  4. Token needs "api" scope for GitLab access');

  return {
    hasToken: !!token,
    hasUser: !!user,
    hasProjectPath: !!projectPath,
    hasBaseUrl: !!baseUrl,
    isComplete: !!(token && user && projectPath && baseUrl)
  };
};

async function gitlabProxyRequest(method: string, endpoint: string, data?: any): Promise<any> {
  const token = getStoredToken();
  if (!token) {
    throw new Error('Not authenticated with GitLab');
  }

  console.log(`🟠 GitLab API Request:`, { method, endpoint, hasData: !!data });

  const resp = await fetch('/api/gitlab-api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, method, endpoint, data }),
  });

  const payload = await resp.json();

  console.log(`🟠 GitLab API Response:`, {
    status: resp.status,
    ok: resp.ok,
    payload
  });

  if (!resp.ok) {
    const message = (payload && (payload.message || payload.error)) || `GitLab API error (${resp.status})`;

    if (resp.status === 403) {
      console.error(`❌ 403 Forbidden - Possible causes:
        1. Token doesn't have 'api' scope
        2. You don't have maintainer/owner access to the project
        3. Issues are disabled on the project
        4. Token has expired or been revoked

        Current config:
        - Project Path: ${getEnv('VITE_GITLAB_PROJECT_PATH')}
        - Base URL: ${getEnv('VITE_GITLAB_BASE_URL')}
        - Endpoint: ${endpoint}
      `);
    }

    throw new Error(message);
  }
  return payload;
}

const encodePath = (path: string): string => {
  // GitLab requires double encoding for file paths
  return encodeURIComponent(path.replace(/\//g, '%2F'));
};

const base64EncodeUtf8 = (input: string): string => {
  return btoa(unescape(encodeURIComponent(input)));
};

const base64DecodeUtf8 = (input: string): string => {
  return decodeURIComponent(escape(atob(input)));
};

const getLabelNames = (issue: any): string[] => {
  const labels = issue?.labels;
  if (!Array.isArray(labels)) return [];
  return labels
    .map((l: any) => (typeof l === 'string' ? l : l?.name || l?.title))
    .filter((n: any) => typeof n === 'string');
};

const issueHasAnyVersion = (issue: any): boolean => {
  const labelNames = getLabelNames(issue);
  if (labelNames.some((n) => n.startsWith('version:'))) return true;
  const body: string = issue?.description || '';
  return body.includes('Version:');
};

// Encode project path to project ID format for GitLab API
const getProjectId = (): string => {
  const projectPath = getEnv('VITE_GITLAB_PROJECT_PATH');
  if (!projectPath) return '';
  // GitLab API accepts URL-encoded project path (e.g., "group%2Fproject")
  return encodeURIComponent(projectPath);
};

/**
 * GitLab implementation of the IssueProviderAdapter interface
 */
export class GitLabAdapter implements IssueProviderAdapter {
  isConfigured(): boolean {
    return isGitLabConfigured();
  }

  async createIssue(params: CreateIssueParams): Promise<ProviderResult<IssueData>> {
    if (!isGitLabConfigured()) return { success: false, error: 'Please sign in with GitLab' };

    const projectId = getProjectId();

    try {
      const metadata = [
        `- Route: \`${params.route}\``,
        params.version ? `- Version: \`${params.version}\`` : null,
        params.cssSelector ? `- Target Component: \`${params.elementDescription || 'unknown'}\`` : null,
        params.cssSelector ? `- CSS Selector: \`${params.cssSelector}\`` : null,
        `- Fallback Position: \`(${params.xPercent.toFixed(1)}%, ${params.yPercent.toFixed(1)}%)\``,
      ]
        .filter(Boolean)
        .join('\n');

      // GitLab uses 'description' instead of 'body'
      const issuePayload: any = {
        title: params.title,
        description: `${params.body}\n\n---\n**Metadata:**\n${metadata}`,
      };

      // GitLab accepts labels as comma-separated string or array
      const labels: string[] = [
        'hale-comment',
        `route:${params.route}`,
      ];
      if (params.cssSelector && params.elementDescription) {
        labels.push(`component:${params.elementDescription}`);
      }
      labels.push(`coords:${Math.round(params.xPercent)},${Math.round(params.yPercent)}`);
      if (params.version) labels.push(`version:${params.version}`);

      issuePayload.labels = labels.join(',');

      const data = await gitlabProxyRequest('POST', `/projects/${projectId}/issues`, issuePayload);

      // Normalize GitLab response to match GitHub format
      return {
        success: true,
        data: {
          number: data.iid, // GitLab uses 'iid' (issue ID) instead of 'number'
          html_url: data.web_url, // GitLab uses 'web_url' instead of 'html_url'
        }
      };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to create issue' };
    }
  }

  async createComment(issueNumber: number, body: string): Promise<ProviderResult> {
    if (!isGitLabConfigured()) return { success: false, error: 'Please sign in with GitLab' };
    const projectId = getProjectId();

    try {
      // GitLab uses 'notes' instead of 'comments'
      const data = await gitlabProxyRequest('POST', `/projects/${projectId}/issues/${issueNumber}/notes`, { body });
      return { success: true, data };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to create comment' };
    }
  }

  async fetchIssuesForRouteAndVersion(route: string, version?: string): Promise<ProviderResult<any[]>> {
    if (!isGitLabConfigured()) return { success: false, error: 'Please sign in with GitLab' };
    const projectId = getProjectId();
    try {
      // GitLab API uses 'scope=all' to get all issues (open and closed)
      const data = await gitlabProxyRequest(
        'GET',
        `/projects/${projectId}/issues?scope=all&per_page=100`,
      );

      // Filter by metadata OR labels (route:${route}), and optionally by version
      const filtered = (Array.isArray(data) ? data : [])
        .filter((issue: any) => {
          const body: string = issue?.description || '';
          const labels = getLabelNames(issue);
          const bodyMatch = body.includes(`Route: \`${route}\``);
          const labelMatch = labels.includes(`route:${route}`);
          return bodyMatch || labelMatch;
        })
        .filter((issue: any) => {
          if (!version) return true;

          const labels = getLabelNames(issue);
          const body: string = issue?.description || '';
          const versionLabelMatch = labels.includes(`version:${version}`);
          const bodyVersionMatch = body.includes(`Version: \`${version}\``);

          // Back-compat: if an issue has no version metadata at all, treat it as default "1"
          if (!issueHasAnyVersion(issue) && version === '1') return true;

          return versionLabelMatch || bodyVersionMatch;
        });

      // Normalize GitLab response to match GitHub format
      const normalized = filtered.map((issue: any) => ({
        ...issue,
        number: issue.iid, // Add 'number' field for compatibility
        body: issue.description, // Add 'body' field for compatibility
        html_url: issue.web_url, // Add 'html_url' field for compatibility
      }));

      return { success: true, data: normalized };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to fetch issues' };
    }
  }

  async fetchIssueComments(issueNumber: number): Promise<ProviderResult<any[]>> {
    if (!isGitLabConfigured()) return { success: false, error: 'Please sign in with GitLab' };
    const projectId = getProjectId();
    try {
      // GitLab uses 'notes' instead of 'comments'
      const data = await gitlabProxyRequest(
        'GET',
        `/projects/${projectId}/issues/${issueNumber}/notes?per_page=100`,
      );
      return { success: true, data };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to fetch issue comments' };
    }
  }

  async updateComment(commentId: number, body: string, issueNumber?: number): Promise<ProviderResult> {
    if (!isGitLabConfigured()) return { success: false, error: 'Please sign in with GitLab' };

    // GitLab requires both issue IID and note ID in the path
    if (!issueNumber) {
      return { success: false, error: 'Issue number is required for GitLab comment updates' };
    }

    const projectId = getProjectId();
    try {
      // GitLab uses PUT instead of PATCH for note updates
      const data = await gitlabProxyRequest('PUT', `/projects/${projectId}/issues/${issueNumber}/notes/${commentId}`, { body });
      return { success: true, data };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to update comment' };
    }
  }

  async deleteComment(commentId: number, issueNumber?: number): Promise<ProviderResult> {
    if (!isGitLabConfigured()) return { success: false, error: 'Please sign in with GitLab' };

    // GitLab requires both issue IID and note ID in the path
    if (!issueNumber) {
      return { success: false, error: 'Issue number is required for GitLab comment deletion' };
    }

    const projectId = getProjectId();
    try {
      await gitlabProxyRequest('DELETE', `/projects/${projectId}/issues/${issueNumber}/notes/${commentId}`);
      return { success: true, data: {} };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to delete comment' };
    }
  }

  async closeIssue(issueNumber: number): Promise<ProviderResult> {
    if (!isGitLabConfigured()) return { success: false, error: 'Please sign in with GitLab' };
    const projectId = getProjectId();
    try {
      // GitLab uses 'state_event: close' instead of 'state: closed'
      const data = await gitlabProxyRequest('PUT', `/projects/${projectId}/issues/${issueNumber}`, { state_event: 'close' });
      return { success: true, data };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to close issue' };
    }
  }

  async reopenIssue(issueNumber: number): Promise<ProviderResult> {
    if (!isGitLabConfigured()) return { success: false, error: 'Please sign in with GitLab' };
    const projectId = getProjectId();
    try {
      // GitLab uses 'state_event: reopen' instead of 'state: open'
      const data = await gitlabProxyRequest('PUT', `/projects/${projectId}/issues/${issueNumber}`, { state_event: 'reopen' });
      return { success: true, data };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to reopen issue' };
    }
  }

  async getRepoFile(path: string): Promise<ProviderResult<{ text: string; sha: string } | null>> {
    if (!isGitLabConfigured()) return { success: false, error: 'Please sign in with GitLab' };
    const projectId = getProjectId();
    try {
      // GitLab requires ref parameter (branch name)
      const data = await gitlabProxyRequest('GET', `/projects/${projectId}/repository/files/${encodePath(path)}?ref=main`);
      const content = typeof data?.content === 'string' ? data.content.replace(/\n/g, '') : '';
      const sha = data?.blob_id as string | undefined; // GitLab uses 'blob_id' instead of 'sha'
      if (!content || !sha) return { success: true, data: null };
      const text = base64DecodeUtf8(content);
      return { success: true, data: { text, sha } };
    } catch (e: any) {
      // If file doesn't exist yet, treat as empty
      if (String(e?.message || '').toLowerCase().includes('not found') ||
          String(e?.message || '').toLowerCase().includes('file not found')) {
        return { success: true, data: null };
      }
      return { success: false, error: e?.message || 'Failed to read repo file' };
    }
  }

  async putRepoFile(params: PutRepoFileParams): Promise<ProviderResult<{ sha: string }>> {
    if (!isGitLabConfigured()) return { success: false, error: 'Please sign in with GitLab' };
    const projectId = getProjectId();
    try {
      const payload: any = {
        branch: 'main',
        commit_message: params.message,
        content: params.text, // GitLab accepts plain text, not base64
      };

      // GitLab uses different endpoints for create vs update
      const method = params.sha ? 'PUT' : 'POST';
      if (params.sha) {
        payload.last_commit_id = params.sha; // GitLab uses 'last_commit_id' for optimistic locking
      }

      const data = await gitlabProxyRequest(
        method,
        `/projects/${projectId}/repository/files/${encodePath(params.path)}`,
        payload,
      );

      // GitLab returns commit info, not the blob SHA directly
      const newSha = data?.file_path ? 'updated' : params.sha || 'created';
      return { success: true, data: { sha: newSha } };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to write repo file' };
    }
  }
}

// Export singleton instance
export const gitlabAdapter = new GitLabAdapter();
