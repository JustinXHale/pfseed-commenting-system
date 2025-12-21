// Contexts
export { CommentProvider, useComments } from './contexts/CommentContext';
export { GitHubAuthProvider, useGitHubAuth } from './contexts/GitHubAuthContext';

// Components
export { CommentOverlay } from './components/CommentOverlay';
export { CommentPin } from './components/CommentPin';
export { CommentPanel } from './components/CommentPanel';

// Types
export type { Comment, Thread, SyncStatus, ThreadStatus } from './types';
