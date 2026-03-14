/**
 * Message Components - Unified Exports
 *
 * This module provides all message-related components for the chat interface.
 * Components have been split from a single 522-line file into logical modules.
 */

// Main message list components
export { MessageList, MessageListComponent, MessageItem } from './MessageList';

// Message content components
export { MessageContent, AgentMessageContent } from './ContentMessage';

// Specialized message display components
export { WorkflowDisplay } from './WorkflowMessage';
export { ThinkingDisplay } from './ThinkingMessage';
export { StepAgentDisplay } from './AgentMessage';
export { ToolDisplay } from './ToolMessage';
export { AgentGroupDisplay } from './AgentGroupDisplay';
export { WorkflowConfirmCard } from './WorkflowConfirmCard';

// Default export for backward compatibility
export { default } from './MessageList';
