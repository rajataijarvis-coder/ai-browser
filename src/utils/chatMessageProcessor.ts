// INPUT: ChatStreamMessage from @jarvis-agent/core
// OUTPUT: Processes chat stream messages into ChatMessage display models
// POS: Sub-processor for MessageProcessor, handles ChatAgent message flow

import type { ChatStreamMessage } from '@jarvis-agent/core';
import { ChatMessage } from '@/models';

/** Processes ChatAgent streaming messages into display-ready ChatMessage */
export class ChatMessageProcessor {
  private chatMessages = new Map<string, ChatMessage>();
  private contentOffsets = new Map<string, number>();

  /** Process a single ChatStreamMessage, returns the ChatMessage if found/created */
  process(message: ChatStreamMessage): ChatMessage | null {
    const { messageId, chatId, type } = message;

    switch (type) {
      case 'chat_start':
        return this.handleChatStart(messageId, chatId);
      case 'text':
      case 'thinking':
        return this.handleTextOrThinking(messageId, message);
      case 'tool_use':
      case 'tool_streaming':
      case 'tool_running':
      case 'tool_result':
        return this.handleToolEvent(messageId, message);
      case 'finish':
        return this.handleFinish(messageId, message);
      case 'chat_end':
        return this.handleChatEnd(messageId, message);
      case 'error':
        return this.handleError(messageId, message);
      default:
        return this.chatMessages.get(messageId) ?? null;
    }
  }

  /** Get existing ChatMessage by messageId */
  get(messageId: string): ChatMessage | undefined {
    return this.chatMessages.get(messageId);
  }

  /** Clear all state */
  clear(): void {
    this.chatMessages.clear();
    this.contentOffsets.clear();
  }

  private handleChatStart(messageId: string, chatId: string): ChatMessage {
    const chatMsg: ChatMessage = {
      id: messageId,
      type: 'chat',
      chatId,
      content: '',
      tools: [],
      thinkings: [],
      status: 'running',
      timestamp: new Date(),
    };
    this.chatMessages.set(messageId, chatMsg);
    return chatMsg;
  }

  private handleTextOrThinking(messageId: string, message: ChatStreamMessage): ChatMessage | null {
    const chatMsg = this.chatMessages.get(messageId);
    if (!chatMsg) return null;

    if (message.type === 'text') {
      const offset = this.contentOffsets.get(messageId) || 0;
      if (message.newTextLength > 0) {
        chatMsg.content = chatMsg.content.slice(0, offset) + message.text;
      } else if (message.newTextLength === 0) {
        this.contentOffsets.set(messageId, chatMsg.content.length);
      }
    } else if (message.type === 'thinking') {
      let thinking = chatMsg.thinkings.find(t => t.id === message.streamId);
      if (!thinking) {
        thinking = { type: 'thinking', id: message.streamId, content: '', completed: false };
        chatMsg.thinkings.push(thinking);
      }
      thinking.content = message.text;
      thinking.completed = message.streamDone ?? false;
    }

    return chatMsg;
  }

  private handleToolEvent(messageId: string, message: ChatStreamMessage): ChatMessage | null {
    const chatMsg = this.chatMessages.get(messageId);
    if (!chatMsg) return null;

    if (message.type === 'tool_streaming') {
      let tool = chatMsg.tools.find(t => t.id === message.toolCallId);
      if (!tool) {
        tool = {
          type: 'tool', id: message.toolCallId, toolName: message.toolName,
          status: 'streaming', timestamp: new Date(), agentName: 'ChatAgent',
        };
        chatMsg.tools.push(tool);
      }
      tool.status = 'streaming';
    } else if (message.type === 'tool_use') {
      let tool = chatMsg.tools.find(t => t.id === message.toolCallId);
      if (tool) {
        tool.params = message.params;
        tool.status = 'use';
      } else {
        chatMsg.tools.push({
          type: 'tool', id: message.toolCallId, toolName: message.toolName,
          params: message.params, status: 'use', timestamp: new Date(), agentName: 'ChatAgent',
        });
      }
    } else if (message.type === 'tool_running') {
      const tool = chatMsg.tools.find(t => t.id === message.toolCallId);
      if (tool) tool.status = 'running';
    } else if (message.type === 'tool_result') {
      const tool = chatMsg.tools.find(t => t.id === message.toolCallId);
      if (tool) {
        tool.status = 'completed';
        tool.params = message.params;
        tool.result = message.toolResult;
      }
    }

    return chatMsg;
  }

  private handleFinish(messageId: string, message: ChatStreamMessage): ChatMessage | null {
    const chatMsg = this.chatMessages.get(messageId);
    if (chatMsg && message.type === 'finish' && message.usage) {
      chatMsg.usage = {
        promptTokens: message.usage.promptTokens,
        completionTokens: message.usage.completionTokens,
        totalTokens: message.usage.totalTokens,
      };
    }
    return chatMsg ?? null;
  }

  private handleChatEnd(messageId: string, message: ChatStreamMessage): ChatMessage | null {
    const chatMsg = this.chatMessages.get(messageId);
    if (chatMsg && message.type === 'chat_end') {
      chatMsg.status = message.error ? 'error' : 'completed';
      chatMsg.error = message.error ?? undefined;
      chatMsg.duration = message.duration;
    }
    return chatMsg ?? null;
  }

  private handleError(messageId: string, message: ChatStreamMessage): ChatMessage | null {
    const chatMsg = this.chatMessages.get(messageId);
    if (chatMsg && message.type === 'error') {
      chatMsg.status = 'error';
      chatMsg.error = String(message.error);
    }
    return chatMsg ?? null;
  }
}
