/*
  Copyright 2018 Bit Factory, Inc.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

declare module 'json-rpc-engine' {
  namespace RpcEngine {
    export interface Request {
      jsonrpc: string
      method: string
      params: any[]
      id: number
    }
    export interface Response {
      jsonrpc: string
      id: number
      result?: any
      error?: string
    }
    export type Middleware =
      (
        req: Request,
        res: Response,
        next: (returnHandler?: (cb: (err?: Error) => void) => void) => void,
        end: (err?: Error) => void
      ) => void
  }
  class RpcEngine {
    push (middleware: RpcEngine.Middleware): void
    handle (req: RpcEngine.Request | RpcEngine.Request[], cb: (err: Error, res: RpcEngine.Response) => void)
  }

  export = RpcEngine
}

declare module 'web3-eth-contract' {
  import Contract from 'web3/eth/contract'
  export = Contract
}

declare module 'web3-eth-abi' {
  import ABI from 'web3/eth/abi'
  const abi: ABI
  export = abi
}

declare module 'web3-utils' {
  import Utils from 'web3/utils'
  const utils: Utils
  export = utils
}

declare module 'safe-event-emitter' {
  import { EventEmitter } from 'events'
  class SafeEventEmitter extends EventEmitter { }
  export = SafeEventEmitter
}
