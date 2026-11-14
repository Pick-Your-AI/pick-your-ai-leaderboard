import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FileCheckpointStore, GithubReadClient, nextRestLink, paginateRest } from "../dist/index.js";

const ORIGIN = "https://api.synthetic.invalid";
const NEXT = `${ORIGIN}/issues?page=2`;
const header = `<${ORIGIN}/issues?page=1>; title="ignore; rel=next ; this"; rel=prev, <${NEXT}>; title="page, two; still two"; rel="next last"`;
const response = (items, headers = {}) => new Response(JSON.stringify(items), { headers });
const options = {
  source: "synthetic-installation",
  key: "link-parameters/v1",
  url: `${ORIGIN}/issues`,
  maxPages: 3,
  select: (body) => body,
};

for (const [name, value, expected] of [
  ["comma inside a quoted title", `<${NEXT}>; title="page, two"; rel=next`, NEXT],
  ["semicolon inside a quoted title", `<${NEXT}>; title="page; two"; rel=next`, NEXT],
  ["escaped quote and delimiters", String.raw`<${NEXT}>; title="page\", two; more"; rel=next`, NEXT],
  ["escaped backslash before closing quote", String.raw`<${NEXT}>; title="page\\"; rel=next`, NEXT],
  ["comma and semicolon inside the URI", `<${NEXT}&filter=a,b;c>; rel=next`, `${NEXT}&filter=a,b;c`],
  ["relation text inside a quoted title", `<${NEXT}>; title="ignore; rel=next ; this"; rel=prev`, undefined],
  ["first duplicate relation remains authoritative", `<${NEXT}>; rel=prev; rel=next`, undefined],
  ["unquoted registered relation is case-insensitive", `<${NEXT}>; rel=NEXT`, NEXT],
  ["quoted registered relation is case-insensitive", `<${NEXT}>; rel="prev NeXt"`, NEXT],
  ["quoted HTAB is not an SP separator", `<${NEXT}>; rel="prev\tnext"`, undefined],
  ["bare token cannot escape a relation letter", String.raw`<${NEXT}>; rel=ne\xt`, undefined],
  ["bare token cannot escape its first letter", String.raw`<${NEXT}>; rel=\next`, undefined],
  ["quoted-pair may escape a relation letter", String.raw`<${NEXT}>; rel="ne\xt"`, NEXT],
  ["invalid first relation cannot be overridden", `<${NEXT}>; rel=; rel=next`, undefined],
  ["trailing garbage on first rel cannot be overridden", `<${NEXT}>; rel="prev"junk; rel=next`, undefined],
  ["invalid bare first relation cannot be overridden", String.raw`<${NEXT}>; rel=ne\xt; rel=next`, undefined],
  ["unterminated quoted value", `<${NEXT}>; title="ignore; rel=next`, undefined],
  ["unterminated URI reference", `<${NEXT}; rel=next`, undefined],
  ["multiple links with quoted parameter delimiters", header, NEXT],
  [
    "complete link before an unfinished quoted title",
    `<${NEXT}>; rel=next, <${ORIGIN}/other>; title="unfinished`,
    NEXT,
  ],
  ["complete link before an unfinished URI", `<${NEXT}>; rel=next, <${ORIGIN}/unfinished`, NEXT],
  [
    "anchor after rel is not the page context",
    `<${ORIGIN}/repos/other/issues?page=2>; rel=next; anchor="${ORIGIN}/repos/other/issues"`,
    undefined,
  ],
  [
    "anchor before rel is not the page context",
    `<${ORIGIN}/repos/other/issues?page=2>; anchor="${ORIGIN}/repos/other/issues"; rel=next`,
    undefined,
  ],
  [
    "quoted anchor with delimiters is still an anchor",
    `<${NEXT}>; rel=next; anchor="${ORIGIN}/other,with;delimiters"`,
    undefined,
  ],
  [
    "anchored first link falls back to unanchored second",
    `<${ORIGIN}/repos/other/issues?page=2>; rel=next; anchor="${ORIGIN}/repos/other/issues", <${NEXT}>; rel=next`,
    NEXT,
  ],
  [
    "anchor before rel also falls back to next link",
    `<${ORIGIN}/repos/other/issues?page=2>; anchor="${ORIGIN}/repos/other/issues"; rel=next, <${NEXT}>; rel=next`,
    NEXT,
  ],
  ["title-only anchor string is not a link anchor", `<${NEXT}>; title="anchor=${ORIGIN}/other"; rel=next`, NEXT],
  [
    "anchor text inside URI reference is not a parameter",
    `<${NEXT}&anchor=literal>; rel=next`,
    `${NEXT}&anchor=literal`,
  ],
  ["invalid bare anchor is conservatively rejected", `<${NEXT}>; rel=next; anchor`, undefined],
  ["similarly named extension parameter is not anchor", `<${NEXT}>; rel=next; anchor_meta=value`, NEXT],
]) {
  test(`REST Link parameters: ${name}`, () => assert.equal(nextRestLink(value), expected));
}

