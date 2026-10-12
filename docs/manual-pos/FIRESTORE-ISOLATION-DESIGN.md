# Proposed isolated Firestore design — NOT BUILT / approval required

This is the concrete design for Claude's independent approval before implementation. No emulator, Firebase connection, credentials, fixtures in a database, backend write, kitchen sink or paid service is installed/started by this delivery. Current lab stays no-write/no-SEND/FIRE. Independent design approval does not authorize production or expense.

## Boundary and processes

1. Owner/development machine runs pinned Firebase Local Emulator Suite with Firestore on 127.0.0.1:8080 and Auth on 127.0.0.1:9099; emulator UI disabled or loopback-only; explicit DEMO project demo-epicurean-manual. Pin Node/Java/CLI versions and jar integrity in the implementation before downloading/installing. No real Firebase project, service-account or production config is accepted.
2. Isolated POS server remains the existing real UI on its own origin. A local backend adapter runs at 127.0.0.1:9444. Browser can access it only via same-origin lab proxy with session nonce/origin/host gates. The iPhone has no direct emulator port access; only the approved temporary private HTTP screen origin is LAN-visible.
3. Backend is emulator-only: exact allowlisted loopback endpoints and demo project ID mandatory. Startup fails if credential/config/project destination is real, if FIRESTORE_EMULATOR_HOST is absent/wrong, if application-default credential resolution is attempted, or if emulator health check fails. No fallthrough to Google/provider endpoints; outbound runtime egress denied except local ports. Missing service is a test failure, not a live fallback. Production SDK initialization remains removed from test-served HTML.
4. No browser direct privileged Firestore writes. All state transitions use the local backend; server verifies synthetic Auth identity and fixture staff policy. Firestore Rules deny unauthenticated access and client creation/update/delete of financial approvals/audits/kitchen outbox. Rules and API boundaries both get malicious/direct-invocation tests. The server's privileged emulator SDK cannot rely on Rules for its own checks; transaction logic enforces policy independently.

## Data, initial state and durable operations

Import only hash-verified, owner-permitted authentic BOH records into namespaced per-run fixtures; no missing food records filled with SEED_ITEMS. Synthetic staff/guests/check IDs only. Preserve source revisions, prices, identity/VIN/vintage/size, availability/taxability metadata. A missing required record/classification blocks relevant acceptance cases before any transition. Session snapshot logs never contain personal guests/staff/codes/credentials.

Proposed collections: catalog_revisions/{hash}; staff_policy/{syntheticAuthUid}; checks/{checkId} with revision and explicit position identities; check_lines/{lineId} with full menu/selection/modifier/seat identity and immutable BOH price snapshot; manager_approvals/{approvalId}; audit_events/{eventId}; action_requests/{requestId}; kitchen_intents/{intentId}; kitchen_acks/{intentId}. No collection uses live path credentials. Trace each line and intent to check, exact position (2 or 2A), menu/course, actor and catalog revision.

Every edit/void/comp/discount transaction reads expected check revision, scoped staff policy and (if needed) one-use manager approval. It atomically writes the new line/check revision, immutable audit and idempotent request result. Invalid/expired/stale/unauthorized requests mutate nothing. Sent/fired history stays immutable; void adds a reversal event. Preserve original price and derive tax/tip totals from approved adjustments. Backend verifies all arithmetic; browser-supplied prices/tax/tips/manager IDs are untrusted.

Reload reads full structured lines and check revisions; never reconstructs menu selections from display text. Two-client tests exercise expected-version conflicts and deterministic retries. Offline/pending state is explicit; no stale client may overwrite the new revision. Manager codes are synthetic, stored as salted/verifiable hashes for local tests, excluded from all logs; reauthentication yields a tightly scoped approval, not permanent elevated role.

## Kitchen simulation, not real SEND/FIRE

Existing application actions route through a reviewable transport boundary, not a replacement mock POS. In the proposed approved emulator profile, action intent is recorded locally with exact IDs and checked role/grant. A separate loopback recording sink returns controlled success, failure, timeout, duplicate acknowledgment or reordered acknowledgment. It has no kitchen device, printer, production queue or external network target.

Before acknowledgment, show pending intent; do not mark final sent/fired. Record acknowledgment and state transition transactionally/idempotently; identical retries cannot create a second intent. FIRE validates selected course, pending dessert, allergy confirmation, sent/fired status and exact check position. Server/manager SEND/FIRE allowed; active explicitly granted kitchen FIRE allowed; kitchen SEND denied. Financial approvals use the owner policy even when initiating manager is already logged in. Fault injection demonstrates crash between intent/ack/state, failed network, double tap, stale revision, revoked grant and denied manager code.

## Verification, approval and cleanup gates

Claude reviews project/endpoint deny rules, credential handling, Rules/API division, complete schema, role/approval/audit design, money rounding contract, ack/idempotency and cleanup before build. After approval, implementation gets a separate review commit with tests and no production configuration changes. Emulator writes require explicit owner authorization for that isolated profile under the current “no Firebase writes” rule; silence/design approval alone is not permission to write.

Required evidence: isolated connection refusal for real project/wrong host/missing emulator; Rules tests; direct action-role tests; codes never in logs; transaction denial changes zero documents; full reload/two-client recovery; manager approval/audit consistency; exact catalog/money oracle; kitchen sink count/ack behavior; no external traffic; process ports only as intended. UI screen results, simulated transport results and physical iPhone results stay separate in the same scorecard.

Data/run paths live in a fresh restrictive local temp directory outside cloud-sync/repository/backups. Port bindings and processes started by harness only; teardown stops all, deletes only its own synthetic run directory and verifies ports closed. Logs/screenshots deliberately retained only as controlled test evidence for review; run namespaces independent. A later owner-authorized phone session may use same-origin proxy, still no real kitchen/production connection.

Current implementation status: DESIGN ONLY. No claim of Firestore durability, financial permission enforcement or actual kitchen authorization is made.
