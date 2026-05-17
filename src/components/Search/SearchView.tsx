import { useState, useEffect } from 'react';
import {
  Autocomplete,
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
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
  IconSearch,
  IconFileOff,
  IconSortAscending,
  IconSortDescending,
  IconX,
} from '@tabler/icons-react';
import { commands, getSearchHistory, addToSearchHistory, clearSearchHistory } from '../../utils/commands';
import type { SearchResult, IndexerFolder, SearchMode, MatchType, SortBy, SortDir } from '../../utils/types';
import { ResultCard } from './ResultCard';
import { PreviewPanel } from './PreviewPanel';

const SORT_OPTIONS = [
  { value: 'relevance', label: 'По релевантности' },
  { value: 'date', label: 'По дате' },
  { value: 'size', label: 'По размеру' },
  { value: 'name', label: 'По имени' },
];

export function SearchView() {
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 300);
  const [mode, setMode] = useState<SearchMode>('all');
  const [matchType, setMatchType] = useState<MatchType>('partial');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [fileTypes, setFileTypes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>('relevance');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState<IndexerFolder[]>([]);
  const [history, setHistory] = useState<string[]>(getSearchHistory());
  const [previewResult, setPreviewResult] = useState<SearchResult | null>(null);

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
        sortBy,
        sortDir,
      )
      .then((res) => {
        setResults(res);
        setLoading(false);
        addToSearchHistory(debouncedQuery);
        setHistory(getSearchHistory());
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [debouncedQuery, mode, matchType, folderId, fileTypes, sortBy, sortDir]);

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

  const handleClearHistory = () => {
    clearSearchHistory();
    setHistory([]);
  };

  const toggleSortDir = () => {
    setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleResultClick = (result: SearchResult) => {
    setPreviewResult(result);
  };

  const handleClosePreview = () => {
    setPreviewResult(null);
  };

  return (
    <Box style={{ height: '100%', display: 'flex' }}>
      {/* Main search area */}
      <Stack gap="md" p="md" style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
        {/* Search input with history autocomplete */}
        <Group gap="xs" wrap="nowrap">
          <Autocomplete
            id="search-input"
            placeholder="Поиск по документам..."
            leftSection={<IconSearch size={18} />}
            rightSection={
              query ? (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="xs"
                  onClick={() => { setQuery(''); setResults([]); setPreviewResult(null); }}
                >
                  <IconX size={14} />
                </ActionIcon>
              ) : null
            }
            data={history}
            value={query}
            onChange={setQuery}
            size="md"
            style={{ flex: 1 }}
            styles={{
              input: { fontSize: '15px' },
            }}
          />
        </Group>

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

          {/* Sort controls */}
          <Group gap={4} wrap="nowrap">
            <Select
              id="sort-by"
              data={SORT_OPTIONS}
              value={sortBy}
              onChange={(v) => setSortBy((v as SortBy) || 'relevance')}
              size="xs"
              style={{ minWidth: 150 }}
              allowDeselect={false}
            />
            <Tooltip label={sortDir === 'asc' ? 'По возрастанию' : 'По убыванию'}>
              <ActionIcon
                variant="subtle"
                color="olive"
                size="sm"
                onClick={toggleSortDir}
              >
                {sortDir === 'asc' ? <IconSortAscending size={16} /> : <IconSortDescending size={16} />}
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* Results count + clear history */}
        {debouncedQuery.trim() && !loading && (
          <Group gap="xs" justify="space-between">
            <Badge variant="light" color="olive" size="sm">
              Найдено: {results.length}
            </Badge>
            {history.length > 0 && (
              <Text
                size="xs"
                c="dimmed"
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={handleClearHistory}
              >
                Очистить историю
              </Text>
            )}
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
                <ResultCard
                  key={result.id}
                  result={result}
                  isActive={previewResult?.id === result.id}
                  onPreview={handleResultClick}
                />
              ))}
            </Stack>
          )}
        </Box>
      </Stack>

      {/* Preview panel */}
      {previewResult && (
        <PreviewPanel
          result={previewResult}
          searchQuery={debouncedQuery}
          onClose={handleClosePreview}
        />
      )}
    </Box>
  );
}
