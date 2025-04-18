import { ILogger } from "./iface";
import { strToBool } from "./shared";

export class ConsoleLogger implements ILogger {
  ok(...msgs: string[]): void {
    return console.info(...msgs);
  }
  err(...msgs: string[]): void {
    return console.error(...msgs);
  }
}
export class LoggerDummy implements ILogger {
  ok(...msg: string[]): void {}
  err(...msg: string[]): void {}
}

export const dummyLogger = new LoggerDummy();

let debug = false;

export const isDebugEnabled = () => !!debug;

export const init_debug = (
  src: Record<string, string | undefined> = process.env
) => {
  debug = strToBool(src.DEBUG);
  console.info(Date.now(), "DEBUG: enabled");
};
export const dlog = function (...msg: any[]) {
  debug && console.info(Date.now(), ...msg);
};
