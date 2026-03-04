import type { PrismaClient } from '@prisma/client'

type RiskLevel = 'green' | 'yellow' | 'red'

function computeRiskLevel(score: number): RiskLevel {
  if (score >= 80) return 'green'
  if (score >= 50) return 'yellow'
  return 'red'
}

export class CreditService {
  constructor(private readonly prisma: PrismaClient | null) {}

  async ensureCredit(agentId: string): Promise<void> {
    if (!this.prisma) return
    const existing = await this.prisma.agentCredit.findUnique({ where: { agentId } })
    if (existing) return
    await this.prisma.agentCredit.create({
      data: { agentId, creditScore: 80, riskLevel: 'green', violations: 0 },
    })
  }

  async adjustCredit(agentId: string, delta: number, reason: string): Promise<{ credit_score: number; risk_level: RiskLevel }> {
    if (!this.prisma) return { credit_score: 80, risk_level: 'green' }

    await this.ensureCredit(agentId)

    const credit = await this.prisma.agentCredit.findUnique({ where: { agentId } })
    if (!credit) return { credit_score: 80, risk_level: 'green' }

    const newScore = Math.max(0, Math.min(100, credit.creditScore + delta))
    const newRisk = computeRiskLevel(newScore)
    const isViolation = delta < 0

    await this.prisma.agentCredit.update({
      where: { agentId },
      data: {
        creditScore: newScore,
        riskLevel: newRisk,
        violations: isViolation ? { increment: 1 } : undefined,
        lastViolationAt: isViolation ? new Date() : undefined,
      },
    })

    await this.prisma.creditEvent.create({
      data: { agentId, delta, reason },
    })

    if (newRisk === 'red') {
      await this.prisma.agent.update({
        where: { id: agentId },
        data: { status: 'LIMITED' },
      }).catch((err) => {
        console.error('[CreditService] agent status update to LIMITED failed:', err)
      })
    }

    return { credit_score: newScore, risk_level: newRisk }
  }

  async getCredit(agentId: string): Promise<{ credit_score: number; risk_level: RiskLevel; violations: number; last_violation_at: Date | null }> {
    if (!this.prisma) return { credit_score: 80, risk_level: 'green', violations: 0, last_violation_at: null }
    const c = await this.prisma.agentCredit.findUnique({ where: { agentId } })
    if (!c) return { credit_score: 80, risk_level: 'green', violations: 0, last_violation_at: null }
    return {
      credit_score: c.creditScore,
      risk_level: c.riskLevel as RiskLevel,
      violations: c.violations,
      last_violation_at: c.lastViolationAt,
    }
  }

  async getCreditEvents(agentId: string, limit = 20) {
    if (!this.prisma) return []
    const events = await this.prisma.creditEvent.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return events.map(e => ({
      id: e.id,
      delta: e.delta,
      reason: e.reason,
      created_at: e.createdAt,
    }))
  }

  async dailyRecovery(): Promise<number> {
    if (!this.prisma) return 0
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 1)

    const eligible = await this.prisma.agentCredit.findMany({
      where: {
        creditScore: { lt: 100 },
        OR: [
          { lastViolationAt: null },
          { lastViolationAt: { lt: cutoff } },
        ],
      },
    })

    let recovered = 0
    for (const c of eligible) {
      await this.adjustCredit(c.agentId, 1, 'daily_clean')
      recovered++
    }
    return recovered
  }
}
