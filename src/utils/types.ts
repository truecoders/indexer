// === Data Types ===

export interface IndexerFolder {
  id: number;
  path: string;
  created_at: string;
  last_indexed: string | null;
  file_count: number;
  total_words: number;
  error_count: number;
  watch_enabled: boolean;
}

export interface SearchResult {
  id: number;
  folder_id: number;
  path: string;
  filename: string;
  file_type: string;
  size_bytes: number;
  modified_at: string;
  word_count: number;
  filename_snippet: string;
  content_snippet: string;
}

export interface IndexerStats {
  folder_count: number;
  file_count: number;
  total_words: number;
  error_count: number;
}

export interface IndexProgress {
  folder_id: number;
  folder_path: string;
  current: number;
  total: number;
  current_file: string;
  done: boolean;
}

export type SearchMode = 'all' | 'filename' | 'content';
export type MatchType = 'partial' | 'exact';
