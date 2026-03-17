import React from 'react';
import { Input, Button, App } from 'antd';
import { SendMessage, CancleTask, PauseTask, ResumeTask, MicOn, MicOff } from '@/icons/deepfundai-icons';
import { useTranslation } from 'react-i18next';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { logger } from '@/utils/logger';
import { TaskMode } from '@/models';
import { ModeSwitch } from './ModeSwitch';

interface ChatInputAreaProps {
  query: string;
  isCurrentTaskRunning: boolean;
  hasValidProvider?: boolean;
  isPaused?: boolean;
  taskMode?: TaskMode;
  onModeChange?: (mode: TaskMode) => void;
  onQueryChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  onPause?: () => void;
}

/**
 * Chat input area component
 * Handles message input and send/cancel/pause actions
 */
export const ChatInputArea: React.FC<ChatInputAreaProps> = ({
  query,
  isCurrentTaskRunning,
  hasValidProvider = true,
  isPaused = false,
  taskMode = 'chat',
  onModeChange,
  onQueryChange,
  onSend,
  onCancel,
  onPause,
}) => {
  const { t } = useTranslation('main');
  const { message: antdMessage } = App.useApp();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isCurrentTaskRunning) return;
      if (!hasValidProvider) {
        antdMessage.warning(t('no_provider_warning') || 'Please configure AI provider in Settings first');
        return;
      }
      onSend();
    }
  };

  // Voice input hook
  const { isRecording, toggleRecording } = useVoiceInput({
    onTextRecognized: (text) => {
      onQueryChange(query ? `${query} ${text}` : text);
    },
    onError: (error) => {
      antdMessage.error(t('voice_input_error'));
      logger.error('Voice input error', error, 'ChatInputArea');
    },
  });

  return (
    <div className='h-30 gradient-border relative'>
      <Input.TextArea
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('input_placeholder') || '请输入你的问题...'}
        autoSize={{ minRows: 1, maxRows: 4 }}
        className='!bg-transparent border-none !resize-none !outline-none placeholder-text-04-dark focus:!shadow-none !text-base !pt-4 !pb-4 !pl-3.5 !pr-15'
      />
      {/* Mode switch at bottom-left */}
      {onModeChange && (
        <div className="absolute bottom-4 left-3">
          <ModeSwitch mode={taskMode} onChange={onModeChange} disabled={isCurrentTaskRunning} />
        </div>
      )}
      <div className='absolute bottom-4 right-4 flex items-center gap-0.5'>
        {!isCurrentTaskRunning && (
          <Button
            type='text'
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleRecording();
            }}
            className={`!p-0 !w-8 !h-8 !min-w-0 flex items-center justify-center text-lg cursor-pointer rounded-lg transition-all duration-200
              ${isRecording
                ? '!bg-red-500/20 !text-red-500 hover:!bg-red-500/30'
                : 'hover:!bg-white/10 !text-white/50 hover:!text-white/80'
              }`}
            title={isRecording ? t('voice_input_stop') : t('voice_input_start')}
          >
            {isRecording ? <MicOn /> : <MicOff />}
          </Button>
        )}
        {isCurrentTaskRunning ? (
          <div className="flex items-center gap-2">
            {onPause && (
              <Button
                type='text'
                onClick={onPause}
                className='!p-0 !w-8 !h-8 !min-w-0 flex items-center justify-center cursor-pointer rounded-lg transition-all duration-200
                  hover:!bg-white/10 !text-white/70 hover:!text-white'
                title={isPaused ? t('resume_task') : t('pause_task')}
              >
                {isPaused ? <ResumeTask /> : <PauseTask />}
              </Button>
            )}
            <Button
              type='text'
              onClick={onCancel}
              className='!p-0 !w-8 !h-8 !min-w-0 flex items-center justify-center cursor-pointer rounded-lg transition-all duration-200
                hover:!bg-red-500/20 !text-red-500 dark:!text-red-400 hover:!text-red-600 dark:hover:!text-red-300'
            >
              <CancleTask />
            </Button>
          </div>
        ) : (
          <Button
            type='text'
            onClick={() => {
              if (!hasValidProvider) {
                antdMessage.warning(t('no_provider_warning') || 'Please configure AI provider in Settings first');
                return;
              }
              onSend();
            }}
            disabled={!query.trim() || !hasValidProvider}
            className={`!p-0 !w-8 !h-8 !min-w-0 flex items-center justify-center text-lg rounded-lg transition-all duration-200
              ${(!query.trim() || !hasValidProvider)
                ? '!text-white/40 cursor-not-allowed'
                : 'cursor-pointer hover:!bg-white/10 !text-white/50 hover:!text-white/80'
              }`}
            title={!hasValidProvider ? (t('no_provider_tooltip') || 'Configure AI provider first') : ''}
          >
            <SendMessage />
          </Button>
        )}
      </div>
    </div>
  );
};
