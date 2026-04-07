#!/usr/bin/env node

import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const BCRYPT_ROUNDS = 12

function usage(exitCode = 0) {
  console.log(`
bootstrap-admin-account.mjs

Usage:
  node scripts/bootstrap-admin-account.mjs \\
    [--email <bootstrap-admin-email>] \\
    [--phone <bootstrap-admin-phone>] \\
    [--display-name <name>] \\
    [--password <password>]

Notes:
  - At least one of --email / --phone is required.
  - The provided email/phone must already be listed in AUTH_BOOTSTRAP_ADMIN_EMAILS / AUTH_BOOTSTRAP_ADMIN_PHONES.
  - --password only applies to email accounts.
`)
  process.exit(exitCode)
}

function parseArgs(argv) {
  const out = {
    email: '',
    phone: '',
    displayName: '',
    password: '',
  }

  for (let i = 2; i < argv.length; i++) {
    const token = argv[i]
    if (token === '--help' || token === '-h') usage(0)
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for --${key}`)
    }
    if (key === 'email') out.email = next.trim().toLowerCase()
    if (key === 'phone') out.phone = normalizePhone(next)
    if (key === 'display-name') out.displayName = next.trim()
    if (key === 'password') out.password = next
    i += 1
  }

  if (!out.email && !out.phone) {
    throw new Error('Provide --email or --phone')
  }
  if (out.password && !out.email) {
    throw new Error('--password requires --email')
  }
  return out
}

function normalizePhone(phone) {
  const digits = String(phone).replace(/[^\d]/g, '')
  return digits.startsWith('86') && digits.length === 13 ? digits.slice(2) : digits
}

function parseStringList(raw) {
  return String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function assertBootstrapAuthority(input) {
  const allowedEmails = parseStringList(process.env.AUTH_BOOTSTRAP_ADMIN_EMAILS).map((value) => value.toLowerCase())
  const allowedPhones = parseStringList(process.env.AUTH_BOOTSTRAP_ADMIN_PHONES).map(normalizePhone)
  if ((input.email && !allowedEmails.includes(input.email)) || (input.phone && !allowedPhones.includes(input.phone))) {
    throw new Error('Target is not listed in AUTH_BOOTSTRAP_ADMIN_EMAILS / AUTH_BOOTSTRAP_ADMIN_PHONES')
  }
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

async function main() {
  const input = parseArgs(process.argv)
  assertBootstrapAuthority(input)

  const pool = new pg.Pool({ connectionString: requireEnv('DATABASE_URL') })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter, log: ['error'] })

  try {
    let user = null
    if (input.email) {
      user = await prisma.humanUser.findUnique({ where: { email: input.email } })
    }
    if (!user && input.phone) {
      user = await prisma.humanUser.findUnique({ where: { phone: input.phone } })
    }

    if (!user) {
      user = await prisma.humanUser.create({
        data: {
          ...(input.email ? { email: input.email, emailVerified: true } : {}),
          ...(input.phone ? { phone: input.phone, phoneVerified: true } : {}),
          displayName: input.displayName || 'Bootstrap Admin',
          planTier: 'ADMIN',
          status: 'ACTIVE',
        },
      })
    } else {
      user = await prisma.humanUser.update({
        where: { id: user.id },
        data: {
          planTier: 'ADMIN',
          status: 'ACTIVE',
          ...(input.email ? { emailVerified: true } : {}),
          ...(input.phone ? { phoneVerified: true } : {}),
        },
      })
    }

    if (input.password) {
      const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)
      user = await prisma.humanUser.update({
        where: { id: user.id },
        data: {
          passwordHash,
          emailVerified: true,
        },
      })
    }

    console.log(JSON.stringify({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        displayName: user.displayName,
        planTier: user.planTier,
        status: user.status,
      },
    }, null, 2))
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(`[bootstrap-admin-account] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
