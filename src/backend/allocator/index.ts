export { EventAllocator, type AllocatorDeps } from './allocator.js'
export { InMemoryAdmissionGate } from './admission.js'
export { DefaultQuotaCalculator } from './quota-calculator.js'
export { DefaultCandidateSelector } from './candidate-selector.js'
export { InMemoryAllocationLock } from './allocation-lock.js'
export { DefaultDegradationMonitor } from './degradation.js'
export { InMemoryEventQueue, type EventQueue } from './event-queue.js'
export { QueueConsumer, type BatchResult, type ConsumerStats } from './queue-consumer.js'
export { deriveFollowUpEvents } from './chain-propagation.js'
export { DEFAULT_ALLOCATOR_CONFIG, type AllocatorConfig } from './config.js'
export type {
  EventPayload,
  AllocationResult,
  DomainEventType,
  ScoredCandidate,
  AgentCandidate,
  DegradationState,
  DegradationLevel,
  QuotaContext,
  SelectedAgent,
  AdmissionVerdict,
  AgentRepository,
} from './types.js'
