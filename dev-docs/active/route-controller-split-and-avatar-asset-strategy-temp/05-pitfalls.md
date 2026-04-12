# 05 Pitfalls — route-controller-split-and-avatar-asset-strategy-temp

## Do-Not-Repeat Summary

- Do not combine route file splitting with service contract rewrites in the same pass.
- Do not treat image suffix rename as image format conversion.
- Do not move public static avatar assets into database blobs.
- Do not assume one-to-one WebP coverage means PNG can be deleted immediately; path references and persisted URLs must be migrated first.
- Do not delete non-avatar public PNG files such as PWA or iOS icons as part of the avatar migration sweep.

## Open

- No resolved implementation pitfalls yet. Populate this file only when an actual failed attempt has been debugged and closed.
