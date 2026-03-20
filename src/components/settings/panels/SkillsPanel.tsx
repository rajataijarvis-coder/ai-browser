/**
 * INPUT: Skills IPC APIs for CRUD operations
 * OUTPUT: Skills management panel with grid cards, search, and detail view
 * POSITION: Settings tab for managing skill packages
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ThunderboltOutlined,
  PlusOutlined,
  ImportOutlined,
  FolderOpenOutlined,
  SearchOutlined,
  EllipsisOutlined,
  EyeOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { Typography, Switch, App, Empty, Spin, Input, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '@/components/ui';
import { SkillDetailModal } from './SkillDetailModal';

const { Title, Paragraph } = Typography;

interface SkillPackage {
  name: string;
  description: string;
  path: string;
  source: 'builtin' | 'user';
  enabled: boolean;
  metadata?: {
    author?: string;
    version?: string;
    tags?: string[];
    [key: string]: unknown;
  };
}

/** Single skill card */
const SkillCard: React.FC<{
  skill: SkillPackage;
  onView: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
}> = ({ skill, onView, onDelete, onToggle }) => {
  const { t } = useTranslation('settings');

  const menuItems: MenuProps['items'] = [
    { key: 'view', icon: <EyeOutlined />, label: t('skills.view_detail'), onClick: onView },
    ...(skill.source === 'user'
      ? [{ key: 'delete', icon: <DeleteOutlined />, label: t('skills.delete'), danger: true as const, onClick: onDelete }]
      : []),
  ];

  return (
    <div
      className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 hover:border-primary/30 dark:hover:border-purple-400/30 transition-colors cursor-pointer"
      onClick={onView}
    >
      {/* Name + Switch */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-text-01 dark:text-text-01-dark font-medium text-sm truncate mr-2">
          {skill.name}
        </span>
        <Switch
          size="small"
          checked={skill.enabled}
          onClick={(checked, e) => {
            e.stopPropagation();
            onToggle(checked);
          }}
        />
      </div>

      {/* Description - 2 line clamp */}
      <div className="text-text-12 dark:text-text-12-dark text-xs mb-3 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {skill.description}
      </div>

      {/* Footer: source + menu */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-text-12 dark:text-text-12-dark">
          <ThunderboltOutlined className="text-[10px]" />
          <span>{t(`skills.${skill.source}`)}</span>
        </div>
        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
          <button
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-white/10 text-text-12 dark:text-text-12-dark"
            onClick={(e) => e.stopPropagation()}
          >
            <EllipsisOutlined />
          </button>
        </Dropdown>
      </div>
    </div>
  );
};

/** Skills management panel */
export const SkillsPanel: React.FC = () => {
  const { t } = useTranslation('settings');
  const { message: antMessage, modal } = App.useApp();

  const [skills, setSkills] = useState<SkillPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detailSkill, setDetailSkill] = useState<string | null>(null);

  /** Load skill list */
  const loadSkills = useCallback(async () => {
    try {
      const result = await window.api.skillsList();
      if (result?.success) setSkills(result.data ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  /** Filtered skills */
  const filtered = useMemo(() => {
    if (!search.trim()) return skills;
    const q = search.toLowerCase();
    return skills.filter(
      (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
    );
  }, [skills, search]);

  /** Toggle skill enabled state (local only) */
  const handleToggle = useCallback((name: string, enabled: boolean) => {
    setSkills((prev) => prev.map((s) => (s.name === name ? { ...s, enabled } : s)));
  }, []);

  /** Import skill from zip or folder */
  const handleImport = async (type: 'zip' | 'folder') => {
    try {
      const apiFn = type === 'zip' ? window.api.skillsImportZip : window.api.skillsImportFolder;
      const result = await apiFn();
      if (result?.success && result.data) {
        antMessage.success(t('skills.import_success', { name: result.data.name }));
        loadSkills();
      } else if (result?.error && result.error !== 'Cancelled') {
        antMessage.error(result.error);
      }
    } catch {
      antMessage.error(t('skills.import_error'));
    }
  };

  /** Delete a user skill */
  const handleDelete = (name: string) => {
    modal.confirm({
      title: t('skills.delete'),
      content: t('skills.delete_confirm', { name }),
      okType: 'danger',
      onOk: async () => {
        try {
          const result = await window.api.skillsDelete(name);
          if (result?.success) {
            antMessage.success(t('skills.delete_success'));
            loadSkills();
          } else {
            antMessage.error(result?.error ?? 'Failed');
          }
        } catch {
          antMessage.error('Failed to delete skill');
        }
      },
    });
  };

  /** Add dropdown items */
  const addMenuItems: MenuProps['items'] = [
    { key: 'zip', icon: <ImportOutlined />, label: t('skills.import_zip'), onClick: () => handleImport('zip') },
    { key: 'folder', icon: <FolderOpenOutlined />, label: t('skills.import_folder'), onClick: () => handleImport('folder') },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-8 pb-0">
        <div className="flex items-center gap-3 mb-2">
          <ThunderboltOutlined className="text-3xl text-primary dark:text-purple-400" />
          <Title level={2} className="!text-text-01 dark:!text-text-01-dark !mb-0">
            {t('skills.title')}
          </Title>
        </div>
        <Paragraph className="!text-text-12 dark:!text-text-12-dark !mb-0">
          {t('skills.description')}
        </Paragraph>
      </div>

      {/* Toolbar: search + add */}
      <div className="flex-shrink-0 px-8 pt-5 pb-2">
        <div className="flex items-center gap-3">
          <Input
            prefix={<SearchOutlined className="text-gray-400" />}
            placeholder={t('skills.search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 260 }}
          />
          <div className="flex-1" />
          <Dropdown menu={{ items: addMenuItems }} trigger={['click']}>
            <ActionButton variant="secondary" icon={<PlusOutlined />}>
              {t('skills.add')}
            </ActionButton>
          </Dropdown>
        </div>
      </div>

      {/* Skill grid */}
      <div className="flex-1 min-h-0 px-8 pt-4 pb-8 overflow-y-auto">
        {filtered.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <div className="text-sm text-text-12 dark:text-text-12-dark">
                  {search ? t('skills.no_results') : t('skills.no_skills')}
                </div>
                {!search && (
                  <div className="text-xs text-gray-400 mt-1">{t('skills.no_skills_desc')}</div>
                )}
              </div>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((skill) => (
              <SkillCard
                key={skill.name}
                skill={skill}
                onView={() => setDetailSkill(skill.name)}
                onDelete={() => handleDelete(skill.name)}
                onToggle={(enabled) => handleToggle(skill.name, enabled)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detailSkill && (
        <SkillDetailModal
          skillName={detailSkill}
          open={!!detailSkill}
          onClose={() => setDetailSkill(null)}
          onDelete={(name) => {
            setDetailSkill(null);
            handleDelete(name);
          }}
        />
      )}
    </div>
  );
};
