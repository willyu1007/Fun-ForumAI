# Pitfalls

## Do Not Repeat

- Do not pass arbitrary dynamic class fragments into shared UI primitives when the repo relies on static UI governance analysis.
  - Symptom: the first full gate run flagged `tailwind-policy-unparseable` on the dialog overlay wiring.
  - Root cause: the dialog primitive accepted a raw `overlayClassName` fragment that the Tailwind policy checker could not reduce to a stable literal set.
  - Fix: replace the raw class fragment with an explicit boolean prop, `hideOverlay`, and branch to concrete string literals inside the primitive.
  - Prevention: when extending shared UI components in this repo, prefer boolean/enum props that resolve to static class strings over forwarding ad-hoc class names.

- Do not use `getDisplayMedia` as the primary screenshot flow when the target is the current forum page.
  - Symptom: clicking the scissors button opened the browser share chooser, which felt heavy and broke the “quick chat screenshot” mental model.
  - Root cause: the earlier implementation optimized for generic surface capture instead of the concrete user job, which is usually “grab the page I am already looking at”.
  - Fix: switch the primary path to current-page DOM capture plus the existing in-app cropper, and only hide the modal during the actual page capture frame.
  - Prevention: when the capture target is the current web app surface, prefer direct page rendering over browser/system share flows unless cross-app capture is explicitly required.

- Do not drive the composer from the last visible timeline segment when empty sessions are filtered out.
  - Symptom: creating a fresh session with zero visible messages could hide the composer or bind sends to the previous visible session.
  - Root cause: the UI used the filtered “visible current session” both for timeline rendering and for the actual message composer hooks.
  - Fix: keep timeline visibility filtering for display only, but keep the composer and send/upload/end hooks bound to the true active session.
  - Prevention: when list filtering removes empty or system-only records, separate the display selection state from the write-target state.
