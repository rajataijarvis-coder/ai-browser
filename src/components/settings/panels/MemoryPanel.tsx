/**
 * INPUT: MemorySettings from parent, IPC memory APIs
 * OUTPUT: Memory settings + management panel
 * POSITION: Settings tab for cross-session memory system
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Input, App, Tag, Empty, Typography, Select } from 'antd';
import { BulbOutlined, SearchOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { ToggleSetting, SliderSetting } from '../components';
import { SettingsDivider } from '@/components/ui';

const { Title, Paragraph, Text } = Typography;

interface MemorySettings {
  enabled: boolean;
  autoExtract: boolean;
  autoRecall: boolean;
  maxRecallResults: number;
  similarityThreshold: number;
  retentionDays: number;
  memoryModel?: string;
  embeddingModel?: string;
}

interface MemoryEntry {
  id: string;
  content: string;
  source: 'auto' | 'manual';
  createdAt: number;
  updatedAt: number;
  tags: string[];
}

interface MemoryStats {
  total: number;
  auto: number;
  manual: number;
}

interface MemoryPanelProps {
  settings?: MemorySettings;
  onSettingsChange?: (settings: MemorySettings) => void;
}

const DEFAULT_SETTINGS: MemorySettings = {
  enabled: true,
  autoExtract: true,
  autoRecall: true,
  maxRecallResults: 5,
  similarityThreshold: 0.1,
  retentionDays: 90,
};

/** Memory settings and management panel */
export const MemoryPanel: React.FC<MemoryPanelProps> = ({
  settings = DEFAULT_SETTINGS,
  onSettingsChange,
}) => {
  const { t } = useTranslation('settings');
  const { modal, message: antdMessage } = App.useApp();

  const [stats, setStats] = useState<MemoryStats>({ total: 0, auto: 0, manual: 0 });
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [newMemory, setNewMemory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [embeddingModels, setEmbeddingModels] = useState<Array<{ value: string; label: string; group: string }>>([]);

  const handleChange = (updates: Partial<MemorySettings>) => {
    onSettingsChange?.({ ...settings, ...updates });
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, listRes, modelsRes] = await Promise.all([
        window.api.memoryStats(),
        window.api.memoryList(),
        window.api.memoryEmbeddingModels(),
      ]);
      if (statsRes?.success && statsRes.data) setStats(statsRes.data);
      if (listRes?.success) setMemories(listRes.data || []);
      if (modelsRes?.success) setEmbeddingModels(modelsRes.data || []);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = async () => {
    const content = newMemory.trim();
    if (!content) return;
    const res = await window.api.memoryAdd(content);
    if (res?.success) {
      setNewMemory('');
      antdMessage.success('Memory added');
      loadData();
    }
  };

  const handleDelete = async (id: string) => {
    const res = await window.api.memoryDelete(id);
    if (res?.success) loadData();
  };

  const handleClearAll = () => {
    modal.confirm({
      title: t('memory.list.clear_all'),
      content: t('memory.list.clear_confirm'),
      okType: 'danger',
      onOk: async () => {
        await window.api.memoryClear();
        loadData();
      },
    });
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadData();
      return;
    }
    const res = await window.api.memorySearch(searchQuery.trim(), 50);
    if (res?.success) setMemories(res.data || []);
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString();

  /** Group embedding models by provider for Select options */
  const buildGroupedOptions = (models: Array<{ value: string; label: string; group: string }>) => {
    const groups = new Map<string, Array<{ value: string; label: string }>>();
    for (const m of models) {
      const list = groups.get(m.group) || [];
      list.push({ value: m.value, label: m.label });
      groups.set(m.group, list);
    }
    return Array.from(groups.entries()).map(([group, options]) => ({
      label: group,
      options,
    }));
  };

  const sortedMemories = [...memories].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="flex flex-col h-full">
      {/* Fixed header */}
      <div className="flex-shrink-0 p-8 pb-0">
        <div className="flex items-center gap-3 mb-4">
          <BulbOutlined className="text-3xl text-purple-400" />
          <Title level={2} className="!text-text-01 dark:!text-text-01-dark !mb-0">
            {t('memory.title')}
          </Title>
        </div>
        <Paragraph className="!text-text-12 dark:!text-text-12-dark !mb-0">
          {t('memory.feature.enabled_desc')}
        </Paragraph>
      </div>

      {/* Card container */}
      <div className="flex-1 min-h-0 p-8 pt-6">
        <div className="bg-white dark:bg-white/5 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/10 h-full flex flex-col">
          {/* Scrollable content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">

            {/* Memory Feature */}
            <div>
              <Text className="!text-text-01 dark:!text-text-01-dark text-lg font-semibold">
                {t('memory.feature.title')}
              </Text>
              <div className="mt-4">
                <ToggleSetting
                  label={t('memory.feature.enabled')}
                  description={t('memory.feature.enabled_desc')}
                  checked={settings.enabled}
                  onChange={(checked) => handleChange({ enabled: checked })}
                />
              </div>
            </div>

            <SettingsDivider />

            {/* Memory Recall */}
            <div>
              <Text className="!text-text-01 dark:!text-text-01-dark text-lg font-semibold">
                {t('memory.recall.title')}
              </Text>
              <div className="mt-4 space-y-2">
                <ToggleSetting
                  label={t('memory.recall.auto_recall')}
                  description={t('memory.recall.auto_recall_desc')}
                  checked={settings.autoRecall}
                  onChange={(checked) => handleChange({ autoRecall: checked })}
                />
                <SliderSetting
                  label={`${t('memory.recall.max_results')}: ${settings.maxRecallResults}`}
                  description={t('memory.recall.max_results_desc')}
                  min={1}
                  max={20}
                  value={settings.maxRecallResults}
                  onChange={(value) => handleChange({ maxRecallResults: value })}
                />
                <SliderSetting
                  label={`${t('memory.recall.similarity_threshold')}: ${Math.round(settings.similarityThreshold * 100)}%`}
                  description={t('memory.recall.similarity_desc')}
                  min={0}
                  max={100}
                  value={Math.round(settings.similarityThreshold * 100)}
                  onChange={(value) => handleChange({ similarityThreshold: value / 100 })}
                />
                <div className="flex justify-between text-xs text-white/40 px-1 -mt-1">
                  <span>{t('memory.recall.lenient')}</span>
                  <span>{t('memory.recall.strict')}</span>
                </div>
              </div>
            </div>

            <SettingsDivider />

            {/* Memory Extraction */}
            <div>
              <Text className="!text-text-01 dark:!text-text-01-dark text-lg font-semibold">
                {t('memory.extract.title')}
              </Text>
              <div className="mt-4">
                <ToggleSetting
                  label={t('memory.extract.auto_extract')}
                  description={t('memory.extract.auto_extract_desc')}
                  checked={settings.autoExtract}
                  onChange={(checked) => handleChange({ autoExtract: checked })}
                />
              </div>
            </div>

            <SettingsDivider />

            {/* Embedding Model */}
            <div>
              <Text className="!text-text-01 dark:!text-text-01-dark text-lg font-semibold">
                {t('memory.embedding.title')}
              </Text>
              <div className="text-xs text-text-12 dark:text-text-12-dark mt-1 mb-3">
                {t('memory.embedding.desc')}
              </div>
              <Select
                value={settings.embeddingModel || undefined}
                onChange={(value) => handleChange({ embeddingModel: value || undefined })}
                placeholder={t('memory.embedding.placeholder')}
                allowClear
                showSearch
                className="w-full"
                options={buildGroupedOptions(embeddingModels)}
              />
              {embeddingModels.length === 0 && (
                <div className="text-xs text-text-12 dark:text-text-12-dark mt-2">
                  {t('memory.embedding.no_provider')}
                </div>
              )}
            </div>

            <SettingsDivider />

            {/* Statistics */}
            <div>
              <Text className="!text-text-01 dark:!text-text-01-dark text-lg font-semibold">
                {t('memory.stats.title')}
              </Text>
              <div className="mt-4 grid grid-cols-3 gap-4">
                {[
                  { label: t('memory.stats.total'), value: stats.total },
                  { label: t('memory.stats.auto'), value: stats.auto },
                  { label: t('memory.stats.manual'), value: stats.manual },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center p-4 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]">
                    <div className="text-2xl font-bold text-text-01 dark:text-text-01-dark">{value}</div>
                    <div className="text-xs text-text-12 dark:text-text-12-dark mt-1">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <SettingsDivider />

            {/* Add Memory */}
            <div>
              <Text className="!text-text-01 dark:!text-text-01-dark text-lg font-semibold">
                {t('memory.add.title')}
              </Text>
              <div className="mt-4">
                <Input.TextArea
                  value={newMemory}
                  onChange={(e) => setNewMemory(e.target.value)}
                  placeholder={t('memory.add.placeholder')}
                  rows={3}
                  className="mb-3"
                />
                <Button type="primary" block onClick={handleAdd} disabled={!newMemory.trim()}>
                  {t('memory.add.button')}
                </Button>
              </div>
            </div>

            <SettingsDivider />

            {/* Search Memories */}
            <div>
              <Text className="!text-text-01 dark:!text-text-01-dark text-lg font-semibold">
                {t('memory.search.title')}
              </Text>
              <div className="mt-4 flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onPressEnter={handleSearch}
                  placeholder={t('memory.search.placeholder')}
                />
                <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} />
              </div>
            </div>

            <SettingsDivider />

            {/* Memory List */}
            <div>
              <div className="flex items-center justify-between">
                <Text className="!text-text-01 dark:!text-text-01-dark text-lg font-semibold">
                  {t('memory.list.title')}
                </Text>
                <div className="flex gap-2">
                  <Button size="small" icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                    {t('memory.list.refresh')}
                  </Button>
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={handleClearAll} disabled={memories.length === 0}>
                    {t('memory.list.clear_all')}
                  </Button>
                </div>
              </div>

              <div className="mt-4">
                {sortedMemories.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <span className="text-text-12 dark:text-text-12-dark">
                        {t('memory.list.empty')}
                      </span>
                    }
                  />
                ) : (
                  <div className="space-y-2">
                    {sortedMemories.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] group hover:border-gray-300 dark:hover:border-white/10 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-text-01 dark:text-text-01-dark leading-relaxed">{entry.content}</div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Tag color={entry.source === 'auto' ? 'blue' : 'green'} className="text-xs">
                              {entry.source === 'auto' ? t('memory.list.auto') : t('memory.list.manual')}
                            </Tag>
                            <span className="text-xs text-text-12 dark:text-text-12-dark">{formatDate(entry.updatedAt)}</span>
                          </div>
                        </div>
                        <Button
                          type="text"
                          size="small"
                          icon={<DeleteOutlined />}
                          className="opacity-0 group-hover:opacity-100 transition-opacity !text-text-12 dark:!text-text-12-dark hover:!text-red-400"
                          onClick={() => handleDelete(entry.id)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
