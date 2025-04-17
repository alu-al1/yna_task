import {
  IProtocol,
  IStringer,
  IWritable,
  IClonable,
  ITimed,
  IComparable,
  IReflectable,
} from "./iface";
import { Duration, sleeP } from "./shared";

//Alternatively can be:
// - an interface (if we want to ensure certain handles)
// - an abstract class - if we want to impose some common handlers

export class Protocol implements IProtocol, IClonable, ITimed, IReflectable, IComparable {
  private data: IStringer;
  public ms: Duration = 0;
  constructor(data: IStringer, ms: Duration) {
    //TODO validate after is positive at least
    this.data = data;
    this.ms = ms;
  }
  getPayload() {
    return this.data
  }
  eqTo(b: this): boolean {
    const a = this;
    return a.data.toString() == b.data.toString() && a.ms == b.ms;
  }
  asMs(): Duration {
    return this.ms;
  }

  public clone(): this {
    return new Protocol(this.data, this.ms) as this;
  }

  private async _waitAsyncViaSleeP() {
    await sleeP(this.ms);
  }

  public async wait() {
    //TODO mb? even faster with loop manipulations
    if (this.ms == 0) return;
    return this._waitAsyncViaSleeP();
  }

  //usually socket write op returns number of bytes - here we are preserving this convention albeit in a canny way
  public write(trg: IWritable): number {
    const msg = this.getPayload().toString();
    trg.send(msg);
    //TODO assumnig that strings are utf8 here
    return msg.length;
  }
}
