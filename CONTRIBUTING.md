# Contributing

Current team and Project names: [organization naming register](https://github.com/Pick-Your-AI/.github/blob/ce8c876f6331b4f427d7fc8c2deff4776d003cf5/docs/NAMING.md).

This repository owns the Pick Your AI contributor-recognition delivery plan and service implementation. Read the [product scope](docs/PRODUCT.md), [delivery plan](docs/DELIVERY_PLAN.md) and your issue before starting. The repository contains planning tools, source and metric packages, public and protected services, and a browser application. Remaining implementation, source authorization and public release remain tracked work.

## First local fixture journey

Use the pinned Node.js 24/npm toolchain in `package.json`. From the repository root, run:

```bash
npm ci
npm run build
node --test apps/service/test/pending-counts.test.mjs
```

This synthetic journey calls the actual public API and JSON/CSV export handlers in process. It verifies that 14 accepted contributions plus 3 pending remain below 15 accepted, then exercises current artifact/actor suppression, disabled policy, revoked snapshots, unsafe receipts, unknown coverage and half-open date boundaries, including source timestamps with fractional-second precision. A successful run passes every case with zero failures and zero skipped tests. The fixtures do not require GitHub credentials, a database server, browser installation or published contributor data; dependency installation still needs the normal package registry/cache. Build first because tests import compiled workspace packages.

For the optional browser prototype, API startup, worker boundaries and disposable database workflow, continue with [local runtime setup](docs/runtime-foundation.md). Synthetic results demonstrate the tested behavior only; they do not enable real sources or certify production acceptance. Do not seed synthetic observations into a public runtime.

## Choose and own work

Use GitHub Assignees as the source of truth. Agree an owner and confirm prerequisites before moving an issue from Backlog to Ready. The initial plan is unassigned; a proposed owner role is not an assignment. Preserve existing assignees, triage and source decision-record paths across the organization.

The native hierarchy is Program → Epic → Work package. Program and epics use the Feature issue type; work packages use Task. Keep small steps in the package checklist. Open another sub-issue only for an independently owned or reviewable deliverable. Do not duplicate native children as a second checklist.

Status, Priority, Phase, Workstream, Readiness, Level and Acceptance Gate are the seven Project fields. Native Assignees and relationships remain authoritative. Use labels selectively for kinds and topics such as documentation, questions, security and accessibility; do not duplicate status, priority or ownership in labels. Do not invent dates, estimates or iterations.

## Readiness and dependencies

- **Needs owner:** the package can be scoped but has no accepted owner.
- **Needs input:** a named prerequisite deliverable is missing.
- **Awaiting decision:** a stated choice requires the accountable role to accept it.
- **Ready:** an owner has accepted work and all required inputs are usable.
- **Blocked:** an active impediment prevents progress; state the blocker and next action.

Use native blocked-by links for genuine delivery prerequisites. Information inputs, related sources and optional integration relationships belong in contextual body links. Do not turn compatibility or information cycles into delivery blockers. Preserve native parent links when editing issue text.

## Plan and implementation changes

Create a branch and pull request against `main`. Reference the work-package issue, describe the resulting behavior or decision and supply its required evidence. Use `Refs #n` for partial progress; use `Closes #n` only when the full acceptance gate is satisfied. Repository creation does not close engineering foundation, installation or deployment work by itself.

The canonical baseline is [planning/project-backlog.json](planning/project-backlog.json). When scope changes, update metric/UI mappings, decision and release records, then regenerate documentation. Match existing stable LB IDs to native issues rather than publishing duplicates. GitHub carries live execution state; the baseline must not reset assignees or progress.

Use the [offline-first publication reconciler](docs/PUBLICATION.md) to verify existing issues and native parents. Its CLI is read-only. Authorized publication uses durable receipts and a connected-integration adapter; never force a retry by discarding an uncertain receipt or overwrite live issue bodies from the baseline.

```bash
python scripts/sync_baseline.py
python scripts/render_docs.py
python scripts/validate_plan.py
python -m unittest discover -s tests -v
python scripts/render_docs.py --check
```

The synchronizer updates derived counts and the UI mapping's backlog fingerprint after an intentional edit. It does not repair missing references or change delivery scope. Review generated diffs, including changed counts and metric meanings.

CI checks structure, references, dependency cycles, mapping agreement, safe source URL shape, local Markdown links and generated-document drift. Planning JSON object members must be unique, including equivalent escaped spellings; duplicate catalog, metric-definition and task fields fail validation before cross-document checks. It does not fetch or certify source claims, prove API permissions, validate production metric accuracy, certify accessibility or deploy the app. Report these limits and supply the appropriate independent evidence.

## Evidence, source rights and privacy

Keep real contribution evidence public, attributable, dated and source-linked. Do not invent missing actors, event times, acceptance states, prices, measurements or permissions. Unknown and unsupported are meaningful states. Synthetic examples belong under `tests/fixtures/` and must never enter real rankings.

Do not commit credentials, private GitHub payloads, commit emails, customer data, raw datasets, full assistant sessions, model weights or large downloads. Use small sanitized manifests for external evidence. Review public Markdown, filenames and URLs as untrusted content in the future app.

Changes to research findings or imported builder contracts belong in the [research repository](https://github.com/Pick-Your-AI/pick-your-ai-research), following its workflow and central contract review. Leaderboard contracts are separate and versioned here. Ingestion must not mutate upstream labels, ownership or Project fields.

## Access, branches and reviews

Early contributors push branches named `contrib/<your-login>/<topic>` to this repository; other contributors work from a fork. Every pull request into `main` needs one approval from someone other than its author, and only maintainers merge. The [organization contributing rules](https://github.com/Pick-Your-AI/.github/blob/main/CONTRIBUTING.md) define roles, credentials and enforcement.

### Access and roles

Current naming uses `Organization Maintainers` for the top-level team, `Contributor Leaderboard` for this repository's contributor team, `Lead Maintainers - Contributor Leaderboard` for its specialist lead team, and `Lead Maintainers - Websites` for shared website leadership. The `Websites` parent team and `Early Contributors` retain their names. GitHub grants remain authoritative; this naming update does not change permissions or assign operational ownership. Team membership and settings are managed by organization owners and designated GitHub team maintainers under the [accepted delegation record](https://github.com/Pick-Your-AI/.github/issues/18). [CODEOWNERS](.github/CODEOWNERS) routes review only and grants no access, and team membership does not waive the pull request approval and required checks above.

## Review and completion

Request review from the affected metric, source, UI, security or operations roles. Acceptance requires the package's stated evidence, not only passing automated checks. Mark Done after the reviewed deliverable is merged and its gate is met. Public release additionally requires approved hosting, real deployment, independent anonymous readback, fresh source activity and a functioning correction receipt. Proposed operators and response commitments must be accepted before they are advertised.

## Routing decisions

For an unresolved decision, first read the existing issue, its assignees, relevant
decision record and related pull requests. Preserve accepted ownership and local
review, evidence, security and release requirements. Routing identifies a contact;
it does not grant access, appoint an owner, authorize publication or waive a gate.

Use the canonical [escalation guide](https://github.com/Pick-Your-AI/.github/blob/main/docs/governance/ESCALATION.md) and
[versioned routing policy](https://github.com/Pick-Your-AI/.github/blob/main/governance/escalation-policy.json). These links depend on the organization
governance change merging; until then, use its reviewed checkout and describe the
route as provisional. Do not claim the central tooling is installed or active.

The order is repository team → repository maintainer → repository lead maintainer
→ applicable parent teams → CompleteDotTech. Record a disposition at each level,
including unresolved, vacant, pending-acceptance or inaccessible roles; membership,
team-management status and repository permissions do not establish accepted
operational ownership. Keep owner placeholders for the final fallback. Do not
silently skip an unresolved role or treat a proposed mapping as accepted.

An operator with read access must refresh the private snapshot before resolving:

```sh
python /path/to/org-checkout/governance/router.py refresh --policy /path/to/org-checkout/governance/escalation-policy.json --snapshot /private/path/routing-snapshot.json --status /private/path/routing-status.json
python /path/to/org-checkout/governance/router.py resolve --policy /path/to/org-checkout/governance/escalation-policy.json --snapshot /private/path/routing-snapshot.json --repo Pick-Your-AI/pick-your-ai-leaderboard --max-age-seconds 86400 --status /private/path/routing-status.json
```

Here `86400` is an **operator-selected example**, not an approved default. Select
an appropriate explicit maximum age; a proposed policy value does not supply one.
Check that refresh succeeded. If refresh fails, stop recipient selection and
report the failure; the last successful snapshot is retained for diagnosis, not
as a current route. Report stale or incomplete coverage explicitly. Keep snapshots,
raw API responses, rosters and private
identities outside public Git and public issues. Share only the necessary public
team destination and a sanitized decision summary.

When escalation is needed, include the decision needed, current responsible role,
prior disposition and proposed next recipient. Reuse information already in the
issue or PR; routine contributions need no full escalation history. Send nothing
and change no assignment automatically. Sensitive reports follow the existing
private security/support process.
