"use client";

import { Tabs, Title, Group, LoadingOverlay, Box } from "@mantine/core";
import { Bell, ShieldCheck, KeyRound, Server, Building2, Settings } from "lucide-react";
import { useSettings } from "./use-settings";
import { GeneralTab } from "./company-tab";
import { NotificationsTab } from "./general-tab";
import { SmtpSyslogTab } from "./smtp-syslog-tab";
import { AuthenticationTab } from "./authentication-tab";
import { RegistrationTab } from "./registration-tab";

export function SettingsPageClient() {
  const { settings, isLoading, saveSettings } = useSettings();

  if (isLoading || !settings) {
    return (
      <>
        <Group mb="lg">
          <Settings size={28} />
          <Title order={2}>Settings</Title>
        </Group>
        <Box pos="relative" mih={300}>
          <LoadingOverlay visible />
        </Box>
      </>
    );
  }

  return (
    <>
      <Group mb="lg">
        <Settings size={28} />
        <Title order={2}>Settings</Title>
      </Group>

      <Box pos="relative" mih={300}>
        <Tabs defaultValue="general" keepMounted={false}>
          <Tabs.List mb="md">
            <Tabs.Tab value="general" leftSection={<Building2 size={16} />}>
              General
            </Tabs.Tab>
            <Tabs.Tab value="notifications" leftSection={<Bell size={16} />}>
              Notifications
            </Tabs.Tab>
            <Tabs.Tab value="smtp-syslog" leftSection={<Server size={16} />}>
              SMTP / Syslog
            </Tabs.Tab>
            <Tabs.Tab value="authentication" leftSection={<ShieldCheck size={16} />}>
              Authentication
            </Tabs.Tab>
            <Tabs.Tab value="registration" leftSection={<KeyRound size={16} />}>
              Registration
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="general">
            <GeneralTab settings={settings} onSave={saveSettings} />
          </Tabs.Panel>

          <Tabs.Panel value="notifications">
            <NotificationsTab settings={settings} onSave={saveSettings} />
          </Tabs.Panel>

          <Tabs.Panel value="smtp-syslog">
            <SmtpSyslogTab settings={settings} onSave={saveSettings} />
          </Tabs.Panel>

          <Tabs.Panel value="authentication">
            <AuthenticationTab settings={settings} onSave={saveSettings} />
          </Tabs.Panel>

          <Tabs.Panel value="registration">
            <RegistrationTab settings={settings} onSave={saveSettings} />
          </Tabs.Panel>
        </Tabs>
      </Box>
    </>
  );
}
