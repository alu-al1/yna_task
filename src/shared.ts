let debug = false;

export const isDebugEnabled = () => !!debug

export const strToBool = (mbstr: string | undefined): boolean =>
  mbstr ? mbstr.toLowerCase() == "true" : false;

export const strToInt = (mbstr: string | undefined): number =>
  mbstr ? parseInt(mbstr, 10) : 0;

export const init_debug = (src: Record<string, string | undefined> = process.env) => {
  debug = strToBool(src.DEBUG);
  console.info(Date.now(), "DEBUG: enabled")
};
export const dlog = function (...msg: any[]) {
  debug && console.info(Date.now(), ...msg);
};

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

export const die = (code: number = 1) => process.exit(1);
