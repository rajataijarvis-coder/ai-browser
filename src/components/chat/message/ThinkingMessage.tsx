/**
 * INPUT: thinking content string, completion status, display mode
 * OUTPUT: collapsible thinking process display
 * POSITION: used in workflow planning and agent execution steps
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import { ExpandCollapse, DeepThinking, FinishStatus } from '@/icons/deepfundai-icons';
import { useTranslation } from 'react-i18next';

interface ThinkingDisplayProps {
  content: string;
  isCompleted?: boolean;
  compact?: boolean;
}

/** Collapsible thinking process display */
export const ThinkingDisplay: React.FC<ThinkingDisplayProps> = ({
  content,
  isCompleted = false,
  compact = false
}) => {
  const { t } = useTranslation('chat');
  const [collapsed, setCollapsed] = useState(false);
  const prevCompleted = useRef(isCompleted);

  // Auto-collapse when thinking completes
  useEffect(() => {
    if (compact && isCompleted && !prevCompleted.current) {
      setCollapsed(true);
    }
    prevCompleted.current = isCompleted;
  }, [isCompleted, compact]);

  if (compact) {
    const isThinking = !isCompleted;
    return (
      <div className="my-1">
        {/* Header: shimmer covers entire row when thinking */}
        <div
          className={`inline-flex items-center gap-1.5 cursor-pointer select-none group/thinking ${
            isThinking ? 'thinking-shimmer' : ''
          }`}
          onClick={() => setCollapsed(!collapsed)}
        >
          <BulbOutlined className="text-sm" />
          <span className="text-xs font-medium">
            {t('thinking_process')}
          </span>
          <ExpandCollapse className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </div>

        {/* Content with max height */}
        {!collapsed && (
          <div className="text-sm text-text-12 dark:text-text-12-dark leading-relaxed mt-2 max-h-40 overflow-y-auto">
            {content}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-thinking dark:bg-thinking-dark rounded-lg p-4">
      {/* Header */}
      <div
        className="flex items-center justify-start gap-1 cursor-pointer mb-3"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center space-x-2">
          {isCompleted ? <FinishStatus /> : <DeepThinking />}
          <span className="text-text-01 dark:text-text-01-dark font-medium text-sm">{t('thinking')}</span>
        </div>
        <Button
          type="text"
          size="small"
          icon={collapsed ? <ExpandCollapse className="rotate-180" /> : <ExpandCollapse />}
          className="!text-text-12 dark:!text-text-12-dark hover:!text-text-01 dark:hover:!text-text-01-dark"
        />
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="text-sm text-text-12 dark:text-text-12-dark leading-relaxed">
          {content}
        </div>
      )}
    </div>
  );
};
