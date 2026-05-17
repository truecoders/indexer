import { useState, useEffect, useCallback } from 'react';
import {
  TextInput,
  SegmentedControl,
  Select,
  MultiSelect,
  Stack,
  Group,
  Text,
  Center,
  Loader,
  Badge,
  Box,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch, IconFileOff } from '@tabler/icons-react';
import { commands } from '../../utils/commands';
import type { SearchResult, IndexerFolder, SearchMode, MatchType } from '../../utils/types';
import { ResultCard } from './ResultCard';

export function SearchView() {
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 300);
  const [mode, setMode] = useState<SearchMode>('all');
  const [matchType, setMatchType] = useState<MatchType>('partial');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [fileTypes, setFileTypes] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState<IndexerFolder[]>([]);

  // Load folders for filter
  useEffect(() => {
    commands.listFolders().then(setFolders).catch(console.error);
  }, []);

  // Search
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    commands
      .search(
        debouncedQuery,
        mode,
        matchType,
        folderId ? parseInt(folderId) : null,
        fileTypes.length > 0 ? fileTypes : null,
      )
      .then((res) => {
        setResults(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [debouncedQuery, mode, matchType, folderId, fileTypes]);

  const folderOptions = folders.map((f) => ({
    value: f.id.toString(),
    label: f.path.split('\\').pop() || f.path,
  }));

  const fileTypeOptions = [
    { value: 'docx', label: 'Word (.docx)' },
    { value: 'xlsx', label: 'Excel (.xlsx)' },
    { value: 'xls', label: 'Excel (.xls)' },
    { value: 'txt', label: 'Текст (.txt)' },
    { value: 'md', label: 'Markdown (.md)' },
    { value: 'csv', label: 'CSV (.csv)' },
  ];

  return (
    <Stack gap="md" p="md" style={{ height: '100%', overflow: 'hidden' }}>
      {/* Search input */}
      <TextInput
        id="search-input"
        placeholder="Поиск по документам..."
        leftSection={<IconSearch size={18} />}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        size="md"
        styles={{
          input: {
            fontSize: '15px',
          },
        }}
      />

      {/* Filters row */}
      <Group gap="sm" wrap="wrap">
        <SegmentedControl
          id="search-mode"
          size="xs"
          value={mode}
          onChange={(v) => setMode(v as SearchMode)}
          data={[
            { label: 'Везде', value: 'all' },
            { label: 'По имени', value: 'filename' },
            { label: 'По содержимому', value: 'content' },
          ]}
        />

        <SegmentedControl
          id="match-type"
          size="xs"
          value={matchType}
          onChange={(v) => setMatchType(v as MatchType)}
          data={[
            { label: 'Частичный', value: 'partial' },
            { label: 'Точный', value: 'exact' },
          ]}
        />

        <Select
          id="folder-filter"
          placeholder="Все папки"
          data={folderOptions}
          value={folderId}
          onChange={setFolderId}
          clearable
          size="xs"
          style={{ minWidth: 150 }}
        />

        <MultiSelect
          id="filetype-filter"
          placeholder="Все типы"
          data={fileTypeOptions}
          value={fileTypes}
          onChange={setFileTypes}
          clearable
          size="xs"
          style={{ minWidth: 180 }}
        />
      </Group>

      {/* Results count */}
      {debouncedQuery.trim() && !loading && (
        <Group gap="xs">
          <Badge variant="light" color="olive" size="sm">
            Найдено: {results.length}
          </Badge>
        </Group>
      )}

      {/* Results list */}
      <Box style={{ flex: 1, overflow: 'auto' }}>
        {loading && (
          <Center py="xl">
            <Loader color="olive" size="md" />
          </Center>
        )}

        {!loading && debouncedQuery.trim() && results.length === 0 && (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconFileOff size={48} color="var(--mantine-color-gray-4)" />
              <Text c="dimmed" size="sm">Ничего не найдено</Text>
            </Stack>
          </Center>
        )}

        {!loading && !debouncedQuery.trim() && (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconSearch size={48} color="var(--mantine-color-gray-3)" />
              <Text c="dimmed" size="sm">Введите запрос для поиска</Text>
            </Stack>
          </Center>
        )}

        {!loading && results.length > 0 && (
          <Stack gap="xs">
            {results.map((result) => (
              <ResultCard key={result.id} result={result} />
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
