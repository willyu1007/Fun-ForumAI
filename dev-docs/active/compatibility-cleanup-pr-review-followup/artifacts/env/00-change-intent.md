# Env Change Intent

- Remove `FF_CONTROL_PLANE_CONFIG_V1` from the live env contract because the control-plane config routes are no longer runtime-gated by that flag.
- Remove `FF_INCUBATION_TRUST_HARD_ENFORCE` from the live env contract because strict T4 trust enforcement is now canonical runtime behavior.
- Regenerate `env/.env.example`, `docs/env.md`, and `docs/context/env/contract.json` so published config surfaces match runtime.
