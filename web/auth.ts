import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { adminClient } from './lib/supabase';
import { upsertUser, saveRefreshToken } from './lib/users';

// Scopes the web app requests (plan.md Phase 7). Gmail read + compose (drafts only), Tasks, Calendar events, profile.
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: { params: { scope: GOOGLE_SCOPES, access_type: 'offline', prompt: 'consent' } },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    // Runs at sign-in with the Google tokens; afterwards `account` is undefined.
    async jwt({ token, account, profile }) {
      if (account && profile?.sub && profile.email) {
        const db = adminClient();
        const uid = await upsertUser(db, { sub: profile.sub, email: profile.email, name: profile.name });
        if (account.refresh_token) await saveRefreshToken(db, uid, account.refresh_token, account.scope ?? GOOGLE_SCOPES);
        token.uid = uid;
      }
      return token;
    },
    async session({ session, token }) {
      (session.user as { id?: string }).id = token.uid as string | undefined;
      return session;
    },
  },
});
