import type { PromptScene, PromptSceneBudgetConfig } from './types.js'

const DEFAULT_COMPILER_POLICY = {
  min_control_tier: 'minimal',
  max_control_tier: 'expanded',
  default_memory_tier: 'compact',
  allow_soft_overflow: true,
} as const

export const PROMPT_SCENE_BUDGET_CONFIGS: Record<PromptScene, PromptSceneBudgetConfig> = {
  forum_post: {
    scene: 'forum_post',
    request_budget: {
      reference_input: 12_000,
      soft_total_ratio: 1.30,
      hard_total_ratio: 1.55,
      output_reserve: 520,
    },
    buckets: {
      hard_control: { guaranteed: 8, preferred: 10, max: 13 },
      compact_control: { guaranteed: 12, preferred: 15, max: 19 },
      current_context: { guaranteed: 28, preferred: 36, max: 46 },
      memory: { guaranteed: 18, preferred: 26, max: 38 },
      soft_expression: { guaranteed: 6, preferred: 10, max: 15 },
    },
    compiler_policy: {
      ...DEFAULT_COMPILER_POLICY,
      default_memory_tier: 'full',
    },
  },
  forum_thread: {
    scene: 'forum_thread',
    request_budget: {
      reference_input: 8_000,
      soft_total_ratio: 1.25,
      hard_total_ratio: 1.45,
      output_reserve: 520,
    },
    buckets: {
      hard_control: { guaranteed: 9, preferred: 11, max: 14 },
      compact_control: { guaranteed: 12, preferred: 15, max: 20 },
      current_context: { guaranteed: 35, preferred: 42, max: 52 },
      memory: { guaranteed: 12, preferred: 20, max: 30 },
      soft_expression: { guaranteed: 5, preferred: 8, max: 12 },
    },
    compiler_policy: {
      ...DEFAULT_COMPILER_POLICY,
      default_memory_tier: 'compact',
    },
  },
  forum_turn: {
    scene: 'forum_turn',
    request_budget: {
      reference_input: 8_000,
      soft_total_ratio: 1.25,
      hard_total_ratio: 1.45,
      output_reserve: 520,
    },
    buckets: {
      hard_control: { guaranteed: 9, preferred: 11, max: 14 },
      compact_control: { guaranteed: 12, preferred: 15, max: 20 },
      current_context: { guaranteed: 35, preferred: 42, max: 52 },
      memory: { guaranteed: 12, preferred: 20, max: 30 },
      soft_expression: { guaranteed: 5, preferred: 8, max: 12 },
    },
    compiler_policy: {
      ...DEFAULT_COMPILER_POLICY,
      default_memory_tier: 'compact',
    },
  },
  scheduled_post: {
    scene: 'scheduled_post',
    request_budget: {
      reference_input: 12_000,
      soft_total_ratio: 1.30,
      hard_total_ratio: 1.55,
      output_reserve: 720,
    },
    buckets: {
      hard_control: { guaranteed: 8, preferred: 10, max: 13 },
      compact_control: { guaranteed: 12, preferred: 15, max: 19 },
      current_context: { guaranteed: 28, preferred: 36, max: 46 },
      memory: { guaranteed: 18, preferred: 26, max: 38 },
      soft_expression: { guaranteed: 6, preferred: 10, max: 15 },
    },
    compiler_policy: {
      ...DEFAULT_COMPILER_POLICY,
      default_memory_tier: 'full',
    },
  },
  private_chat: {
    scene: 'private_chat',
    request_budget: {
      reference_input: 10_000,
      soft_total_ratio: 1.25,
      hard_total_ratio: 1.50,
      output_reserve: 900,
    },
    buckets: {
      hard_control: { guaranteed: 10, preferred: 12, max: 15 },
      compact_control: { guaranteed: 14, preferred: 18, max: 22 },
      current_context: { guaranteed: 24, preferred: 30, max: 38 },
      memory: { guaranteed: 16, preferred: 24, max: 36 },
      soft_expression: { guaranteed: 5, preferred: 8, max: 12 },
    },
    compiler_policy: {
      ...DEFAULT_COMPILER_POLICY,
      default_memory_tier: 'compact',
    },
  },
  chat_room: {
    scene: 'chat_room',
    request_budget: {
      reference_input: 5_000,
      soft_total_ratio: 1.25,
      hard_total_ratio: 1.45,
      output_reserve: 600,
    },
    buckets: {
      hard_control: { guaranteed: 10, preferred: 12, max: 15 },
      compact_control: { guaranteed: 12, preferred: 16, max: 20 },
      current_context: { guaranteed: 35, preferred: 45, max: 55 },
      memory: { guaranteed: 10, preferred: 18, max: 28 },
      soft_expression: { guaranteed: 5, preferred: 8, max: 12 },
    },
    compiler_policy: {
      ...DEFAULT_COMPILER_POLICY,
      default_memory_tier: 'minimal',
    },
  },
  proactive_dm: {
    scene: 'proactive_dm',
    request_budget: {
      reference_input: 6_000,
      soft_total_ratio: 1.15,
      hard_total_ratio: 1.30,
      output_reserve: 700,
    },
    buckets: {
      hard_control: { guaranteed: 12, preferred: 14, max: 18 },
      compact_control: { guaranteed: 14, preferred: 18, max: 22 },
      current_context: { guaranteed: 22, preferred: 28, max: 35 },
      memory: { guaranteed: 14, preferred: 22, max: 32 },
      soft_expression: { guaranteed: 4, preferred: 7, max: 10 },
    },
    compiler_policy: {
      min_control_tier: 'compact',
      max_control_tier: 'expanded',
      default_memory_tier: 'sparse',
      allow_soft_overflow: false,
    },
  },
}

export function getPromptSceneBudgetConfig(scene: PromptScene): PromptSceneBudgetConfig {
  return PROMPT_SCENE_BUDGET_CONFIGS[scene]
}
