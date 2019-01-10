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

import RpcEngine from 'json-rpc-engine'
import SafeEventEmitter from 'safe-event-emitter'
import { Provider, JsonRPCRequest, JsonRPCResponse } from 'web3/providers'

export class EngineProvider extends SafeEventEmitter implements Provider {
  constructor (
    private readonly engine: RpcEngine
  ) {
    super()
    if (this.engine['on']) {
      this.engine['on']('notification', (message) => {
        this['emit']('data', null, message)
      })
    }
  }

  public send (payload: JsonRPCRequest, callback: (e: Error, val: JsonRPCResponse) => void) {
    this.engine.handle(payload, callback)
  }

  public sendAsync (payload: JsonRPCRequest, callback: (e: Error, val: JsonRPCResponse) => void) {
    this.engine.handle(payload, callback)
  }
}
