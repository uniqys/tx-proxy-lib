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

import utils from 'web3-utils'
import abi from 'web3-eth-abi'

export namespace TypedData {
  export interface TypeProperty { name: string, type: string }
  export interface Domain {
    name?: string,
    version?: string,
    chainId?: number,
    verifyingContract?: string,
    salt?: string
  }
  export interface Types {
    EIP712Domain:
    ({ name: 'name', type: 'string' } |
      { name: 'version', type: 'string' } |
      { name: 'chainId', type: 'uint256' } |
      { name: 'verifyingContract', type: 'address' } |
      { name: 'salt', type: 'bytes32' })[],
    [key: string]: TypeProperty[]
  }
  export interface TypedData<T = {}> {
    types: Types,
    primaryType: string,
    domain: Domain,
    message: T
  }

  function concat (bytes: string[]): string {
    return utils.bytesToHex(bytes.reduce<number[]>((a, b) => a.concat(utils.hexToBytes(b)), []))
  }

  export function encode<T> (data: TypedData<T>): string {
    return concat([
      utils.bytesToHex([0x19, 0x01]),
      domainSeparator(data.types, data.domain),
      hashStruct(data.types, data.primaryType, data.message)
    ])
  }

  export function hash<T> (data: TypedData<T>): string {
    return utils.sha3(encode(data))
  }

  export function hashStruct<T> (types: Types, type: string, data: T): string {
    return utils.sha3(concat([utils.sha3(encodeType(types, type)), encodeData(types, type, data)]))
  }

  function _encodeType (types: Types, type: string, ref: { [key: string]: string }): string {
    // check refs
    const refs = types[type].filter(m => (m.type in types) && m.type !== type).map(m => m.type)
    refs.forEach(t => {
      if (!(t in ref)) {
        ref[t] = _encodeType(types, t, ref)
      }
    })
    return `${type}(${types[type].map(m => `${m.type} ${m.name}`).join(',')})`
  }
  export function encodeType (types: Types, type: string): string {
    const ref = {}
    const primary = _encodeType(types, type, ref)
    const encodedRefs = Object.keys(ref).sort().map(t => ref[t]).join('')

    return `${primary}${encodedRefs}`
  }

  export function encodeData<T> (types: Types, type: string, data: T): string {
    const members = types[type]
    return concat(members.map(m => {
      const t = m.type
      const d = data[m.name]

      // ref
      if (t in types) {
        return hashStruct(types, t, d)
      }

      // dynamic
      if (t === 'bytes' || t === 'string') {
        return utils.sha3(d)
      }

      // array
      const arr = /^(.+)\[\d*\]/.exec(t)
      if (arr) {
        return utils.sha3(concat((d as ({}[])).map(d => encodeData(types, arr[1], d))))
      }

      // atomic
      return abi.encodeParameter(t, d)
    }))
  }

  export function domainSeparator (types: Types, domain: Domain): string {
    return hashStruct(types, 'EIP712Domain', domain)
  }
}
export type TypedData<T = {}> = TypedData.TypedData<T>

export namespace TxTypedData {
  export interface Tx {
    nonce: number
    to: string
    data: string
  }
  export const types: TypedData.Types = {
    EIP712Domain: [
      { name: 'verifyingContract', type: 'address' }
    ],
    Tx: [
      { name: 'nonce', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'data', type: 'bytes' }
    ]
  }

  export function make (proxyAddress: string, tx: Tx): TypedData<Tx> {
    return {
      types: TxTypedData.types,
      primaryType: 'Tx',
      domain: { verifyingContract: proxyAddress },
      message: tx
    }
  }
}
