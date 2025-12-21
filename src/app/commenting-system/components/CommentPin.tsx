import * as React from 'react';
import { Button } from '@patternfly/react-core';
import { CommentIcon } from '@patternfly/react-icons';

interface CommentPinProps {
  xPercent: number;
  yPercent: number;
  commentCount: number;
  isClosed?: boolean;
  isSelected: boolean;
  onClick: () => void;
}

export const CommentPin: React.FunctionComponent<CommentPinProps> = ({
  xPercent,
  yPercent,
  commentCount,
  isClosed = false,
  isSelected,
  onClick,
}) => {
  return (
    <Button
      variant="plain"
      data-comment-pin
      style={{
        position: 'absolute',
        left: `${xPercent}%`,
        top: `${yPercent}%`,
        transform: 'translate(-50%, -50%)',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        backgroundColor: isClosed ? 'var(--pf-t--global--icon--color--subtle)' : '#C9190B',
        color: 'white',
        border: isSelected ? '3px solid #0066CC' : '2px solid white',
        boxShadow: isSelected
          ? '0 0 0 3px rgba(0, 102, 204, 0.3), 0 2px 8px rgba(0,0,0,0.3)'
          : '0 2px 8px rgba(0,0,0,0.3)',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
        pointerEvents: 'auto',
      }}
      onClick={onClick}
      aria-label={`${isClosed ? 'Closed ' : ''}comment thread with ${commentCount} comment${commentCount !== 1 ? 's' : ''}`}
    >
      {commentCount === 0 ? (
        <CommentIcon style={{ fontSize: '16px' }} />
      ) : commentCount === 1 ? (
        <CommentIcon style={{ fontSize: '16px' }} />
      ) : (
        <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{commentCount}</span>
      )}
    </Button>
  );
};
