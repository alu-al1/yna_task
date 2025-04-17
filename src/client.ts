import { WebSocket } from "ws";

import { IClonable, IReflectable, IProtocol, ITimed } from "./iface";
import { dlog, Duration, now, Timestamp, tryFmtDate } from "./shared";
import { expectedServerSeq, toleranceMsDefault } from "./preset";
import {
  NothingToDo,
  ServerResponseTooQuick,
  ServerResponseTooSlow,
  ServerResponseUnexpectedMessage,
} from "./errors";

export type WSurl = string | URL;
export type ClientOptions = { url: WSurl }; // can be expanded

export type throwsTypedErrors = void;

export const CURSOR_NOT_SET: number = -1;

type metrics = {
  b: Timestamp;
  a: Timestamp;

  // tolerance can be upgraded to {tolerance: Duration, cansub: bool, canadd: bool} or something like that;
  // for now the tolerance works in both ways

  tolerancems: Duration;
};

type SeqEl = (IProtocol & IClonable & ITimed & IReflectable)

//TODO can also be bound to some logger; using clog and cerr for now
export class WSClient {
  private wso: ClientOptions = { url: "" };
  private _wsc: WebSocket | null = null;

  private seq: SeqEl[] = [];

  //single session for now, can be upgraded to simple session storage {seq, cur, metrics}

  private metrics: metrics = { b: 0, a: 0, tolerancems: toleranceMsDefault };
  private seqcur: number = CURSOR_NOT_SET;

  constructor(
    wso: ClientOptions,
    seq: SeqEl[],
    tolerancems?: number
  ) {
    this.wso = wso;
    this.seq = seq.map((el) => el.clone());
    this.seqcur = +(this.seq.length > 0) - 1;
    if (tolerancems && tolerancems > -1) this.metrics.tolerancems = tolerancems;
  }

  //keeping it public for test purposes
  die() {
    if (this._wsc && (this._wsc.OPEN || this._wsc.CONNECTING)) {
      try {
        this._wsc.close();
      } catch (_) {}
    }
  }

  //copying metrics for now to reduce repr-state coupling as long as metrics instance is shared between validation processes. Can be reduced to dates or just got from the original src
  private emit_ok(message: string, m: metrics) {
    console.info(`Protocol OK: \“${message}\“ received at ${tryFmtDate(m.a)}`);
  }
  private emit_err(message: string, el: SeqEl, m: metrics) {    
    const expected = m.b + el.asMs()
    const got = m.a
    
    console.error(
      `Protocol ERR: expected \“${message}\” between ${tryFmtDate(
        expected - m.tolerancems
      )} and ${tryFmtDate(expected + m.tolerancems)} but got ${tryFmtDate(got)}`
    );
  }
  private advanceMetrics() {
    this.metrics.b = this.metrics.a;
    this.metrics.a = 0;
  }

  //TODO should not block reading but any subsequent readings should use its own metrics
  private process(msg: any) {
    try {
      //implicit conv any to str is ok as String is fail-proof
      this.validate(msg);
      this.emit_ok(msg, { ...this.metrics });
      this.advanceMetrics();
      this.seqcur += 1 % this.seq.length;

    } catch (e) {
      dlog("got error", e);
      //TODO respect Protocol, Protocol sequence and general errors
      //we haven't advanced the cur so it is safe to get some data for the report
      this.emit_err(msg, this.seq[this.seqcur], { ...this.metrics });
      this.die();
    }
  }

  private validate(msg: string): throwsTypedErrors {
    this.metrics.a = now();
    if (this.seqcur == CURSOR_NOT_SET)
      throw new NothingToDo(
        "the seq of protocol elements to monitor is probably not set"
      );

    const curseq = this.seq[this.seqcur];
    const deltaAct = this.metrics.a - this.metrics.b;
    const deltaExpected = curseq.asMs();

    //can be refactored to if..else if... else if... else
    //but I will keep it this way for now not to clog the impl
    if (deltaAct > deltaExpected + this.metrics.tolerancems)
      throw new ServerResponseTooSlow();

    if (deltaAct < deltaExpected - this.metrics.tolerancems)
      throw new ServerResponseTooQuick();

    //alt: we can implement ISerializable, IMessage or IComparable (with some caveats)
    // or just simply refuse to use this.seq as a sum of interfaces
    //TODO check if type assertion failed
    if ((curseq.getPayload() as typeof msg) != msg)
      throw new ServerResponseUnexpectedMessage();
  }

  //TODO check all is set and ready
  public connectAndPoll() {
    this._wsc = new WebSocket(this.wso.url);
    this._wsc.on("message", (msg) => this.process(msg));
    //TODO mb? here we can reuse advanceMetrics() which can move cur from -1 to 0 and update ts
    //...TODO mb? this approach may have some benefits
    // ...TODO mb? yet the readability will definitely suffer
    this._wsc.on("open", () => (this.metrics.b = now()));

    //TODO on close - check if premature via peeking into the metrics
  }
}

function main() {
  new WSClient(
    { url: "ws://localhost:8080" },
    expectedServerSeq
  ).connectAndPoll();
}

//TODO listen to os signals to be able to shutdown gracefully
// https://nodejs.org/api/modules.html#accessing-the-main-module
if (require.main === module) main();
