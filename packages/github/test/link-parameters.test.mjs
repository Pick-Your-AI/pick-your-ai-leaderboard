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
  ["unterminated quoted value", `<${NEXT}>; title="ignore; rel=next`, undefined],
  ["unterminated URI reference", `<${NEXT}; rel=next`, undefined],
  ["multiple links with quoted parameter delimiters", header, NEXT],
  [
    "complete link before an unfinished quoted title",
    `<${NEXT}>; rel=next, <${ORIGIN}/other>; title="unfinished`,
    NEXT,
  ],
  ["complete link before an unfinished URI", `<${NEXT}>; rel=next, <${ORIGIN}/unfinished`, NEXT],
]) {
  test(`REST Link parameters: ${name}`, () => assert.equal(nextRestLink(value), expected));
}

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
