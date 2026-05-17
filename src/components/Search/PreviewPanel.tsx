import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Box,
  Group,
  Text,
  ActionIcon,
  Tooltip,
  Loader,
  Center,
  Stack,
  Badge,
  ScrollArea,
  Divider,
} from '@mantine/core';
import {
  IconX,
  IconChevronUp,
  IconChevronDown,
  IconExternalLink,
  IconFolderOpen,
  IconFileText,
} from '@tabler/icons-react';
import { commands } from '../../utils/commands';
import type { SearchResult } from '../../utils/types';

interface PreviewPanelProps {
  result: SearchResult;
  searchQuery: string;
  onClose: () => void;
}

export function PreviewPanel({ result, searchQuery, onClose }: PreviewPanelProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMatch, setCurrentMatch] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Load file content
  useEffect(() => {
    setLoading(true);
    setError(null);
    setContent(null);
    setCurrentMatch(0);

    commands
      .previewFile(result.path)
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch((err) => {
        setError(`${err}`);
        setLoading(false);
      });
  }, [result.path]);

  // Split text into segments with highlights
  const { segments, matchCount } = useMemo(() => {
    if (!content || !searchQuery.trim()) {
      return { segments: content ? [{ text: content, isMatch: false }] : [], matchCount: 0 };
    }

    const query = searchQuery.trim().toLowerCase();
    const words = query.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) {
      return { segments: [{ text: content, isMatch: false }], matchCount: 0 };
    }

    // Build regex from search words
    const escapedWords = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedWords.join('|')})`, 'gi');

    const parts: { text: string; isMatch: boolean }[] = [];
    let lastIndex = 0;
    let count = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: content.slice(lastIndex, match.index), isMatch: false });
      }
      parts.push({ text: match[0], isMatch: true });
      count++;
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push({ text: content.slice(lastIndex), isMatch: false });
    }

    return { segments: parts, matchCount: count };
  }, [content, searchQuery]);

  // Scroll to current match
  useEffect(() => {
    if (matchCount === 0) return;
    const el = document.getElementById(`preview-match-${currentMatch}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentMatch, matchCount]);

  const goToNext = useCallback(() => {
    setCurrentMatch((prev) => (prev + 1) % matchCount);
  }, [matchCount]);

  const goToPrev = useCallback(() => {
    setCurrentMatch((prev) => (prev - 1 + matchCount) % matchCount);
  }, [matchCount]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'F3' || (e.ctrlKey && e.key === 'g')) {
        e.preventDefault();
        if (e.shiftKey) goToPrev();
        else goToNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, goToNext, goToPrev]);

  const handleOpen = async () => {
    try { await commands.openFile(result.path); } catch (e) { console.error(e); }
  };

  const handleShowInFolder = async () => {
    try { await commands.showInFolder(result.path); } catch (e) { console.error(e); }
  };

  // Render highlighted text
  let matchIndex = 0;
  const renderedContent = segments.map((seg, i) => {
    if (seg.isMatch) {
      const idx = matchIndex++;
      const isCurrent = idx === currentMatch;
      return (
        <mark
          key={i}
          id={`preview-match-${idx}`}
          style={{
            backgroundColor: isCurrent
              ? 'rgba(139, 154, 74, 0.6)'
              : 'rgba(139, 154, 74, 0.25)',
            color: 'inherit',
            padding: '0 1px',
            borderRadius: '2px',
            outline: isCurrent ? '2px solid var(--mantine-color-olive-5)' : 'none',
            transition: 'background-color 0.2s, outline 0.2s',
          }}
        >
          {seg.text}
        </mark>
      );
    }
    return <span key={i}>{seg.text}</span>;
  });

  return (
    <Box
      style={{
        width: 420,
        minWidth: 420,
        height: '100%',
        borderLeft: '1px solid var(--mantine-color-gray-3)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--mantine-color-white)',
      }}
    >
      {/* Header */}
      <Box px="sm" py="xs" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
        <Group justify="space-between" wrap="nowrap" mb={4}>
          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
            <IconFileText size={16} color="var(--mantine-color-olive-6)" />
            <Text size="sm" fw={600} truncate title={result.filename}>
              {result.filename}
            </Text>
          </Group>
          <Group gap={4} wrap="nowrap">
            <Tooltip label="Открыть файл">
              <ActionIcon variant="subtle" color="olive" size="xs" onClick={handleOpen}>
                <IconExternalLink size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Показать в папке">
              <ActionIcon variant="subtle" color="gray" size="xs" onClick={handleShowInFolder}>
                <IconFolderOpen size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Закрыть (Esc)">
              <ActionIcon variant="subtle" color="gray" size="xs" onClick={onClose}>
                <IconX size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <Text size="xs" c="dimmed" truncate title={result.path}>
          {result.path}
        </Text>

        {/* Match navigation */}
        {matchCount > 0 && (
          <>
            <Divider my={4} />
            <Group gap="xs" justify="space-between">
              <Badge size="xs" variant="light" color="olive">
                {currentMatch + 1} из {matchCount} совпадений
              </Badge>
              <Group gap={2}>
                <Tooltip label="Предыдущее (Shift+F3)">
                  <ActionIcon variant="subtle" color="olive" size="xs" onClick={goToPrev}>
                    <IconChevronUp size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Следующее (F3)">
                  <ActionIcon variant="subtle" color="olive" size="xs" onClick={goToNext}>
                    <IconChevronDown size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          </>
        )}
      </Box>

      {/* Content */}
      <ScrollArea style={{ flex: 1 }} ref={scrollAreaRef} p="sm">
        {loading && (
          <Center py="xl">
            <Loader color="olive" size="sm" />
          </Center>
        )}

        {error && (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <Text c="red" size="sm">{error}</Text>
            </Stack>
          </Center>
        )}

        {!loading && !error && content !== null && (
          <Box
            style={{
              fontSize: '13px',
              lineHeight: 1.6,
              fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'var(--mantine-color-gray-8)',
            }}
          >
            {renderedContent}
          </Box>
        )}

        {!loading && !error && content !== null && content.length === 0 && (
          <Center py="xl">
            <Text c="dimmed" size="sm">Файл пуст</Text>
          </Center>
        )}
      </ScrollArea>
    </Box>
  );
}
