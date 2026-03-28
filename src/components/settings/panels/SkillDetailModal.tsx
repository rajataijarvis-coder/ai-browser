/**
 * INPUT: Skill name, IPC API for loading skill content
 * OUTPUT: Modal with file tree sidebar and content preview
 * POSITION: Detail view opened from SkillsPanel
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal, Spin, Empty, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import {
  FileTextOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  EllipsisOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodePreview } from '@/components/file-preview/CodePreview';

interface SkillContent {
  metadata: {
    name: string;
    description: string;
    metadata?: {
      author?: string;
      version?: string;
      tags?: string[];
      [key: string]: unknown;
    };
  };
  instructions: string;
  resources: string[];
}

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: TreeNode[];
}

/** Build tree from flat paths */
function buildFileTree(files: string[], rootName: string): TreeNode {
  const root: TreeNode = { name: rootName, path: '', isDir: true, children: [] };
  for (const file of files) {
    const parts = file.split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1;
      const name = parts[i];
      const dirPath = parts.slice(0, i + 1).join('/');
      let child = current.children?.find((c) => c.name === name);
      if (!child) {
        child = { name, path: isLast ? file : dirPath, isDir: !isLast, children: isLast ? undefined : [] };
        current.children?.push(child);
      }
      current = child;
    }
  }
  return root;
}

/** Recursive file tree item */
const TreeItem: React.FC<{
  node: TreeNode;
  depth: number;
  selected: string;
  onSelect: (path: string) => void;
}> = ({ node, depth, selected, onSelect }) => {
  const [expanded, setExpanded] = useState(true);
  const isSelected = !node.isDir && node.path === selected;

  const handleClick = () => {
    if (node.isDir) setExpanded((v) => !v);
    else onSelect(node.path);
  };

  return (
    <>
      <button
        className={`w-full flex items-center gap-1.5 py-1 rounded cursor-pointer transition-colors text-[13px] ${
          isSelected
            ? 'bg-primary/10 dark:bg-primary/15 text-primary dark:text-purple-300 font-medium'
            : 'text-text-01 dark:text-text-01-dark hover:bg-gray-100 dark:hover:bg-white/5'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px`, paddingRight: 8 }}
        onClick={handleClick}
      >
        {node.isDir ? (
          expanded ? <FolderOpenOutlined className="text-xs opacity-60" /> : <FolderOutlined className="text-xs opacity-60" />
        ) : (
          <FileTextOutlined className="text-xs opacity-60" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {node.isDir && expanded && node.children?.map((child) => (
        <TreeItem key={child.path + child.name} node={child} depth={depth + 1} selected={selected} onSelect={onSelect} />
      ))}
    </>
  );
};

/** Resource file viewer with syntax highlighting */
const ResourceViewer: React.FC<{ skillName: string; filePath: string }> = ({ skillName, filePath }) => {
  const { t } = useTranslation('settings');
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setText(null);
    window.api
      .skillsLoadResource(skillName, filePath)
      .then((result) => {
        if (result?.success) setText(result.data ?? null);
      })
      .catch(() => { /* ignore */ })
      .finally(() => setLoading(false));
  }, [skillName, filePath]);

  if (loading) return <div className="flex items-center justify-center h-full"><Spin /></div>;
  if (text === null) return <Empty description={t('skills.load_failed')} className="mt-20" />;

  return (
    <div className="m-4 rounded-lg border border-gray-200 dark:border-white/10 bg-[#1e1e2e] overflow-hidden" style={{ maxWidth: 'calc(100% - 2rem)' }}>
      <div className="overflow-y-auto overflow-x-hidden w-full" style={{ maxHeight: 'calc(70vh - 100px)' }}>
        <CodePreview content={text} fileName={filePath} showLineNumbers wordWrap />
      </div>
    </div>
  );
};

interface SkillDetailModalProps {
  skillName: string;
  open: boolean;
  onClose: () => void;
  onDelete: (name: string) => void;
}

/** Skill detail modal */
export const SkillDetailModal: React.FC<SkillDetailModalProps> = ({
  skillName, open, onClose, onDelete,
}) => {
  const { t } = useTranslation('settings');
  const [content, setContent] = useState<SkillContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState('SKILL.md');

  useEffect(() => {
    if (!open || !skillName) return;
    setLoading(true);
    setSelectedFile('SKILL.md');
    window.api
      .skillsGetContent(skillName)
      .then((result) => {
        if (result?.success) setContent(result.data ?? null);
      })
      .catch(() => { /* ignore */ })
      .finally(() => setLoading(false));
  }, [open, skillName]);

  const meta = content?.metadata;
  const info = meta?.metadata;

  const tree = useMemo(() => {
    if (!content) return null;
    return buildFileTree(['SKILL.md', ...content.resources], skillName);
  }, [content, skillName]);

  const frontmatter = useMemo(() => {
    if (!meta) return '';
    const lines = [`name: ${meta.name}`, `description: "${meta.description}"`];
    if (info) {
      lines.push('metadata:');
      if (info.author) lines.push(`  author: ${info.author}`);
      if (info.version) lines.push(`  version: "${info.version}"`);
      if (info.tags?.length) lines.push(`  tags: [${info.tags.join(', ')}]`);
    }
    return lines.join('\n');
  }, [meta, info]);

  const handleSelect = useCallback((path: string) => setSelectedFile(path), []);

  const menuItems: MenuProps['items'] = [
    { key: 'delete', icon: <DeleteOutlined />, label: t('skills.delete'), danger: true as const, onClick: () => onDelete(skillName) },
  ];

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      footer={null}
      width={960}
      destroyOnHidden
      styles={{ body: { padding: 0 } }}
    >
      {loading ? (
        <div className="flex items-center justify-center py-20"><Spin size="large" /></div>
      ) : !content ? (
        <div className="py-16"><Empty description={t('skills.load_failed')} /></div>
      ) : (
        <div className="flex flex-col" style={{ height: '70vh' }}>
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-white/10 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-text-01 dark:text-text-01-dark font-semibold text-base">
                {skillName}
              </span>
              <span className="text-text-12 dark:text-text-12-dark text-xs">
                {t('skills.skill_label')}
              </span>
            </div>
            <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
              <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-white/10 text-text-12 dark:text-text-12-dark">
                <EllipsisOutlined className="text-base" />
              </button>
            </Dropdown>
          </div>

          {/* Body */}
          <div className="flex flex-1 min-h-0">
            {/* File tree */}
            <div className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-white/10 overflow-y-auto py-2 px-1.5">
              {tree?.children?.map((node) => (
                <TreeItem key={node.path + node.name} node={node} depth={0} selected={selectedFile} onSelect={handleSelect} />
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 overflow-y-auto">
              {selectedFile === 'SKILL.md' ? (
                <div className="p-6 space-y-5">
                  {/* YAML frontmatter */}
                  <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-white/10">
                    <div className="px-4 py-2 text-xs font-medium text-text-12 dark:text-text-12-dark border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                      YAML
                    </div>
                    <div className="bg-[#1e1e2e]">
                      <CodePreview content={frontmatter} fileName="frontmatter.yaml" showLineNumbers={false} />
                    </div>
                  </div>

                  {/* Markdown with GFM tables/checkboxes */}
                  <div className="markdown-container text-text-01 dark:text-text-01-dark">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {content.instructions}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                <ResourceViewer skillName={skillName} filePath={selectedFile} />
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
