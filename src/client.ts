//TODO mb check if alive on each validate and such events

import { WebSocket } from "ws";
import { URL } from "url"; // same as ws uses

import { IClonable, IReflectable, IProtocol, ITimed, ILogger } from "./iface";
import {
  die,
  Duration,
  now,
  Timestamp,
  tryFmtDate,
} from "./shared";
import {
  ClientAlreadyBusy,
  NothingToDo,
  ServerResponseTooQuick,
  ServerResponseTooSlow,
  ServerResponseUnexpectedMessage,
} from "./errors";
import { ConsoleLogger, dlog, dummyLogger, init_debug, isDebugEnabled } from "./logger";
import { expectedServerSeq, toleranceMsDefault } from "./preset";

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

type SeqEl = IProtocol & IClonable & ITimed & IReflectable;

//TODO acts like sync emitter

//TODO can also be bound to some logger; using clog and cerr for now
export class WSClient {
  private wso: ClientOptions = { url: "" };
  private _wsc: WebSocket | null = null;
  private _logger: ILogger = dummyLogger;
  private seq: SeqEl[] = [];

  //single session for now, can be upgraded to simple session storage {seq, cur, metrics}

  private metrics: metrics = { b: 0, a: 0, tolerancems: toleranceMsDefault };
  private seqcur: number = CURSOR_NOT_SET;
  private expMesgMaxTo?: NodeJS.Timeout;

  constructor(
    wso: ClientOptions,
    seq: SeqEl[],
    tolerancems?: number,
    logger: ILogger = new ConsoleLogger()
  ) {
    this.wso = wso;
    this.seq = seq.map((el) => el.clone());
    this.seqcur = +(this.seq.length > 0) - 1;
    if (tolerancems && tolerancems > -1) this.metrics.tolerancems = tolerancems;
    this._logger = logger;
  }

  isAlive() {
    //without !! null can be returned in _wsc never was opened
    return !!(this._wsc && this._wsc.readyState == this._wsc.OPEN);
  }

  //keeping it public for test purposes
  die() {
    if (
      this._wsc &&
      this._wsc.readyState in [this._wsc.OPEN, this._wsc.CONNECTING]
    ) {
      try {
        this._wsc.close();
      } catch (_) {}
    }
  }

  //copying metrics for now to reduce repr-to-state coupling as long as metrics instance is shared between validation processes. Can be reduced to dates or just got from the original src

  private emit_ok(message: string, m: metrics, el?: SeqEl) {
    let msg = `Protocol OK: \“${message}\“ received at ${tryFmtDate(m.a)}`;
    if (!!el)
      msg += `;act delay: ${
        m.a - m.b
      } ms; step set delay: ${el.asMs()} ms; tolerance (+-): ${
        m.tolerancems
      } ms;`;

    this._logger.ok(msg);
  }
  private emit_err(message: string, m: metrics, el: SeqEl) {
    const expected = m.b + el.asMs();

    let msg = `Protocol ERR: expected \“${message}\” between ${tryFmtDate(
      expected - m.tolerancems
    )} and ${tryFmtDate(expected + m.tolerancems)}`;

    if (false) msg += `but got ${tryFmtDate(m.a)}`;

    this._logger.err(msg);
  }
  private advanceMetrics() {
    this.metrics.b = this.metrics.a;
    this.metrics.a = 0;
  }

  private pauseTimingsMonitoring() {
    clearTimeout(this.expMesgMaxTo);
  }
  private resumeTimingsMonitoring() {
    const nextExpecting = this.seq[this.seqcur];
    if (this.seqcur >= this.seq.length) return;

    this.expMesgMaxTo = setTimeout(() => {
      // TooSlow
      this.emit_err(
        nextExpecting.getPayload(),
        { ...this.metrics },
        nextExpecting
      );
      this.die();
    }, nextExpecting.asMs() + this.metrics.tolerancems - (now() - this.metrics.b));
  }

  onclose(listener: (this: WebSocket, code: number, reason: Buffer) => void) {
    this._wsc?.on("close", listener);
  }

  //TODO should not block reading but any subsequent readings should use its own metrics
  private process(msg: any) {
    try {
      this.pauseTimingsMonitoring();
      //implicit conv any to str is ok as String is fail-proof
      this.validate(msg);
      //TODO mb? emit_x SeqEl abstraction leak can be resolved with an additional getter
      this.emit_ok(
        msg,
        { ...this.metrics },
        isDebugEnabled() ? this.seq[this.seqcur].clone() : undefined
      );

      {
        // alt: use this.seqcur += 1 % this.seq.length if you want to roll back to the beguinning of the sequence
        // but in this case some server message should be defined that will act like "open" event acts now
        // otherwise we will fail with serverTooSlow on the first message after the cur reset
        this.seqcur++;
      }

      this.advanceMetrics();
      this.resumeTimingsMonitoring();
    } catch (e) {
      dlog("got error", e);
      //TODO respect Protocol, Protocol sequence and general errors
      //we haven't advanced the cur so it is safe to get some data for the report
      this.emit_err(msg, { ...this.metrics }, this.seq[this.seqcur]);
      this.die();
    }
  }

  //TODO wrap sending message to be able to reset metrics.b
  // all this step can be packed into a custom validators collection + validation strategies
  private validate(msg: string): throwsTypedErrors {
    this.metrics.a = now();

    const curseq = this.seq[this.seqcur];
    const deltaAct = this.metrics.a - this.metrics.b;
    const deltaExpected = curseq.asMs();

    //can be refactored to if..else if... else if... else
    //but I will keep it this way for now not to clog the impl

    if (deltaAct < deltaExpected - this.metrics.tolerancems)
      throw new ServerResponseTooQuick();

    //alt: we can implement ISerializable, IMessage or IComparable (with some caveats)
    // or just simply refuse to use this.seq as a sum of interfaces
    //TODO check if type assertion failed
    if ((curseq.getPayload() as typeof msg) != msg)
      throw new ServerResponseUnexpectedMessage();
  }

  public connectAndPoll(): throwsTypedErrors {
    if (this.seqcur == CURSOR_NOT_SET)
      throw new NothingToDo(
        "the seq of protocol elements to monitor is probably not set"
      );
    if (this.isAlive()) throw new ClientAlreadyBusy();

    this._wsc = new WebSocket(this.wso.url);
    this._wsc.on("message", (msg) => this.process(msg));
    //TODO mb? here we can reuse advanceMetrics() which can move cur from -1 to 0 and update ts
    //...TODO mb? this approach may have some benefits
    // ...TODO mb? yet the readability will definitely suffer
    this._wsc.on("open", () => {
      this.metrics.a = now();

      this.advanceMetrics();
      this.resumeTimingsMonitoring();
    });

    //TODO on close - check if premature via peeking into the metrics
  }
}

let url: string | undefined = "";

function usage() {
  const [cmd, entrypoint] = process.argv;
  console.error(
    `USAGE: WSS_URL="ws(s)?://host:port" [DEBUG=false] ${cmd} ${entrypoint}`
  );
}

function init() {
  try {
    init_debug();

    {
      url = process.env.WSS_URL;
      new URL(url as string);
    }
  } catch (e) {
    e instanceof TypeError &&
      e.message.indexOf("URL") > -1 &&
      console.error("ERROR: WSS_URL:" + e.message);
    usage();
    die();
  }
}

function main(url: any) {
  new WSClient({ url: url as string }, expectedServerSeq).connectAndPoll();
}

//TODO listen to os signals to be able to shutdown gracefully
// https://nodejs.org/api/modules.html#accessing-the-main-module
if (require.main === module) {
  init();
  main(url);
}
