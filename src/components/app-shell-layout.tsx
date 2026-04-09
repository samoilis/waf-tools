"use client";

import {
  AppShell,
  Burger,
  Group,
  Title,
  NavLink,
  ScrollArea,
  Menu,
  UnstyledButton,
  Text,
  Avatar,
  Divider,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  Home,
  Settings,
  Database,
  FileText,
  FolderSearch,
  Camera,
  Users,
  ScrollText,
  ClipboardList,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

const navLinks = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "Backup Explorer", href: "/backup-explorer", icon: FolderSearch, section: "Manage" },
  { label: "Config Snapshots", href: "/config-snapshots", icon: Camera, section: "Manage" },
  { label: "WAF Servers", href: "/waf-servers", icon: Database, section: "Setup" },
  { label: "Backup Tasks", href: "/backup-tasks", icon: FileText, section: "Setup" },
  { label: "Users", href: "/users", icon: Users, adminOnly: true, section: "Administration" },
  { label: "Settings", href: "/settings", icon: Settings, adminOnly: true, section: "Administration" },
  { label: "Audit Logs", href: "/audit-logs", icon: ScrollText, adminOnly: true, section: "Administration" },
  { label: "Backup Logs", href: "/backup-logs", icon: ClipboardList, adminOnly: true, section: "Administration" },
];

export function AppShellLayout({ children }: { children: React.ReactNode }) {
  const [opened, { toggle }] = useDisclosure();
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const isAdmin = session?.user?.role === "ADMIN";

  const visibleLinks = navLinks.filter(
    (link) => !link.adminOnly || isAdmin,
  );

  if (status === "loading") {
    return null;
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 260, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="WAF Tools" width={32} height={32} />
            <Title order={3}>WAF Tools</Title>
          </Group>
          <Group>
            <ThemeToggle />
            {session?.user && (
              <Menu shadow="md" width={200} position="bottom-end">
                <Menu.Target>
                  <UnstyledButton>
                    <Group gap="xs">
                      <Avatar size="md" radius="xl">
                        {session.user.username[0].toUpperCase()}
                      </Avatar>
                      <ChevronDown size={14} />
                    </Group>
                  </UnstyledButton>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>
                    {session.user.displayName
                      ? `${session.user.displayName} (${session.user.username})`
                      : session.user.username}{" "}
                    — {session.user.role}
                  </Menu.Label>
                  <Divider />
                  <Menu.Item
                    leftSection={<LogOut size={14} />}
                    onClick={() => signOut({ callbackUrl: "/login" })}
                  >
                    Sign Out
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <AppShell.Section grow component={ScrollArea}>
          {visibleLinks.map((link, index) => {
            const prevLink = visibleLinks[index - 1];
            const showDivider = link.section && link.section !== prevLink?.section;
            return (
              <div key={link.href}>
                {showDivider && <Divider my="xs" label={link.section} labelPosition="left" />}
                <NavLink
                  component={Link}
                  href={link.href}
                  label={link.label}
                  leftSection={<link.icon size={18} />}
                  active={pathname === link.href}
                  onClick={() => {
                    if (opened) toggle();
                  }}
                />
              </div>
            );
          })}
        </AppShell.Section>
        <AppShell.Section>
          <Divider my="xs" />
          <Text size="xs" c="dimmed" ta="center" py="xs">
            &copy; 2026 Odyssey Consultants SA
          </Text>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
