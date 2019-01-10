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
import utils from 'web3-utils'
import Contract from 'web3-eth-contract'
import { Tx } from 'web3/eth/types'
import { Provider } from 'web3/providers'
import PromiEvent from 'web3/promiEvent'
import RpcEngine from 'json-rpc-engine'
import providerAsMiddleware from 'eth-json-rpc-middleware/providerAsMiddleware'
import { senderPlaceholder } from './proxy'
import { EngineProvider } from './engine'

export class AgentManagerContract extends Contract {
  constructor (
    address: string,
    provider: Provider
  ) {
    super([
      {
        type: 'function',
        name: 'agentOf',
        inputs: [{ name: '_owner', type: 'address' }],
        outputs: [{ name: '', type: 'address' }]
      },
      {
        type: 'function',
        name: 'newAgent',
        inputs: [{ name: '_sender', type: 'address' }],
        outputs: [{ name: '', type: 'address' }]
      },
      {
        type: 'event',
        name: 'Called',
        inputs: [
          { indexed: false, name: '_sender', type: 'address' },
          { indexed: false, name: '_nonce', type: 'uint256' },
          { indexed: false, name: '_result', type: 'bool' }
        ]
      }
    ], address)
    this.setProvider(provider)
  }

  public get address (): string {
    return this.options.address
  }

  public newAgent (tx: Tx): PromiEvent<any> {
    return this.methods.newAgent(senderPlaceholder).send(tx)
  }

  public async agentOf (owner: string): Promise<string | undefined> {
    const agent = await this.methods.agentOf(owner).call()
    return utils.hexToNumberString(agent) === '0' ? undefined : agent
  }
}

export class Agent {
  private static readonly agentABI = {
    call: {
      name: 'callContract',
      inputs: [
        { name: '_sender', type: 'address' },
        { name: '_to', type: 'address' },
        { name: '_data', type: 'bytes' }
      ]
    }
  }
  constructor (
    public readonly manager: AgentManagerContract
  ) { }

  public asMiddleware (): RpcEngine.Middleware {
    return (req, _res, next, end) => {
      if ((req.method === 'eth_sendTransaction' || req.method === 'eth_call') && req.params[0]['agent'] && req.params[0].from) {
        this._modifyTx(req.params[0]).then(() => next(), err => end(err))
      } else {
        next()
      }
    }
  }

  private async _modifyTx (tx: Tx & { from: string, to: string, data: string }): Promise<void> {
    const agent = await this.manager.agentOf(tx.from)
    if (!agent) throw new Error('agent of this sender is not exists.')

    tx.data = abi.encodeFunctionCall(Agent.agentABI.call, [senderPlaceholder, tx.to, tx.data])
    tx.to = agent
  }
}

export class AgentProvider extends EngineProvider {
  public static readonly address = {
    3: '0xadbb912b649afd932691b1617d95637ad3ed72f0'
  }
  public readonly manager: AgentManagerContract
  constructor (
    baseProvider: Provider,
    addressOrNetworkId: string | number = 3
  ) {
    const address = typeof addressOrNetworkId === 'string'
      ? addressOrNetworkId
      : AgentProvider.address[addressOrNetworkId]
    const engine = new RpcEngine()
    super(engine)

    this.manager = new AgentManagerContract(address, baseProvider)
    engine.push(new Agent(this.manager).asMiddleware())
    engine.push(providerAsMiddleware(baseProvider))
  }
}
