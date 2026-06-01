# local-mcp-echo

Minimal local stdio MCP server for testing this connectivity path:

```text
ChatGPT / supported OpenAI surface
  -> OpenAI Secure MCP Tunnel
  -> tunnel-client running on this Mac
  -> local stdio MCP server in this repository
  -> ping tool response
```

The server intentionally exposes only one tool: `ping`.

## Requirements

- Node.js 18 or newer
- No npm dependencies

## Run locally

```bash
npm start
```

The server reads newline-delimited JSON-RPC messages from stdin and writes
responses to stdout, which is the transport shape expected by stdio MCP clients.

## Smoke test

```bash
npm run smoke
```

Expected output:

```text
smoke ok
```

## Tool

### `ping`

Arguments:

- `message` optional string, maximum 200 characters

Response:

```text
pong
```

or, when `message` is provided:

```text
pong: <message>
```

## Example stdio command

Use this repository path as the working directory and run:

```bash
node ./src/server.js
```

The server has no network, filesystem, shell, or subprocess capability. It only
responds to MCP initialization, `tools/list`, `tools/call` for `ping`, and empty
`resources/list` / `prompts/list` requests.
