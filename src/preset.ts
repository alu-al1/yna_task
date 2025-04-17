import { Protocol } from "./protocol";
import { IClonable, IProtocol, IReflectable, ITimed } from "./iface";
import { KnownMessages, KMStringer } from "./message";

const kmtostr = (km: KnownMessages) => new KMStringer(km).toString();

export const expectedServerSeq: (IProtocol & IClonable & ITimed & IReflectable)[] = [
  new Protocol(kmtostr(KnownMessages.GREETING), 2 * 1000),
  new Protocol(kmtostr(KnownMessages.STILLHERE), 3 * 1000),
  new Protocol(kmtostr(KnownMessages.MBLEAVE), 3.5 * 1000),
];

export const toleranceMsDefault: number = 300;
