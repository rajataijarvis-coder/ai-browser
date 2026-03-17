/**
 * INPUT: workflow data, optional confirmId/confirmStatus/taskId
 * OUTPUT: workflow display with optional edit mode and action buttons
 * POSITION: main workflow visualization in chat message list
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { uuidv4 } from '@/utils/uuid';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { Atlas } from '@/icons/deepfundai-icons';
import { logger } from '@/utils/logger';
import { ThinkingDisplay } from './ThinkingMessage';
import { StepAgentDisplay } from './AgentMessage';
import { EditableStepNode } from './EditableStepNode';
import { WorkflowActions } from './WorkflowActions';

type ConfirmStatus = 'pending' | 'confirmed' | 'regenerating';

interface WorkflowDisplayProps {
  workflow: any;
  taskId?: string;
  confirmId?: string;
  confirmStatus?: ConfirmStatus;
}

/** Workflow display with optional edit mode */
export const WorkflowDisplay: React.FC<WorkflowDisplayProps> = ({
  workflow,
  taskId,
  confirmId,
  confirmStatus
}) => {
  const { t } = useTranslation('main');
  const { message: antMessage } = App.useApp();

  // Local override only during async operations; null = follow props
  const [localStatus, setLocalStatus] = useState<ConfirmStatus | null>(null);
  const currentStatus = localStatus ?? confirmStatus;
  const isEditable = currentStatus === 'pending';

  // Sync: when props change, clear local override
  const prevConfirmId = useRef(confirmId);
  useEffect(() => {
    if (confirmId !== prevConfirmId.current) {
      setLocalStatus(null);
      setEditableAgents(null);
      prevConfirmId.current = confirmId;
    }
  }, [confirmId]);

  // Clear local override when props confirmStatus becomes undefined (regeneration streaming)
  useEffect(() => {
    if (!confirmStatus && localStatus === 'regenerating') {
      setLocalStatus(null);
    }
  }, [confirmStatus, localStatus]);

  // Editable copy of agents for modification
  const [editableAgents, setEditableAgents] = useState<any[] | null>(null);

  // Initialize editable copy when entering edit mode
  useEffect(() => {
    if (isEditable && workflow?.agents && !editableAgents) {
      setEditableAgents(structuredClone(workflow.agents));
    }
  }, [isEditable, workflow?.agents, editableAgents]);

  const displayAgentsForEdit = isEditable ? editableAgents : null;

  // Node edit handlers
  const updateNode = useCallback((agentIdx: number, nodeIdx: number, text: string) => {
    setEditableAgents(prev => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      const node = next[agentIdx]?.nodes?.[nodeIdx];
      if (!node) return prev;
      if (typeof node === 'string') {
        next[agentIdx].nodes[nodeIdx] = text;
      } else {
        node.text = text;
      }
      return next;
    });
  }, []);

  const deleteNode = useCallback((agentIdx: number, nodeIdx: number) => {
    setEditableAgents(prev => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      next[agentIdx]?.nodes?.splice(nodeIdx, 1);
      return next;
    });
  }, []);

  const addNode = useCallback((agentIdx: number, afterNodeIdx: number) => {
    setEditableAgents(prev => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      const newNode = { text: '', type: 'normal', _key: uuidv4(), _isNew: true };
      next[agentIdx]?.nodes?.splice(afterNodeIdx + 1, 0, newNode);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!confirmId) return;
    try {
      setLocalStatus('confirmed');
      const modifiedWorkflow = editableAgents ? { agents: editableAgents } : undefined;
      await window.api.ekoWorkflowConfirmResponse(confirmId, true, modifiedWorkflow);
    } catch (error) {
      logger.error('Failed to confirm workflow', error, 'WorkflowDisplay');
      setLocalStatus(null);
      antMessage.error(t('workflow_confirm_failed', 'Workflow confirmation failed'));
    }
  }, [confirmId, editableAgents, antMessage, t]);

  const handleRegenerate = useCallback(async () => {
    if (!taskId) return;
    try {
      setLocalStatus('regenerating');
      setEditableAgents(null);
      await window.api.ekoRegenerateWorkflow(taskId);
      // Status will be cleared by useEffect when confirmId/confirmStatus changes
    } catch (error) {
      logger.error('Failed to regenerate workflow', error, 'WorkflowDisplay');
      setLocalStatus(null);
      antMessage.error(t('workflow_confirm_failed', 'Workflow regeneration failed'));
    }
  }, [taskId, antMessage, t]);

  if (!workflow) return null;

  const isThoughtCompleted = workflow.agents && workflow.agents.length > 0;
  const displayAgents = displayAgentsForEdit ?? workflow?.agents;

  return (
    <div className="workflow-display space-y-4">
      <div className="flex items-center gap-2">
        <Atlas />
        <span className="text-lg font-bold text-text-01 dark:text-text-01-dark">Atlas</span>
      </div>

      {/* Thinking process */}
      {workflow.thought && (
        <ThinkingDisplay content={workflow.thought} isCompleted={isThoughtCompleted} />
      )}

      {/* Agent steps */}
      {displayAgents && displayAgents.length > 0 && (
        <div className="space-y-3">
          {displayAgents.map((agent: any, agentIdx: number) => (
            isEditable && agent.nodes?.length > 0 ? (
              <EditableAgentBlock
                key={agent.id || agentIdx}
                agent={agent}
                agentIdx={agentIdx}
                onUpdateNode={updateNode}
                onDeleteNode={deleteNode}
                onAddNode={addNode}
              />
            ) : (
              <StepAgentDisplay key={agent.id || agentIdx} agent={agent} />
            )
          ))}
        </div>
      )}

      {/* Action buttons */}
      {currentStatus && (
        <WorkflowActions
          confirmStatus={currentStatus}
          onConfirm={handleConfirm}
          onRegenerate={handleRegenerate}
        />
      )}
    </div>
  );
};

interface EditableAgentBlockProps {
  agent: any;
  agentIdx: number;
  onUpdateNode: (agentIdx: number, nodeIdx: number, text: string) => void;
  onDeleteNode: (agentIdx: number, nodeIdx: number) => void;
  onAddNode: (agentIdx: number, afterNodeIdx: number) => void;
}

/** Agent block with editable step nodes */
const EditableAgentBlock: React.FC<EditableAgentBlockProps> = ({
  agent,
  agentIdx,
  onUpdateNode,
  onDeleteNode,
  onAddNode
}) => {
  const { t } = useTranslation('chat');

  return (
    <div className="step-agent-display text-base">
      <div className="px-2 border-l-2 border-text-05-dark mb-3">
        <div className="flex items-center gap-1 text-text-05 dark:text-text-05-dark font-semibold">
          {agent.name} {t('agent')}
        </div>
        <div className="mt-1">{agent.task}</div>
      </div>

      <div>
        {agent.nodes?.map((node: any, nodeIdx: number) => (
          <EditableStepNode
            key={node._key || nodeIdx}
            node={node}
            nodeIndex={nodeIdx}
            onUpdate={(idx, text) => onUpdateNode(agentIdx, idx, text)}
            onDelete={(idx) => onDeleteNode(agentIdx, idx)}
            onAdd={(idx) => onAddNode(agentIdx, idx)}
          />
        ))}
      </div>
    </div>
  );
};
