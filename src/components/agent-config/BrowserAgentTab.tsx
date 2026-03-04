import React from 'react';
import { Card, Switch, Input, Space, Divider, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

interface BrowserAgentConfig {
  enabled: boolean;
  customPrompt?: string;
  [key: string]: unknown;
}

interface BrowserAgentTabProps {
  config: BrowserAgentConfig;
  onConfigChange: (config: BrowserAgentConfig) => void;
}

/**
 * Browser Agent Configuration Tab Component
 * Allows users to enable/disable browser agent and set custom prompt
 */
export const BrowserAgentTab: React.FC<BrowserAgentTabProps> = ({
  config,
  onConfigChange
}) => {
  const { t } = useTranslation('agentConfig');

  return (
    <Card>
      <Space direction="vertical" size="large" className="w-full">
        <div>
          <div className="flex justify-between items-center mb-2">
            <Text strong>{t('enable_browser_agent')}</Text>
            <Switch
              checked={config.enabled}
              onChange={(enabled) =>
                onConfigChange({ ...config, enabled })
              }
            />
          </div>
          <Paragraph type="secondary" className="m-0">
            {t('browser_agent_desc')}
          </Paragraph>
        </div>

        <Divider />

        <div>
          <Text strong>{t('custom_prompt')}</Text>
          <Paragraph type="secondary">
            {t('custom_prompt_desc')}
          </Paragraph>
          <TextArea
            value={config.customPrompt}
            onChange={(e) =>
              onConfigChange({ ...config, customPrompt: e.target.value })
            }
            placeholder={t('browser_prompt_placeholder')}
            rows={6}
            disabled={!config.enabled}
          />
        </div>
      </Space>
    </Card>
  );
};
