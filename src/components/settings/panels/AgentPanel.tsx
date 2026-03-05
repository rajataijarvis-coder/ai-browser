/**
 * Agent configuration panel
 * INPUT: Agent config + global MCP services
 * OUTPUT: Updated agent configurations with per-agent MCP selection
 * POSITION: Fourth tab in settings window for agent behavior management
 */

import React, { useState } from 'react';
import {
  RobotOutlined,
  GlobalOutlined,
  FolderOutlined,
  ApiOutlined
} from '@ant-design/icons';
import { Typography, Switch, Input, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import type { AgentConfig } from '@/types';
import type { McpServiceConfig, AgentMcpConfig } from '@/models/settings';
import { SelectableCard } from '@/components/ui';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

type AgentTab = 'browser' | 'file';

/** Tab navigation item */
const TabItem: React.FC<{
  label: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
}> = ({ label, icon, isSelected, onClick }) => (
  <SelectableCard
    selected={isSelected}
    onClick={onClick}
    hoverScale={false}
    className="w-full mb-2 px-4 py-3"
  >
    <div className="flex items-center gap-3 text-left">
      <span className="text-lg text-text-12 dark:text-text-12-dark">{icon}</span>
      <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
    </div>
  </SelectableCard>
);

/** Per-agent MCP service selector */
const McpServiceSelector: React.FC<{
  services: McpServiceConfig[];
  agentMcpConfig: AgentMcpConfig;
  onConfigChange: (config: AgentMcpConfig) => void;
  disabled?: boolean;
}> = ({ services, agentMcpConfig, onConfigChange, disabled }) => {
  const { t } = useTranslation('settings');

  if (services.length === 0) {
    return (
      <div className="text-center py-6 text-text-12 dark:text-text-12-dark">
        <div className="text-2xl mb-2">🔌</div>
        <div className="text-sm">{t('agent.no_mcp_services')}</div>
      </div>
    );
  }

  /** Toggle service enabled state */
  const handleServiceToggle = (serviceId: string, enabled: boolean) => {
    const current = agentMcpConfig[serviceId];
    onConfigChange({
      ...agentMcpConfig,
      [serviceId]: {
        enabled,
        tools: current?.tools ?? {}
      }
    });
  };

  /** Toggle individual tool within a service */
  const handleToolToggle = (serviceId: string, toolName: string, enabled: boolean) => {
    const current = agentMcpConfig[serviceId];
    if (!current) return;
    onConfigChange({
      ...agentMcpConfig,
      [serviceId]: {
        ...current,
        tools: { ...current.tools, [toolName]: { enabled } }
      }
    });
  };

  /** Check if a tool is enabled */
  const isToolEnabled = (serviceId: string, toolName: string): boolean => {
    return agentMcpConfig[serviceId]?.tools[toolName]?.enabled ?? true;
  };

  return (
    <div className="space-y-3">
      {services.map((service) => {
        const serviceConfig = agentMcpConfig[service.id];
        const isEnabled = serviceConfig?.enabled ?? false;

        return (
          <div
            key={service.id}
            className="rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden"
          >
            {/* Service header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-white/5">
              <div className="flex items-center gap-2 min-w-0">
                <ApiOutlined className="text-text-12 dark:text-text-12-dark flex-shrink-0" />
                <Text className="!text-text-01 dark:!text-text-01-dark font-medium text-sm truncate">
                  {service.name}
                </Text>
                {service.tools.length > 0 && (
                  <span className="text-xs text-text-12 dark:text-text-12-dark flex-shrink-0">
                    ({service.tools.length})
                  </span>
                )}
              </div>
              <Switch
                checked={isEnabled}
                onChange={(checked) => handleServiceToggle(service.id, checked)}
                size="small"
                disabled={disabled}
              />
            </div>

            {/* Tool list (visible when service is enabled and has tools) */}
            {isEnabled && service.tools.length > 0 && (
              <div className="border-t border-gray-100 dark:border-white/5 px-4 py-2 space-y-1">
                {service.tools.map((tool) => (
                  <div
                    key={tool.name}
                    className="flex items-center justify-between py-1.5"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="text-sm text-text-01 dark:text-text-01-dark truncate">
                        {tool.name}
                      </div>
                      {tool.description && (
                        <div className="text-xs text-text-12 dark:text-text-12-dark truncate">
                          {tool.description}
                        </div>
                      )}
                    </div>
                    <Switch
                      checked={isToolEnabled(service.id, tool.name)}
                      onChange={(checked) => handleToolToggle(service.id, tool.name, checked)}
                      size="small"
                      disabled={disabled}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface AgentPanelProps {
  settings?: AgentConfig;
  onSettingsChange?: (settings: AgentConfig) => void;
  mcpServices?: McpServiceConfig[];
}

/** Agent configuration panel */
export const AgentPanel: React.FC<AgentPanelProps> = ({
  settings,
  onSettingsChange,
  mcpServices = []
}) => {
  const { t } = useTranslation('settings');
  const [activeTab, setActiveTab] = useState<AgentTab>('browser');

  const tabs: { id: AgentTab; labelKey: string; icon: React.ReactNode }[] = [
    { id: 'browser', labelKey: 'agent.browser_agent', icon: <GlobalOutlined /> },
    { id: 'file', labelKey: 'agent.file_agent', icon: <FolderOutlined /> }
  ];

  /** Update a specific agent's settings */
  const updateAgent = (
    agentKey: 'browserAgent' | 'fileAgent',
    updates: Partial<AgentConfig['browserAgent']>
  ) => {
    if (!settings || !onSettingsChange) return;
    onSettingsChange({
      ...settings,
      [agentKey]: { ...settings[agentKey], ...updates }
    });
  };

  /** Render agent tab content */
  const renderAgentContent = (
    agentKey: 'browserAgent' | 'fileAgent',
    behaviorKey: 'browser' | 'file'
  ) => {
    if (!settings) return null;

    const agentSettings = settings[agentKey];
    const isEnabled = agentSettings?.enabled ?? true;
    const behaviorKeys = behaviorKey === 'browser'
      ? ['analyze', 'commands', 'popups', 'user_help', 'scroll']
      : ['tasks', 'paths', 'naming', 'visualization', 'charts'];

    return (
      <div className="space-y-6">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Text className="!text-text-01 dark:!text-text-01-dark font-medium block">
              {t('agent.enable_agent')}
            </Text>
            <Text className="!text-text-12 dark:text-text-12-dark text-sm">
              {t(`agent.${behaviorKey}_agent_behavior`)}
            </Text>
          </div>
          <Switch
            checked={isEnabled}
            onChange={(enabled) => updateAgent(agentKey, { enabled })}
          />
        </div>

        {/* Default behaviors */}
        <div className="p-4 bg-white dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
          <Text className="!text-text-12 dark:!text-text-12-dark font-medium block mb-3">
            {t('agent.default_behavior')}
          </Text>
          <div className="text-sm text-text-12 dark:text-text-12-dark space-y-1.5">
            {behaviorKeys.map((key) => (
              <div key={key}>• {t(`agent.${behaviorKey}_behaviors.${key}`)}</div>
            ))}
          </div>
        </div>

        {/* Custom prompt */}
        <div>
          <Text className="!text-text-01 dark:!text-text-01-dark font-medium block mb-2">
            {t('agent.custom_prompt')}
          </Text>
          <Text className="!text-text-12 dark:text-text-12-dark text-sm block mb-3">
            {t(`agent.custom_prompt_desc_${behaviorKey}`)}
          </Text>
          <TextArea
            value={agentSettings?.customPrompt ?? ''}
            onChange={(e) => updateAgent(agentKey, { customPrompt: e.target.value })}
            placeholder={t('agent.custom_prompt_placeholder')}
            rows={6}
            disabled={!isEnabled}
            className="bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-text-01 dark:text-text-01-dark placeholder-gray-500"
          />
        </div>

        {/* Per-agent MCP services */}
        <div className="pt-4 border-t border-gray-200 dark:border-white/10">
          <Text className="!text-text-01 dark:!text-text-01-dark font-medium text-base block mb-1">
            {t('agent.mcp_services_title')}
          </Text>
          <Text className="!text-text-12 dark:text-text-12-dark text-sm block mb-4">
            {t('agent.mcp_services_desc')}
          </Text>
          <McpServiceSelector
            services={mcpServices}
            agentMcpConfig={agentSettings?.mcpServices ?? {}}
            onConfigChange={(mcpConfig) => updateAgent(agentKey, { mcpServices: mcpConfig })}
            disabled={!isEnabled}
          />
        </div>
      </div>
    );
  };

  /** Render content based on active tab */
  const renderContent = () => {
    if (!settings) {
      return (
        <div className="flex items-center justify-center h-full">
          <Spin size="large" />
        </div>
      );
    }

    switch (activeTab) {
      case 'browser':
        return renderAgentContent('browserAgent', 'browser');
      case 'file':
        return renderAgentContent('fileAgent', 'file');
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Fixed header */}
      <div className="flex-shrink-0 p-8 pb-0">
        <div className="flex items-center gap-3 mb-4">
          <RobotOutlined className="text-3xl text-primary dark:text-purple-400" />
          <Title level={2} className="!text-text-01 dark:!text-text-01-dark !mb-0">
            {t('agent.title')}
          </Title>
        </div>
        <Paragraph className="!text-text-12 dark:!text-text-12-dark !mb-0">
          {t('agent.description')}
        </Paragraph>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 p-8 pt-6">
        <div className="flex gap-6 h-full">
          {/* Left: Tab navigation */}
          <div className="w-48 flex-shrink-0">
            {tabs.map((tab) => (
              <TabItem
                key={tab.id}
                label={t(tab.labelKey)}
                icon={tab.icon}
                isSelected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </div>

          {/* Right: Content panel */}
          <div className="flex-1 bg-white dark:bg-white/5 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/10 p-6 overflow-y-auto">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};
