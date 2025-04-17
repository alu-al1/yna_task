import { WebSocketServer, ServerOptions } from "ws";

import { dlog, die, init_debug, strToBool, strToInt } from "./shared";
import { IProtocol, IClonable } from "./iface";
import { expectedServerSeq } from "./preset";

const connIsAlive = (conn: WebSocket) => conn.OPEN || conn.CONNECTING;

export class WSServer {
  private wso: ServerOptions = {};
  private _wss: WebSocketServer | null = null;

  private seq: IProtocol[] = [];
  //TODO mb? store some minimal clients conn data and set atomic flag if seq is already being served
  //...TODO to ensure one serving at a time
  //...TODO and gracefully breakup with clients if needed

  //additionally IComparable can be used for various optimisations (e.g. compacting seq, uniqueness validation etc.)
  constructor(so: ServerOptions, seq: (IProtocol & IClonable)[]) {
    //getting local copies for the instance to eliminate any possible mutability issues
    this.wso = { ...so };
    this.seq = seq.map((e) => e.clone());
  }

  private async serveSeq(conn: WebSocket) {
    for (let el of this.seq) {
      await el.wait();
      dlog("answering");
      el.write(conn);
    }
  }

  private closeConnSafe(conn: WebSocket | null): void {
    if (conn && connIsAlive(conn))
      try {
        conn.close();
      } catch (_) {}
  }

  async serve() {
    this._wss = new WebSocketServer(this.wso);
    this._wss.on("connection", async (conn: WebSocket) => {
      await this.serveSeq(conn).catch((_) => this.closeConnSafe(conn));
    });
    //TODO on close - check if premature
    dlog("listening...");
  }
}

let port: number = 0;

function usage() {
  const [cmd, entrypoint] = process.argv;
  //assume user already knows about an available port subset
  console.error(`USAGE: WSS_PORT=number [DEBUG=false] ${cmd} ${entrypoint}`);
}

function init() {
  try {
    init_debug();

    {
      port = strToInt(process.env.WSS_PORT);
      if (port == 0) throw "Invalid WSS_PORT value";
    }
  } catch (e) {
    typeof e === "string" && e.length && console.error("ERROR:" + e);
    usage();
    die();
  }
}

function main() {
  new WSServer({ port }, expectedServerSeq).serve();
}

//TODO listen to os signals to be able to shutdown gracefully
// https://nodejs.org/api/modules.html#accessing-the-main-module
if (require.main === module) {
  init();
  main();
}
