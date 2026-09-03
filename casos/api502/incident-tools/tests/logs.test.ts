import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compressLogLines } from "../src/logs.js";


describe("compressLogLines", () => {
  it("deduplicates repeated messages and reports the reduction", () => {
    const result = compressLogLines([
      "connect() failed (111: Connection refused) while connecting to upstream",
      "connect() failed (111: Connection refused) while connecting to upstream",
      "upstream timed out while reading response header",
    ]);

    assert.equal(result.originalCount, 3);
    assert.equal(result.uniqueCount, 2);
    assert.equal(result.discardedAsDuplicates, 1);
    assert.deepEqual(result.patterns, [
      {
        message:
          "connect() failed (111: Connection refused) while connecting to upstream",
        count: 2,
      },
      {
        message: "upstream timed out while reading response header",
        count: 1,
      },
    ]);
  });

  it("limits evidence without losing aggregate counts", () => {
    const result = compressLogLines(["a", "b", "c"], 2);

    assert.equal(result.uniqueCount, 3);
    assert.deepEqual(result.patterns, [
      { message: "a", count: 1 },
      { message: "b", count: 1 },
    ]);
  });

  it("groups equivalent Nginx errors with different runtime metadata", () => {
    const result = compressLogLines([
      '2026/09/03 17:57:18 [error] 10#10: *21 connect() failed (111: Connection refused) while connecting to upstream, client: 127.0.0.1, server: _, request: "GET /health HTTP/1.1", upstream: "http://172.21.0.2:8999/health", host: "gateway"',
      '2026/09/03 17:57:19 [error] 11#11: *22 connect() failed (111: Connection refused) while connecting to upstream, client: 172.21.0.4, server: _, request: "GET /health HTTP/1.1", upstream: "http://172.21.0.2:8999/health", host: "127.0.0.1:8088"',
    ]);

    assert.equal(result.originalCount, 2);
    assert.equal(result.uniqueCount, 1);
    assert.equal(result.discardedAsDuplicates, 1);
    assert.equal(result.patterns[0]?.count, 2);
    assert.match(result.patterns[0]?.message ?? "", /8999/);
  });

  it("handles empty log lines gracefully", () => {
    const result = compressLogLines([]);

    assert.equal(result.originalCount, 0);
    assert.equal(result.uniqueCount, 0);
    assert.equal(result.discardedAsDuplicates, 0);
    assert.deepEqual(result.patterns, []);
  });

  it("handles mixed unstructured and formatted logs without loss", () => {
    const result = compressLogLines([
      "custom application error: database timeout",
      "custom application error: database timeout",
      "worker process exited on signal 9",
    ]);

    assert.equal(result.originalCount, 3);
    assert.equal(result.uniqueCount, 2);
    assert.equal(result.discardedAsDuplicates, 1);
    assert.equal(result.patterns.length, 2);
  });
});
