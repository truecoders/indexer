import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { IndexerFolder, SearchResult, IndexerStats, IndexProgress, SearchMode, MatchType, SortBy, SortDir } from './types';

export const commands = {
  addFolder: () =>
    invoke<IndexerFolder | null>('add_folder'),

  removeFolder: (id: number) =>
    invoke<boolean>('remove_folder', { id }),

  listFolders: () =>
    invoke<IndexerFolder[]>('list_folders'),

  reindex: (id: number) =>
    invoke<boolean>('reindex', { id }),

  search: (
    query: string,
    mode: SearchMode,
    matchType: MatchType,
    folderId?: number | null,
    fileTypes?: string[] | null,
    sortBy?: SortBy,
    sortDir?: SortDir,
  ) =>
    invoke<SearchResult[]>('search', {
      query,
      mode,
      matchType: matchType === 'exact' ? 'exact' : 'partial',
      folderId: folderId ?? null,
      fileTypes: fileTypes && fileTypes.length > 0 ? fileTypes : null,
      sortBy: sortBy ?? 'relevance',
      sortDir: sortDir ?? 'desc',
    }),

  openFile: (path: string) =>
    invoke('open_file', { path }),

  showInFolder: (path: string) =>
    invoke('show_in_folder', { path }),

  getStats: () =>
    invoke<IndexerStats>('get_stats'),

  toggleWatcher: (id: number, enable: boolean) =>
    invoke('toggle_watcher', { id, enable }),

  updateExcludePatterns: (id: number, patterns: string[]) =>
    invoke('update_exclude_patterns', { id, patterns }),

  onProgress: (cb: (data: IndexProgress) => void): Promise<UnlistenFn> =>
    listen<IndexProgress>('indexer:progress', (e) => cb(e.payload)),
};

// === Search History (localStorage) ===

const HISTORY_KEY = 'indexer-search-history';
const MAX_HISTORY = 20;

export function getSearchHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

export function addToSearchHistory(query: string) {
  if (!query || query.trim().length < 2) return;
  const trimmed = query.trim();
  const history = getSearchHistory().filter((h) => h !== trimmed);
  history.unshift(trimmed);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

export function clearSearchHistory() {
  localStorage.removeItem(HISTORY_KEY);
}
