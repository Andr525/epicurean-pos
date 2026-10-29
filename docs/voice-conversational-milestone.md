# Conversational Voice milestone — mock pilot

Branch: `voice/conversational-pilot`, based on `voice/build67-reliability-audit` / `2dd9d1a`.

## What is demonstrated

The separate pilot now uses actual browser MediaRecorder audio over HTTP, a scripted STT boundary, the existing server-side OpenAI Responses interpretation adapter through a mocked transport, a stateful server coordinator, and server-loaded BOH validation. HTTP tests cover three guests including **both 2 and 2A**, multiple courses, a required-temperature clarification, natural contextual correction, complete confirmation, replay, session restart, invalid outputs and an interrupted in-flight interpretation. Chromium records audio, confirms the resulting draft, logs out, logs in and records another successful order.

This is a mock conversational Voice pilot. Scripted ASR and LLM responses do **not** establish acoustic recognition or model accuracy. It is not yet an integrated POS ordering pilot. No production POS files or production function entry point were changed. Confirmed output is an isolated unsent kitchen draft; it does not modify a check, SEND or FIRE. Do not describe these tests as physical iPhone acceptance.

## Diagnosis and minimum repair

The baseline evidence and exact Build 67 reproductions remain in [voice-build67-audit.md](voice-build67-audit.md). `index.html`'s `voiceBatchLinesFromText` split clauses rather than an entire conversational intent; connected position/course tokens failed segmentation. The pork chop’s missing standalone price was a correct BOH protection: the authoritative menu costs $89, and choosing a menu must remain explicit. Literal parsing could not resolve “No, change what you wrote.” Old capture/auth state was not reliably reconstructed after logout/login; the review branch added lifecycle fencing, though physical Safari recovery still needs testing.

`functions/interpret-order.mjs` already implemented strict structured interpretation but was not connected to an authorized server session. The smallest repair is a server coordinator around it, not replacing pricing or manual POS constructors. Added `pilot-service.mjs`, `pilot-authority.mjs`, `pilot-store.mjs` and `pilot-budget.mjs` provide that seam. Client-supplied catalogs and prices are rejected. Firebase identity must map to a server-side `voice_pilot_staff` binding; local PIN or anonymous authentication alone is insufficient.

Remaining minimum integration work: route the existing Safari recorder to a bounded STT gateway, connect transcript/session requests to this coordinator, and consume confirmation through existing manual menu constructors with an atomic unsent upsert. Keep existing manual POS controls available. The isolated browser harness proves the new request path without changing the working POS.

## Architecture recommendation

Retain Deepgram and add a bounded text LLM. Start with short push-to-talk turns and on-screen clarification; browser speech synthesis can read questions without a paid speech-generation provider. Retain Deepgram’s transcription boundary, but replace keyword interpretation with a model receiving the entire utterance, recent conversation, exact authoritative positions, existing draft IDs and a bounded BOH snapshot.

An integrated realtime model offers lower latency, richer turn-taking and acoustic interruption detection, but adds audio-generation charges, realtime session management and echo/barge-in handling. It still needs exactly the same server authorization, BOH validation, draft ownership and confirmation gates. Start with Deepgram + text interpretation; compare realtime only if measured physical tests show unacceptable turn latency or interruption handling. Neither architecture can be called reliable before those tests.

## Ordering state and kitchen contract

States are idle → interpreting → clarify/review → confirmed; interruption invalidates pending work while preserving the previous validated proposal. Cancel clears the conversation draft. Logout discards client references and stops tracks; login creates a new authorized session. Session identity binds staff, table, check, explicit pricing, BOH revision and exact positions. Fresh BOH/check-revision/allergy validation runs before each interpretation and confirmation. Request IDs prevent replay; session revision rejects stale changes; a nonce prevents an interrupted result from overwriting state.

Initial ordering requires the spoken “Foodmaster” prefix. Guest conversation does not reach the model. Answers are permitted while clarification is pending. Corrections address exact server-owned proposal IDs and replace/remove rather than append; unspecified corrections produce a question. The deployment UI must also distinguish an explicitly armed staff turn from guest chatter during an active proposal: the prefix heuristic alone cannot prove speaker intent.

