import * as React from 'react';
import { Thread, Comment } from '../types';

interface CommentContextType {
  threads: Thread[];
  commentsEnabled: boolean;
  setCommentsEnabled: (enabled: boolean) => void;
  drawerPinnedOpen: boolean;
  setDrawerPinnedOpen: (open: boolean) => void;
  addThread: (xPercent: number, yPercent: number, route: string) => string;
  addReply: (threadId: string, text: string) => void;
  updateComment: (threadId: string, commentId: string, text: string) => void;
  deleteComment: (threadId: string, commentId: string) => void;
  deleteThread: (threadId: string) => void;
  getThreadsForRoute: (route: string) => Thread[];
  selectedThreadId: string | null;
  setSelectedThreadId: (threadId: string | null) => void;
}

const CommentContext = React.createContext<CommentContextType | undefined>(undefined);

export const CommentProvider: React.FunctionComponent<{ children: React.ReactNode }> = ({ children }) => {
  const [threads, setThreads] = React.useState<Thread[]>([]);
  const [commentsEnabled, setCommentsEnabled] = React.useState(false);
  const [selectedThreadId, setSelectedThreadId] = React.useState<string | null>(null);
  const [drawerPinnedOpen, setDrawerPinnedOpen] = React.useState(false);

  const addThread = (xPercent: number, yPercent: number, route: string): string => {
    const threadId = `thread-${Date.now()}`;
    const newThread: Thread = {
      id: threadId,
      xPercent,
      yPercent,
      route,
      comments: [],
    };
    setThreads((prev) => [...prev, newThread]);
    return threadId;
  };

  const addReply = (threadId: string, text: string) => {
    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id === threadId) {
          const newComment: Comment = {
            id: `comment-${Date.now()}`,
            text,
            createdAt: new Date().toISOString(),
          };
          return {
            ...thread,
            comments: [...thread.comments, newComment],
          };
        }
        return thread;
      }),
    );
  };

  const updateComment = (threadId: string, commentId: string, text: string) => {
    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id === threadId) {
          return {
            ...thread,
            comments: thread.comments.map((comment) =>
              comment.id === commentId ? { ...comment, text } : comment,
            ),
          };
        }
        return thread;
      }),
    );
  };

  const deleteComment = (threadId: string, commentId: string) => {
    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id === threadId) {
          return {
            ...thread,
            comments: thread.comments.filter((comment) => comment.id !== commentId),
          };
        }
        return thread;
      }),
    );
  };

  const deleteThread = (threadId: string) => {
    setThreads((prev) => prev.filter((thread) => thread.id !== threadId));
    if (selectedThreadId === threadId) {
      setSelectedThreadId(null);
    }
  };

  const getThreadsForRoute = (route: string): Thread[] => {
    return threads.filter((thread) => thread.route === route);
  };

  const value: CommentContextType = {
    threads,
    commentsEnabled,
    setCommentsEnabled,
    drawerPinnedOpen,
    setDrawerPinnedOpen,
    addThread,
    addReply,
    updateComment,
    deleteComment,
    deleteThread,
    getThreadsForRoute,
    selectedThreadId,
    setSelectedThreadId,
  };

  return <CommentContext.Provider value={value}>{children}</CommentContext.Provider>;
};

export const useComments = (): CommentContextType => {
  const context = React.useContext(CommentContext);
  if (!context) {
    throw new Error('useComments must be used within a CommentProvider');
  }
  return context;
};
