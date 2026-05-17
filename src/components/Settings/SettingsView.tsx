import { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Group,
  Button,
  Text,
  Card,
  ActionIcon,
  Tooltip,
  Switch,
  Progress,
  Divider,
  Title,
  Badge,
  TagsInput,
  Collapse,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconFolderPlus,
  IconRefresh,
  IconTrash,
  IconFolder,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconFilter,
  IconChevronDown,
  IconChevronRight,
} from '@tabler/icons-react';
import { commands } from '../../utils/commands';
import type { IndexerFolder, IndexerStats, IndexProgress } from '../../utils/types';
import { StatsPanel } from './StatsPanel';

export function SettingsView() {
  const [folders, setFolders] = useState<IndexerFolder[]>([]);
  const [stats, setStats] = useState<IndexerStats>({ folder_count: 0, file_count: 0, total_words: 0, error_count: 0 });
  const [progress, setProgress] = useState<Record<number, IndexProgress>>({});
  const [expandedExcludes, setExpandedExcludes] = useState<Record<number, boolean>>({});

  const loadData = useCallback(async () => {
    try {
      const [f, s] = await Promise.all([commands.listFolders(), commands.getStats()]);
      setFolders(f);
      setStats(s);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadData();
    let unlisten: (() => void) | undefined;
    commands.onProgress((data) => {
      setProgress((prev) => ({ ...prev, [data.folder_id]: data }));
      if (data.done) {
        setTimeout(() => {
          loadData();
          setProgress((prev) => {
            const next = { ...prev };
            delete next[data.folder_id];
            return next;
          });
        }, 500);
      }
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [loadData]);

  const handleAddFolder = async () => {
    try {
      const folder = await commands.addFolder();
      if (folder) {
        const folderName = folder.path.split('\\').pop() || folder.path;
        notifications.show({
          title: 'Папка добавлена',
          message: `${folderName} — индексация запущена`,
          color: 'olive',
          icon: <IconFolderPlus size={18} />,
          autoClose: 3000,
        });
        await loadData();
      }
    } catch (e) {
      notifications.show({
        title: 'Ошибка',
        message: `Не удалось добавить папку: ${e}`,
        color: 'red',
        icon: <IconX size={18} />,
        autoClose: 5000,
      });
    }
  };

  const handleRemoveFolder = async (id: number, path: string) => {
    try {
      await commands.removeFolder(id);
      const folderName = path.split('\\').pop() || path;
      notifications.show({
        title: 'Папка удалена',
        message: `${folderName} удалена из индекса`,
        color: 'gray',
        icon: <IconTrash size={18} />,
        autoClose: 3000,
      });
      await loadData();
    } catch (e) {
      notifications.show({
        title: 'Ошибка удаления',
        message: `${e}`,
        color: 'red',
        icon: <IconX size={18} />,
        autoClose: 5000,
      });
    }
  };

  const handleReindex = async (id: number, path: string) => {
    try {
      const folderName = path.split('\\').pop() || path;
      notifications.show({
        title: 'Переиндексация',
        message: `${folderName} — запущена...`,
        color: 'blue',
        icon: <IconRefresh size={18} />,
        autoClose: 2000,
      });
      await commands.reindex(id);
    } catch (e) {
      notifications.show({
        title: 'Ошибка переиндексации',
        message: `${e}`,
        color: 'red',
        icon: <IconX size={18} />,
        autoClose: 5000,
      });
    }
  };

  const handleToggleWatcher = async (id: number, enable: boolean) => {
    try {
      await commands.toggleWatcher(id, enable);
      notifications.show({
        title: enable ? 'Отслеживание включено' : 'Отслеживание выключено',
        message: enable
          ? 'Изменения файлов будут отслеживаться автоматически'
          : 'Автоматическое отслеживание отключено',
        color: enable ? 'olive' : 'gray',
        icon: enable ? <IconCheck size={18} /> : <IconAlertTriangle size={18} />,
        autoClose: 2500,
      });
      await loadData();
    } catch (e) {
      notifications.show({
        title: 'Ошибка',
        message: `${e}`,
        color: 'red',
        icon: <IconX size={18} />,
        autoClose: 5000,
      });
    }
  };

  const handleUpdateExcludePatterns = async (id: number, patterns: string[]) => {
    try {
      await commands.updateExcludePatterns(id, patterns);
      // Update local state immediately
      setFolders((prev) =>
        prev.map((f) => (f.id === id ? { ...f, exclude_patterns: patterns } : f))
      );
      notifications.show({
        title: 'Исключения обновлены',
        message: patterns.length > 0
          ? `${patterns.length} паттернов. Переиндексируйте папку для применения.`
          : 'Все исключения сняты.',
        color: 'olive',
        icon: <IconFilter size={18} />,
        autoClose: 3000,
      });
    } catch (e) {
      notifications.show({
        title: 'Ошибка',
        message: `${e}`,
        color: 'red',
        icon: <IconX size={18} />,
        autoClose: 5000,
      });
    }
  };

  const toggleExcludes = (id: number) => {
    setExpandedExcludes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatPath = (path: string) => {
    if (path.length > 60) return '...' + path.slice(-57);
    return path;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Никогда';
    const parts = dateStr.split(' ')[0]?.split('-');
    if (parts?.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <Stack gap="md" p="md" style={{ height: '100%', overflow: 'auto' }}>
      <Title order={4}>Статистика индекса</Title>
      <StatsPanel stats={stats} />

      <Divider />

      <Group justify="space-between">
        <Title order={4}>Отслеживаемые папки</Title>
        <Button
          id="add-folder-btn"
          leftSection={<IconFolderPlus size={18} />}
          size="sm"
          onClick={handleAddFolder}
        >
          Добавить папку
        </Button>
      </Group>

      {folders.length === 0 && (
        <Card padding="xl" withBorder>
          <Stack align="center" gap="xs">
            <IconFolder size={48} color="var(--mantine-color-gray-4)" />
            <Text c="dimmed" size="sm">Нет отслеживаемых папок</Text>
            <Text c="dimmed" size="xs">Нажмите «Добавить папку» чтобы начать индексацию</Text>
          </Stack>
        </Card>
      )}

      <Stack gap="xs">
        {folders.map((folder) => {
          const prog = progress[folder.id];
          const isIndexing = prog && !prog.done;
          const isExcludesOpen = expandedExcludes[folder.id] || false;

          return (
            <Card key={folder.id} padding="sm" radius="md" withBorder>
              <Stack gap="xs">
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                    <IconFolder size={20} color="var(--mantine-color-olive-6)" />
                    <Stack gap={0} style={{ minWidth: 0 }}>
                      <Text size="sm" fw={600} truncate title={folder.path}>
                        {folder.path.split('\\').pop() || folder.path}
                      </Text>
                      <Text size="xs" c="dimmed" truncate title={folder.path}>
                        {formatPath(folder.path)}
                      </Text>
                    </Stack>
                  </Group>

                  <Group gap="xs" wrap="nowrap">
                    <Badge size="xs" variant="light" color="blue">{folder.file_count} файлов</Badge>
                    <Badge size="xs" variant="light" color="gray">
                      {formatDate(folder.last_indexed)}
                    </Badge>
                  </Group>
                </Group>

                {isIndexing && prog && (
                  <Stack gap={2}>
                    <Progress
                      value={(prog.current / Math.max(prog.total, 1)) * 100}
                      color="olive"
                      size="sm"
                      animated
                    />
                    <Text size="xs" c="dimmed">
                      {prog.current} / {prog.total} — {prog.current_file}
                    </Text>
                  </Stack>
                )}

                <Group justify="space-between">
                  <Group gap="sm">
                    <Switch
                      id={`watcher-${folder.id}`}
                      label="Автоотслеживание"
                      size="xs"
                      checked={folder.watch_enabled}
                      onChange={(e) => handleToggleWatcher(folder.id, e.currentTarget.checked)}
                    />
                    <Text
                      size="xs"
                      c="dimmed"
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => toggleExcludes(folder.id)}
                    >
                      <Group gap={4} wrap="nowrap">
                        {isExcludesOpen ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
                        <IconFilter size={12} />
                        Исключения
                        {folder.exclude_patterns.length > 0 && (
                          <Badge size="xs" variant="dot" color="orange">
                            {folder.exclude_patterns.length}
                          </Badge>
                        )}
                      </Group>
                    </Text>
                  </Group>

                  <Group gap={4}>
                    <Tooltip label="Переиндексировать">
                      <ActionIcon
                        variant="subtle"
                        color="olive"
                        size="sm"
                        loading={isIndexing}
                        onClick={() => handleReindex(folder.id, folder.path)}
                      >
                        <IconRefresh size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Удалить из индекса">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={() => handleRemoveFolder(folder.id, folder.path)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>

                {/* Exclude patterns editor */}
                <Collapse in={isExcludesOpen}>
                  <TagsInput
                    size="xs"
                    placeholder="node_modules, .git, ~$*, *.tmp"
                    description="Введите паттерн и нажмите Enter. Примеры: node_modules, *.tmp, ~$*"
                    value={folder.exclude_patterns}
                    onChange={(patterns) => handleUpdateExcludePatterns(folder.id, patterns)}
                  />
                </Collapse>
              </Stack>
            </Card>
          );
        })}
      </Stack>
    </Stack>
  );
}
