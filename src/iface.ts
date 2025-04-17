import { Duration } from "./shared";

export interface IStringer {
    toString(): string;
  }
  
  export interface IWritable {
    send(data: string | ArrayBuffer | Blob | ArrayBufferView): void;
  }
  
  export interface IProtocol {
    wait(): Promise<void>; // set to return Promise so tsc will understand that `wait` is async
    write(trg: any): number;
  }

  export interface IClonable {
    clone(): this;
  }

  export interface ITimed {
    ms?: Duration,
    sec?: Duration,
    h?: Duration
    // as work days on Venus
    // and so on ... 

    asMs(): Duration
  }

  export interface IComparable {
    eqTo(b: this): boolean; //i.e. functionally equal
  }

  export interface IReflectable {
    getPayload(): any;
  }