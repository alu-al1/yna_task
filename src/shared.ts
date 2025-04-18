import { exit } from "process";
import { WebSocket } from "ws";


export const strToBool = (mbstr: string | undefined): boolean =>
  mbstr ? mbstr.toLowerCase() == "true" : false;

export const strToInt = (mbstr: string | undefined): number =>
  mbstr ? parseInt(mbstr, 10) : 0;

export type Timestamp = number;
export type Duration = number;

export const now = () => Date.now();
export const sleeP = (tms: number) =>
  new Promise<void>((res) => setTimeout(() => res(), tms));

export enum DateFmt {
  ISO,
}

export const tryFmtDate = (
  mbvalid: Timestamp,
  fmt: DateFmt = DateFmt.ISO,
  fb: string = "<date repr failed>"
): string => {
  const d = new Date(mbvalid);
  if (d.toString() == "Invalid Date") return fb;
  switch (fmt) {
    case DateFmt.ISO:
      return d.toISOString();
    default:
      return fb;
  }
};

export const connIsAlive = (conn?: WebSocket) =>
  !!conn && conn.readyState in [conn.OPEN, conn.CONNECTING];

// alt set exit code to process
export const die = (code: number = 1) => exit(code);

