import { ChildProcess } from "child_process";

//quick test mute
export const xtest = (_: string, __: any) => {};

//TODO sigterm and sigkill on to
export const trypkill = (mbp: ChildProcess | null) => {
  if (!mbp) return;
  try {
    mbp.kill();
  } catch (_) {}
};
