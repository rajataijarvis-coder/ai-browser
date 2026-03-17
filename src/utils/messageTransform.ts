import { StreamCallbackMessage } from '@jarvis-agent/core';
import type { ChatStreamMessage } from '@jarvis-agent/core';
import { uuidv4 } from '@/utils/uuid';
import { DisplayMessage, WorkflowMessage, AgentGroupMessage, UserMessage, ChatMessage, ToolAction } from '@/models';
import { ChatMessageProcessor } from './chatMessageProcessor';
import { logger } from '@/utils/logger';

// Message transformation and processing class
export class MessageProcessor {
  private messages: DisplayMessage[] = [];
  private workflowMessages = new Map<string, WorkflowMessage>();
  private agentGroups = new Map<string, AgentGroupMessage>();
  private chatProcessor = new ChatMessageProcessor();
  private executionId: string = '';

  // Set execution ID
  public setExecutionId(id: string) {
    this.executionId = id;
  }

  // Process streaming messages and convert to structured display messages
  public processStreamMessage(message: StreamCallbackMessage | ChatStreamMessage): DisplayMessage[] {
    // Route chat messages to dedicated handler
    if (message.streamType === 'chat') {
      return this.processChatStreamMessage(message);
    }

    logger.debug('Processing message:', 'MessageProcessor', message.type);

    switch (message.type) {
      case 'workflow':
        this.handleWorkflowMessage(message);
        break;
      case 'workflow_confirm':
        this.handleWorkflowConfirmMessage(message);
        break;
      case 'agent_start':
        this.handleAgentStartMessage(message);
        break;
      case 'text':
      case 'thinking':
        this.handleTextMessage(message);
        break;
      case 'tool_streaming':
      case 'tool_use':
      case 'tool_running':
      case 'tool_result':
        this.handleToolMessage(message);
        break;
      case 'agent_result':
        this.handleAgentResultMessage(message);
        break;
      case 'finish':
        this.handleFinishMessage(message);
        break;
      case 'error':
        this.handleErrorMessage(message);
        break;
    }

    logger.debug('Current message count:', 'MessageProcessor', this.messages.length);
    return [...this.messages];
  }

  // Handle workflow message
  private handleWorkflowMessage(message: any) {
    const key = `${message.taskId}-${this.executionId}`;
    let workflowMsg = this.workflowMessages.get(key);
    
    if (!workflowMsg) {
      workflowMsg = {
        id: uuidv4(),
        type: 'workflow',
        taskId: message.taskId,
        workflow: message.workflow,
        timestamp: new Date()
      };
      this.workflowMessages.set(key, workflowMsg);
      // Add directly to message list in order
      this.messages.push(workflowMsg);
    } else {
      // Update workflow information, clear confirm state on regeneration
      workflowMsg.workflow = message.workflow;
      if (workflowMsg.confirmId) {
        workflowMsg.confirmId = undefined;
        workflowMsg.confirmStatus = undefined;
      }
    }
  }

  // Merge workflow_confirm into existing workflow message
  private handleWorkflowConfirmMessage(message: any) {
    const key = `${message.taskId}-${this.executionId}`;
    const existing = this.workflowMessages.get(key);

    if (existing) {
      existing.confirmId = message.confirmId;
      existing.confirmStatus = 'pending';
      existing.workflow = message.workflow;
    } else {
      // Fallback: no existing workflow → create with confirm embedded
      const workflowMsg: WorkflowMessage = {
        id: uuidv4(),
        type: 'workflow',
        taskId: message.taskId,
        workflow: message.workflow,
        confirmId: message.confirmId,
        confirmStatus: 'pending',
        timestamp: new Date()
      };
      this.workflowMessages.set(key, workflowMsg);
      this.messages.push(workflowMsg);
    }
  }

  // Handle agent_start message
  private handleAgentStartMessage(message: any) {
    const agentKey = `${message.taskId}-${message.nodeId}-${this.executionId}`;
    
    if (!this.agentGroups.has(agentKey)) {
      const agentGroup: AgentGroupMessage = {
        id: uuidv4(),
        type: 'agent_group',
        taskId: message.taskId,
        agentName: message.agentName,
        agentNode: message.agentNode || message.workflow || null,
        messages: [],
        status: 'running',
        timestamp: new Date()
      };
      this.agentGroups.set(agentKey, agentGroup);
      // Add directly to message list in order
      this.messages.push(agentGroup);
    }

  }

  // Handle text message
  private handleTextMessage(message: any) {
    const agentKey = `${message.taskId}-${message.nodeId}-${this.executionId}`;
    let agentGroup = this.agentGroups.get(agentKey);
    
    if (!agentGroup) {
      // If no corresponding agent group, create one
      agentGroup = {
        id: uuidv4(),
        type: 'agent_group',
        taskId: message.taskId,
        agentName: message.agentName,
        messages: [],
        status: 'running',
        timestamp: new Date()
      };
      this.agentGroups.set(agentKey, agentGroup);
      // Add directly to message list in order
      this.messages.push(agentGroup);
    }

    const msgType = message.type === 'thinking' ? 'thinking' : 'text';
    const streamId = message.streamId || message.id;

    // Skip empty text-end messages (e.g. DeepSeek Reasoner emits empty text)
    if (msgType === 'text' && !message.text && message.streamDone) return;

    // Find or create corresponding message
    let textMessage = agentGroup.messages.find(msg =>
      (msg.type === 'text' || msg.type === 'thinking') && msg.id === streamId
    );

    if (!textMessage) {
      textMessage = msgType === 'thinking'
        ? { type: 'thinking' as const, id: streamId || uuidv4(), content: message.text || '', completed: message.streamDone ?? false }
        : { type: 'text' as const, id: streamId || uuidv4(), content: message.text || '' };
      agentGroup.messages.push(textMessage);
    } else {
      // Update content (support streaming updates)
      if (message.text && 'content' in textMessage) {
        textMessage.content = message.text;
      }
      if (msgType === 'thinking' && message.streamDone !== undefined && 'completed' in textMessage) {
        textMessage.completed = message.streamDone;
      }
    }
  }

