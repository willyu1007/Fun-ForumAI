#!/usr/bin/env node

import { createRequire } from 'node:module';
import process from 'node:process';
import dotenv from 'dotenv';

const require = createRequire(import.meta.url);
const nodemailer = require('nodemailer');
const OpenApiClient = require('@alicloud/openapi-client');
const DysmsApi = require('@alicloud/dysmsapi20170525');

function usage(exitCode = 0) {
  console.log(`
auth-delivery-smoke.mjs

Usage:
  node scripts/auth-delivery-smoke.mjs --mode <smtp|sms|both> [options]

Options:
  --env-file <path>         Load environment variables from a dotenv file before running.
  --mode <mode>             smtp | sms | both. Default: both.
  --email <address>         Send a real verification email to this address.
  --phone <number>          Send a real verification SMS to this number.
  --code <digits>           Verification code payload. Default: 246810.
  --ttl-sec <seconds>       Verification TTL in seconds. Default: 600.
  --smtp-verify-only        Only run SMTP transport.verify(); skip sending email.
  --dry-run                 Validate config only; do not call external providers.
  --help                    Show this help.

Examples:
  node scripts/auth-delivery-smoke.mjs --mode smtp --env-file ops/deploy/env-files/staging.env --smtp-verify-only
  node scripts/auth-delivery-smoke.mjs --mode smtp --email you@example.com --code 123456
  node scripts/auth-delivery-smoke.mjs --mode sms --phone 13800138000 --code 123456
  node scripts/auth-delivery-smoke.mjs --mode both --dry-run
`.trim());
  process.exit(exitCode);
}

function fail(message, details) {
  console.error(`[auth-delivery-smoke] ${message}`);
  if (details) {
    console.error(details);
  }
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    envFile: '',
    mode: 'both',
    email: '',
    phone: '',
    code: '246810',
    ttlSec: 600,
    smtpVerifyOnly: false,
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') usage(0);
    if (!token.startsWith('--')) {
      fail(`Unknown argument: ${token}`);
    }

    const key = token.slice(2);
    if (key === 'smtp-verify-only') {
      args.smtpVerifyOnly = true;
      continue;
    }
    if (key === 'dry-run') {
      args.dryRun = true;
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      fail(`Missing value for --${key}`);
    }

    if (key === 'env-file') args.envFile = next;
    else if (key === 'mode') args.mode = next.trim().toLowerCase();
    else if (key === 'email') args.email = next.trim().toLowerCase();
    else if (key === 'phone') args.phone = normalizePhone(next);
    else if (key === 'code') args.code = String(next).trim();
    else if (key === 'ttl-sec') args.ttlSec = parsePositiveInt(next, 600, '--ttl-sec');
    else fail(`Unknown option: --${key}`);

    i += 1;
  }

  if (!['smtp', 'sms', 'both'].includes(args.mode)) {
    fail(`Unsupported --mode value: ${args.mode}`);
  }

  return args;
}

function parsePositiveInt(raw, fallback, label) {
  const value = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(value) || value <= 0) {
    fail(`${label} must be a positive integer`);
  }
  return value || fallback;
}

function normalizePhone(phone) {
  const digits = String(phone).replace(/[^\d]/g, '');
  return digits.startsWith('86') && digits.length === 13 ? digits.slice(2) : digits;
}

function maskValue(value, { keepStart = 2, keepEnd = 2 } = {}) {
  if (!value) return '<empty>';
  if (value.length <= keepStart + keepEnd) return '*'.repeat(value.length);
  return `${value.slice(0, keepStart)}***${value.slice(-keepEnd)}`;
}

function maskEmail(email) {
  if (!email) return '<empty>';
  const [localPart = '', domain = ''] = String(email).split('@');
  return `${maskValue(localPart, { keepStart: 1, keepEnd: 1 })}@${domain || 'unknown'}`;
}

function loadEnv(envFile) {
  if (!envFile) return;
  const result = dotenv.config({ path: envFile, override: false, quiet: true });
  if (result.error) {
    fail(`Failed to load env file: ${envFile}`, result.error.message);
  }
}

function readConfig() {
  return {
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parsePositiveInt(process.env.SMTP_PORT || '587', 587, 'SMTP_PORT'),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      fromEmail: process.env.SMTP_FROM_EMAIL || '',
      fromName: process.env.SMTP_FROM_NAME || 'Fun Forum AI',
    },
    sms: {
      accessKeyId: process.env.ALIYUN_SMS_ACCESS_KEY_ID || '',
      accessKeySecret: process.env.ALIYUN_SMS_ACCESS_KEY_SECRET || '',
      signName: process.env.ALIYUN_SMS_SIGN_NAME || '',
      templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE || '',
      endpoint: process.env.ALIYUN_SMS_ENDPOINT || 'dysmsapi.aliyuncs.com',
    },
  };
}

function assertRequired(label, values) {
  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    fail(`${label} config is incomplete`, `missing: ${missing.join(', ')}`);
  }
}

