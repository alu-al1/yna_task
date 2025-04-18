//TODO mb check if alive on each validate and such events

import { WebSocket } from "ws";
import { URL } from "url"; // same as ws uses
import { seq as serverSeq } from "./server";
import { die, Duration, now, Timestamp, tryFmtDate } from "./shared";
import { Protocol } from "./protocol";

type metrics = {
  b: Timestamp;
  a: Timestamp;
  tolerancems: Duration;
};
const wsmetrics: metrics = { b: 0, a: 0, tolerancems: 3000 };

function advanceMetrics(m: metrics) {
  m.b = m.a;
  m.a = 0;
}

let seq: Protocol[] = serverSeq;
// let seq: Protocol[] = serverSeq.reverse();

const CURSOR_NOT_SET: number = -1;
let cur = CURSOR_NOT_SET;

const emit_ok = (message: string) => {
  console.info(
    `Protocol OK: \“${message}\“ received at ${tryFmtDate(wsmetrics.a)}`
  );
};

const emit_err = (message: string) => {
  const step = seq[cur];
  const expected = wsmetrics.b + step.ms;
  console.error(
    `Protocol ERR: expected \“${step.data}\” between ${tryFmtDate(
      expected - wsmetrics.tolerancems
    )} and ${tryFmtDate(expected + wsmetrics.tolerancems)}`
  );
};

let msgTO: any;

function pauseTimingsMonitoring() {
  clearTimeout(msgTO);
}
function resumeTimingsMonitoring() {
  if (cur >= seq.length) return;

  const nextExpecting = seq[cur];
  msgTO = setTimeout(() => {
    // TooSlow
    emit_err(nextExpecting.data);
    do_die();
  }, nextExpecting.ms + wsmetrics.tolerancems - (now() - wsmetrics.b));
}

let url: string | undefined;

function do_die(conn?: WebSocket) {
  pauseTimingsMonitoring();
  try {
    !!conn && conn.close();
  } catch (_) {}
  die();
}

function validate(msg: string) {
  const step = seq[cur];
  const delta = wsmetrics.a - wsmetrics.b;
  const expected = step.ms;

  if (delta < expected - wsmetrics.tolerancems) {
    throw new Error("too quick");
  }
  if (msg != step.data) {
    throw new Error("wrong message");
  }
}

function processMessage(msg: any) {
  try {
    {
      pauseTimingsMonitoring();
      wsmetrics.a = now();
    }

    validate(msg);
    emit_ok(msg);

    {
      cur++;
      advanceMetrics(wsmetrics);
      resumeTimingsMonitoring();
    }
  } catch (_) {
    emit_err(msg);
    do_die();
  }
}

function usage() {
  const [cmd, entrypoint] = process.argv;
  console.error(`USAGE: WSS_URL="ws(s)?://host:port" ${cmd} ${entrypoint}`);
}

function init() {
  try {
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
  const wsc = new WebSocket(url);

  wsc.on("message", processMessage);
  wsc.on("open", () => {
    wsmetrics.a = now();

    {
      cur = +(seq.length > 0) - 1;
      advanceMetrics(wsmetrics);
      resumeTimingsMonitoring();
    }
  });
}

//TODO listen to os signals to be able to shutdown gracefully
// https://nodejs.org/api/modules.html#accessing-the-main-module
if (require.main === module) {
  init();
  main(url);
}
