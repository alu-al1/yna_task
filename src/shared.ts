const debug = 1;
export const dlog = (...msg: any[]) => {
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
