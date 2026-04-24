import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Credentials from 'next-auth/providers/credentials'
import GitHub from 'next-auth/providers/github'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/db'
import { getUserByEmail } from '@/lib/db/userRepo'
import { createAccount, getAccountsByUserId, updateAccount } from '@/lib/db/accountRepo'
import { updateActiveAccount } from '@/lib/db/userRepo'
import { encrypt } from '@/lib/crypto'
import logger from '@/lib/logger'
import type { NextAuthConfig } from 'next-auth'

type GitHubProfile = {
  login: string
  avatar_url: string
  name: string | null
  email: string | null
}

const config: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await getUserByEmail(credentials.email as string)
        if (!user?.password) return null
        const valid = await bcrypt.compare(credentials.password as string, user.password)
        if (!valid) return null
        return { id: user.id, email: user.email, name: user.name }
      },
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      authorization: { params: { scope: 'repo,read:user,user:email' } },
      profile(profile) {
        return {
          id: String(profile.id),
          name: profile.name ?? profile.login,
          email: profile.email ?? `${profile.login}@users.noreply.github.com`,
          image: profile.avatar_url,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile, trigger, session }) {
      if (user?.id) {
        token.userId = user.id

        if (account?.provider === 'github' && profile && account.access_token) {
          const gh = profile as GitHubProfile
          try {
            const encryptedToken = encrypt(account.access_token)
            const existing = await getAccountsByUserId(user.id)
            const alreadyLinked = existing.find((a) => a.githubLogin === gh.login)

            if (alreadyLinked) {
              await updateAccount(alreadyLinked.id, {
                accessToken: encryptedToken,
                avatarUrl: gh.avatar_url,
              })
            } else {
              const newAccount = await createAccount({
                userId: user.id,
                githubLogin: gh.login,
                accessToken: encryptedToken,
                avatarUrl: gh.avatar_url,
              })
              if (existing.length === 0) {
                await updateActiveAccount(user.id, newAccount.id)
              }
            }
          } catch (err) {
            logger.error({ err }, 'Failed to link GitHub account during OAuth sign-in')
          }
        }

        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { activeAccountId: true },
        })
        token.activeAccountId = dbUser?.activeAccountId ?? null
      }
      if (trigger === 'update' && session?.activeAccountId !== undefined) {
        token.activeAccountId = session.activeAccountId
      }
      return token
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.userId as string,
          activeAccountId: (token.activeAccountId as string | null) ?? null,
        },
      }
    },
  },
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth(config)
