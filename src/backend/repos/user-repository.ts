import type { HumanUser, CreateHumanUserInput } from './types.js'

export interface UserRepository {
  findById(id: string): Promise<HumanUser | null>
  findByEmail(email: string): Promise<HumanUser | null>
  create(input: CreateHumanUserInput): Promise<HumanUser>
  updateLastLogin(id: string): Promise<void>
}
