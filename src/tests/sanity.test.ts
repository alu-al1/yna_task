import { execSync } from "child_process";

import { dlog, init_debug } from "../shared";
init_debug({ DEBUG: "true" });

const prefix = "[sanity]";
//quick test mute
const xtest = (_: string, __: any) => {};

const bin_available_by_probing = (cmd: string) => {
  try {
    const found = execSync(cmd).toString().trim(); //TODO mb? better to use solely an exitcode
    dlog(`[bin_available_by_probing] cmd: ${cmd} out: ${found}`);
    return !!found;
  } catch {
    return false;
  }
};

test(prefix + "checking env", async () => {
  expect(bin_available_by_probing("which which")).toBe(true);
  expect(bin_available_by_probing("which node")).toBe(true);
});