# T-071 Compatibility / Migration Plan

- Base and local-kind ConfigMap will set persona runtime flags explicitly.
- Existing environments that do not set these keys will continue to parse because the env contract provides defaults.
- `T-071` validation will use `GET /v1/admin/runtime/features` to prove the deployed runtime sees the expected values.