function logConfigSummary(config, args) {
  console.log('[auth-delivery-smoke] config summary');
  if (args.mode === 'smtp' || args.mode === 'both') {
    console.log(`  smtp.host=${config.smtp.host || '<empty>'}`);
    console.log(`  smtp.port=${config.smtp.port}`);
    console.log(`  smtp.secure=${String(config.smtp.secure)}`);
    console.log(`  smtp.user=${maskEmail(config.smtp.user)}`);
    console.log(`  smtp.from=${maskEmail(config.smtp.fromEmail)}`);
  }
  if (args.mode === 'sms' || args.mode === 'both') {
    console.log(`  sms.endpoint=${config.sms.endpoint}`);
    console.log(`  sms.accessKeyId=${maskValue(config.sms.accessKeyId)}`);
    console.log(`  sms.signName=${config.sms.signName || '<empty>'}`);
    console.log(`  sms.templateCode=${config.sms.templateCode || '<empty>'}`);
  }
}

function buildEmailMessage({ to, code, ttlSec, fromEmail, fromName }) {
  const minutes = Math.max(1, Math.ceil(ttlSec / 60));
  return {
    from: {
      address: fromEmail,
      name: fromName,
    },
    to,
    subject: `Fun Forum AI 验证码 ${code}`,
    text: [
      'Fun Forum AI 验证码联调消息',
      '',
      `验证码：${code}`,
      `有效期：${minutes} 分钟`,
      '',
      '如果这不是你的操作，请忽略这封邮件。',
    ].join('\n'),
    html: [
      '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">',
      '<h2 style="margin-bottom:12px">Fun Forum AI 验证码联调消息</h2>',
      `<p>验证码：<strong style="font-size:24px;letter-spacing:4px">${code}</strong></p>`,
      `<p>有效期：${minutes} 分钟</p>`,
      '<p>如果这不是你的操作，请忽略这封邮件。</p>',
      '</div>',
    ].join(''),
  };
}

async function runSmtp(config, args) {
  assertRequired('SMTP', {
    SMTP_HOST: config.smtp.host,
    SMTP_USER: config.smtp.user,
    SMTP_PASS: config.smtp.pass,
    SMTP_FROM_EMAIL: config.smtp.fromEmail,
  });

  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });

  if (args.dryRun) {
    console.log('[auth-delivery-smoke] SMTP dry-run passed');
    return;
  }

  await transport.verify();
  console.log('[auth-delivery-smoke] SMTP transport verify passed');

  if (args.smtpVerifyOnly) {
    return;
  }

  if (!args.email) {
    fail('SMTP send requested but --email is missing');
  }

  await transport.sendMail(buildEmailMessage({
    to: args.email,
    code: args.code,
    ttlSec: args.ttlSec,
    fromEmail: config.smtp.fromEmail,
    fromName: config.smtp.fromName,
  }));

  console.log(`[auth-delivery-smoke] email sent to ${maskEmail(args.email)}`);
}

async function runSms(config, args) {
  assertRequired('Aliyun SMS', {
    ALIYUN_SMS_ACCESS_KEY_ID: config.sms.accessKeyId,
    ALIYUN_SMS_ACCESS_KEY_SECRET: config.sms.accessKeySecret,
    ALIYUN_SMS_SIGN_NAME: config.sms.signName,
    ALIYUN_SMS_TEMPLATE_CODE: config.sms.templateCode,
  });

  if (args.dryRun) {
    console.log('[auth-delivery-smoke] SMS dry-run passed');
    return;
  }

  if (!args.phone) {
    fail('SMS send requested but --phone is missing');
  }

  const client = new DysmsApi.default(new OpenApiClient.Config({
    accessKeyId: config.sms.accessKeyId,
    accessKeySecret: config.sms.accessKeySecret,
    endpoint: config.sms.endpoint,
  }));

  const response = await client.sendSms(new DysmsApi.SendSmsRequest({
    phoneNumbers: args.phone,
    signName: config.sms.signName,
    templateCode: config.sms.templateCode,
    templateParam: JSON.stringify({
      code: args.code,
      minutes: Math.max(1, Math.ceil(args.ttlSec / 60)),
    }),
  }));

  if (response.body?.code !== 'OK') {
    fail('Aliyun SMS send failed', JSON.stringify(response.body, null, 2));
  }

  console.log(`[auth-delivery-smoke] sms sent to ${maskValue(args.phone, { keepStart: 3, keepEnd: 2 })}`);
}

async function main() {
  const args = parseArgs(process.argv);
  loadEnv(args.envFile);
  const config = readConfig();
  logConfigSummary(config, args);

  if (args.mode === 'smtp' || args.mode === 'both') {
    await runSmtp(config, args);
  }
  if (args.mode === 'sms' || args.mode === 'both') {
    await runSms(config, args);
  }

  console.log('[auth-delivery-smoke] completed');
}

main().catch((error) => {
  fail(
    error instanceof Error ? error.message : String(error),
    error instanceof Error && error.stack ? error.stack : undefined,
  );
});
