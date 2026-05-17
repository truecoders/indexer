import { useState, useEffect } from 'react';
import {
  MantineProvider,
  AppShell,
  NavLink,
  Group,
  Text,
  ThemeIcon,
  Box,
  Divider,
  Stack,
  Tooltip,
  Loader,
  Progress,
} from '@mantine/core';
import { Notifications, notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import {
  IconSearch,
  IconSettings,
  IconFileSearch,
  IconFolder,
  IconFile,
  IconLetterCase,
  IconCheck,
  IconLoader,
} from '@tabler/icons-react';
import { theme } from './theme';
import { SearchView } from './components/Search/SearchView';
import { SettingsView } from './components/Settings/SettingsView';
import { commands } from './utils/commands';
import type { IndexerStats, IndexProgress } from './utils/types';
import './App.css';

type View = 'search' | 'settings';

function App() {
  const [activeView, setActiveView] = useState<View>('search');
  const [stats, setStats] = useState<IndexerStats>({
    folder_count: 0,
    file_count: 0,
    total_words: 0,
    error_count: 0,
  });
  const [indexingProgress, setIndexingProgress] = useState<Record<number, IndexProgress>>({});

  const loadStats = async () => {
    try {
      const s = await commands.getStats();
      setStats(s);
    } catch (e) {
      console.error(e);
    }
  };

  // Derived: are we currently indexing anything?
  const activeIndexing = Object.values(indexingProgress);
  const isIndexing = activeIndexing.length > 0;

  // Total progress across all active indexing jobs
  const totalCurrent = activeIndexing.reduce((sum, p) => sum + p.current, 0);
  const totalTotal = activeIndexing.reduce((sum, p) => sum + p.total, 0);
  const totalPercent = totalTotal > 0 ? Math.round((totalCurrent / totalTotal) * 100) : 0;

  // Load stats & listen for progress updates
  useEffect(() => {
    loadStats();

    let unlisten: (() => void) | undefined;
    commands
      .onProgress((data) => {
        if (data.done) {
          // Remove from active indexing
          setIndexingProgress((prev) => {
            const next = { ...prev };
            delete next[data.folder_id];
            return next;
          });

          // Show toast notification
          const folderName = data.folder_path.split('\\').pop() || data.folder_path;
          notifications.show({
            title: 'Индексация завершена',
            message: `${folderName}: ${data.total} файлов проиндексировано`,
            color: 'olive',
            icon: <IconCheck size={18} />,
            autoClose: 4000,
          });

          // Re-fetch stats
          setTimeout(loadStats, 300);
        } else {
          // Update active indexing progress
          setIndexingProgress((prev) => ({
            ...prev,
            [data.folder_id]: data,
          }));
        }
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, []);

  // Also refresh stats when switching views
  useEffect(() => {
    loadStats();
  }, [activeView]);

  // Ctrl+F → focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setActiveView('search');
        setTimeout(() => {
          document.getElementById('search-input')?.focus();
        }, 100);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="top-right" zIndex={9999} />
      <AppShell
        navbar={{
          width: 220,
          breakpoint: 0,
        }}
        padding={0}
      >
        <AppShell.Navbar p="xs" style={{ background: 'var(--mantine-color-olive-0)' }}>
          {/* Logo area */}
          <Box mb="md" pt="xs" pb="xs" px="xs">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon size="lg" radius="md" variant="filled" color="olive">
                <IconFileSearch size={20} />
              </ThemeIcon>
              <div>
                <Text size="sm" fw={700} lh={1.2}>Индексатор</Text>
                <Text size="xs" c="dimmed" lh={1.2}>файлов</Text>
              </div>
            </Group>
          </Box>

          {/* Navigation */}
          <NavLink
            id="nav-search"
            label="Поиск"
            leftSection={<IconSearch size={18} />}
            active={activeView === 'search'}
            onClick={() => setActiveView('search')}
            color="olive"
            variant="filled"
            style={{ borderRadius: 'var(--mantine-radius-md)' }}
          />
          <NavLink
            id="nav-settings"
            label="Настройки"
            leftSection={<IconSettings size={18} />}
            active={activeView === 'settings'}
            onClick={() => setActiveView('settings')}
            color="olive"
            variant="filled"
            style={{ borderRadius: 'var(--mantine-radius-md)', marginTop: 4 }}
          />

          {/* Stats & Indexing Status & Version footer */}
          <Box mt="auto" pt="xs">
            {/* Live indexing indicator */}
            {isIndexing && (
              <Box px="xs" mb="xs">
                <Group gap="xs" mb={4} wrap="nowrap">
                  <Loader size={14} color="olive" type="dots" />
                  <Text size="xs" fw={600} c="olive.7">
                    Индексация... {totalPercent}%
                  </Text>
                </Group>
                <Progress
                  value={totalPercent}
                  color="olive"
                  size="xs"
                  animated
                  radius="xl"
                />
                {activeIndexing.length === 1 && activeIndexing[0] && (
                  <Text size="xs" c="dimmed" mt={2} truncate>
                    {activeIndexing[0].current_file}
                  </Text>
                )}
                {activeIndexing.length > 1 && (
                  <Text size="xs" c="dimmed" mt={2}>
                    {activeIndexing.length} папок обрабатывается
                  </Text>
                )}
              </Box>
            )}

            {/* "Index up to date" when not indexing */}
            {!isIndexing && stats.file_count > 0 && (
              <Box px="xs" mb="xs">
                <Group gap="xs" wrap="nowrap">
                  <IconCheck size={14} color="var(--mantine-color-olive-6)" />
                  <Text size="xs" c="olive.7">Индекс актуален</Text>
                </Group>
              </Box>
            )}

            <Divider my="xs" label="Статистика" labelPosition="center" color="gray.3" />
            <Stack gap="xs" px="xs" mb="xs">
              <Tooltip label="Всего отслеживаемых папок" position="right">
                <Group gap="xs" wrap="nowrap">
                  <IconFolder size={16} color="var(--mantine-color-olive-6)" />
                  <Text size="xs" fw={500}>Папок:</Text>
                  <Text size="xs" c="dimmed" style={{ marginLeft: 'auto' }}>
                    {stats.folder_count}
                  </Text>
                </Group>
              </Tooltip>

              <Tooltip label="Успешно проиндексированных файлов" position="right">
                <Group gap="xs" wrap="nowrap">
                  <IconFile size={16} color="var(--mantine-color-blue-6)" />
                  <Text size="xs" fw={500}>Файлов:</Text>
                  <Text size="xs" c="dimmed" style={{ marginLeft: 'auto' }}>
                    {stats.file_count}
                  </Text>
                </Group>
              </Tooltip>

              <Tooltip label="Общее количество слов в индексе" position="right">
                <Group gap="xs" wrap="nowrap">
                  <IconLetterCase size={16} color="var(--mantine-color-teal-6)" />
                  <Text size="xs" fw={500}>Слов:</Text>
                  <Text size="xs" c="dimmed" style={{ marginLeft: 'auto' }}>
                    {stats.total_words.toLocaleString()}
                  </Text>
                </Group>
              </Tooltip>
            </Stack>
            <Divider color="gray.2" my="xs" />
            <Text size="xs" c="dimmed" ta="center">v0.1.0</Text>
          </Box>
        </AppShell.Navbar>

        <AppShell.Main style={{ height: '100vh', overflow: 'hidden' }}>
          <Box style={{ height: '100%' }}>
            {activeView === 'search' && <SearchView />}
            {activeView === 'settings' && <SettingsView />}
          </Box>
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}

export default App;
