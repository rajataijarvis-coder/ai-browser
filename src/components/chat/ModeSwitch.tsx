// INPUT: taskMode state from parent, i18n translations
// OUTPUT: Mode toggle dropdown for chat/explore switching
// POS: UI control in input area, next to ModelSelector

import React from 'react';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { MessageOutlined, SearchOutlined } from '@ant-design/icons';
import { TaskMode } from '@/models';
import { useTranslation } from 'react-i18next';

interface ModeSwitchProps {
  mode: TaskMode;
  onChange: (mode: TaskMode) => void;
  disabled?: boolean;
}

/** Mode toggle between Chat and Deep Explore */
export const ModeSwitch: React.FC<ModeSwitchProps> = ({ mode, onChange, disabled }) => {
  const { t } = useTranslation('main');

  const items: MenuProps['items'] = [
    {
      key: 'chat',
      icon: <MessageOutlined />,
      label: (
        <div>
          <div className="font-medium">{t('mode_chat')}</div>
          <div className="text-xs text-gray-400">{t('mode_chat_desc')}</div>
        </div>
      ),
      onClick: () => onChange('chat'),
    },
    {
      key: 'explore',
      icon: <SearchOutlined />,
      label: (
        <div>
          <div className="font-medium">{t('mode_explore')}</div>
          <div className="text-xs text-gray-400">{t('mode_explore_desc')}</div>
        </div>
      ),
      onClick: () => onChange('explore'),
    },
  ];

  const icon = mode === 'chat' ? <MessageOutlined /> : <SearchOutlined />;
  const label = mode === 'chat' ? t('mode_chat') : t('mode_explore');

  return (
    <Dropdown
      menu={{ items, selectedKeys: [mode] }}
      trigger={['click']}
      disabled={disabled}
      placement="top"
      overlayClassName="mode-switch-dropdown"
    >
      <button
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 dark:text-gray-400
          hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent"
      >
        {icon}
        <span>{label}</span>
        <span className="text-[10px]">▾</span>
      </button>
    </Dropdown>
  );
};
