/**
 * INPUT: query string, skill list from IPC
 * OUTPUT: autocomplete popover for /skill-name commands
 * POSITION: overlay above ChatInputArea for skill activation
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ThunderboltOutlined } from '@ant-design/icons';

interface SkillItem {
  name: string;
  description: string;
  enabled: boolean;
}

interface SkillCommandPopoverProps {
  query: string;
  visible: boolean;
  onSelect: (skillName: string) => void;
  onClose: () => void;
}

/** Skill command autocomplete popover */
export const SkillCommandPopover: React.FC<SkillCommandPopoverProps> = ({
  query, visible, onSelect, onClose,
}) => {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Load skills once on mount
  useEffect(() => {
    window.api.skillsList().then((result) => {
      if (result?.success) {
        setSkills((result.data ?? []).filter((s: SkillItem) => s.enabled));
      }
    }).catch(() => { /* ignore */ });
  }, []);

  // Filter skills by query (text after /)
  const keyword = useMemo(() => {
    if (!query.startsWith('/')) return '';
    const spaceIdx = query.indexOf(' ');
    return spaceIdx === -1 ? query.slice(1) : query.slice(1, spaceIdx);
  }, [query]);

  const filtered = useMemo(() => {
    if (!keyword) return skills;
    const q = keyword.toLowerCase();
    return skills.filter(
      (s) => s.name.includes(q) || s.description.toLowerCase().includes(q),
    );
  }, [skills, keyword]);

  // Reset active index on filter change
  useEffect(() => setActiveIndex(0), [filtered]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!visible || filtered.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // Only intercept if user hasn't typed a space yet (still selecting)
      if (!query.includes(' ') || query.endsWith('/')) {
        e.preventDefault();
        e.stopPropagation();
        onSelect(filtered[activeIndex].name);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [visible, filtered, activeIndex, query, onSelect, onClose]);

  useEffect(() => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown, true);
      return () => document.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [visible, handleKeyDown]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 z-50">
      <div
        ref={listRef}
        className="mx-3 rounded-lg border border-white/10 bg-[#1a1a2e] shadow-xl overflow-y-auto"
        style={{ maxHeight: 240 }}
      >
        {filtered.map((skill, idx) => (
          <button
            key={skill.name}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
              idx === activeIndex
                ? 'bg-primary/15 text-white'
                : 'text-white/80 hover:bg-white/5'
            }`}
            onMouseEnter={() => setActiveIndex(idx)}
            onClick={(e) => { e.preventDefault(); onSelect(skill.name); }}
          >
            <ThunderboltOutlined className="text-primary text-sm flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">/{skill.name}</div>
              <div className="text-xs text-white/40 truncate">{skill.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
