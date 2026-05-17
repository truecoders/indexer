import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { IndexerFolder, SearchResult, IndexerStats, IndexProgress, SearchMode, MatchType } from './types';

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
  ) =>
    invoke<SearchResult[]>('search', {
      query,
      mode,
      matchType: matchType === 'exact' ? 'exact' : 'partial',
      folderId: folderId ?? null,
      fileTypes: fileTypes && fileTypes.length > 0 ? fileTypes : null,
    }),

  openFile: (path: string) =>
    invoke('open_file', { path }),

  showInFolder: (path: string) =>
    invoke('show_in_folder', { path }),

  getStats: () =>
    invoke<IndexerStats>('get_stats'),

  toggleWatcher: (id: number, enable: boolean) =>
    invoke('toggle_watcher', { id, enable }),

  onProgress: (cb: (data: IndexProgress) => void): Promise<UnlistenFn> =>
    listen<IndexProgress>('indexer:progress', (e) => cb(e.payload)),
};
