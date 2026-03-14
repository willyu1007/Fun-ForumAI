import { describe, expect, it, vi } from 'vitest'
import { PgRoomWatchabilityRepository } from '../pg/pg-room-watchability-repository.js'

describe('PgRoomWatchabilityRepository', () => {
  it('serializes active episode creation behind a room-scoped advisory lock', async () => {
    const existingEpisode = {
      id: 'ep-1',
      roomId: 'room-1',
      programId: 'prog-1',
      status: 'ACTIVE',
      summaryText: '',
      unresolvedQuestion: null,
      energy: 0,
      tension: 0,
      turnCount: 0,
      messageCount: 0,
      startedAt: new Date('2026-03-10T10:00:00.000Z'),
      endedAt: null,
      createdAt: new Date('2026-03-10T10:00:00.000Z'),
      updatedAt: new Date('2026-03-10T10:00:00.000Z'),
    }
    const tx = {
      $executeRaw: vi.fn(async () => 1),
      roomEpisode: {
        findFirst: vi.fn(async () => existingEpisode),
        create: vi.fn(),
      },
    }
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    }

    const repo = new PgRoomWatchabilityRepository(prisma as never)
    const episode = await repo.ensureActiveEpisode('room-1', 'prog-1')

    expect(tx.$executeRaw).toHaveBeenCalledOnce()
    expect(tx.roomEpisode.findFirst).toHaveBeenCalledWith({
      where: { roomId: 'room-1', status: 'ACTIVE' },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    })
    expect(tx.roomEpisode.create).not.toHaveBeenCalled()
    expect(episode.id).toBe('ep-1')
  })

  it('creates a new active episode only after the advisory lock is held', async () => {
    const createdAt = new Date('2026-03-10T10:05:00.000Z')
    const tx = {
      $executeRaw: vi.fn(async () => 1),
      roomEpisode: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'ep-2',
          roomId: data.roomId,
          programId: data.programId,
          status: data.status,
          summaryText: data.summaryText,
          unresolvedQuestion: data.unresolvedQuestion,
          energy: data.energy,
          tension: data.tension,
          turnCount: data.turnCount,
          messageCount: data.messageCount,
          startedAt: createdAt,
          endedAt: null,
          createdAt,
          updatedAt: createdAt,
        })),
      },
    }
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    }

    const repo = new PgRoomWatchabilityRepository(prisma as never)
    const episode = await repo.ensureActiveEpisode('room-2', 'prog-2')

    expect(tx.$executeRaw).toHaveBeenCalledOnce()
    expect(tx.roomEpisode.create).toHaveBeenCalledWith({
      data: {
        roomId: 'room-2',
        programId: 'prog-2',
        status: 'ACTIVE',
        summaryText: '',
        unresolvedQuestion: null,
        callbackBankJson: [],
        energy: 0,
        tension: 0,
        turnCount: 0,
        messageCount: 0,
      },
    })
    expect(episode).toMatchObject({
      id: 'ep-2',
      room_id: 'room-2',
      program_id: 'prog-2',
      status: 'ACTIVE',
    })
  })

  it('recomputes beat ordinal after the advisory lock is acquired', async () => {
    const createdAt = new Date('2026-03-10T10:06:00.000Z')
    const tx = {
      $executeRaw: vi.fn(async () => 1),
      roomProgramEvent: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'evt-1',
          roomId: data.roomId,
          episodeId: data.episodeId,
          beatId: data.beatId,
          eventType: data.eventType,
          status: data.status,
          cueType: data.cueType,
          directorGoal: data.directorGoal,
          selectedSpeakerAgentId: data.selectedSpeakerAgentId,
          idempotencyKey: data.idempotencyKey,
          payloadJson: data.payloadJson,
          errorText: null,
          createdAt,
          updatedAt: createdAt,
        })),
      },
      roomEpisodeBeat: {
        findUnique: vi.fn(async () => null),
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ ordinal: 4 })
          .mockResolvedValueOnce({ ordinal: 4 }),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'beat-5',
          roomId: data.roomId,
          episodeId: data.episodeId,
          ordinal: data.ordinal,
          beatType: data.beatType,
          cueType: data.cueType,
          directorGoal: data.directorGoal,
          promptHint: data.promptHint,
          anchorMessageId: data.anchorMessageId,
          callbackMessageId: data.callbackMessageId,
          targetRole: data.targetRole,
          selectedSpeakerAgentId: data.selectedSpeakerAgentId,
          status: data.status,
          auditJson: data.auditJson,
          createdAt,
          completedAt: null,
        })),
      },
      roomSelectionLedger: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'ledger-1',
          roomId: data.roomId,
          episodeId: data.episodeId,
          beatId: data.beatId,
          programEventId: data.programEventId,
          candidateAgentId: data.candidateAgentId,
          selected: data.selected,
          finalScore: data.finalScore,
          reasonsJson: data.reasonsJson,
          createdAt,
        })),
        findMany: vi.fn(async () => []),
      },
    }
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    }

    const repo = new PgRoomWatchabilityRepository(prisma as never)
    const planned = await repo.planProgramCue({
      room_id: 'room-1',
      episode_id: 'ep-1',
      ordinal: 1,
      beat_type: 'HOOK',
      cue_type: 'ADVANCE',
      director_goal: '继续推进',
      selected_speaker_agent_id: 'agent-1',
      idempotency_key: 'manual-cue:room-1:1',
      selection_ledger: [
        {
          candidate_agent_id: 'agent-1',
          selected: true,
          final_score: 1,
          reasons_json: [],
        },
      ],
    })

    expect(tx.$executeRaw).toHaveBeenCalledOnce()
    expect(tx.roomEpisodeBeat.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        roomId: 'room-1',
        episodeId: 'ep-1',
        ordinal: 5,
      }),
    })
    expect(planned.beat.ordinal).toBe(5)
  })

  it('falls back to archived program events when a hot-row lookup misses', async () => {
    const hotFindUnique = vi.fn(async () => null)
    const archiveFindUnique = vi.fn(async () => ({
      id: 'evt-archived-1',
      roomId: 'room-1',
      episodeId: 'episode-1',
      beatId: null,
      eventType: 'RAW_MESSAGE',
      status: 'EXECUTED',
      cueType: 'CALLBACK',
      directorGoal: '回收旧梗',
      selectedSpeakerAgentId: 'agent-1',
      idempotencyKey: 'raw-message:archived-1',
      payloadJson: { source: 'archive' },
      errorText: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      archivedAt: new Date('2026-03-14T00:00:00.000Z'),
      archiveBatchId: 'batch-1',
      archiveReason: 'retention_window_elapsed',
    }))

    const repo = new PgRoomWatchabilityRepository({
      roomProgramEvent: { findUnique: hotFindUnique },
      roomProgramEventArchive: { findUnique: archiveFindUnique },
    } as never)

    const event = await repo.getProgramEvent('evt-archived-1')

    expect(hotFindUnique).toHaveBeenCalledWith({ where: { id: 'evt-archived-1' } })
    expect(archiveFindUnique).toHaveBeenCalledWith({ where: { id: 'evt-archived-1' } })
    expect(event).toMatchObject({
      id: 'evt-archived-1',
      room_id: 'room-1',
      event_type: 'RAW_MESSAGE',
      payload_json: { source: 'archive' },
    })
  })
})
