// INPUT: ChatMessage from MessageProcessor, markdown renderer
// OUTPUT: Renders ChatAgent streaming response (text + tools + thinking)
// POS: Message display component for chat mode, parallel to AgentGroupDisplay

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { LoadingOutlined } from '@ant-design/icons';
import { ChatMessage, ToolAction } from '@/models';
import { ThinkingDisplay } from './ThinkingMessage';
import { ToolDisplay } from './ToolMessage';

interface ChatMessageDisplayProps {
  message: ChatMessage;
  onToolClick?: (tool: ToolAction) => void;
}

/** Render ChatAgent response message */
export const ChatMessageDisplay: React.FC<ChatMessageDisplayProps> = ({ message, onToolClick }) => {
  const { content, tools, thinkings, status, error } = message;

  return (
    <div className="flex flex-col gap-2">
      {/* Thinking process (compact) */}
      {thinkings.map(thinking => (
        <ThinkingDisplay
          key={thinking.id}
          content={thinking.content}
          isCompleted={thinking.completed}
          compact
        />
      ))}

      {/* Tool calls */}
      {tools.map(tool => (
        <ToolDisplay
          key={tool.id}
          message={tool}
          onToolClick={onToolClick || (() => {})}
        />
      ))}

      {/* Streaming text content */}
      {content && (
        <div className="message-text text-text-12 dark:text-text-12-dark markdown-container">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}

      {/* Loading indicator */}
      {status === 'running' && !content && tools.length === 0 && (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-1">
          <LoadingOutlined />
        </div>
      )}

      {/* Error display */}
      {status === 'error' && error && (
        <div className="text-red-500 text-sm mt-1">
          Error: {error}
        </div>
      )}
    </div>
  );
};
