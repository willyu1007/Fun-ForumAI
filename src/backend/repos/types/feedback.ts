export type FeedbackCategory =
  | 'PRODUCT_SUGGESTION'
  | 'BUG_REPORT'
  | 'UX_ISSUE'
  | 'OTHER'

export type FeedbackStatus = 'RECEIVED' | 'UNDER_REVIEW' | 'PLANNED' | 'CLOSED'

export type FeedbackHistoryVisibility = 'USER' | 'ADMIN_ONLY'

export type FeedbackHistoryEventType =
  | 'SUBMITTED'
  | 'STATUS_CHANGED'
  | 'PUBLIC_NOTE_UPDATED'
  | 'INTERNAL_NOTE_UPDATED'

export interface FeedbackTicket {
  id: string
  created_by_user_id: string
  category: FeedbackCategory
  title: string
  body: string
  entry_surface: string | null
  source_route: string | null
  status: FeedbackStatus
  public_resolution_note: string | null
  internal_note: string | null
  updated_by_user_id: string | null
  created_at: Date
  updated_at: Date
}

export interface FeedbackAttachment {
  id: string
  feedback_ticket_id: string
  storage_key: string
  mime_type: string
  file_size_bytes: number
  width: number | null
  height: number | null
  created_at: Date
}

export interface FeedbackAttachmentFile {
  attachment: FeedbackAttachment
  data: Buffer
}

export interface FeedbackHistoryEntry {
  id: string
  feedback_ticket_id: string
  actor_user_id: string | null
  visibility: FeedbackHistoryVisibility
  event_type: FeedbackHistoryEventType
  from_status: FeedbackStatus | null
  to_status: FeedbackStatus | null
  message: string | null
  created_at: Date
}

export interface FeedbackTicketRecord {
  ticket: FeedbackTicket
  attachments: FeedbackAttachment[]
  history: FeedbackHistoryEntry[]
}

export interface CreateFeedbackTicketInput {
  created_by_user_id: string
  category: FeedbackCategory
  title: string
  body: string
  entry_surface?: string | null
  source_route?: string | null
  status?: FeedbackStatus
  public_resolution_note?: string | null
  internal_note?: string | null
  updated_by_user_id?: string | null
}

export interface CreateFeedbackAttachmentInput {
  feedback_ticket_id: string
  storage_key: string
  mime_type: string
  file_size_bytes: number
  width?: number | null
  height?: number | null
  data: Buffer
}

export interface CreateFeedbackHistoryEntryInput {
  feedback_ticket_id: string
  actor_user_id?: string | null
  visibility: FeedbackHistoryVisibility
  event_type: FeedbackHistoryEventType
  from_status?: FeedbackStatus | null
  to_status?: FeedbackStatus | null
  message?: string | null
}

export interface UpdateFeedbackTicketInput {
  id: string
  status?: FeedbackStatus
  public_resolution_note?: string | null
  internal_note?: string | null
  updated_by_user_id: string
}

