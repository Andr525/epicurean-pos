# Pre-existing Voice test failure — not a new Voice regression

Unchanged test/voice-engine.mjs fails at its function beginAddItem byte-for-byte comparison against origin/main. Confirmed on clean detached2ff42a7 and current corrective source with Node22.23.3, jsdom from frozen test lockfile and origin/main=cfeceb8. Prior exact-position constructor differences already violated that source-freeze assertion before this corrective patch. Current helper change adds another textual difference; this is not evidence of a newly failing Voice-language/session behavior. Later assertions after this first failure do not run.

Files voice-engine-baseline.txt and voice-engine-current.txt preserve failing outputs/exit1. No assertion edited, no Voice code/parser/provider changed, no paid service called. This existing failure is reported separately from manual regressions, not hidden or counted as a pass.

Reproduce baseline in a separate clean checkout of2ff42a7 with origin/main=cfeceb8, frozen test dependencies, then node test/voice-engine.mjs. Current command identical at review branch. This regression characterization does not resume Voice development or benchmark speech.
