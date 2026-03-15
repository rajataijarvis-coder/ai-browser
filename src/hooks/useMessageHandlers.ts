import { useCallback } from 'react';
import type { StreamCallbackMessage, ChatStreamMessage } from '@jarvis-agent/core';
import { Task, ToolAction } from '@/models';

type StreamMessage = StreamCallbackMessage | ChatStreamMessage;
import { MessageProcessor } from '@/utils/messageTransform';
import { useTranslation } from 'react-i18next';
import { uuidv4 } from '@/utils/uuid';
import { detectFileType } from '@/utils/fileDetection';

interface UseMessageHandlersOptions {
  isHistoryMode: boolean;
  isTaskDetailMode: boolean;
  scheduledTaskId?: string;
  taskIdRef: React.RefObject<string>;
  messageProcessorRef: React.RefObject<MessageProcessor>;
  currentTaskId: string;
  tasks: Task[];
  showDetailAgents: string[];
  toolHistory: any[];
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  createTask: (taskId: string, initialData: Partial<Task>) => void;
  replaceTaskId: (oldTaskId: string, newTaskId: string) => void;
  setCurrentTaskId: (taskId: string) => void;
  setCurrentTool: (tool: { toolName: string; operation: string; status: 'running' | 'completed' | 'error' } | null) => void;
  setShowDetail: (show: boolean) => void;
  setToolHistory: (history: any[]) => void;
  addToolHistory: (taskId: string, tool: any) => void;
}

/**
 * Hook for handling message stream callbacks and tool operations
 */
