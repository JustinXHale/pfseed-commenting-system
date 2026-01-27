// Contexts
export { CommentProvider, useComments } from './contexts/CommentContext';
export { ProviderAuthProvider, useProviderAuth } from './contexts/ProviderAuthContext';
export { GitHubAuthProvider, useGitHubAuth } from './contexts/GitHubAuthContext'; // Deprecated - use ProviderAuthProvider instead

// Components
export { CommentOverlay } from './components/CommentOverlay';
export { CommentPin } from './components/CommentPin';
export { CommentPanel } from './components/CommentPanel';
export { DetailsTab } from './components/DetailsTab';
export { JiraTab } from './components/JiraTab';
export { FloatingWidget } from './components/FloatingWidget';

// Services
export { githubAdapter, isGitHubConfigured } from './services/githubAdapter';

// Types
export type { Comment, Thread, SyncStatus, ThreadStatus, ComponentMetadata } from './types';

// Utils
export { getComponentMetadata, getComponentPath, findNearestComponentElement } from './utils/componentUtils';
