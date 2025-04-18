import { execSync, spawn } from "child_process";
import * as path from "path";

// init_debug({ DEBUG: "true" });

const prefix = "['show usage' tests]";

//TODO get it from ts config
const builddir = "build";

const serverJS = path.resolve(__dirname, "..", "..", builddir, "server.js");
const clientJS = path.resolve(__dirname, "..", "..", builddir, "client.js");


const get_node_path = (): string => path.dirname(process.argv[0]);

[serverJS, clientJS].forEach((js) => {
  test(prefix + "no args => should show usage and exit with non-zero", async () => {
    const outputAcc: string[] = [];

    const exitcode: number = await new Promise((resolve, reject) => {
      const proc = spawn("node", [js], {
        env: { PATH: get_node_path() },
        stdio: ["ignore", "ignore", "pipe"],
      });

      proc.stderr?.on("data", (data) => {
        outputAcc.push(data.toString());
      });

      proc.on("error", (err) => reject(err)); // Catch spawn errors

      proc.on("close", (code) => {
        resolve(code ?? 0);
      });
    });

    expect(outputAcc.join("").toLowerCase()).toContain("usage");
    expect(exitcode).toBeGreaterThanOrEqual(1);
  });
});
