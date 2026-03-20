import { Title, Text, Stack, Card } from "@mantine/core";

export default function Home() {
  return (
    <Stack gap="lg">
      <Title order={2}>Dashboard</Title>
      <Text c="dimmed" size="lg">
        Management tools for Imperva Web Application Firewall
      </Text>
      <Card withBorder shadow="sm" radius="md" p="lg">
        <Stack gap="sm">
          <Title order={3}>Getting Started</Title>
          <Text>
            Welcome to Imperva WAF Tools. Configure your environment variables
            and database connection to get started.
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
