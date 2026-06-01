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
- Optional: `tunnel-client`, if you have access to OpenAI Secure MCP Tunnel tooling

This repository does not install or vendor `tunnel-client`. If
`command -v tunnel-client` prints nothing, the Secure MCP Tunnel steps below
cannot be run from this repo yet.

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

```json
{
  "ok": true,
  "source": "local-mcp-echo",
  "received_message": null,
  "timestamp": "2026-06-01T00:00:00.000Z",
  "pid": 12345
}
```

When `message` is provided, `received_message` contains the same string. The
response is returned as MCP text content containing formatted JSON so it is easy
to inspect from ChatGPT.

## Secure MCP Tunnel

This repository is designed to be run behind the OpenAI Secure MCP Tunnel using
`tunnel-client` on the same Mac as this local stdio server.

### Current local finding

On this Mac, `tunnel-client` was not found:

```text
/bin/bash: tunnel-client: command not found
```

The following locations were also checked:

- `/usr/local/bin`
- `/opt/homebrew/bin`
- `~/.local/bin`

No `tunnel-client` binary was present. Until the OpenAI tunnel client is
installed or its absolute path is known, use the local smoke test only.

### 0. Verify the tunnel client exists

Before running any tunnel command:

```bash
command -v tunnel-client
```

Expected result:

```text
/path/to/tunnel-client
```

If there is no output, stop here. Install the tunnel client using the official
instructions for the OpenAI surface that granted Secure MCP Tunnel access, or
run the commands below with the absolute path to the binary if it is installed
outside your `PATH`.

Do not install an arbitrary package named `tunnel-client` from a package manager
unless the OpenAI instructions explicitly identify that package as the tunnel
client.

### 1. Initialize the tunnel client

From this repository directory:

```bash
tunnel-client init
```

If your binary is not on `PATH`, replace `tunnel-client` with its absolute path.
Follow the prompts from `tunnel-client`. Keep any generated local configuration
out of git unless the tunnel-client documentation explicitly says it is safe to
commit.

### 2. Check the local setup

```bash
tunnel-client doctor
```

Use `doctor` before opening ChatGPT. It should confirm that the tunnel client can
authenticate, reach the OpenAI tunnel service, and start the local stdio command.
If this command is unavailable, the tunnel client is still missing or not on
`PATH`.

### 3. Run the tunnel

Use this server as the stdio command:

```bash
tunnel-client run -- node ./src/server.js
```

Leave this process running while testing from ChatGPT.

Important: stdout is reserved for MCP JSON-RPC messages only. Human-readable
runtime logs are written to stderr.

Expected stderr logs:

```text
[2026-06-01T00:00:00.000Z] server starting
[2026-06-01T00:00:01.000Z] ping called
[2026-06-01T00:00:01.001Z] ping completed
```

### 4. Connect from ChatGPT

In ChatGPT, use a surface that supports custom MCP connectors and tunnel
connectors.

1. Open ChatGPT settings.
2. Enable Developer mode if required for custom MCP connectors.
3. Go to Apps / Connectors settings.
4. Create a custom connector.
5. Choose `Tunnel` as the connector type.
6. Select or enter the tunnel created by `tunnel-client`.
7. Save the connector and start a new chat with it enabled.
8. Ask ChatGPT to call the `ping` tool with a short message.

If successful, ChatGPT should show a JSON text result containing:

- `ok`
- `source`
- `received_message`
- `timestamp`
- `pid`

## Troubleshooting

Use this order to isolate where a failure is happening.

### Local server

Run the smoke test:

```bash
npm run smoke
```

If this fails, the issue is in the local Node server or local Node runtime.

### Tunnel client

First check whether the command exists:

```bash
command -v tunnel-client
```

If there is no output, the failure is before MCP or ChatGPT. The local echo
server can still be tested with `npm run smoke`, but ChatGPT cannot reach it
through the Secure MCP Tunnel until the tunnel client is installed or its
absolute path is used.

Run:

```bash
tunnel-client doctor
```

If `doctor` fails, fix authentication, tunnel configuration, network access, or
the stdio command before testing from ChatGPT.

### Tunnel process

Run:

```bash
tunnel-client run -- node ./src/server.js
```

If the process starts but ChatGPT cannot call `ping`, watch stderr:

- `server starting` means the local server launched.
- `ping called` means a tool call reached the local server.
- `ping completed` means the local server returned the MCP tool response.

If `server starting` appears but `ping called` does not, the request is not
reaching the local stdio server. Check the ChatGPT connector selection and tunnel
status.

If `ping called` appears but `ping completed` does not, the server rejected the
arguments or failed while building the response. Check the JSON-RPC error shown
in ChatGPT or the tunnel-client logs.

### ChatGPT connector

If local smoke tests and `tunnel-client doctor` pass, but ChatGPT does not show
the tool:

- Confirm the connector is saved and enabled in the current chat.
- Confirm `Tunnel` was selected as the connector type.
- Start a new chat after changing connector settings.
- Ask explicitly: `Call the ping tool with message "hello tunnel".`

## Example stdio command

Use this repository path as the working directory and run:

```bash
node ./src/server.js
```

The server has no network, filesystem, shell, or subprocess capability. It only
responds to MCP initialization, `tools/list`, `tools/call` for `ping`, and empty
`resources/list` / `prompts/list` requests.