export const useMessageHandlers = ({
  isHistoryMode,
  isTaskDetailMode,
  scheduledTaskId,
  taskIdRef,
  messageProcessorRef,
  currentTaskId,
  tasks,
  showDetailAgents,
  toolHistory,
  updateTask,
  createTask,
  replaceTaskId,
  setCurrentTaskId,
  setCurrentTool,
  setShowDetail,
  setToolHistory,
  addToolHistory,
}: UseMessageHandlersOptions) => {
  const { t } = useTranslation('main');

  const getToolOperation = useCallback((message: StreamCallbackMessage): string => {
    const toolName = (message as any).toolName || '';
    switch (toolName.toLowerCase()) {
      case 'browser':
      case 'browser_navigate':
        return t('tool_operations.browsing_web_page');
      case 'file_write':
      case 'file':
        return t('tool_operations.writing_file');
      case 'file_read':
        return t('tool_operations.reading_file');
      case 'search':
        return t('tool_operations.searching');
      default:
        return t('tool_operations.executing', { toolName });
    }
  }, [t]);

  const getToolStatus = useCallback((messageType: string): 'running' | 'completed' | 'error' => {
    switch (messageType) {
      case 'tool_use':
      case 'tool_streaming':
      case 'tool_running':
        return 'running';
      case 'tool_result':
        return 'completed';
      case 'error':
        return 'error';
      default:
        return 'running';
    }
  }, []);

  const handleFileAttachment = useCallback((toolResult: any) => {
    try {
      let fileInfo: any = toolResult;

      // Parse AI SDK wrapped format
      if (toolResult?.content?.[0]?.type === 'text' && toolResult.content[0].text) {
        try {
          fileInfo = JSON.parse(toolResult.content[0].text);
        } catch (e) {
          console.error('[useMessageHandlers] Failed to parse file info:', e);
          return;
        }
      }

      const { filePath, fileName, previewUrl, size } = fileInfo;
      if (!fileName || !previewUrl) return;

      const fileAttachment = {
        id: uuidv4(),
        name: fileName,
        path: filePath || fileName,
        url: previewUrl,
        type: detectFileType(fileName),
        size,
        createdAt: new Date()
      };

      if (taskIdRef.current) {
        const currentTask = tasks.find(t => t.id === taskIdRef.current);
        const existingFiles = currentTask?.files || [];

        if (!existingFiles.some(f => f.url === previewUrl)) {
          updateTask(taskIdRef.current, {
            files: [...existingFiles, fileAttachment]
          });
        }
      }
    } catch (error) {
      console.error('[useMessageHandlers] Failed to handle file attachment:', error);
    }
  }, [taskIdRef, tasks, updateTask]);

  const handleToolComplete = useCallback(async (message: ToolAction) => {
    try {
      if (!window.api) return;

      let screenshot: string | undefined;
      if (showDetailAgents.includes(message.agentName)) {
        const result = await (window.api as any).getMainViewScreenshot?.();
        if (result?.success && result.data?.imageBase64) {
          screenshot = result.data.imageBase64;
        }
      }

      const toolMessage = {
        ...message,
        screenshot,
        toolSequence: toolHistory.length + 1
      };

      setToolHistory([...toolHistory, toolMessage]);

      if (taskIdRef.current) {
        addToolHistory(taskIdRef.current, toolMessage);
      }
    } catch (error) {
      console.error('[useMessageHandlers] Screenshot failed:', error);
    }
  }, [taskIdRef, showDetailAgents, toolHistory, setToolHistory, addToolHistory]);

  const onMessage = useCallback((message: StreamMessage) => {
    if (isHistoryMode) return;

    // Handle ChatStreamMessage (streamType === 'chat')
    if (message.streamType === 'chat') {
      const chatMsg = message as ChatStreamMessage;

      const updatedMessages = messageProcessorRef.current.processStreamMessage(chatMsg);
      const taskIdToUpdate = taskIdRef.current;
      if (taskIdToUpdate) {
        const updates: Partial<Task> = { messages: updatedMessages };

        // Set task name on first chat_start
        if (chatMsg.type === 'chat_start') {
          const existingTask = tasks.find(t => t.id === taskIdToUpdate);
          if (existingTask?.name?.startsWith('Task ') || existingTask?.name === 'Processing...') {
            updates.name = `Chat ${taskIdToUpdate.slice(0, 8)}`;
          }
        }

        // Update task status on chat_end
        if (chatMsg.type === 'chat_end') {
          updates.status = chatMsg.error ? 'error' : 'done';
          if (chatMsg.error) updates.error = chatMsg.error;
        }

        updateTask(taskIdToUpdate, updates);
      }
      return;
    }

    // Below handles AgentStreamMessage only
    const agentMsg = message as StreamCallbackMessage;
    const updatedMessages = messageProcessorRef.current.processStreamMessage(agentMsg);

    const isCurrentTaskTemporary = taskIdRef.current?.startsWith('temp-');
    const hasRealTaskId = agentMsg.taskId && !agentMsg.taskId.startsWith('temp-');

    if (isCurrentTaskTemporary && hasRealTaskId) {
      const tempTaskId = taskIdRef.current;
      const realTaskId = agentMsg.taskId;

      replaceTaskId(tempTaskId, realTaskId);
      taskIdRef.current = realTaskId;

      updateTask(realTaskId, {
        ...(agentMsg.type === 'workflow' && agentMsg.workflow?.name
          ? { name: agentMsg.workflow.name, workflow: agentMsg.workflow }
          : {}),
        messages: updatedMessages
      });

      return;
    }

    if (agentMsg.taskId && !currentTaskId && !agentMsg.taskId.startsWith('temp-')) {
      setCurrentTaskId(agentMsg.taskId);
    }

    const taskIdToUpdate = agentMsg.taskId || taskIdRef.current;
    if (taskIdToUpdate) {
      const existingTask = tasks.find(task => task.id === taskIdToUpdate);

      if (existingTask) {
        const updates: Partial<Task> = {
          messages: updatedMessages
        };

        if (agentMsg.type === 'workflow' && agentMsg.workflow?.name) {
          updates.name = agentMsg.workflow.name;
          updates.workflow = agentMsg.workflow;
        }

        if (agentMsg.type === 'error') {
          updates.status = 'error';
        }

        updateTask(taskIdToUpdate, updates);
      } else {
        // Task doesn't exist, create it
        const initialData: Partial<Task> = {
          name: (agentMsg.type === 'workflow' && agentMsg.workflow?.name)
            ? agentMsg.workflow.name
            : `Task ${taskIdToUpdate.slice(0, 8)}`,
          workflow: (agentMsg.type === 'workflow' && agentMsg.workflow) ? agentMsg.workflow : undefined,
          messages: updatedMessages,
          status: 'running',
          taskType: isTaskDetailMode ? 'scheduled' : 'normal',
          scheduledTaskId: isTaskDetailMode ? scheduledTaskId : undefined,
          startTime: new Date(),
        };

        taskIdRef.current = taskIdToUpdate;
        setCurrentTaskId(taskIdToUpdate);
        createTask(taskIdToUpdate, initialData);
      }
    }

    if (agentMsg.type.includes('tool')) {
      // Tool event — toolName exists on all tool_* union members
      const toolMsg = agentMsg as StreamCallbackMessage & { toolName?: string };
      setCurrentTool({
        toolName: toolMsg.toolName || 'Unknown tool',
        operation: getToolOperation(agentMsg),
        status: getToolStatus(agentMsg.type)
      });

      if (showDetailAgents.includes(agentMsg.agentName)) {
        setShowDetail(true);
      }

      if (agentMsg.type === 'tool_result') {
        handleToolComplete({
          type: 'tool',
          id: agentMsg.toolCallId,
          toolName: agentMsg.toolName,
          status: 'completed',
          timestamp: new Date(),
          agentName: agentMsg.agentName
        });

        if (agentMsg.toolName === 'file_write' && agentMsg.toolResult) {
          handleFileAttachment(agentMsg.toolResult);
        }
      }
    }
  }, [
    isHistoryMode, taskIdRef, messageProcessorRef, currentTaskId, showDetailAgents,
    updateTask, replaceTaskId, setCurrentTaskId, setCurrentTool, setShowDetail,
    getToolOperation, getToolStatus, handleToolComplete, handleFileAttachment
  ]);

  return {
    onMessage,
    getToolOperation,
    getToolStatus,
    handleToolComplete,
    handleFileAttachment,
  };
};
