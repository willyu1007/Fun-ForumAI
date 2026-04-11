# 06 Operator Guide — ios-android-runtime-smoke-kit (T-061)

## Purpose

Run the Expo dev-client smoke flow for both platforms and collect reproducible artifacts under `.ai/.tmp/mobile-smoke/`.

## Preconditions

- Backend is reachable at `http://127.0.0.1:${PORT:-4000}` and `/health` returns `200`
- Local env is loaded so `EXPO_PUBLIC_API_BASE_URL` resolves correctly for host and app runtime
- Expo dev client for `ai.funforum.app` is already installed on:
  - one booted iOS simulator
  - one booted Android emulator
- `maestro` CLI is installed and available on `$PATH` or at `$HOME/.maestro/bin/maestro`
- No existing Metro server is occupying port `8081`

## Fixture Preparation

1. Run:

```bash
pnpm mobile:smoke:prepare
```

2. Expected result:
  - backend seed profile `smoke-minimal` is applied
  - a fixture is written to `.ai/.tmp/mobile-smoke/<run-id>/fixture.json`
  - `.ai/.tmp/mobile-smoke/latest.json` points at the latest fixture

## iOS Smoke

1. Boot an iOS simulator with the Fun Forum dev client installed.
2. Run:

```bash
pnpm mobile:smoke:ios
```

3. Expected artifacts:
  - `.ai/.tmp/mobile-smoke/<run-id>/ios/metro.log`
  - `.ai/.tmp/mobile-smoke/<run-id>/ios/maestro.log`
  - `.ai/.tmp/mobile-smoke/<run-id>/ios/debug-output/`

## Android Smoke

1. Boot an Android emulator with the Fun Forum dev client installed.
2. Run:

```bash
pnpm mobile:smoke:android
```

3. Expected artifacts:
  - `.ai/.tmp/mobile-smoke/<run-id>/android/metro.log`
  - `.ai/.tmp/mobile-smoke/<run-id>/android/maestro.log`
  - `.ai/.tmp/mobile-smoke/<run-id>/android/debug-output/`

## Flow Inventory

- shared flows:
  - `apps/mobile/.maestro/shared/anonymous.yaml`
  - `apps/mobile/.maestro/shared/login.yaml`
  - `apps/mobile/.maestro/shared/feed.yaml`
  - `apps/mobile/.maestro/shared/rooms.yaml`
  - `apps/mobile/.maestro/shared/agents.yaml`
  - `apps/mobile/.maestro/shared/xp.yaml`
  - `apps/mobile/.maestro/shared/private.yaml`
- platform entrypoints:
  - `apps/mobile/.maestro/ios/smoke.yaml`
  - `apps/mobile/.maestro/android/smoke.yaml`

## Failure Handling

- `backend unreachable`: start the backend first and re-run `pnpm mobile:smoke:prepare`
- `No mobile smoke fixture found`: re-run `pnpm mobile:smoke:prepare`
- `Metro is already running on port 8081`: stop the existing Metro session and re-run the platform command
- `No booted iOS simulator found` or `No booted Android emulator found`: boot the target simulator/emulator and confirm the dev client is installed
- `Maestro CLI is not installed`: install Maestro before retrying

## Verification

- Structural validation:

```bash
pnpm mobile:smoke:validate
```

- The validation should confirm:
  - required Maestro flows exist
  - required scripts are registered in `package.json`
  - this operator guide exists
  - required test IDs are wired in the mobile app
