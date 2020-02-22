/**
 * Copyright 2020 NEM Foundation (https://nem.io)
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {Store} from 'vuex'
import {Account, Address, NetworkType, SimpleWallet, Password} from 'nem2-sdk'
import {
  ExtendedKey,
  MnemonicPassPhrase,
  Network,
  NodeEd25519,
  Wallet,
} from 'nem2-hd-wallets'

// internal dependencies
import {AbstractService} from './AbstractService'
import {DerivationService, DerivationPathLevels} from './DerivationService'
import {DerivationPathValidator} from '@/core/validation/validators'
import {WalletsModel, WalletType} from '@/core/database/entities/WalletsModel'
import {WalletsRepository} from '@/repositories/WalletsRepository'
import {SimpleStorageAdapter} from '@/core/database/SimpleStorageAdapter'
import {AccountsModel} from '@/core/database/entities/AccountsModel'

export class WalletService extends AbstractService {
  /**
   * Service name
   * @var {string}
   */
  public name: string = 'wallet'

  /**
   * Vuex Store 
   * @var {Vuex.Store}
   */
  public $store: Store<any>

  /**
   * Wallets repository
   * @var {WalletsRepository}
   */
  public wallets: WalletsRepository

  /**
   * Default wallet derivation path
   * @var {string}
   */
  public static readonly DEFAULT_WALLET_PATH = 'm/44\'/43\'/0\'/0\'/0\''

  /**
   * Construct a service instance around \a store
   * @param store
   */
  constructor(store?: Store<any>, adapter?: SimpleStorageAdapter) {
    super()
    this.$store = store
    this.wallets = new WalletsRepository()

    // - use overwritten adapter
    if (!!adapter) {
      this.$store.dispatch('diagnostic/ADD_DEBUG', 'Changing WalletService storage adapter.')
      this.wallets.setAdapter(adapter)
      this.wallets.fetch()
    }
  }

  /**
   * Read wallet from store or dispatch fetch action.
   * @param {MosaicId} mosaicId 
   * @return {Promise<MosaicInfo>}
   */
  public getWallet(
    identifier: string 
  ): WalletsModel {
    try {
      const wallet = this.wallets.read(identifier)
      return wallet
    }
    catch (e) {
      this.$store.dispatch('notification/ADD_ERROR', 'Wallet with identifier \'' + identifier + '\' does not exist.')
    }

    return null
  }

  /**
   * Getter for the collection of items
   * mapped by identifier
   * @return {Map<string, WalletsModel>}
   */
  public getWallets(
    filterFn: (
      value: WalletsModel,
      index: number,
      array: WalletsModel[]
    ) => boolean = (e) => true
  ): WalletsModel[] {
    const repository = new WalletsRepository()
    return repository.collect().filter(filterFn)
  }

  /**
   * Derive \a path using \a mnemonic pass phrase
   * @param {MnemonicPassPhrase} mnemonic 
   * @param {string} path 
   * @param {NetworkType} networkType 
   * @return {Account}
   */
  public getAccountByPath(
    mnemonic: MnemonicPassPhrase,
    networkType: NetworkType,
    path: string = WalletService.DEFAULT_WALLET_PATH,
  ): Account {
    if (false === DerivationPathValidator.validate(path)) {
      const errorMessage = 'Invalid derivation path: ' + path
      this.$store.dispatch('diagnostic/ADD_ERROR', errorMessage)
      throw new Error(errorMessage)
    }

    // create hd extended key
    const extendedKey = ExtendedKey.createFromSeed(mnemonic.toSeed().toString('hex'), Network.CATAPULT)

    // create wallet
    const wallet = new Wallet(extendedKey)
    // @ts-ignore //@TODO: SDK upgrade
    return wallet.getChildAccount(path, networkType)
  }

  /**
   * Get extended key around \a mnemonic for \a networkTypw
   * @param {MnemonicPassPhrase} mnemonic 
   * @param {NetworkType} networkType 
   * @return {ExtendedKey}
   */
  public getExtendedKeyFromMnemonic(
    mnemonic: MnemonicPassPhrase,
    networkType: NetworkType,
  ): ExtendedKey {
    return ExtendedKey.createFromSeed(
      mnemonic.toSeed().toString('hex'),
      Network.CATAPULT
    )
  }

  /**
   * Get extended key around \a account for \a networkTypw
   * @param {MnemonicPassPhrase} mnemonic 
   * @param {NetworkType} networkType 
   * @return {ExtendedKey}
   */
  public getExtendedKeyFromAccount(
    account: Account,
    networkType: NetworkType,
  ): ExtendedKey {
    // create HD node using curve ED25519
    const nodeEd25519 = new NodeEd25519(
      Buffer.from(account.privateKey),
      undefined, // publicKey
      Buffer.from(''), // chainCode
      Network.CATAPULT
    )
    return new ExtendedKey(nodeEd25519, nodeEd25519.network)
  }

  /**
   * Generate \a count accounts using \a mnemonic
   * @param {MnemonicPassPhrase} mnemonic
   * @param {NetworkType} networkType
   * @param {string} startPath
   * @param {number} count
   * @return {Account[]}
   */
  public generateAccountsFromMnemonic(
    mnemonic: MnemonicPassPhrase,
    networkType: NetworkType,
    startPath: string = WalletService.DEFAULT_WALLET_PATH,
    count: number = 10,
  ): Account[] {
    const helpers = new DerivationService(this.$store)

    // create hd extended key
    const xkey = this.getExtendedKeyFromMnemonic(mnemonic, networkType)

    // increment derivation path \a count times
    let current = startPath
    const paths = [...Array(count).keys()].map(
      index => count === 0 ? current : (current = helpers.incrementPathLevel(current, DerivationPathLevels.Address))
    )

    const wallets = paths.map(path => new Wallet(xkey.derivePath(path)))
    // @ts-ignore // @TODO: SDK Upgrade
    return wallets.map(wallet => wallet.getAccount())
  }

  /**
   * Generate accounts using a mnemonic and an array of paths
   * @param {MnemonicPassPhrase} mnemonic
   * @param {NetworkType} networkType
   * @param {string[]} paths
   * @returns {Account[]}
   */
  public generateAccountsFromPaths(
    mnemonic: MnemonicPassPhrase,
    networkType: NetworkType,
    paths: string[],
  ): Account[] {
    // create hd extended key
    const xkey = this.getExtendedKeyFromMnemonic(mnemonic, networkType)
    const wallets = paths.map(path => new Wallet(xkey.derivePath(path)))
    // @ts-ignore
    return wallets.map(wallet => wallet.getAccount())
  }

  /**
   * Get list of addresses using \a mnemonic
   * @return {Address[]}
   */
  public getAddressesFromMnemonic(
    mnemonic: MnemonicPassPhrase,
    networkType: NetworkType,
    startPath: string = WalletService.DEFAULT_WALLET_PATH,
    count: number = 10,
  ): Address[] {
    const accounts = this.generateAccountsFromMnemonic(mnemonic, networkType, startPath, count)
    return accounts.map(acct => acct.address)
  }

  /**
   * Get a user friendly name for a public key
   * @param {string} publicKey 
   */
  public getWalletLabel(
    publicKey: string,
    networkType: NetworkType
  ): string {
    const address = Address.createFromPublicKey(publicKey, networkType)

    // search in known wallets
    const knownWallets = this.$store.getters['wallet/knownWallets']
    const wallets = this.getWallets(wlt => knownWallets.includes(wlt.getIdentifier()))

    // find by public key
    const findIt = wallets.find(wlt => publicKey === wlt.values.get('publicKey'))
    if (undefined !== findIt) {
      return findIt.values.get('name')
    }

    // wallet not found by public key
    return address.plain()
  }

  /**
   * Create a wallet instance from mnemonic
   * @return {WalletsModel}
   */
  public getDefaultWallet(
    currentAccount: AccountsModel,
    mnemonic: MnemonicPassPhrase,
    password: Password,
    networkType: NetworkType,
  ): WalletsModel {
    const account = this.getAccountByPath(
      mnemonic,
      networkType,
      WalletService.DEFAULT_WALLET_PATH
    )

    const simpleWallet = SimpleWallet.createFromPrivateKey(
      'SeedWallet 1',
      password,
      account.privateKey,
      networkType
    )

    return new WalletsModel(new Map<string, any>([
      ['accountName', currentAccount.getIdentifier()],
      ['name', 'Seed Wallet 1'],
      ['type', WalletType.fromDescriptor('Seed')],
      ['address', simpleWallet.address.plain()],
      ['publicKey', account.publicKey],
      ['encPrivate', simpleWallet.encryptedPrivateKey.encryptedKey],
      ['encIv', simpleWallet.encryptedPrivateKey.iv],
      ['path', WalletService.DEFAULT_WALLET_PATH],
      ['isMultisig', false]
    ]))
  }

  /**
   * Create a child wallet instance from mnemonic and path
   * @return {WalletsModel}
   */
  public getChildWalletByPath(
    currentAccount: AccountsModel,
    password: Password,
    mnemonic: MnemonicPassPhrase,
    nextPath: string,
    networkType: NetworkType,
    childWalletName: string,
  ): WalletsModel {

    // - derive account
    const account = this.getAccountByPath(
      mnemonic,
      networkType,
      nextPath
    )

    const simpleWallet = SimpleWallet.createFromPrivateKey(
      childWalletName,
      password,
      account.privateKey,
      networkType
    )

    return new WalletsModel(new Map<string, any>([
      ['accountName', currentAccount.getIdentifier()],
      ['name', childWalletName],
      ['type', WalletType.fromDescriptor('Seed')],
      ['address', simpleWallet.address.plain()],
      ['publicKey', account.publicKey],
      ['encPrivate', simpleWallet.encryptedPrivateKey.encryptedKey],
      ['encIv', simpleWallet.encryptedPrivateKey.iv],
      ['path', nextPath],
      ['isMultisig', false]
    ]))
  }

  /**
   * Create a sub wallet by private key
   * @param currentAccount 
   * @param password 
   * @param childWalletName 
   * @param privateKey 
   * @param networkType 
   * @return {WalletsModel}
   */
  public getSubWalletByPrivateKey(
    currentAccount: AccountsModel,
    password: Password,
    childWalletName: string,
    privateKey: string,
    networkType: NetworkType,
  ): WalletsModel {
    const account = Account.createFromPrivateKey(privateKey, networkType)
    const simpleWallet = SimpleWallet.createFromPrivateKey(
      childWalletName,
      password,
      account.privateKey,
      networkType
    )

    return new WalletsModel(new Map<string, any>([
      ['accountName', currentAccount.getIdentifier()],
      ['name', childWalletName],
      ['type', WalletType.fromDescriptor('Pk')],
      ['address', simpleWallet.address.plain()],
      ['publicKey', account.publicKey],
      ['encPrivate', simpleWallet.encryptedPrivateKey.encryptedKey],
      ['encIv', simpleWallet.encryptedPrivateKey.iv],
      ['path', ''],
      ['isMultisig', false]
    ]))
  }
}
