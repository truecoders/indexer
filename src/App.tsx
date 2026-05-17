import { useState, useEffect } from 'react';
import {
  MantineProvider,
  AppShell,
  NavLink,
  Group,
  Text,
  ThemeIcon,
  Box,
} from '@mantine/core';
import '@mantine/core/styles.css';
import { IconSearch, IconSettings, IconFileSearch } from '@tabler/icons-react';
import { theme } from './theme';
import { SearchView } from './components/Search/SearchView';
import { SettingsView } from './components/Settings/SettingsView';
import './App.css';

type View = 'search' | 'settings';

function App() {
  const [activeView, setActiveView] = useState<View>('search');

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

          {/* Version footer */}
          <Box mt="auto" pb="xs" px="xs">
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
