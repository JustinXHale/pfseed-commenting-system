import * as React from 'react';
import { useLocation } from 'react-router-dom';
import {
  Drawer,
  DrawerActions,
  DrawerCloseButton,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerPanelBody,
  DrawerPanelContent,
  Button,
  TextArea,
  Card,
  CardBody,
  ActionList,
  ActionListItem,
  Title,
  Tabs,
  Tab,
  TabTitleText,
  EmptyState,
  EmptyStateBody,
  Label,
  Spinner,
} from '@patternfly/react-core';
import { ExternalLinkAltIcon, GithubIcon, InfoCircleIcon, TrashIcon } from '@patternfly/react-icons';
import { useComments } from '../contexts/CommentContext';
import { DetailsTab } from './DetailsTab';
import { JiraTab } from './JiraTab';
import { getVersionFromPathOrQuery } from '../utils/version';

interface CommentPanelProps {
  children: React.ReactNode;
}

export const CommentPanel: React.FunctionComponent<CommentPanelProps> = ({ children }) => {
  const {
    getThreadsForRoute,
    selectedThreadId,
    setSelectedThreadId,
    drawerPinnedOpen,
    setDrawerPinnedOpen,
    addReply,
    updateComment,
    deleteComment,
    closeThread,
    reopenThread,
    removePin,
    retrySync,
  } = useComments();
  const location = useLocation();
  const detectedVersion = getVersionFromPathOrQuery(location.pathname, location.search);
  const [newCommentText, setNewCommentText] = React.useState('');
  const [replyingToCommentId, setReplyingToCommentId] = React.useState<string | null>(null);
  const [replyTextByCommentId, setReplyTextByCommentId] = React.useState<Record<string, string>>({});
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState('');
  const drawerRef = React.useRef<HTMLSpanElement>(null);
  const [activeTabKey, setActiveTabKey] = React.useState<string | number>('comments');

  const currentThreads = getThreadsForRoute(location.pathname, detectedVersion);
  const selectedThread = currentThreads.find((t) => t.id === selectedThreadId);
  const isExpanded = !!selectedThreadId || drawerPinnedOpen;

  const onExpand = () => {
    drawerRef.current && drawerRef.current.focus();
  };

  React.useEffect(() => {
    if (selectedThreadId) {
      setActiveTabKey('comments');
    }
  }, [selectedThreadId]);

  React.useEffect(() => {
    if (drawerPinnedOpen && !selectedThreadId) {
      setActiveTabKey('details');
    }
  }, [drawerPinnedOpen, selectedThreadId]);

  const handleAddComment = () => {
    if (newCommentText.trim() && selectedThread) {
      addReply(selectedThread.id, newCommentText.trim());
      setNewCommentText('');
    }
  };

  const handleStartReply = (commentId: string) => {
    setReplyingToCommentId(commentId);
    setReplyTextByCommentId((prev) => ({ ...prev, [commentId]: prev[commentId] ?? '' }));
  };

  const handleCancelReply = () => {
    setReplyingToCommentId(null);
  };

  const handleSubmitReply = (parentCommentId: string) => {
    if (!selectedThread) return;
    const text = (replyTextByCommentId[parentCommentId] || '').trim();
    if (!text) return;
    addReply(selectedThread.id, text, parentCommentId);
    setReplyTextByCommentId((prev) => ({ ...prev, [parentCommentId]: '' }));
    setReplyingToCommentId(null);
  };

  const handleStartEdit = (commentId: string, currentText: string) => {
    setEditingCommentId(commentId);
    setEditText(currentText);
  };

  const handleSaveEdit = (commentId: string) => {
    if (editText.trim() && selectedThread) {
      updateComment(selectedThread.id, commentId, editText.trim());
      setEditingCommentId(null);
      setEditText('');
    }
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditText('');
  };

  const handleDeleteComment = (commentId: string) => {
    if (selectedThread) {
      deleteComment(selectedThread.id, commentId);
    }
  };

  const handleCloseThread = () => {
    if (selectedThread) {
      closeThread(selectedThread.id);
    }
  };

  const handleReopenThread = () => {
    if (selectedThread) {
      reopenThread(selectedThread.id);
    }
  };

  const handleRemovePin = () => {
    if (!selectedThread) return;
    removePin(selectedThread.id);
  };

  const handleClose = () => {
    setSelectedThreadId(null);
    setDrawerPinnedOpen(false);
    setEditingCommentId(null);
    setEditText('');
    setNewCommentText('');
    setReplyingToCommentId(null);
    setReplyTextByCommentId({});
  };

  const formatCommentDate = (isoDate: string): string => {
    const date = new Date(isoDate);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const stripMarkersForDisplay = (text: string): string => {
    return text
      .replace(/<!--\s*hale-reply-to:\d+\s*-->\s*\n?/g, '')
      .replace(/<!--\s*hale-reply-to-local\s*-->\s*\n?/g, '')
      .trimEnd();
  };

  const deriveStatus = () => {
    if (!selectedThread) return 'local' as const;
    if (selectedThread.syncStatus === 'error') return 'error' as const;
    // If we have an issue and any comment hasn't synced yet, treat as pending.
    if (selectedThread.issueNumber && selectedThread.comments.some((c) => !c.githubCommentId)) return 'pending' as const;
    if (selectedThread.issueNumber) return 'synced' as const;
    return selectedThread.syncStatus || 'local';
  };

  const renderSyncLabel = (status?: 'synced' | 'local' | 'pending' | 'syncing' | 'error') => {
    switch (status) {
      case 'synced':
        return (
          <Label color="green" icon={<GithubIcon />}>
            Synced
          </Label>
        );
      case 'local':
        return <Label color="grey">Local</Label>;
      case 'pending':
        return <Label color="blue">Pending…</Label>;
      case 'syncing':
        return (
          <Label color="blue" icon={<Spinner size="sm" />}>
            Syncing…
          </Label>
        );
      case 'error':
        return <Label color="red">Sync error</Label>;
      default:
        return null;
    }
  };

  const panelContent = isExpanded ? (
    <DrawerPanelContent isResizable defaultSize={'500px'} minSize={'300px'}>
      <DrawerHead>
        <span tabIndex={isExpanded ? 0 : -1} ref={drawerRef}>
          <Title headingLevel="h2" size="lg">
            Feedback
          </Title>
        </span>
        <DrawerActions>
          <DrawerCloseButton onClick={handleClose} />
        </DrawerActions>
      </DrawerHead>
      <DrawerPanelBody>
        <Tabs
          activeKey={activeTabKey}
          onSelect={(_event, tabKey) => setActiveTabKey(tabKey)}
          aria-label="Feedback drawer tabs"
        >
          <Tab eventKey="details" title={<TabTitleText>Details</TabTitleText>}>
            <div style={{ paddingTop: '1rem' }}>
              <DetailsTab />
            </div>
          </Tab>
          <Tab eventKey="jira" title={<TabTitleText>Jira</TabTitleText>}>
            <div style={{ paddingTop: '1rem' }}>
              <JiraTab />
            </div>
          </Tab>
          <Tab eventKey="comments" title={<TabTitleText>Comments</TabTitleText>}>
            <div style={{ paddingTop: '1rem' }}>
              {!selectedThread ? (
                <EmptyState icon={InfoCircleIcon} titleText="No pin selected" headingLevel="h3">
                  <EmptyStateBody>Select or create a comment pin to start a thread.</EmptyStateBody>
                </EmptyState>
              ) : (
                <>
                  {/* Thread summary header (scaffold) */}
                  <Card style={{ marginBottom: '1rem' }}>
                    <CardBody>
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.875rem' }}>
                          <strong>Location:</strong> ({selectedThread.xPercent.toFixed(1)}%, {selectedThread.yPercent.toFixed(1)}%)
                        </div>
                        <div style={{ fontSize: '0.875rem' }}>
                          <strong>Comments:</strong> {selectedThread.comments.length}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                          <strong>Status:</strong>
                          {renderSyncLabel(deriveStatus()) ?? <Label color="grey">Local</Label>}
                        </div>

                        <div style={{ fontSize: '0.875rem' }}>
                          {selectedThread.issueNumber && selectedThread.issueUrl ? (
                            <a
                              href={selectedThread.issueUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              <GithubIcon />
                              Issue #{selectedThread.issueNumber}
                              <ExternalLinkAltIcon style={{ fontSize: '0.75rem' }} />
                            </a>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--pf-t--global--text--color--subtle)' }}>
                              <GithubIcon />
                              Issue pending…
                            </span>
                          )}
                        </div>

                        <div>
                          {/* AI summarize removed for now */}
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  {/* Comments List */}
                  {selectedThread.comments.length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      {(() => {
                        const comments = selectedThread.comments;

                        const byId = new Map(comments.map((c) => [c.id, c]));
                        const byGitHubId = new Map<number, string>();
                        for (const c of comments) {
                          if (c.githubCommentId) byGitHubId.set(c.githubCommentId, c.id);
                        }

                        const childrenByParent = new Map<string, string[]>();
                        const topLevel: string[] = [];

                        for (const c of comments) {
                          const parentLocal =
                            c.parentCommentId ||
                            (c.parentGitHubCommentId ? byGitHubId.get(c.parentGitHubCommentId) : undefined);

                          if (parentLocal && byId.has(parentLocal)) {
                            const list = childrenByParent.get(parentLocal) || [];
                            list.push(c.id);
                            childrenByParent.set(parentLocal, list);
                          } else {
                            topLevel.push(c.id);
                          }
                        }

                        const sortByCreatedAt = (aId: string, bId: string) => {
                          const a = byId.get(aId);
                          const b = byId.get(bId);
                          const at = a ? Date.parse(a.createdAt) : 0;
                          const bt = b ? Date.parse(b.createdAt) : 0;
                          return at - bt;
                        };

                        topLevel.sort(sortByCreatedAt);
                        childrenByParent.forEach((list, parentId) => {
                          list.sort(sortByCreatedAt);
                          childrenByParent.set(parentId, list);
                        });

                        const renderNode = (id: string, depth: number, topIndex?: number) => {
                          const comment = byId.get(id);
                          if (!comment) return null;

                          const isReply = depth > 0;
                          const title = isReply ? 'Reply' : `Comment #${(topIndex ?? 0) + 1}`;

                          const children = childrenByParent.get(id) || [];

                          return (
                            <div
                              key={id}
                              style={{
                                marginLeft: depth * 16,
                                marginTop: depth > 0 ? '8px' : undefined,
                                marginBottom: depth > 0 ? '8px' : '1rem',
                              }}
                            >
                              <Card>
                                <CardBody style={{ position: 'relative' }}>
                                  <Button
                                    variant="plain"
                                    icon={<TrashIcon />}
                                    isDanger
                                    aria-label="Delete comment"
                                    title="Delete comment"
                                    onClick={() => handleDeleteComment(comment.id)}
                                    style={{ position: 'absolute', top: '12px', right: '12px' }}
                                  />
                                  <Title headingLevel="h3" size={isReply ? 'lg' : 'xl'} style={{ paddingRight: '2.5rem' }}>
                                    {title}
                                  </Title>
                                  <div
                                    style={{
                                      marginTop: '0.25rem',
                                      fontSize: '0.875rem',
                                      color: 'var(--pf-t--global--text--color--subtle)',
                                      paddingRight: '2.5rem',
                                    }}
                                  >
                                    @{comment.author ?? '—'} &nbsp; {formatCommentDate(comment.createdAt)}
                                  </div>

                                  {editingCommentId === comment.id ? (
                                    <div style={{ marginTop: '0.5rem' }}>
                                      <TextArea
                                        value={editText}
                                        onChange={(_event, value) => setEditText(value)}
                                        aria-label="Edit comment"
                                        rows={3}
                                      />
                                      <ActionList style={{ marginTop: '0.5rem' }}>
                                        <ActionListItem>
                                          <Button variant="primary" onClick={() => handleSaveEdit(comment.id)}>
                                            Save
                                          </Button>
                                        </ActionListItem>
                                        <ActionListItem>
                                          <Button variant="link" onClick={handleCancelEdit}>
                                            Cancel
                                          </Button>
                                        </ActionListItem>
                                      </ActionList>
                                    </div>
                                  ) : (
                                    <div>
                                      <div style={{ marginTop: '0.75rem', whiteSpace: 'pre-wrap' }}>
                                        {stripMarkersForDisplay(comment.text)}
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.5rem' }}>
                                        <Button variant="primary" onClick={() => handleStartReply(comment.id)}>
                                          Reply
                                        </Button>
                                        <Button variant="link" onClick={() => handleStartEdit(comment.id, stripMarkersForDisplay(comment.text))}>
                                          Edit
                                        </Button>
                                      </div>
                                    </div>
                                  )}

                                  {replyingToCommentId === comment.id && (
                                    <div style={{ marginTop: '0.75rem' }}>
                                      <Title headingLevel="h4" size="md" style={{ marginBottom: '0.5rem' }}>
                                        Reply to this comment
                                      </Title>
                                      <TextArea
                                        value={replyTextByCommentId[comment.id] || ''}
                                        onChange={(_event, value) =>
                                          setReplyTextByCommentId((prev) => ({ ...prev, [comment.id]: value }))
                                        }
                                        placeholder="Type your reply..."
                                        aria-label="Reply to comment"
                                        rows={3}
                                      />
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.5rem' }}>
                                        <Button
                                          variant="primary"
                                          onClick={() => handleSubmitReply(comment.id)}
                                          isDisabled={!(replyTextByCommentId[comment.id] || '').trim()}
                                        >
                                          Post reply
                                        </Button>
                                        <Button variant="link" onClick={handleCancelReply}>
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </CardBody>
                              </Card>

                              {children.map((childId) => renderNode(childId, depth + 1))}
                            </div>
                          );
                        };

                        return <>{topLevel.map((id, idx) => renderNode(id, 0, idx))}</>;
                      })()}
                    </div>
                  )}

                  {/* Add New Comment */}
                  <div>
                    {selectedThread.status === 'closed' ? (
                      <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'var(--pf-t--global--background--color--secondary--default)', borderRadius: 'var(--pf-t--global--border--radius--medium)' }}>
                        <Title headingLevel="h3" size="md" style={{ marginBottom: '0.5rem' }}>
                          🔒 Thread Closed
                        </Title>
                        <p style={{ color: 'var(--pf-t--global--text--color--subtle)', marginBottom: '1rem' }}>
                          This thread has been closed and locked. Reopen it to add new comments.
                        </p>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                           <Button variant="primary" onClick={handleReopenThread}>
                             Reopen Thread
                           </Button>
                           <Button variant="link" isDanger onClick={handleRemovePin}>
                             Remove pin
                           </Button>
                         </div>
                      </div>
                    ) : (
                      <>
                        <Title headingLevel="h3" size="md" style={{ marginBottom: '0.5rem' }}>
                          Add comment
                        </Title>
                        <TextArea
                          value={newCommentText}
                          onChange={(_event, value) => setNewCommentText(value)}
                          placeholder="Type your comment..."
                          aria-label="New comment"
                          rows={4}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '1rem' }}>
                          <Button variant="primary" onClick={handleAddComment} isDisabled={!newCommentText.trim()}>
                            Add Comment
                          </Button>
                          <Button variant="secondary" onClick={handleCloseThread}>
                            Close Thread
                          </Button>
                           <Button variant="link" isDanger onClick={handleRemovePin}>
                             Remove pin
                           </Button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </Tab>
        </Tabs>
      </DrawerPanelBody>
    </DrawerPanelContent>
  ) : null;

  return (
    <Drawer isExpanded={isExpanded} isInline onExpand={onExpand}>
      <DrawerContent panelContent={panelContent}>
        <DrawerContentBody style={{ position: 'relative' }}>{children}</DrawerContentBody>
      </DrawerContent>
    </Drawer>
  );
};
