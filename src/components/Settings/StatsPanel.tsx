import { SimpleGrid, Card, Text, Group, ThemeIcon, Stack } from '@mantine/core';
import { IconFolder, IconFile, IconLetterCase, IconAlertTriangle } from '@tabler/icons-react';
import type { IndexerStats } from '../../utils/types';

interface StatsPanelProps {
  stats: IndexerStats;
}

const statItems = [
  { key: 'folder_count', label: 'Папок', icon: IconFolder, color: 'olive' },
  { key: 'file_count', label: 'Файлов', icon: IconFile, color: 'blue' },
  { key: 'total_words', label: 'Слов', icon: IconLetterCase, color: 'teal' },
  { key: 'error_count', label: 'Ошибок', icon: IconAlertTriangle, color: 'red' },
] as const;

export function StatsPanel({ stats }: StatsPanelProps) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
      {statItems.map((item) => (
        <Card key={item.key} padding="sm" radius="md" withBorder>
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon variant="light" color={item.color} size="lg" radius="md">
              <item.icon size={20} />
            </ThemeIcon>
            <Stack gap={0}>
              <Text size="xl" fw={700} lh={1.2}>
                {(stats[item.key] as number).toLocaleString()}
              </Text>
              <Text size="xs" c="dimmed">{item.label}</Text>
            </Stack>
          </Group>
        </Card>
      ))}
    </SimpleGrid>
  );
}
