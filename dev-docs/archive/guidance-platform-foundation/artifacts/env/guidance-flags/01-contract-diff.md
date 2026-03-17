# Contract Diff

- Added backend variable: `FF_GUIDANCE_V1`
  - Type: `enum("true","false")`
  - Default: `"false"`
  - Purpose: gate guidance side effects and delivery.
- Added frontend variable: `VITE_FF_GUIDANCE_V1`
  - Type: `enum("true","false")`
  - Default: `"false"`
  - Purpose: gate guidance queries and visible surfaces.

Compatibility:

- Non-breaking addition.
- Existing environments continue to work because both variables are optional and default to disabled.
