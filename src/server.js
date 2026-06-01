#!/usr/bin/env node

const SERVER_NAME = "local-mcp-echo";
const SERVER_VERSION = "0.1.0";
const FALLBACK_PROTOCOL_VERSION = "2024-11-05";

let buffer = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;

  let newlineIndex;
  while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);

    if (line.length > 0) {
      handleLine(line);
    }
  }
});

process.stdin.on("end", () => {
  process.exit(0);
});

process.on("SIGINT", () => {
  process.exit(0);
});

function handleLine(line) {
  let message;

  try {
    message = JSON.parse(line);
  } catch (error) {
    writeError(null, -32700, "Parse error", error.message);
    return;
  }

  if (message.id === undefined || message.id === null) {
    return;
  }

  try {
    const result = route(message);
    writeResult(message.id, result);
  } catch (error) {
    writeError(
      message.id,
      error.code ?? -32603,
      error.message ?? "Internal error",
      error.data,
    );
  }
}

function route(message) {
  switch (message.method) {
    case "initialize":
      return initialize(message.params);
    case "tools/list":
      return listTools();
    case "tools/call":
      return callTool(message.params);
    case "resources/list":
      return { resources: [] };
    case "prompts/list":
      return { prompts: [] };
    default:
      throw rpcError(-32601, `Method not found: ${message.method}`);
  }
}

function initialize(params = {}) {
  return {
    protocolVersion: params.protocolVersion ?? FALLBACK_PROTOCOL_VERSION,
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
    serverInfo: {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    instructions:
      "Connectivity test server exposing only a safe ping tool over local stdio.",
  };
}

function listTools() {
  return {
    tools: [
      {
        name: "ping",
        description:
          "Connectivity check. Returns pong and optionally echoes a short message.",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Optional short text to echo after pong.",
              maxLength: 200,
            },
          },
          additionalProperties: false,
        },
      },
    ],
  };
}

function callTool(params = {}) {
  if (params.name !== "ping") {
    throw rpcError(-32602, `Unknown tool: ${params.name}`);
  }

  const args = params.arguments ?? {};
  if (typeof args !== "object" || Array.isArray(args)) {
    throw rpcError(-32602, "Tool arguments must be an object.");
  }

  const message = args.message;
  if (message !== undefined && typeof message !== "string") {
    throw rpcError(-32602, "message must be a string when provided.");
  }

  if (message && message.length > 200) {
    throw rpcError(-32602, "message must be 200 characters or fewer.");
  }

  const suffix = message ? `: ${message}` : "";
  return {
    content: [
      {
        type: "text",
        text: `pong${suffix}`,
      },
    ],
  };
}

function writeResult(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function writeError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) {
    error.data = data;
  }

  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error })}\n`);
}

function rpcError(code, message, data) {
  const error = new Error(message);
  error.code = code;
  error.data = data;
  return error;
}
