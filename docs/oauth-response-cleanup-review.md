# OAuth response cleanup review

This is bounded engineering evidence for [LB-18.05 / #113](https://github.com/Pick-Your-AI/pick-your-ai-leaderboard/issues/113),
covering the browser identity provider's response lifecycle. It is not a release
approval or a live GitHub OAuth test. The reviewed starting source is
[`a1f8f07ac31d0851c1752cf3b1dd5696c4ba9fb9`](https://github.com/Pick-Your-AI/pick-your-ai-leaderboard/tree/a1f8f07ac31d0851c1752cf3b1dd5696c4ba9fb9).

## Finding and correction

The [provider adapter](../apps/controls/src/github.mjs) rejected unsuccessful HTTP
responses without consuming or cancelling their bodies. Its async body iterator
also awaited transport cancellation after an oversized response. A slow cleanup
could therefore delay the provider failure, including the transient token's
revocation after an oversized user response. An unexpected successful revocation
status was checked only after reading its body, despite already being insufficient
to establish the required 204 acknowledgement.

The adapter now cancels rejected HTTP bodies immediately, validates the required
revocation status before reading, and uses an explicit reader whose cancellation
is initiated without awaiting the transport's cleanup promise. The reader lock is
released in `finally`; cleanup rejection is observed without replacing the
original error. Successful token/user responses retain the 65,536-byte ceiling,
fatal UTF-8 decoding, existing BOM handling and JSON validation. The token remains
subject to the existing revocation `finally` block, and only the existing fixed
provider endpoints are used.

## Reproduction and checks

All provider responses and account identities are fictional. The callback test
uses a loopback HTTP server and a disposable private SQLite store.

- The twelve initial cases in
  [oauth-response-cleanup.test.mjs](../apps/controls/test/oauth-response-cleanup.test.mjs)
  failed against the unchanged starting adapter: unsuccessful response bodies
  were not cancelled, oversized-response failures waited for cleanup, and
  unconfirmed revocation statuses read the body before rejection.
- The corrected adapter passes those twelve cases with cleanup held unresolved
  and then either resolved or rejected. A failed user response still reaches
  token revocation before its cleanup settles. Rejected bodies release their
  reader lock, and cleanup errors do not replace the fixed provider error.
- A thirteenth case exercises the actual Controls callback. While cleanup remains
  unresolved, an oversized user response returns 502, consumes the one-use login
  state, preserves the previous session and public snapshot, rejects replay, and
  permits a fresh successful login that rotates the old session.
- Existing scope, revocation and encoding tests remain part of the focused
  verification. Revocation's invalid HTTP status now takes precedence over body
  decoding, so encoding cases apply to the token/user endpoints; the valid empty
  204 and wrong-status revocation cases remain explicitly covered.

Run the focused suite after installing the pinned dependencies and building:

```sh
npm ci --ignore-scripts
npm run build
node --test apps/controls/test/oauth-response-cleanup.test.mjs apps/controls/test/oauth-response-encoding.test.mjs apps/controls/test/oauth-revocation.test.mjs apps/controls/test/oauth-scope.test.mjs
```

The focused suite passed all 66 cases with zero failures or skips on Node.js
24.19.0. An independent agent source review and separate execution of the same
66 cases found no blocking defect. This engineering review does not substitute
for the repository's required independent GitHub approval.

## Acceptance limits and remaining owners

This advances #113's authorization/API-abuse review and its requirement to state
what was tested and what remains unknown. It does not demonstrate a live provider
outage, real token revocation, production connection reuse or load limits, hosting
headers, source privacy transitions, retention/backup erasure, dependency/SBOM
review, incident routing, or an accepted operator response commitment. No live
incident or critical authorization bypass is asserted by these fixtures.

The complete release gate still requires independent review of the enabled
deployment and usable evidence from [#108](https://github.com/Pick-Your-AI/pick-your-ai-leaderboard/issues/108),
[#95](https://github.com/Pick-Your-AI/pick-your-ai-leaderboard/issues/95),
[#42](https://github.com/Pick-Your-AI/pick-your-ai-leaderboard/issues/42) and
[#94](https://github.com/Pick-Your-AI/pick-your-ai-leaderboard/issues/94).
Their existing owners and open PRs remain authoritative. The configured provider
and deployment owners must supply operational evidence; no new owner, cadence,
source permission or production configuration is established here. All 98 metric
definitions and the planning baseline remain unchanged.
