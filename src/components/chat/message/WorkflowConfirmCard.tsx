/**
 * INPUT: WorkflowConfirmMessage with workflow data and confirmId
 * OUTPUT: Confirmation card with workflow steps and confirm/cancel buttons
 * POSITION: Inline message component for workflow execution approval
 */

import React, { useState } from 'react';
import { App, Button } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { logger } from '@/utils/logger';
import { Atlas } from '@/icons/deepfundai-icons';
import { StepAgentDisplay } from './AgentMessage';
import { ThinkingDisplay } from './ThinkingMessage';
import type { WorkflowConfirmMessage } from '@/models';

interface WorkflowConfirmCardProps {
  message: WorkflowConfirmMessage;
}

/** Workflow confirmation card with approve/reject actions */
export const WorkflowConfirmCard: React.FC<WorkflowConfirmCardProps> = ({ message }) => {
  const { t } = useTranslation('main');
  const { message: antMessage } = App.useApp();
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'cancelled'>(message.status);
  const workflow = message.workflow as Record<string, any>;

  const handleConfirm = async () => {
    try {
      setStatus('confirmed');
      await window.api.ekoWorkflowConfirmResponse(message.confirmId, true);
    } catch (error) {
      logger.error('Failed to confirm workflow', error, 'WorkflowConfirmCard');
      setStatus('pending');
      antMessage.error(t('workflow_confirm_failed', 'Workflow confirmation failed'));
    }
  };

  const handleCancel = async () => {
    try {
      setStatus('cancelled');
      await window.api.ekoWorkflowConfirmResponse(message.confirmId, false);
    } catch (error) {
      logger.error('Failed to cancel workflow', error, 'WorkflowConfirmCard');
      setStatus('pending');
      antMessage.error(t('workflow_confirm_failed', 'Workflow confirmation failed'));
    }
  };

  const isResolved = status !== 'pending';

  return (
    <div className="workflow-confirm-card space-y-4">
      <div className="flex items-center gap-2">
        <Atlas />
        <span className="text-lg font-bold text-text-01 dark:text-text-01-dark">Atlas</span>
        <span className="text-sm text-text-05 dark:text-text-05-dark">
          — {t('workflow_confirm_title')}
        </span>
      </div>

      {/* Thinking process */}
      {workflow?.thought && (
        <ThinkingDisplay content={workflow.thought} isCompleted={true} />
      )}

      {/* Agent steps */}
      {workflow?.agents?.length > 0 && (
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {workflow.agents.map((agent: any, index: number) => (
            <StepAgentDisplay key={agent.id || index} agent={agent} />
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3 pt-2">
        {isResolved ? (
          <span className={`text-sm font-medium ${
            status === 'confirmed'
              ? 'text-green-500 dark:text-green-400'
              : 'text-red-500 dark:text-red-400'
          }`}>
            {status === 'confirmed' ? t('workflow_confirmed') : t('workflow_cancelled')}
          </span>
        ) : (
          <>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={handleConfirm}
              className="bg-[linear-gradient(135deg,#5E31D8,#8B5CF6)] border-transparent"
            >
              {t('confirm_execute')}
            </Button>
            <Button
              icon={<CloseOutlined />}
              onClick={handleCancel}
              className="!bg-transparent !border-gray-300 dark:!border-white/20 !text-gray-700 dark:!text-gray-300"
            >
              {t('cancel_workflow')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
