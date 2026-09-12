# Retrospective log

This file is the feedback half of the decision loop. `decisions.md` records what was chosen.
This file records what happened after — where a decision produced friction, drift, or a
symptom `self-audit.mjs` or repeated validator warnings surfaced. It is how the skill
corrects itself between sessions instead of relying on Luke to notice.

Append-only, newest first. Every entry follows the Retrospective protocol in `decisions.md`.
An entry with no Action taken is incomplete — do not log a pattern and walk away from it.

```
## RETRO-00N — <the recurring symptom>
**Date:** YYYY-MM-DD
**Trigger:** <what surfaced it — a warning seen N times, a self-audit finding, a manual report>
**Traces to:** ADR-000X (or "no prior decision — new pattern")
**Read as:** <the decision was right but underspecified | wrong for this case | missing a helper | not actually a problem>
**Action taken:** <what changed, in this same session — an ADR amendment, a new validator rule, a new script, or an explicit "left as accepted friction" with the reason>
```

---

*(empty — no retrospectives logged yet)*
