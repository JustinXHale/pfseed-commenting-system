export interface Comment {
  id: string;
  author?: string;
  text: string;
  createdAt: string;
  githubCommentId?: number;
  parentCommentId?: string; // local id of parent comment
  parentGitHubCommentId?: number; // GitHub comment id of parent (if known)
}

export type SyncStatus = 'synced' | 'local' | 'pending' | 'syncing' | 'error';
export type ThreadStatus = 'open' | 'closed';

export interface Thread {
  id: string;
  xPercent: number; // Percentage from left (0-100)
  yPercent: number; // Percentage from top (0-100)
  route: string;
  version?: string;
  comments: Comment[];
  issueNumber?: number;
  issueUrl?: string;
  provider?: 'github';
  syncStatus?: SyncStatus;
  syncError?: string;
  status?: ThreadStatus; // open or closed (mirrors GitHub issue state)
}
