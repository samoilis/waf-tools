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
  Badge,
  ActionIcon,
  useMantineColorScheme,
  useComputedColorScheme,
  useMantineTheme,
  MantineProvider,
  DEFAULT_THEME,
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
  FileBarChart,
  LogOut,
  FlaskConical,
  EllipsisVertical,
  Sun,
  Moon,
  Palette,
  UserRound,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePrimaryColor } from "@/providers/theme-provider";

const MANTINE_COLORS = [
  "red", "pink", "grape", "violet", "indigo", "blue",
  "cyan", "teal", "green", "lime", "yellow", "orange",
  "navy",
] as const;

const navLinks = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "Backup Explorer", href: "/backup-explorer", icon: FolderSearch, section: "Manage" },
  { label: "Config Snapshots", href: "/config-snapshots", icon: Camera, section: "Manage" },
  { label: "Compliance Reports", href: "/compliance-reports", icon: FileBarChart, section: "Reporting" },
  { label: "Ad-Hoc Report", href: "/ad-hoc-report", icon: FlaskConical, section: "Reporting" },
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
  const router = useRouter();
  const { data: session, status } = useSession();
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });
  const mantineTheme = useMantineTheme();
  const setPrimaryColor = usePrimaryColor();

  const isAdmin = session?.user?.role === "ADMIN";

  // Fetch profile data (avatar, displayName) via React Query so sidebar updates without refresh
  const { data: userProfile } = useQuery<{ avatar: string | null; displayName: string | null }>({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user-profile");
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    enabled: !!session?.user,
  });

  const visibleLinks = navLinks.filter(
    (link) => !link.adminOnly || isAdmin,
  );

  if (status === "loading") {
    return null;
  }

  const toggleColorScheme = () => {
    setColorScheme(computedColorScheme === "dark" ? "light" : "dark");
  };

  const displayName = userProfile?.displayName || session?.user?.displayName || session?.user?.username || "";

  return (
    <AppShell
      navbar={{ width: 260, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Navbar
        p="xs"
        bg={
          computedColorScheme === "dark"
            ? `var(--mantine-color-${mantineTheme.primaryColor}-9)`
            : `var(--mantine-color-${mantineTheme.primaryColor}-0)`
        }
      >
        {/* Mobile burger */}
        <AppShell.Section hiddenFrom="sm">
          <Group px="xs" py="xs">
            <Burger opened={opened} onClick={toggle} size="sm" />
          </Group>
        </AppShell.Section>

        {/* Logo & app name at top of sidebar */}
        <AppShell.Section>
          <Group px="xs" py="md" gap="sm">
            <div
              style={{
                width: 32,
                height: 32,
                WebkitMaskImage: "url(/logo.png)",
                WebkitMaskSize: "contain",
                WebkitMaskRepeat: "no-repeat",
                maskImage: "url(/logo.png)",
                maskSize: "contain",
                maskRepeat: "no-repeat",
                backgroundColor: `var(--mantine-color-${mantineTheme.primaryColor}-5)`,
              }}
              aria-hidden
            />
            <Title order={3}>WAF Tools</Title>
          </Group>
          <Divider mb="xs" />
        </AppShell.Section>

        {/* Navigation links */}
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

        {/* User section at bottom */}
        <AppShell.Section>
          <Divider my="xs" />
          {session?.user && (
            <Group px="xs" py="xs" justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap" style={{ overflow: "hidden", flex: 1 }}>
                <Avatar size="md" radius="xl" variant="transparent" src={userProfile?.avatar} />
                <div style={{ overflow: "hidden" }}>
                  <Text size="sm" fw={500} truncate>
                    {displayName}
                  </Text>
                  <Badge size="xs" variant="light">
                    {session.user.role}
                  </Badge>
                </div>
              </Group>

              <Menu shadow="md" width={220} position="top-end">
                <Menu.Target>
                  <ActionIcon variant="subtle" color="gray" size="md">
                    <EllipsisVertical size={18} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={
                      computedColorScheme === "dark" ? (
                        <Sun size={14} />
                      ) : (
                        <Moon size={14} />
                      )
                    }
                    onClick={toggleColorScheme}
                  >
                    {computedColorScheme === "dark" ? "Light Theme" : "Dark Theme"}
                  </Menu.Item>

                  <Menu
                    trigger="hover"
                    position="right-start"
                    shadow="md"
                    width={200}
                  >
                    <Menu.Target>
                      <Menu.Item leftSection={<Palette size={14} />}>
                        Base Color
                      </Menu.Item>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {MANTINE_COLORS.map((color) => {
                        const swatch =
                          color === "navy"
                            ? mantineTheme.colors.navy[5]
                            : DEFAULT_THEME.colors[color][5];
                        return (
                          <Menu.Item
                            key={color}
                            leftSection={
                              <div
                                style={{
                                  width: 14,
                                  height: 14,
                                  borderRadius: "50%",
                                  backgroundColor: swatch,
                                }}
                              />
                            }
                            onClick={() => {
                              setPrimaryColor(color);
                            }}
                            fw={mantineTheme.primaryColor === color ? 700 : 400}
                          >
                            {color.charAt(0).toUpperCase() + color.slice(1)}
                          </Menu.Item>
                        );
                      })}
                    </Menu.Dropdown>
                  </Menu>

                  <Menu.Divider />

                  <Menu.Item
                    leftSection={<UserRound size={14} />}
                    onClick={() => router.push("/user-profile")}
                  >
                    Profile
                  </Menu.Item>

                  <Menu.Divider />

                  <Menu.Item
                    leftSection={<LogOut size={14} />}
                    color="red"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                  >
                    Sign Out
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          )}
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