test("stateless pagination rejects same-origin anchored next and follows an independent unanchored link", async () => {
  const wrong = `${ORIGIN}/repos/other/issues?page=2`;
  const calls = [];
  const items = await paginateRest(
    options.url,
    async (url) => {
      calls.push(url);
      return url === options.url
        ? { items: [1], link: `<${wrong}>; rel=next; anchor="${ORIGIN}/repos/other/issues", <${NEXT}>; rel=next` }
        : { items: [2] };
    },
    { apiOrigin: ORIGIN, maxPages: 3 },
  );
  assert.deepEqual(items, [1, 2]);
  assert.deepEqual(calls, [options.url, NEXT]);
});

test("stateless REST pagination follows the real relation after quoted title text", async () => {
  const calls = [];
  const items = await paginateRest(
    options.url,
    async (url) => {
      calls.push(url);
      return url === NEXT ? { items: [2] } : { items: [1], link: header };
    },
    { apiOrigin: ORIGIN, maxPages: 3 },
  );
  assert.deepEqual(items, [1, 2]);
  assert.deepEqual(calls, [options.url, NEXT]);
});

test("client retains quoted pagination across interrupted disk checkpoints and conditional refresh", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "leaderboard-link-parameters-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const calls = [];
  const client = (fetch) =>
    new GithubReadClient({
      apiOrigin: ORIGIN,
      token: async () => undefined,
      checkpoints: new FileCheckpointStore(directory),
      fetch,
      maxRetries: 0,
    });
  await assert.rejects(
    client(async (url) => {
      calls.push(url);
      if (url === NEXT) throw new Error("synthetic interruption");
      return response([1], { link: header, etag: '"first"' });
    }).scanRest(options),
    (error) => error.outcome.kind === "transient_failure",
  );

  const resumed = client(async (url, request) => {
    calls.push(url);
    if (request.headers.has("if-none-match")) return new Response(null, { status: 304 });
    assert.equal(url, NEXT);
    return response([2], { etag: '"second"' });
  });
  assert.deepEqual(await resumed.scanRest(options), [1, 2]);
  assert.deepEqual(await resumed.scanRest({ ...options, refresh: true }), [1, 2]);
  assert.deepEqual(calls, [options.url, NEXT, NEXT, options.url, NEXT]);
});

test("quoted Link parameters do not bypass the client origin restriction", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "leaderboard-link-origin-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let calls = 0;
  const client = new GithubReadClient({
    apiOrigin: ORIGIN,
    token: async () => undefined,
    checkpoints: new FileCheckpointStore(directory),
    fetch: async () => {
      calls += 1;
      return response([1], { link: '<https://other.synthetic.invalid/items>; title="page, two"; rel=next' });
    },
  });
  await assert.rejects(client.scanRest(options), (error) => error.outcome.kind === "unsafe_request");
  assert.equal(calls, 1);
});

for (const tail of [`<${ORIGIN}/other>; title="unfinished`, `<${ORIGIN}/unfinished`]) {
  test(`client follows a completed next link before malformed tail: ${tail}`, async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "leaderboard-link-tail-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const calls = [];
    const client = new GithubReadClient({
      apiOrigin: ORIGIN,
      token: async () => undefined,
      checkpoints: new FileCheckpointStore(directory),
      fetch: async (url) => {
        calls.push(url);
        return url === NEXT ? response([2]) : response([1], { link: `<${NEXT}>; rel=next, ${tail}` });
      },
    });
    assert.deepEqual(await client.scanRest(options), [1, 2]);
    assert.deepEqual(await client.scanRest(options), [1, 2]);
    assert.deepEqual(calls, [options.url, NEXT]);
    assert.deepEqual(
      await paginateRest(
        options.url,
        async (url) => (url === NEXT ? { items: [2] } : { items: [1], link: `<${NEXT}>; rel=next, ${tail}` }),
        { apiOrigin: ORIGIN, maxPages: 3 },
      ),
      [1, 2],
    );
  });
}
