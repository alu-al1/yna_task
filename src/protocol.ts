import { Duration, sleeP } from "./shared";
import { WebSocket } from "ws";

export class Protocol {
  public data: string;
  public ms: Duration = 0;
  constructor(data: string, ms: Duration) {
    //TODO validate after is positive at least
    this.data = data;
    this.ms = ms;
  }

  private async _waitAsyncViaSleeP() {
    await sleeP(this.ms);
  }

  public async wait() {
    //TODO mb? even faster with loop manipulations
    if (this.ms == 0) return;
    return this._waitAsyncViaSleeP();
  }

  public write(trg: WebSocket): number {
    trg.send(this.data);
    //TODO assumnig that strings are utf8 here
    return this.data.length;
  }
}
