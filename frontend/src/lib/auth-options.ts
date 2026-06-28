import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET
          })
        ]
      : []),
    CredentialsProvider({
      id: "guest",
      name: "Guest Researcher",
      credentials: {},
      async authorize() {
        return {
          id: "guest-local",
          name: "Guest Researcher",
          email: "guest@quantcommittee.local",
          image: null
        };
      }
    })
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/"
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.userId = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
      }
      if (account?.provider === "google" && profile && "sub" in profile) {
        token.userId = String(profile.sub);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId ?? token.sub ?? "guest-local");
        session.user.name = token.name as string | null | undefined;
        session.user.email = token.email as string | null | undefined;
        session.user.image = token.picture as string | null | undefined;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET || "quant-committee-dev-secret-change-me"
};
