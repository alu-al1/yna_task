import { WebSocket, WebSocketServer, ServerOptions } from "ws";

import { connIsAlive, die, strToInt } from "./shared";
import { Protocol } from "./protocol";

export const seq: Protocol[] = [
  new Protocol("hello", 2 * 1000),
  new Protocol("still here", 3 * 1000),
  new Protocol("you can leave now", 3.5 * 1000),
];

let port: number = 0;

async function serveSeq(conn: WebSocket) {
  for (let el of seq) {
    if (!connIsAlive(conn)) break;
    await el.wait();
    console.log("sending data", el.data);
    el.write(conn);
  }
}

function usage() {
  const [cmd, entrypoint] = process.argv;
  //assume user already knows about an available port subset
  console.error(`USAGE: WSS_PORT=number ${cmd} ${entrypoint}`);
}

function init() {
  try {
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

function main(port: number) {
  const wss = new WebSocketServer({ port });
  wss.on("connection", async (conn) => {
    await serveSeq(conn).catch((_) => connIsAlive(conn) && conn.close());
  });
}

//TODO listen to os signals to be able to shutdown gracefully
// https://nodejs.org/api/modules.html#accessing-the-main-module
if (require.main === module) {
  init();
  main(port);
}
