import * as React from 'react';
import { Button, Card, CardBody, Title } from '@patternfly/react-core';
import { GripVerticalIcon, TimesIcon, WindowMinimizeIcon } from '@patternfly/react-icons';

interface FloatingWidgetProps {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
}

export const FloatingWidget: React.FunctionComponent<FloatingWidgetProps> = ({ children, onClose, title = 'Hale Commenting System' }) => {
  const [position, setPosition] = React.useState({ x: window.innerWidth - 520, y: 100 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = React.useState(false);
  const widgetRef = React.useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!widgetRef.current) return;
    const rect = widgetRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  };

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Constrain to viewport but allow dragging header even when partially off-screen
  const constrainedPosition = React.useMemo(() => {
    const widgetWidth = 500;
    const widgetHeight = isMinimized ? 60 : 400;
    const maxX = window.innerWidth - 50; // Allow 50px of widget to be visible for dragging
    const maxY = window.innerHeight - 50;
    return {
      x: Math.max(-widgetWidth + 50, Math.min(position.x, maxX)),
      y: Math.max(-widgetHeight + 50, Math.min(position.y, maxY)),
    };
  }, [position, isMinimized]);

  return (
    <div
      ref={widgetRef}
      style={{
        position: 'fixed',
        left: `${constrainedPosition.x}px`,
        top: `${constrainedPosition.y}px`,
        width: '500px',
        height: isMinimized ? '60px' : '80vh',
        maxHeight: '80vh',
        zIndex: 10000,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
        borderRadius: 'var(--pf-t--global--border--radius--medium)',
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      <div
        onMouseDown={handleMouseDown}
        style={{
          padding: '1rem',
          borderBottom: isMinimized ? 'none' : '1px solid var(--pf-t--global--border--color--default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'grab',
          userSelect: 'none',
          backgroundColor: '#ffffff',
          borderRadius: isMinimized ? 'var(--pf-t--global--border--radius--medium)' : 'var(--pf-t--global--border--radius--medium) var(--pf-t--global--border--radius--medium) 0 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
          <GripVerticalIcon style={{ color: 'var(--pf-t--global--text--color--subtle)' }} />
          <Title headingLevel="h2" size="lg">
            {title}
          </Title>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <Button
            variant="plain"
            icon={<WindowMinimizeIcon />}
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(!isMinimized);
            }}
            aria-label={isMinimized ? 'Maximize widget' : 'Minimize widget'}
          />
          <Button variant="plain" icon={<TimesIcon />} onClick={onClose} aria-label="Close widget" />
        </div>
      </div>
      {!isMinimized && (
        <div
          style={{
            overflow: 'auto',
            flex: 1,
            backgroundColor: '#ffffff',
            borderRadius: '0 0 var(--pf-t--global--border--radius--medium) var(--pf-t--global--border--radius--medium)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

