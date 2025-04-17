import { IStringer } from "./iface";

export enum KnownMessages {
  GREETING = "hello",
  STILLHERE = "still here",
  MBLEAVE = "you can leave now",
}

export const isKnownMessage = (data: any): data is KnownMessages => {
  try {
    return Object.values(KnownMessages).includes(data as KnownMessages);
  } catch {
    return false;
  }
};

export class KMStringer implements IStringer {
  constructor(private message: KnownMessages) {}
  toString(): string {
    return this.message;
  }
}