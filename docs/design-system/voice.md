# Voice

Short, warm, record-shop vocabulary. Subtle over noisy, wry over farcical. Clear always beats clever.

## Words

| Say | Don't say | Why |
|---|---|---|
| **Retire** / **Retired** / **Restore** (rotation) | Kill / Killed / Unkill | The station's preferred language. API names (`kill_date`, the kill endpoint) are unchanged and never reach the screen. Classic mode keeps tubafrenzy's wording. |
| Shelf, bin, card, file, pull | Entity, item, record set | The library model (see `README.md`) |
| Heavy · Medium · Light · Singles | H/M/L/S alone in prose | Letters are for compact chips; full names in sentences and accessible names |
| "Heavy 3", "card 3 — Jazz" | "Card ID 14" | Cards are named the way music directors say them |
| Mail Bin | Bin (in user-facing copy) | "Bin" alone means a rotation bin |

## Tone by state

| State | Tone | Example |
|---|---|---|
| Empty | Casual, lightly wry, one next step | "An empty record..." · "Nothing on this shelf matches." + Clear filters |
| Success toast | Casual, plain, names the result | "Retired *DOGA*." (+ Undo) · "Added Heavy 4." · "Saved the replacement windows." |
| Confirm | Neutral, serious, names the count and the consequence | "Clear all 12 albums from your Mail Bin? This can't be undone." |
| Error | Calm and serious (no jokes), reassuring, with a remedy | "Couldn't reach your Mail Bin. Your saved records are safe — check your connection and try again." |
| Partial failure | States exactly what happened and how to finish | "Filed in Medium, but couldn't retire the Heavy entry — retire it from the shelf." |

## Mechanics

- Name the act on every button and its count when there is one: "Discard 6 moves", "Save 6", "Add to rotation".
- Use typographic quotes and dashes (“ ” — ·) in visible and accessible text.
- Accessible names carry the full reading the visuals abbreviate: "Heavy (13)" for a chip that shows `H 13`, "Heavy rotation, card 2 'Jazz'" for a pill that shows `H ②`.
- Present server-owned text (genres, formats, names) exactly as sent. Restyle labels only through an exact-match lookup table, never by changing case.
- Theme names continue the voice: The Stacks, Blue Note, Shellac, Deadstock.