All model output is untrusted: products, course, position, modifications, allergies, menu membership and pricing are revalidated. No free-text kitchen modifications. No partial order is accepted alongside a question. Menu pilot scope is the audited Scalini `pf_scalini_89`; other prix-fixe menus fail closed until their course rules are verified. Wine identity cannot be invented; live wine/BTG/flight ordering is outside this milestone.

Confirmation emits versioned JSON with stable session/order/line IDs, check/table identity, catalog/vocabulary revisions, exact `positionId`, BOH source ID/name, course, authoritative station when available (otherwise null), quantity, validated modifiers, authoritative prices and explicit `state: unsent`, `send: false`, `fire: false`. It contains no speech to reinterpret. A later kitchen consumer must resolve null routing, expand the actual menu’s automatic courses, and retain held/pending course semantics. Post-confirmation corrections retain stable line IDs and require an atomic **upsert of this session’s owned unsent draft**, never append the entire replacement envelope. Sent/fired/manual lines remain ineligible.

Existing legacy checks derive positions from guest count/female flags. Both 2 and 2A require an explicit authoritative `positionIdentities` list; the fixture supplies that check metadata. Speech never adds a seat. Staging must decide how this additive identity list is authored and how existing seat displays consume it.

## Provider requirements and cost gate

No paid requests or deployments were made. `pilot/provider-policy.json` is disabled, unapproved, unverified, has no credentials and has null rates/project. The separate function entry point has an additional hard live lock pending STT ledger, quota and POS acceptance work.

Required before paid use:

- Approved isolated Firebase/Google Cloud project with staff token verification, restricted staff/table bindings, least-privilege BOH read access and separate pilot sessions/budget collections. Do not reuse production ambient credentials.
- Deepgram project/key server-only, Nova-3 model/language/encoding chosen after Safari format testing, explicit channel/duration limits, published billing basis and verified rate. No client key, no automatic provider retry.
- OpenAI project/key server-only, Responses API with structured output and `store:false`, approved model initially GPT-4.1 mini, verified input/output rates and output cap. No cached-token discounts assumed.
- Shared durable pre-call reservations covering both STT and LLM, concurrency-tested transactions, bounded session/turn/audio quotas, request deduplication and no retries after unknown billed calls. LLM reservation includes context, schema and conservative prompt overhead; failed calls retain reservation. Current STT ledger and durable session quota are **not implemented**, so live use remains locked.
- Secrets in server secret storage, explicit retention/redaction policy and diagnostic consent. No guest recordings needed for initial controlled tests.

Published-price verification is blocked: direct GETs to the official pricing pages returned HTTP 403 from this environment’s network proxy. Official sources to verify are https://deepgram.com/pricing and https://developers.openai.com/api/docs/pricing/ . No current published quote is asserted here. The following exact numerical worksheet uses **unverified planning rates**, not approval-ready provider pricing; replace it with dated published rates before enabling anything.

Assumptions: 2 billed minutes of incoming audio per session, four text interpretation turns at 3,000 input / 300 output tokens each (12,000 / 1,200 total); realtime comparison has 2 input minutes and 1 output minute, estimated 600 input / 1,200 output audio tokens per minute plus the same text budget. No cache discount; taxes, cloud infrastructure, rounding and browser synthesis behavior excluded.

| Architecture / unverified planning rate | 100 sessions | 1,000 | 10,000 |
|---|---:|---:|---:|
| Deepgram streaming $0.0077/min + GPT-4.1 mini $0.40/$1.60 per million input/output tokens | $2.21 | $22.12 | $221.20 |
| Realtime mini audio $10/$20 and text $0.60/$2.40 per million tokens | $4.61 | $46.08 | $460.80 |
| Realtime audio $32/$64 and text $4/$16 per million tokens | $18.24 | $182.40 | $1,824.00 |

