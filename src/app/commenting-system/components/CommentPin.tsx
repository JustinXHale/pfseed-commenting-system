import * as React from 'react';
import { Button } from '@patternfly/react-core';
import { CommentIcon } from '@patternfly/react-icons';
import { findElementBySelector } from '../utils/selectorUtils';

interface CommentPinProps {
  cssSelector?: string;
  xPercent: number;
  yPercent: number;
  commentCount: number;
  isClosed?: boolean;
  isSelected: boolean;
  onClick: () => void;
}

export const CommentPin: React.FunctionComponent<CommentPinProps> = ({
  cssSelector,
  xPercent,
  yPercent,
  commentCount,
  isClosed = false,
  isSelected,
  onClick,
}) => {
  const [position, setPosition] = React.useState({ left: `${xPercent}%`, top: `${yPercent}%` });
  const [elementExists, setElementExists] = React.useState(true);

  const updatePosition = React.useCallback(() => {
    if (!cssSelector) {
      // No selector - use fallback coordinates
      setPosition({ left: `${xPercent}%`, top: `${yPercent}%` });
      setElementExists(true);
      return;
    }

    const element = findElementBySelector(cssSelector);
    if (element) {
      // Element found - position pin at top-left of element
      const rect = element.getBoundingClientRect();
      
      // Find the overlay container - it should be a parent with data-comment-overlay
      // or find the CommentPanel's relative container
      let overlayContainer: Element | null = null;
      let current: Element | null = element;
      
      // Walk up the DOM to find the overlay or its parent container
      while (current && current !== document.body) {
        if (current.hasAttribute('data-comment-overlay')) {
          overlayContainer = current;
          break;
        }
        // Also check if parent has position relative (likely the CommentPanel wrapper)
        const parent = current.parentElement;
        if (parent) {
          const style = window.getComputedStyle(parent);
          if (style.position === 'relative') {
            overlayContainer = parent;
            break;
          }
        }
        current = parent;
      }
      
      // If no overlay found, use the element's offsetParent or body
      if (!overlayContainer) {
        overlayContainer = (element as HTMLElement).offsetParent as Element || document.body;
      }
      
      const overlayRect = overlayContainer.getBoundingClientRect();
      
      // Position at top-left of element, offset by 4px (just outside the element border)
      // Use absolute pixel positioning relative to the overlay container
      const leftPx = rect.left - overlayRect.left + 4;
      const topPx = rect.top - overlayRect.top + 4;

      setPosition({ left: `${leftPx}px`, top: `${topPx}px` });
      setElementExists(true);
    } else {
      // Element not found - fall back to stored coordinates and fade
      setPosition({ left: `${xPercent}%`, top: `${yPercent}%` });
      setElementExists(false);
    }
  }, [cssSelector, xPercent, yPercent]);

  React.useEffect(() => {
    updatePosition();

    // Update position on scroll and resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [updatePosition]);

  const opacity = elementExists ? 1.0 : 0.4;

  return (
    <Button
      variant="plain"
      data-comment-pin
      style={{
        position: 'absolute',
        left: position.left,
        top: position.top,
        transform: 'translate(0, 0)',
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
        opacity,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={`${isClosed ? 'Closed ' : ''}comment thread with ${commentCount} comment${commentCount !== 1 ? 's' : ''}${!elementExists ? ' (element deleted)' : ''}`}
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
