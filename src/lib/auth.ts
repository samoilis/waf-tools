import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { authenticateLdap } from "@/lib/auth-ldap";
import { authenticateRadius } from "@/lib/auth-radius";
import { authenticateTacacs } from "@/lib/auth-tacacs";
import type { UserRole } from "@/generated/prisma/client";

declare module "next-auth" {
  interface User {
    username: string;
    role: UserRole;
  }
  interface Session {
    user: {
      id: string;
      username: string;
      displayName: string | null;
      role: UserRole;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    displayName: string | null;
    role: UserRole;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const username = credentials.username as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { username },
        });

        if (!user) {
          await createAuditLog({
            username,
            action: "LOGIN_FAILED",
            details: { reason: "User not found" },
          });
          return null;
        }

        let authenticated = false;
        let resolvedRole: UserRole | undefined;

        switch (user.authProvider) {
          case "LOCAL": {
            if (!user.password) {
              await createAuditLog({
                username,
                action: "LOGIN_FAILED",
                details: { reason: "No password set" },
              });
              return null;
            }
            authenticated = await compare(password, user.password);
            break;
          }
          case "LDAP": {
            try {
              const result = await authenticateLdap(username, password);
              authenticated = result.success;
              resolvedRole = result.role;
            } catch (err) {
              await createAuditLog({
                userId: user.id,
                username,
                action: "LOGIN_FAILED",
                details: {
                  reason: "LDAP error",
                  error: err instanceof Error ? err.message : String(err),
                },
              });
              return null;
            }
            break;
          }
          case "RADIUS": {
            try {
              const result = await authenticateRadius(username, password);
              authenticated = result.success;
            } catch (err) {
              await createAuditLog({
                userId: user.id,
                username,
                action: "LOGIN_FAILED",
                details: {
                  reason: "RADIUS error",
                  error: err instanceof Error ? err.message : String(err),
                },
              });
              return null;
            }
            break;
          }
          case "TACACS": {
            try {
              const result = await authenticateTacacs(username, password);
              authenticated = result.success;
            } catch (err) {
              await createAuditLog({
                userId: user.id,
                username,
                action: "LOGIN_FAILED",
                details: {
                  reason: "TACACS+ error",
                  error: err instanceof Error ? err.message : String(err),
                },
              });
              return null;
            }
            break;
          }
        }

        if (!authenticated) {
          await createAuditLog({
            userId: user.id,
            username: user.username,
            action: "LOGIN_FAILED",
            details: {
              reason: "Invalid credentials",
              provider: user.authProvider,
            },
          });
          return null;
        }

        // Update role from LDAP group mapping if resolved
        const effectiveRole = resolvedRole ?? user.role;
        if (resolvedRole && resolvedRole !== user.role) {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: resolvedRole },
          });
        }

        await createAuditLog({
          userId: user.id,
          username: user.username,
          action: "LOGIN",
          details: { provider: user.authProvider },
        });

        return {
          id: user.id,
          username: user.username,
          name: user.displayName,
          role: effectiveRole,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.username = user.username;
        token.displayName = user.name ?? null;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.id,
        username: token.username,
        displayName: token.displayName,
        role: token.role,
      };
      return session;
    },
  },
});
