# YNA Task

This is my implementation of a given task by the company I will refer to as **YNA**.

For a simple version please refer to [another branch](https://github.com/alu-al1/yna_task/tree/kiss_principle)

**NB:** I tend to write less unless I'm hyperfocused or feel the need to prove something.

### Prerequisites

- `Node.js` (see `.nvmrc` for the required version)
- `npm`
- `TypeScript`
- `nvm` (makes life easier but optional)
- `jq` (optional)

### Installation

1. Clone the repository (you may use `--depth=1` for a shallow clone):

   ```bash
   git clone https://github.com/alu-al1/yna_task.git
   ```

2. Navigate to the project directory:

   ```bash
   cd yna_task
   ```

3. Install dependencies:

   ```bash
   npm install  # or use `npm ci` if applicable
   ```

### Build

You can build different parts of the project with the following scripts:

- `npm run build` – build everything
- `npm run build_server` – build only the server part
- `npm run build_client` – build only the client part
- `npm run clean` – remove all build artifacts

E(**x**)tended variants of some scripts are also available. For example, `npm run xbuild_server` leverages TypeScript config parsing and `jq` for selecting the actual build directory from `tsconfig.json`.

For more details, refer to the `scripts` section in `package.json`.

---

## Usage

To run the server and client with the task provided presets:

### Server

```bash
npm run build_server && npm WSS_PORT=<available_port> run server
```

### Client

```bash
npm run build_client && npm WSS_URL=<url_to_server> run client
```
> ℹ️ Both server and client will provide you with `USAGE:` message if something is missing.

Both `server.ts` and `client.ts` include Node's variant of `if __name__ == "__main__"` and can be imported and reused with custom presets.


---

## Testing

[Jest](https://jestjs.io/docs/getting-started) is used for testing.

To run all tests:

```bash
npm run clean_tests && npm run build_tests && npm run tests
```

To test client-server intercommunication with tailored presets:

```bash
npm run clean_tests && npm run build_tests && npm run test_one
```

> ⚠️ Tests cover various time-based scenarios and will take approximately 17 seconds to complete. Most tests are run in parallel. Refer to the test file(s) for additional environment variable configurations.