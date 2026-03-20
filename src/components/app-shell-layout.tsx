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
  Shield,
  Home,
  Settings,
  Database,
  FileText,
  FolderSearch,
  Users,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

const navLinks = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "MX Servers", href: "/mx-servers", icon: Database },
  { label: "Backup Tasks", href: "/backup-tasks", icon: FileText },
  { label: "Backup Explorer", href: "/backup-explorer", icon: FolderSearch },
  { label: "Users", href: "/users", icon: Users, adminOnly: true },
  { label: "Settings", href: "/settings", icon: Settings, adminOnly: true },
];

export function AppShellLayout({ children }: { children: React.ReactNode }) {
  const [opened, { toggle }] = useDisclosure();
  const pathname = usePathname();
  const { data: session } = useSession();

  const isAdmin = session?.user?.role === "ADMIN";

  const visibleLinks = navLinks.filter(
    (link) => !link.adminOnly || isAdmin,
  );

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
            <Shield size={28} />
            <Title order={3}>Imperva WAF Tools</Title>
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
            const showDivider = link.adminOnly && prevLink && !prevLink.adminOnly;
            return (
              <div key={link.href}>
                {showDivider && <Divider my="xs" label="Administration" labelPosition="left" />}
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
      </AppShell.Navbar>

      <AppShell.Main>
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
