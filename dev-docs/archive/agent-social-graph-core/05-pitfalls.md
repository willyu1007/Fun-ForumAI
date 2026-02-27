# 05 Pitfalls — T-037

## Pitfall 1: Prisma JSON input typing mismatch in relation event payload
- Symptom: `Type 'Record<string, unknown>' is not assignable to InputJsonValue` during typecheck.
- Root cause: Prisma create input requires `InputJsonValue`, not generic record.
- Fix: cast payload to `Prisma.InputJsonValue | undefined` in pg relation repository.
- Prevention: when using Prisma `Json` fields, always normalize/cast at repository boundary.

## Pitfall 2: leader elector mock shape mismatch in scheduler tests
- Symptom: test compile failed because `isLeader` expected a readonly boolean, not function.
- Root cause: test mock used `vi.fn()` for property typed as boolean.
- Fix: set `isLeader: false` literal in test mocks.
- Prevention: mirror interface property types exactly in scheduler/elector mocks.
