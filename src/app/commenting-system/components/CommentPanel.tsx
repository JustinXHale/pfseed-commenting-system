import * as React from 'react';
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
} from '@patternfly/react-core';
import { ExternalLinkAltIcon, GithubIcon, InfoCircleIcon, MagicIcon } from '@patternfly/react-icons';
import { useComments } from '../contexts/CommentContext';
import { DetailsTab } from './DetailsTab';

interface CommentPanelProps {
  children: React.ReactNode;
}

export const CommentPanel: React.FunctionComponent<CommentPanelProps> = ({ children }) => {
  const {
    threads,
    selectedThreadId,
    setSelectedThreadId,
    drawerPinnedOpen,
    setDrawerPinnedOpen,
    addReply,
    updateComment,
    deleteComment,
    deleteThread,
  } = useComments();
  const [newCommentText, setNewCommentText] = React.useState('');
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState('');
  const drawerRef = React.useRef<HTMLSpanElement>(null);
  const [activeTabKey, setActiveTabKey] = React.useState<string | number>('comments');

  const selectedThread = threads.find((t) => t.id === selectedThreadId);
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

  const handleDeleteThread = () => {
    if (selectedThread) {
      deleteThread(selectedThread.id);
    }
  };

  const handleClose = () => {
    setSelectedThreadId(null);
    setDrawerPinnedOpen(false);
    setEditingCommentId(null);
    setEditText('');
    setNewCommentText('');
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

  const JiraTab = (
    <EmptyState icon={InfoCircleIcon} titleText="No Jira links set" headingLevel="h3">
      <EmptyStateBody>Add Jira links/IDs here later (route-based metadata/inheritance).</EmptyStateBody>
    </EmptyState>
  );

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
            <div style={{ paddingTop: '1rem' }}>{JiraTab}</div>
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
                          <Label color="green" icon={<GithubIcon />}>
                            Synced
                          </Label>
                        </div>

                        <div style={{ fontSize: '0.875rem' }}>
                          {/* TODO: wire up issue number + url when GitHub sync is implemented */}
                          <a
                            href="#"
                            onClick={(e) => e.preventDefault()}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <GithubIcon />
                            Issue #—
                            <ExternalLinkAltIcon style={{ fontSize: '0.75rem' }} />
                          </a>
                        </div>

                        <div>
                          {/* TODO: wire up AI summarize when backend is ready */}
                          <Button
                            variant="secondary"
                            icon={<MagicIcon />}
                            onClick={() => {
                              // eslint-disable-next-line no-console
                              console.log('AI Summarize Thread (scaffold)');
                            }}
                            isDisabled={selectedThread.comments.length === 0}
                          >
                            AI Summarize Thread
                          </Button>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  {/* Comments List */}
                  {selectedThread.comments.length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      {selectedThread.comments.map((comment, index) => (
                        <Card key={comment.id} style={{ marginBottom: '1rem' }}>
                          <CardBody>
                            <Title headingLevel="h3" size="xl">
                              Comment #{index + 1}
                            </Title>
                            <div
                              style={{
                                marginTop: '0.25rem',
                                fontSize: '0.875rem',
                                color: 'var(--pf-t--global--text--color--subtle)',
                              }}
                            >
                              @— &nbsp; {formatCommentDate(comment.createdAt)}
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
                                <div style={{ marginTop: '0.75rem' }}>{comment.text}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.5rem' }}>
                              <Button
                                variant="danger"
                                onClick={() => handleDeleteComment(comment.id)}
                              >
                                Delete
                              </Button>
                              <Button variant="link" onClick={() => handleStartEdit(comment.id, comment.text)}>
                                Edit
                              </Button>
                            </div>
                              </div>
                            )}
                          </CardBody>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* Add New Comment */}
                  <div>
                    <Title headingLevel="h3" size="md" style={{ marginBottom: '0.5rem' }}>
                      {selectedThread.comments.length === 0 ? 'Add first comment' : 'Add reply'}
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
                        {selectedThread.comments.length === 0 ? 'Add Comment' : 'Add Reply'}
                      </Button>
                      <Button variant="danger" onClick={handleDeleteThread}>
                        Delete Thread
                      </Button>
                    </div>
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
