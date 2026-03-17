/**
 * INPUT: confirmStatus, confirm/regenerate callbacks
 * OUTPUT: action buttons for workflow confirmation
 * POSITION: bottom actions of WorkflowDisplay in confirm mode
 */

import React from 'react';
import { Button } from 'antd';
import { CheckOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

interface WorkflowActionsProps {
  confirmStatus: 'pending' | 'confirmed' | 'regenerating';
  onConfirm: () => void;
  onRegenerate: () => void;
}

/** Workflow confirm/regenerate action buttons */
export const WorkflowActions: React.FC<WorkflowActionsProps> = ({
  confirmStatus,
  onConfirm,
  onRegenerate
}) => {
  const { t } = useTranslation('main');

  if (confirmStatus === 'confirmed') {
    return (
      <span className="text-sm font-medium text-green-500 dark:text-green-400">
        {t('workflow_confirmed')}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3 pt-2">
      <Button
        type="primary"
        icon={<CheckOutlined />}
        onClick={onConfirm}
        loading={confirmStatus === 'regenerating'}
        className="bg-[linear-gradient(135deg,#5E31D8,#8B5CF6)] border-transparent"
      >
        {t('confirm_execute')}
      </Button>
      <Button
        icon={<ReloadOutlined />}
        onClick={onRegenerate}
        loading={confirmStatus === 'regenerating'}
        className="!bg-transparent !border-gray-300 dark:!border-white/20 !text-gray-700 dark:!text-gray-300"
      >
        {t('regenerate_workflow')}
      </Button>
    </div>
  );
};
