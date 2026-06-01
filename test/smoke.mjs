import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import assert from "node:assert/strict";

const child = spawn(process.execPath, ["./src/server.js"], {
  stdio: ["pipe", "pipe", "pipe"],
});

const stderr = [];
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => stderr.push(chunk));

const lines = createInterface({ input: child.stdout });
const responses = [];
const waiters = [];
lines.on("line", (line) => {
  const response = JSON.parse(line);
  const waiter = waiters.shift();
  if (waiter) {
    waiter(response);
    return;
  }

  responses.push(response);
});

function request(id, method, params) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
}

async function nextResponse() {
  if (responses.length > 0) {
    return responses.shift();
  }

  return new Promise((resolve) => {
    waiters.push(resolve);
  });
}

try {
  request(1, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke-test", version: "0.1.0" },
  });
  const init = await nextResponse();
  assert.equal(init.result.serverInfo.name, "local-mcp-echo");
  assert.ok(init.result.capabilities.tools);

  child.stdin.write(
    `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
  );

  request(2, "tools/list", {});
  const tools = await nextResponse();
  assert.deepEqual(
    tools.result.tools.map((tool) => tool.name),
    ["ping"],
  );

  request(3, "tools/call", {
    name: "ping",
    arguments: { message: "secure tunnel" },
  });
  const ping = await nextResponse();
  const payload = JSON.parse(ping.result.content[0].text);
  assert.deepEqual(Object.keys(payload), [
    "ok",
    "source",
    "received_message",
    "timestamp",
    "pid",
  ]);
  assert.equal(payload.ok, true);
  assert.equal(payload.source, "local-mcp-echo");
  assert.equal(payload.received_message, "secure tunnel");
  assert.match(payload.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(typeof payload.pid, "number");

  child.stdin.end();
  const [code] = await once(child, "exit");
  assert.equal(code, 0, stderr.join(""));
  assert.match(stderr.join(""), /server starting/);
  assert.match(stderr.join(""), /ping called/);
  assert.match(stderr.join(""), /ping completed/);
  console.log("smoke ok");
} finally {
  child.kill();
}
