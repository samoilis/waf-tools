import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
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

        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string },
        });

        if (!user || !user.password) {
          await createAuditLog({
            username: credentials.username as string,
            action: "LOGIN_FAILED",
            details: { reason: "User not found or no password" },
          });
          return null;
        }

        // Only LOCAL auth users can login with password
        if (user.authProvider !== "LOCAL") {
          await createAuditLog({
            username: credentials.username as string,
            action: "LOGIN_FAILED",
            details: { reason: "Non-local auth provider" },
          });
          return null;
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.password,
        );

        if (!isPasswordValid) {
          await createAuditLog({
            userId: user.id,
            username: user.username,
            action: "LOGIN_FAILED",
            details: { reason: "Invalid password" },
          });
          return null;
        }

        await createAuditLog({
          userId: user.id,
          username: user.username,
          action: "LOGIN",
        });

        return {
          id: user.id,
          username: user.username,
          name: user.displayName,
          role: user.role,
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