  // Handle tool-related messages
  private handleToolMessage(message: any) {
    const agentKey = `${message.taskId}-${message.nodeId}-${this.executionId}`;
    let agentGroup = this.agentGroups.get(agentKey);

    if (!agentGroup) {
      // If no corresponding agent group, create one
      agentGroup = {
        id: uuidv4(),
        type: 'agent_group',
        taskId: message.taskId,
        agentName: message.agentName,
        messages: [],
        status: 'running',
        timestamp: new Date()
      };
      this.agentGroups.set(agentKey, agentGroup);
      // Add directly to message list in order
      this.messages.push(agentGroup);
    }

    // Find or create corresponding tool action
    let toolAction = agentGroup.messages.find(tool => tool.id === message.toolCallId);
    if (!toolAction) {
      toolAction = {
        type: 'tool',
        id: message.toolCallId,
        toolName: message.toolName || message.type,
        params: message.params,
        status: this.mapToolStatus(message.type),
        timestamp: new Date(),
        agentName: message.agentName,
      };
      agentGroup.messages.push(toolAction);
    } else {
      if (toolAction.type === 'tool') {
        // Update tool status
      toolAction.status = this.mapToolStatus(message.type);
      if (message.params) {
        toolAction.params = message.params;
      }
      if (message.type === 'tool_result') {
        toolAction.result = message.result || message.toolResult;
        toolAction.status = 'completed';
      }
      }

    }
  }

  // Handle agent_result message
  private handleAgentResultMessage(message: any) {
    const agentKey = `${message.taskId}-${message.nodeId}-${this.executionId}`;
    let agentGroup = this.agentGroups.get(agentKey);

    if (agentGroup) {
      agentGroup.result = message.result;
      agentGroup.status = 'completed';
    }
  }

  // Handle finish message (token usage)
  private handleFinishMessage(message: any) {
    const agentKey = `${message.taskId}-${message.nodeId}-${this.executionId}`;
    let agentGroup = this.agentGroups.get(agentKey);

    if (agentGroup && message.usage) {
      agentGroup.usage = {
        promptTokens: message.usage.promptTokens,
        completionTokens: message.usage.completionTokens,
        totalTokens: message.usage.totalTokens
      };
    }
  }

  // Map tool status
  private mapToolStatus(messageType: string): 'streaming' | 'use' | 'running' | 'completed' {
    switch (messageType) {
      case 'tool_streaming': return 'streaming';
      case 'tool_use': return 'use';
      case 'tool_running': return 'running';
      case 'tool_result': return 'completed';
      default: return 'use';
    }
  }


  // Add user message
  public addUserMessage(content: string): DisplayMessage[] {
    const userMsg: UserMessage = {
      id: uuidv4(),
      type: 'user',
      content,
      timestamp: new Date()
    };
    
    this.messages.push(userMsg);
    return [...this.messages];
  }

  // Handle error message
  private handleErrorMessage(message: any) {
    logger.error('Error message received', message.error, 'MessageProcessor');

    // Create error message as AgentGroupMessage with error status
    const errorMsg: AgentGroupMessage = {
      id: uuidv4(),
      type: 'agent_group',
      taskId: message.taskId || 'unknown',
      agentName: 'System',
      messages: [
        {
          type: 'text',
          id: uuidv4(),
          content: `❌ Error: ${message.error || 'Unknown error occurred'}\n\n${message.detail || ''}`
        }
      ],
      status: 'error',
      timestamp: new Date()
    };

    this.messages.push(errorMsg);
  }

  /** Process ChatStreamMessage via ChatMessageProcessor */
  private processChatStreamMessage(message: ChatStreamMessage): DisplayMessage[] {
    const isNewMessage = !this.chatProcessor.get(message.messageId);
    const chatMsg = this.chatProcessor.process(message);

    // Append newly created ChatMessage to display list
    if (chatMsg && isNewMessage && message.type === 'chat_start') {
      this.messages.push(chatMsg);
    }

    return [...this.messages];
  }

  // Get current message list
  public getMessages(): DisplayMessage[] {
    return [...this.messages];
  }

  // Set messages (for restoring from history)
  public setMessages(messages: DisplayMessage[]): void {
    this.messages = [...messages];
    // Note: workflowMessages and agentGroups are not restored from history
    // They will be rebuilt when new stream messages arrive
  }

  // Clear messages
  public clearMessages(): void {
    this.messages = [];
    this.workflowMessages.clear();
    this.agentGroups.clear();
    this.chatProcessor.clear();
  }
}