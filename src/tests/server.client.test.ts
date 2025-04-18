import { ChildProcess, spawn } from "child_process";
import * as path from "path";

import { WSClient } from "../client";
import { WSServer } from "../server";

import { IClonable, ILogger, IProtocol, IReflectable, ITimed } from "../iface";
import { expectedServerSeq, toleranceMsDefault } from "../preset";

import { Duration, sleeP, strToBool, strToInt } from "../shared";

import { trypkill } from "./shared";
import { Protocol } from "../protocol";

const runInParallel = strToBool(process.env.PARALLEL) || true;
console.info("running tests in parallel?", runInParallel);

const prefix = "[ server<->client ]";

//TODO get it from ts config
const builddir = "build";
const serverJS = path.resolve(__dirname, "..", "..", builddir, "server.js");
const clientJS = path.resolve(__dirname, "..", "..", builddir, "client.js");

let port: number = strToInt(process.env.WSS_PORT) || 8080;

//better to use client event subscription but this will do for now
class LoggerAccum implements ILogger {
  oks: string[][] = [];
  errs: string[][] = [];
  ok(...msg: string[]): void {
    // console.info("[LA][ok]", ...msg);
    this.oks.push(msg);
  }
  err(...msg: string[]): void {
    // console.info("[LA][err]", ...msg);
    this.errs.push(msg);
  }
}

type testcase = {
  name: string;
  port: number;
  serverSeq: (IProtocol & IClonable & IReflectable)[];
  clientSeq: (IProtocol & IClonable & IReflectable & ITimed)[];

  clientStaysAliveAfter: boolean;

  timings: Record<string, Duration>;

  validate: (expected: IReflectable[], got: LoggerAccum) => void;
};

