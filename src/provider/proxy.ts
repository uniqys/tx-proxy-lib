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

import abi from 'web3-eth-abi'
import RpcEngine from 'json-rpc-engine'
import getUniqueId from 'json-rpc-engine/src/getUniqueId'
import { TxTypedData, TypedData } from '../typed-data'
import { EngineProvider } from './engine'
import { Provider } from 'web3/providers'
import providerAsMiddleware from 'eth-json-rpc-middleware/providerAsMiddleware'

export interface SignedTxForProxy {
  proxy: string
  from: string
  nonce: number
  to: string
  data: string
  v: string
  r: string
  s: string
}

export class Proxy {
  private static readonly nonceFunctionABI = {
    name: 'nonce',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  }
  private _engine?: RpcEngine
  public set engine (engine) { this._engine = engine }
  public get engine () {
    if (!this._engine) throw new Error('engine required')
    return this._engine
  }
  constructor (
    private readonly address: string,
    private readonly sender: (signedTx: SignedTxForProxy) => Promise<string>
  ) { }

  public asMiddleware (): RpcEngine.Middleware {
    return (req, res, next, end) => {
      if (req.method === 'eth_sendTransaction' && req.params[0]['proxy']) {
        const txObj = req.params[0]
        if (txObj.value) return end(new Error('can not send value via proxy'))
        delete txObj['proxy']
        this._signForProxy(txObj)
          .then(signedTx => this.sender(signedTx))
          .then(
            txHash => {
              res.result = txHash
              end()
            },
            err => end(err)
          )
      } else {
        next()
      }
    }
  }

  private async _signForProxy (tx: { from: string, to: string, data: string, nonce?: number }): Promise<SignedTxForProxy> {
    const nonce = tx.nonce ? tx.nonce : await this._nonce(tx.from)
    const typedData = TxTypedData.make(
      this.address,
      {
        nonce: nonce,
        to: tx.to,
        data: tx.data
      }
    )
    const sigHex = await this._signTypedData(typedData, tx.from)
    const sig = sigHex.substring(2)
    const r = '0x' + sig.substring(0, 64)
    const s = '0x' + sig.substring(64, 128)
    const v = '0x' + sig.substring(128, 130)

    return {
      proxy: this.address,
      from: tx.from,
      nonce: nonce,
      to: tx.to,
      data: tx.data,
      v, r, s
    }
  }

  private async _signTypedData (typedData: TypedData, from: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.engine.handle({
        id: getUniqueId(),
        jsonrpc: '2.0',
        method: 'eth_signTypedData_v3',
        params: [from, JSON.stringify(typedData)]
      }, (err, res) => {
        if (err) return reject(err)
        resolve(res.result)
      })
    })
  }

  private async _nonce (address: string): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.engine.handle({
        id: getUniqueId(),
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [
          {
            to: this.address,
            data: abi.encodeFunctionCall(Proxy.nonceFunctionABI, [address])
          },
          'latest'
        ]
      }, (err, res) => {
        if (err) return reject(err)
        const nonce = abi.decodeParameters(Proxy.nonceFunctionABI.outputs, res.result)[0]
        resolve(parseInt(nonce, 10))
      })
    })
  }
}

export const senderPlaceholder = '0x0000000000000000000000000000000000000000'

export class ProxyProvider extends EngineProvider {
  public static readonly address = {
    3: '0xf9fe2f690ad69ed0710274caad8136229656a2fb'
  }
  constructor (
    baseProvider: Provider,
    sender: (signedTx: SignedTxForProxy) => Promise<string>,
    addressOrNetworkId: string | number = 3
  ) {
    const address = typeof addressOrNetworkId === 'string'
      ? addressOrNetworkId
      : ProxyProvider.address[addressOrNetworkId]
    const engine = new RpcEngine()
    const proxy = new Proxy(address, sender)
    proxy.engine = engine

    engine.push(proxy.asMiddleware())
    engine.push(providerAsMiddleware(baseProvider))

    super(engine)
  }
}
