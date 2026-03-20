"use client";

import { Tabs, Title, Group, LoadingOverlay, Box } from "@mantine/core";
import { Settings, ShieldCheck, KeyRound } from "lucide-react";
import { useSettings } from "./use-settings";
import { GeneralTab } from "./general-tab";
import { AuthenticationTab } from "./authentication-tab";
import { RegistrationTab } from "./registration-tab";

export function SettingsPageClient() {
  const { settings, isLoading, saveSettings } = useSettings();

  return (
    <>
      <Group mb="lg">
        <Settings size={28} />
        <Title order={2}>Settings</Title>
      </Group>

      <Box pos="relative" mih={300}>
        <LoadingOverlay visible={isLoading} />

        <Tabs defaultValue="general" keepMounted={false}>
          <Tabs.List mb="md">
            <Tabs.Tab value="general" leftSection={<Settings size={16} />}>
              General
            </Tabs.Tab>
            <Tabs.Tab value="authentication" leftSection={<ShieldCheck size={16} />}>
              Authentication
            </Tabs.Tab>
            <Tabs.Tab value="registration" leftSection={<KeyRound size={16} />}>
              Registration
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="general">
            <GeneralTab />
          </Tabs.Panel>

          <Tabs.Panel value="authentication">
            <AuthenticationTab
              settings={settings ?? {}}
              onSave={saveSettings}
            />
          </Tabs.Panel>

          <Tabs.Panel value="registration">
            <RegistrationTab
              settings={settings ?? {}}
              onSave={saveSettings}
            />
          </Tabs.Panel>
        </Tabs>
      </Box>
    </>
  );
}