//TODO add server's state after
const testCases: testcase[] = [
  {
    name: "task seq ok",
    port: port++,

    serverSeq: expectedServerSeq,
    clientSeq: expectedServerSeq,

    clientStaysAliveAfter: true,

    timings: {
      before: 3000,
      process: ((seq: ITimed[], tolerancems: Duration) => {
        return (
          seq.reduce((acc: number, el: ITimed) => acc + el.asMs(), 0) +
          tolerancems * seq.length
        );
      })(expectedServerSeq, toleranceMsDefault),
      after: 3000,
    },

    validate: (exp: IReflectable[], got: LoggerAccum) => {
      //TODO hereby: checking for proto (OK|ERR) can be packed into a common helpers
      const prot_oks_only = got.oks.filter(
        (msg) => msg.length && msg[0].indexOf("Protocol OK") > -1
      );

      expect(prot_oks_only.length).toBeGreaterThanOrEqual(exp.length);

      //iterate over emitted ok messages, inc j only if rignt seq step is met
      {
        //TODO support interweave
        let j = 0;
        for (let i = 0; i < prot_oks_only.length || j < exp.length; i++) {
          j += +(prot_oks_only[i][0].indexOf(exp[j].getPayload()) > -1);
        }
        expect(j).toEqual(exp.length);
      }
    },
  },

  {
    name: "client seq reversed",
    port: port++,

    serverSeq: expectedServerSeq,
    clientSeq: expectedServerSeq.map((el) => el.clone()).reverse(),

    clientStaysAliveAfter: false,

    timings: {
      before: 3000,
      process: ((seq: ITimed[], tolerancems: Duration) => {
        return (
          seq.reduce((acc: number, el: ITimed) => acc + el.asMs(), 0) +
          tolerancems * seq.length
        );
      })(expectedServerSeq, toleranceMsDefault),
      after: 3000,
    },

    validate: (exp: IReflectable[], got: LoggerAccum) => {
      expect(got.errs.length).toBeGreaterThan(0);
      expect(
        got.oks.filter((el) => el.length && el[0].indexOf("Protocol OK") > -1)
          .length
      ).toBeLessThan(exp.length);

      expect(
        !!got.errs.find((el) => el.length && el[0].indexOf("Protocol ERR") > -1)
      ).toBe(true);
    },
  },
  {
    name: "seq on server part and no seq on client",
    port: port++,

    serverSeq: [new Protocol("69", 700)],
    clientSeq: [],

    clientStaysAliveAfter: false,

    timings: {
      before: 0,
      process: 700 + toleranceMsDefault,
      after: 0,
    },

    validate: (_: IReflectable[], got: LoggerAccum) => {
      expect(
        got.oks.filter((el) => el.length && el[0].indexOf("Protocol OK") > -1)
          .length
      ).toBe(0);
      expect(
        got.oks.filter((el) => el.length && el[0].indexOf("Protocol ERR") > -1)
          .length
      ).toBe(0);
    },
  },
  {
    name: "server no message (aka server too slow)",
    port: port++,

    serverSeq: [],
    clientSeq: [new Protocol("nice?", 1000)],

    clientStaysAliveAfter: false,

    timings: {
      before: 0,
      process: 1000 + toleranceMsDefault + 100,
      after: 100,
    },

    validate: (_: IReflectable[], got: LoggerAccum) => {
      expect(got.errs.length).toBeGreaterThan(0);
      expect(
        !!got.errs.find((el) => el.length && el[0].indexOf("Protocol ERR") > -1)
      ).toBe(true);
    },
  },
  {
    name: "server too fast",
    port: port++,

    serverSeq: [new Protocol("nice?", 1000)],
    clientSeq: [new Protocol("nice?", 5000)],

    clientStaysAliveAfter: false,

    timings: {
      before: 0,
      process: 2000 + toleranceMsDefault,
      after: 100,
    },

    validate: (_: IReflectable[], got: LoggerAccum) => {
      expect(got.errs.length).toBeGreaterThan(0);
      expect(
        !!got.errs.find((el) => el.length && el[0].indexOf("Protocol ERR") > -1)
      ).toBe(true);
    },
  },
  {
    name: "server sends something else and do not respect client backpresure",
    port: port++,

    serverSeq: [
      new Protocol("not nice", 1000),
      new Protocol("oh wait...", 1000),
    ],
    clientSeq: [new Protocol("nice", 5000)],

    clientStaysAliveAfter: false,

    timings: {
      before: 0,
      process: 2000 + toleranceMsDefault,
      after: 100,
    },

    validate: (_: IReflectable[], got: LoggerAccum) => {
      expect(got.errs.length).toBeGreaterThan(0);
      expect(
        !!got.errs.find((el) => el.length && el[0].indexOf("Protocol ERR") > -1)
      ).toBe(true);
    },
  },
];
//.slice(-1);
//.slice(-2,-1);
//.slice(0,1);
const do_test = (
  {
    name,
    port,
    serverSeq,
    clientSeq,
    timings,
    clientStaysAliveAfter,
    validate,
  }: testcase,
  allowInParallel: boolean = false
): void => {
  const run = allowInParallel ? test.concurrent : test;
  
  const loggingSuppressed = allowInParallel;
  const log = loggingSuppressed ? () => {} : console.info; // makes it less noisy

  const testName = prefix + " " + name;

  run(
    testName,
    async () => {
      console.info(
        `running ${testName}...(further logging suppressed: ${loggingSuppressed})`
      );
      // there are at least two ways to test it
      // - import server and client here and run it in a single thread
      // - spawn two processes and listens to its outputs comparing with onces that are expected
      // I will resort to the former now as it will give me the ability to mangle message sequences
      // yet blackbox tests are also possible
      const acc = new LoggerAccum();
      const server: WSServer = new WSServer({ port }, serverSeq);
      const client: WSClient = new WSClient(
        { url: `ws://localhost:${port}` },
        clientSeq,
        toleranceMsDefault,
        acc
      );

      let pserver: ChildProcess | null = null;

      const stop = () => {
        client && client.die();
        server && server.die();
        trypkill(pserver);
      };

      try {
        log("waiting for server to spin up...");
        {
          // pserver = spawn("node", [serverJS], {
          //   stdio: "ignore",
          //   env: { WSS_PORT: `${port}`, ...process.env },
          // });
          server.serve();
        }
        await sleeP(timings.before);

        log("running client and waiting client process to finish...");
        try {
          client.connectAndPoll();
        } catch (_) {}

        await sleeP(timings.process);
        expect(client.isAlive()).toBe(clientStaysAliveAfter);

        log(
          "process should be finished by now. waiting a bit to ensure client's state..."
        );
        await sleeP(timings.after);
        expect(client.isAlive()).toBe(clientStaysAliveAfter);

        log("stopping client and server");
        stop();

        log("validating...");
        validate(clientSeq, acc);
      } finally {
        stop();
      }
    },
    Object.values(timings as Record<string, number>).reduce(
      (acc, val) => acc + val,
      0
    ) * 1.15
  );
};

testCases.forEach((testcase) =>
  do_test(testcase, testCases.length > 1 && runInParallel)
);
