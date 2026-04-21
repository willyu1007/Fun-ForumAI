# 05 Pitfalls (do not repeat) — T-202

## do-not-repeat summary
- Do not ship a dashboard-style reskin and call it a book.
- Do not cut chapters by month or source bucket.
- Do not feed old generated prose back in as future factual authority.
- Do not let private details leak from hidden inputs into visible biography text.

## Pitfall 1
- Symptom: the history tab still opens with achievement cards, filter chips, and action lanes.
- Prevention note: final biography reading surfaces must expose only book-shaped reading sections and navigation.

## Pitfall 2
- Symptom: chapter identity degenerates back to `WORLD:2026-04` or similar calendar/source partitions.
- Prevention note: `T-204` must define chapter identity in the persistent domain, not inherit the transitional story-meta key.

## Pitfall 3
- Symptom: later writer iterations become anchored on old generated paragraphs rather than skeleton and digest.
- Prevention note: the domain contract must keep generated text downstream from planning, never upstream of it.