These are workload scenarios, not claims about current published pricing or guaranteed real bills. If actual prerecorded Deepgram billing is cheaper, update the worksheet using the verified format/model rate.

Proposed experiment: **$25 maximum additional spend**, reserve at most $20 for providers and $5 for approved staging infrastructure. Stop before any call whose worst-case reservation would cross the provider ceiling; cap at 100 sessions, 20 interpretation turns/session, 30 seconds/clip, no automatic retries. Disable auto top-up and use project quotas where available; cloud budget alerts alone are not a hard cap. The reservation ledger is a hard application gate only after verified rate/token bounds and STT reservations are complete. Infrastructure must separately have a bounded execution plan; do not promise an invoice cap from a budget alert.

## Milestones and engineering estimate

1. **Implemented here:** server conversation orchestration, strict BOH draft validation, mocked provider adapter integration, MediaRecorder/HTTP mock browser harness, complete-session automated scenarios, independent review.
2. **POS integration and safeguards — 12–20 hours:** consume envelopes through existing pricing constructors; atomic owned-unsent replacement; manual/sent/fired regression coverage; exact 2/2A rendering and menu automatic-course parity.
3. **Approved provider and budget path — 10–16 hours:** STT encoding/gateway, full shared spending reservation, durable session quotas, Firestore emulator concurrency tests, secrets/auth/rate verification. Use mocks until explicit approval.
4. **Physical iPhone acceptance and tuning — 12–20 hours:** whole-session corpus, background noise, overlapping speech, corrections, recording interruptions, recovery and repeatability. No repetitive individual-dish requests.
5. **Pilot hardening — 8–12 hours:** latency/failure diagnostics, retention, error recovery, atomic persistence and independent re-review.

Remaining estimate: **42–68 engineering hours**, excluding delays for provider approval/access and any major failures discovered in physical tests. Realtime migration would add roughly **20–35 hours** before equivalent acceptance.

## Physical test requirements

Use controlled staff utterances across complete multi-guest appetizer/main/dessert sessions, including 2 and 2A when authoritatively present. Capture redacted full transcripts and structured state transitions, rather than catalog matches. Cover vague and exact corrections before/after confirmation, repeated confirmation, a sent/fired protection case, interrupted playback/recording, noisy room and overlapping guest speech, network timeout, expired auth, logout/login on the same check, lock screen/background/foreground and microphone permission denial/recovery. Verify no lost course, no duplicates, no invented modification or standalone price and no automatic SEND/FIRE. Require visible complete review and explicit confirmation. Record device/iOS version and repeat the entire session to establish recovery reliability.

## Independent review and validation

Independent verifier `/root/pilot_verifier` reran HTTP and Chromium tests and reviewed isolation, BOH authority, exact positions, interruption fencing and immutable confirmation. Reviewer explicitly judged the earlier typed-transcript prototype incomplete; the subsequent MediaRecorder/HTTP test was independently rerun and improves transport evidence but still uses scripted ASR. Reviewer confirmed per-clip recorder ownership, stale-permission cleanup and the 30-second discard guard; no release-blocking finding remains for the isolated mock scope. Remaining findings are reflected in the gated integration milestones above.

Run with Node 22:

```
node test/voice-pilot-session.mjs
node test/voice-pilot-browser.cjs
node test/voice-interpret-provider.mjs
node test/voice-reliability-browser.cjs
```

The mock server forbids fallback provider calls when a scripted response/transcript is missing. The browser test supplies fixtures programmatically; running the mock server alone does not invent responses.

## Decisions requiring approval

1. Confirm Deepgram + bounded text LLM as the initial architecture; push-to-talk with explicit staff command/review protocol.
2. Provide/allow read-only access to the official pricing pages so a current dated quote can replace the unverified worksheet. This is separate from approval to incur charges.
3. After verified pricing and guard completion, approve the named isolated project/model/retention policy and **$25 total experiment cap**. No paid-service approval is inferred from this document.
4. Approve staging deployment only after POS delivery/ledger/physical-test gates pass. Production deployment requires a later explicit approval.
