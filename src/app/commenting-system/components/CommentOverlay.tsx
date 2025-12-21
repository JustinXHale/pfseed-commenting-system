import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { useComments } from '../contexts/CommentContext';
import { CommentPin } from './CommentPin';
import { getVersionFromPathOrQuery } from '../utils/version';

export const CommentOverlay: React.FunctionComponent = () => {
  const location = useLocation();
  const { commentsEnabled, addThread, selectedThreadId, setSelectedThreadId, syncFromGitHub, getThreadsForRoute } = useComments();
  const detectedVersion = getVersionFromPathOrQuery(location.pathname, location.search);
  const overlayRef = React.useRef<HTMLDivElement>(null);

  // Show both open and closed threads as pins (GitHub-style: closed issues still exist)
  const currentThreads = getThreadsForRoute(location.pathname, detectedVersion);

  const handlePageClick = (e: MouseEvent) => {
    if (!commentsEnabled) return;

    // Check if clicking on a pin or any interactive element
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('textarea') ||
      target.closest('[role="button"]') ||
      target.closest('[data-comment-controls]') ||
      target.closest('[data-comment-pin]')
    ) {
      return; // Don't create pin if clicking interactive elements
    }

    // Get the overlay container dimensions (accounts for drawer being open)
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();

    // Calculate percentage based on the content area, not the full window
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

    const threadId = addThread(xPercent, yPercent, location.pathname, detectedVersion);
    setSelectedThreadId(threadId);
  };

  React.useEffect(() => {
    console.log('🔄 CommentOverlay useEffect triggered', { commentsEnabled, pathname: location.pathname, detectedVersion });

    if (commentsEnabled) {
      document.addEventListener('click', handlePageClick);
      // Pull latest changes from GitHub when entering comment mode or switching routes
      console.log('🔄 CommentOverlay calling syncFromGitHub...');
      syncFromGitHub(location.pathname, detectedVersion).catch(() => undefined);
    }

    return () => {
      document.removeEventListener('click', handlePageClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentsEnabled, location.pathname, detectedVersion]);

  // Only show pins when commenting is enabled
  if (!commentsEnabled) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 999,
      }}
    >
      {currentThreads.map((thread) => (
        <CommentPin
          key={thread.id}
          xPercent={thread.xPercent}
          yPercent={thread.yPercent}
          commentCount={thread.comments.length}
          isClosed={thread.status === 'closed'}
          isSelected={selectedThreadId === thread.id}
          onClick={() => setSelectedThreadId(thread.id)}
        />
      ))}
    </div>
  );
};
