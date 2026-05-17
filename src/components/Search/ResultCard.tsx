import { Card, Group, Text, Badge, ActionIcon, Tooltip, Stack, Box } from '@mantine/core';
import { IconFile, IconFileTypePdf, IconFileTypeDocx, IconFileSpreadsheet, IconFileText, IconExternalLink, IconFolderOpen } from '@tabler/icons-react';
import { commands } from '../../utils/commands';
import type { SearchResult } from '../../utils/types';

interface ResultCardProps {
  result: SearchResult;
}

const FILE_ICONS: Record<string, typeof IconFile> = {
  docx: IconFileTypeDocx,
  xlsx: IconFileSpreadsheet,
  xls: IconFileSpreadsheet,
  txt: IconFileText,
  md: IconFileText,
  csv: IconFileSpreadsheet,
  pdf: IconFileTypePdf,
};

const FILE_COLORS: Record<string, string> = {
  docx: 'blue',
  xlsx: 'green',
  xls: 'green',
  txt: 'gray',
  md: 'gray',
  csv: 'teal',
  pdf: 'red',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  // Format: YYYY-MM-DD HH:MM:SS → DD.MM.YYYY
  const parts = dateStr.split(' ')[0]?.split('-');
  if (parts?.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
}

export function ResultCard({ result }: ResultCardProps) {
  const FileIcon = FILE_ICONS[result.file_type] || IconFile;
  const badgeColor = FILE_COLORS[result.file_type] || 'gray';

  const handleOpen = async () => {
    try {
      await commands.openFile(result.path);
    } catch (e) {
      console.error('Failed to open file:', e);
    }
  };

  const handleShowInFolder = async () => {
    try {
      await commands.showInFolder(result.path);
    } catch (e) {
      console.error('Failed to show in folder:', e);
    }
  };

  // Truncate path for display
  const displayPath = result.path.length > 80
    ? '...' + result.path.slice(-77)
    : result.path;

  return (
    <Card
      id={`result-${result.id}`}
      padding="sm"
      radius="md"
      withBorder
      style={{
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        cursor: 'pointer',
      }}
      styles={{
        root: {
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: 'var(--mantine-shadow-md)',
          },
        },
      }}
      onClick={handleOpen}
    >
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <FileIcon size={28} color={`var(--mantine-color-${badgeColor}-6)`} style={{ flexShrink: 0 }} />

          <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
            {/* Filename with highlight */}
            <Group gap="xs" wrap="nowrap">
              <Text
                size="sm"
                fw={600}
                truncate
                dangerouslySetInnerHTML={{ __html: result.filename_snippet || result.filename }}
                style={{ lineHeight: 1.3 }}
              />
              <Badge size="xs" variant="light" color={badgeColor}>
                {result.file_type.toUpperCase()}
              </Badge>
            </Group>

            {/* Path */}
            <Text size="xs" c="dimmed" truncate title={result.path}>
              {displayPath}
            </Text>

            {/* Content snippet */}
            {result.content_snippet && (
              <Box
                style={{
                  fontSize: '12px',
                  color: 'var(--mantine-color-gray-7)',
                  lineHeight: 1.4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
                dangerouslySetInnerHTML={{ __html: result.content_snippet }}
              />
            )}

            {/* Meta */}
            <Group gap="md" mt={2}>
              <Text size="xs" c="dimmed">{formatDate(result.modified_at)}</Text>
              <Text size="xs" c="dimmed">{formatSize(result.size_bytes)}</Text>
              <Text size="xs" c="dimmed">{result.word_count.toLocaleString()} сл.</Text>
            </Group>
          </Stack>
        </Group>

        {/* Action buttons */}
        <Group gap={4} style={{ flexShrink: 0 }}>
          <Tooltip label="Открыть файл">
            <ActionIcon
              variant="subtle"
              color="olive"
              size="sm"
              onClick={(e) => { e.stopPropagation(); handleOpen(); }}
            >
              <IconExternalLink size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Показать в папке">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={(e) => { e.stopPropagation(); handleShowInFolder(); }}
            >
              <IconFolderOpen size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Card>
  );
}
