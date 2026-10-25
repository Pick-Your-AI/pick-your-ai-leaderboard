import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate as nextTurn } from "node:timers/promises";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { githubOAuthProvider } from "../src/github.mjs";
import { ControlStore } from "../src/store.mjs";
import { createControlsServer } from "../src/server.mjs";

// Fictional provider responses only; no network request or real credential.
const endpoints = {
  token: "https://github.com/login/oauth/access_token",
  user: "https://api.github.com/user",
  revoke: "https://api.github.com/applications/synthetic-client/token",
};
const exchange = {
  code: "synthetic-code",
  verifier: "synthetic-verifier",
  redirectURI: "https://controls.example.test/controls/auth/callback",
};

for (const stage of ["token", "user", "revoke"]) {
  const scenarios = [
    { name: "unsuccessful HTTP response", status: 503, size: 1, message: "Identity provider unavailable" },
    ...(stage === "revoke"
      ? [{ name: "unconfirmed revocation", status: 200, size: 1, message: "Identity provider unavailable" }]
      : [{ name: "oversized response", status: 200, size: 65_537, message: "Identity response too large" }]),
  ];
  for (const scenario of scenarios) {
    for (const cleanup of ["resolve", "reject"]) {
      test(`${stage} ${scenario.name} settles before cleanup ${cleanup}s`, { timeout: 5000 }, async () => {
        const cancellation = Promise.withResolvers();
        const calls = [];
        let cancelCalls = 0;
        let settled = false;
        let hostileResponse;
        let streamController;
        const provider = githubOAuthProvider({
          clientId: "synthetic-client",
          clientSecret: "synthetic-secret-not-real",
          fetcher: async (url, options) => {
            const current = Object.keys(endpoints).find((key) => endpoints[key] === url);
            assert.ok(current, "Only the fixed provider endpoints may be used");
            assert.equal(options.redirect, "error");
            calls.push(current);
            if (current === stage) {
              hostileResponse = new Response(
                new ReadableStream({
                  start(controller) {
                    streamController = controller;
                    controller.enqueue(new Uint8Array(scenario.size));
                  },
                  cancel() {
                    cancelCalls += 1;
                    return cancellation.promise;
                  },
                }),
                { status: scenario.status },
              );
              return hostileResponse;
            }
            if (current === "token") return Response.json({ access_token: "synthetic-identity-token", scope: "" });
            if (current === "user") return Response.json({ id: 42 });
            assert.deepEqual(JSON.parse(options.body), { access_token: "synthetic-identity-token" });
            return new Response(null, { status: 204 });
          },
        });
        const result = provider.exchange(exchange).then(
          (value) => {
            settled = true;
            return { value };
          },
          (error) => {
            settled = true;
            return { error };
          },
        );
        // Drain actual request microtasks with the transport cleanup held open.
        await nextTurn();
        const beforeCleanup = { settled, calls: [...calls], cancelCalls, locked: hostileResponse.body.locked };
        if (cancelCalls === 0) streamController.close();
        if (cleanup === "resolve") cancellation.resolve();
        else cancellation.reject(new Error("private transport cleanup details"));
        // Observe the synthetic transport's promise even on the broken baseline,
        // which never starts cancellation for an unsuccessful response.
        await cancellation.promise.catch(() => undefined);
        const outcome = await result;
        await nextTurn();
        assert.equal(outcome.error?.status, 502);
        assert.equal(outcome.error?.message, scenario.message);
        assert.deepEqual(beforeCleanup, {
          settled: true,
          calls: stage === "token" ? ["token"] : ["token", "user", "revoke"],
          cancelCalls: 1,
          locked: false,
        });
      });
    }
  }
}

test(
  "a held user-response cleanup preserves the session and permits a fresh HTTP login",
  { timeout: 5000 },
  async (t) => {
    const cancellation = Promise.withResolvers();
    const directory = mkdtempSync(join(tmpdir(), "synthetic-oauth-cleanup-"));
    const store = new ControlStore(join(directory, "private.sqlite"));
    const calls = [];
    let oversized = false;
    let cancelCalls = 0;
    const provider = githubOAuthProvider({
      clientId: "synthetic-client",
      clientSecret: "synthetic-secret-not-real",
      fetcher: async (url) => {
        const stage = Object.keys(endpoints).find((key) => endpoints[key] === url);
        assert.ok(stage);
        calls.push(stage);
        if (stage === "token") return Response.json({ access_token: "synthetic-identity-token", scope: "" });
        if (stage === "revoke") return new Response(null, { status: 204 });
        if (!oversized) return Response.json({ id: 42 });
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(65_537));
            },
            cancel() {
              cancelCalls += 1;
              return cancellation.promise;
            },
          }),
        );
      },
    });
    const server = createControlsServer({ store, provider, origin: "https://controls.example.test" });
    t.after(async () => {
      cancellation.resolve();
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
      store.close();
      rmSync(directory, { recursive: true, force: true });
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const base = "http://127.0.0.1:" + server.address().port;
    async function begin() {
      const response = await fetch(base + "/controls/auth/login", { redirect: "manual" });
      assert.equal(response.status, 302);
      await response.arrayBuffer();
      return {
        state: new URL(response.headers.get("location")).searchParams.get("state"),
        cookie: response.headers.getSetCookie()[0].split(";")[0],
      };
    }
    async function callback(started, session = "") {
      const response = await fetch(
        base + "/controls/auth/callback?" + new URLSearchParams({ state: started.state, code: "synthetic-code" }),
        {
          redirect: "manual",
          headers: { cookie: started.cookie + (session ? "; " + session : "") },
        },
      );
      return { response, body: await response.json().catch(() => null) };
    }
    function sessionCookie(response) {
      return response.headers
        .getSetCookie()
        .find((value) => value.startsWith("__Host-controls_session="))
        .split(";")[0];
    }
    const initial = await callback(await begin());
    assert.equal(initial.response.status, 303);
    const oldCookie = sessionCookie(initial.response);
    const before = store.read();
    const publicBefore = store.publicSnapshot();
    const started = await begin();
    oversized = true;
    calls.length = 0;
    const rejected = await callback(started, oldCookie);
    assert.equal(cancelCalls, 1);
    assert.deepEqual(calls, ["token", "user", "revoke"]);
    assert.equal(rejected.response.status, 502);
    assert.deepEqual(rejected.body, { error: "Identity response too large" });
    assert.deepEqual(rejected.response.headers.getSetCookie(), []);
    assert.deepEqual(store.read(), before);
    assert.deepEqual(store.publicSnapshot(), publicBefore);
    const existing = await fetch(base + "/controls/session", { headers: { cookie: oldCookie } });
    assert.equal(existing.status, 200);
    assert.equal((await existing.json()).actorId, "42");
    const replay = await callback(started, oldCookie);
    assert.equal(replay.response.status, 400);
    assert.deepEqual(calls, ["token", "user", "revoke"]);
    oversized = false;
    const recovered = await callback(await begin(), oldCookie);
    assert.equal(recovered.response.status, 303);
    assert.notEqual(sessionCookie(recovered.response), oldCookie);
    assert.equal(Object.keys(store.read().sessions).length, 1);
    assert.deepEqual(store.publicSnapshot(), publicBefore);
    const expired = await fetch(base + "/controls/session", { headers: { cookie: oldCookie } });
    assert.equal(expired.status, 401);
    await expired.arrayBuffer();
  },
);
