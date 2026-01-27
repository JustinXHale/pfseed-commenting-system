/**
 * Provider abstraction layer for issue tracking platforms (GitHub, GitLab, etc.)
 */

export type ProviderType = 'github' | 'gitlab';

/**
 * Generic user interface that works across providers
 */
export interface ProviderUser {
  login: string;
  avatar: string;
}

/**
 * Standard result type for provider operations
 */
export interface ProviderResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Parameters for creating an issue
 */
export interface CreateIssueParams {
  title: string;
  body: string;
  route: string;
  cssSelector?: string;
  elementDescription?: string;
  xPercent: number;
  yPercent: number;
  version?: string;
}

/**
 * Issue data returned from provider
 */
export interface IssueData {
  number: number; // GitHub uses 'number', GitLab uses 'iid', normalized to 'number'
  html_url: string; // GitHub uses 'html_url', GitLab uses 'web_url', normalized to 'html_url'
}

/**
 * Parameters for updating/creating a file in the repository
 */
export interface PutRepoFileParams {
  path: string;
  text: string;
  message: string;
  sha?: string;
}

/**
 * Core adapter interface that all providers must implement
 * This allows the commenting system to work with GitHub, GitLab, or any other provider
 */
export interface IssueProviderAdapter {
  /**
   * Check if the provider is fully configured and ready to use
   */
  isConfigured(): boolean;

  /**
   * Create a new issue in the provider
   */
  createIssue(params: CreateIssueParams): Promise<ProviderResult<IssueData>>;

  /**
   * Close an existing issue
   */
  closeIssue(issueNumber: number): Promise<ProviderResult>;

  /**
   * Reopen a closed issue
   */
  reopenIssue(issueNumber: number): Promise<ProviderResult>;

  /**
   * Fetch all issues for a specific route and optional version
   */
  fetchIssuesForRouteAndVersion(route: string, version?: string): Promise<ProviderResult<any[]>>;

  /**
   * Create a new comment on an issue
   */
  createComment(issueNumber: number, body: string): Promise<ProviderResult>;

  /**
   * Fetch all comments for an issue
   */
  fetchIssueComments(issueNumber: number): Promise<ProviderResult<any[]>>;

  /**
   * Update an existing comment
   * Note: GitLab requires both issueNumber and commentId in the path
   */
  updateComment(commentId: number, body: string, issueNumber?: number): Promise<ProviderResult>;

  /**
   * Delete a comment
   * Note: GitLab requires both issueNumber and commentId in the path
   */
  deleteComment(commentId: number, issueNumber?: number): Promise<ProviderResult>;

  /**
   * Get a file from the repository
   */
  getRepoFile(path: string): Promise<ProviderResult<{ text: string; sha: string } | null>>;

  /**
   * Create or update a file in the repository
   */
  putRepoFile(params: PutRepoFileParams): Promise<ProviderResult<{ sha: string }>>;
}
