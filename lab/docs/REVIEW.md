# Independent review handoff

Base POS/client/adapter commit: `6ba22ef9e3474d1c9649864ba27def4dfec796e1`.
Review branch: `review/master-iphone-test-environment`.
Earlier immutable review branches: `review/claude-build67-audit` (2dd9d1a) and `review/claude-conversational-pilot` (6ba22ef).

All changes in this milestone are under lab/. No production file, BOH price, main merge, deployment, device access or paid call is included. The BOH snapshot provenance/hash is in fixtures/source.json; server verifies its contents. Source UI files are served from the base checkout, with explicit test-only HTML/runtime replacements described in README.

Review containment before running. Run Node 22, npm ci and npm test in lab; tests use installed Chromium. Security checks must pass. The feature screen suite must currently exit 1: the three documented defects are retained. Cloud results/screens/reproduction are in docs/evidence. These are controlled fixtures only. Automated audio uses fake microphone and scripted transcript; the phone is not tested.

Check: exact visible controls and hit testing; no direct parser/commit invocations masquerading as screen tests; correction creates one menu line; rejected missing price never inferred; 2/2A and later dessert failures retained; local authorization/capability/expiry; no provider fallback; no SEND/FIRE; no production authentication claim. Verify actual native iPhone behavior later under separate owner permission.

Claude should inspect this review branch independently. The internal verifier is not Claude and does not replace the owner's external audit. No automatic message, issue or PR was sent to anyone.
