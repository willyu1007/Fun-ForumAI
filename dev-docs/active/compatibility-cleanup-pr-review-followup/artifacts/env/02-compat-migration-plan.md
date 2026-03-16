# Compatibility / Migration Notes

- This is a breaking env-contract cleanup, but only for dead keys with no remaining runtime consumer.
- No repo secret refs or `env/values/*.yaml` updates were required because the removed variables were feature toggles, not secrets or required values.
- Deploy overlays were updated in the same change so Kubernetes config no longer injects removed keys.
