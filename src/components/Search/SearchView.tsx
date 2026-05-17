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
  ActionIcon,
  Tooltip,
  Button,
} from '@mantine/core';
import {
  IconSearch,
  IconFileOff,
  IconSortAscending,
  IconSortDescending,
  IconX,
} from '@tabler/icons-react';
import { commands } from '../../utils/commands';
import type { SearchResult, IndexerFolder, SearchMode, MatchType, SortBy, SortDir, SearchHistoryEntry } from '../../utils/types';
import { ResultCard } from './ResultCard';
import { PreviewPanel } from './PreviewPanel';

const SORT_OPTIONS = [
  { value: 'relevance', label: 'По релевантности' },
  { value: 'date', label: 'По дате' },
  { value: 'size', label: 'По размеру' },
  { value: 'name', label: 'По имени' },
];

interface SearchViewProps {
  initialParams?: SearchHistoryEntry | null;
  onHistoryUpdate?: () => void;
}

export function SearchView({ initialParams, onHistoryUpdate }: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('all');
  const [matchType, setMatchType] = useState<MatchType>('partial');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [fileTypes, setFileTypes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>('relevance');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState<IndexerFolder[]>([]);
  const [previewResult, setPreviewResult] = useState<SearchResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Load folders for filter
  useEffect(() => {
    commands.listFolders().then(setFolders).catch(console.error);
  }, []);

  // Apply initial params from history click
  useEffect(() => {
    if (initialParams) {
      setQuery(initialParams.query);
      setMode(initialParams.mode);
      setMatchType(initialParams.match_type);
      setFolderId(initialParams.folder_id ? initialParams.folder_id.toString() : null);
      setFileTypes(initialParams.file_types);
      setSortBy(initialParams.sort_by);
      setSortDir(initialParams.sort_dir);
      // Trigger search after state settles
      setTimeout(() => {
        performSearchWithParams(
          initialParams.query,
          initialParams.mode,
          initialParams.match_type,
          initialParams.folder_id,
          initialParams.file_types,
          initialParams.sort_by,
          initialParams.sort_dir,
        );
      }, 50);
    }
  }, [initialParams]);

  const performSearchWithParams = useCallback(
    async (
      q: string,
      m: SearchMode,
      mt: MatchType,
      fid: number | null,
      ft: string[],
      sb: SortBy,
      sd: SortDir,
    ) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      setHasSearched(true);
      setPreviewResult(null);
      try {
        const res = await commands.search(q, m, mt, fid, ft.length > 0 ? ft : null, sb, sd);
        setResults(res);
        // Save to history in DB
        await commands.addSearchHistory(q, m, mt, fid, ft, sb, sd);
        onHistoryUpdate?.();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [onHistoryUpdate],
  );

  const performSearch = useCallback(() => {
    performSearchWithParams(
      query,
      mode,
      matchType,
      folderId ? parseInt(folderId) : null,
      fileTypes,
      sortBy,
      sortDir,
    );
  }, [query, mode, matchType, folderId, fileTypes, sortBy, sortDir, performSearchWithParams]);

  // Rerun search immediately when filters or sorting change, if an active search exists
  useEffect(() => {
    if (hasSearched && query.trim()) {
      performSearch();
    }
  }, [mode, matchType, folderId, fileTypes, sortBy, sortDir, performSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  };

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
        {/* Search input + button */}
        <Group gap="xs" wrap="nowrap">
          <TextInput
            id="search-input"
            placeholder="Поиск по документам..."
            leftSection={<IconSearch size={18} />}
            rightSection={
              query ? (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="xs"
                  onClick={() => {
                    setQuery('');
                    setResults([]);
                    setPreviewResult(null);
                    setHasSearched(false);
                  }}
                >
                  <IconX size={14} />
                </ActionIcon>
              ) : null
            }
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            size="md"
            style={{ flex: 1 }}
            styles={{
              input: { fontSize: '15px' },
            }}
          />
          <Button
            color="olive"
            size="md"
            onClick={performSearch}
            loading={loading}
            leftSection={<IconSearch size={18} />}
          >
            Найти
          </Button>
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

        {/* Results count */}
        {hasSearched && !loading && (
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

          {!loading && hasSearched && results.length === 0 && (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconFileOff size={48} color="var(--mantine-color-gray-4)" />
                <Text c="dimmed" size="sm">Ничего не найдено</Text>
              </Stack>
            </Center>
          )}

          {!loading && !hasSearched && (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconSearch size={48} color="var(--mantine-color-gray-3)" />
                <Text c="dimmed" size="sm">Введите запрос и нажмите Enter или «Найти»</Text>
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
          searchQuery={query}
          onClose={handleClosePreview}
        />
      )}
    </Box>
  );
}
