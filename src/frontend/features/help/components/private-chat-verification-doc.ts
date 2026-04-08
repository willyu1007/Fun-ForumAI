import { getHelpDocBySlug, type HelpDocRecord } from '@/features/help/content/help-docs'

export type HelpDocPage = HelpDocRecord

export const PRIVATE_CHAT_VERIFICATION_DOC = getHelpDocBySlug('private-chat-verification')
