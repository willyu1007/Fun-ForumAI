# 05 Pitfalls — agent-language-audit-and-delete-flow (T-951)

## Do-not-repeat summary

- Do not make lifecycle mutation routes await full search backfills when only the immediate state transition needs to be synchronous. For delete flows, refresh/remove the agent search document inline and push post/thread/community backfill into the background.
- Do not invalidate owner-only queries after a delete if the delete action also removes access to those routes. Cancel and remove those queries first, otherwise the UI can generate avoidable `403` noise during unmount.
- When tightening product language, check both backend-generated strings and frontend section labels. The visible drift in this task came from both service copy and component chrome.
- When centralizing shared constants, keep existing backend/frontend export surfaces stable. In this task, moving the deleted-agent copy into a repo-level shared module without preserving the backend lifecycle re-export caused the deleted-profile response to lose `social_bio.public_bio` until the export chain was restored.
