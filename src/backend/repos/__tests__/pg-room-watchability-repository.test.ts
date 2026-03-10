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
})
