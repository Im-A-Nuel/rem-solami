import { getAccount } from "@solana/spl-token";
import { PublicKey, type Connection } from "@solana/web3.js";

/** The few on-chain reads Rem needs. A small interface so everything that uses it can be tested offline. */
export interface NonceState {
  value: string;
  authority: string;
}

export interface TokenAccountState {
  owner: string;
  mint: string;
  delegate: string | null;
  delegatedAmount: bigint;
}

export interface Chain {
  /** Null when the account does not exist or is not a nonce account. */
  getNonce(account: string): Promise<NonceState | null>;
  /** Null when the account does not exist or is not an SPL Token account. */
  getTokenAccount(account: string): Promise<TokenAccountState | null>;
}

export function rpcChain(connection: Connection): Chain {
  return {
    async getNonce(account) {
      const n = await connection.getNonce(new PublicKey(account), "confirmed");
      return n ? { value: n.nonce, authority: n.authorizedPubkey.toBase58() } : null;
    },
    async getTokenAccount(account) {
      try {
        const a = await getAccount(connection, new PublicKey(account), "confirmed");
        return {
          owner: a.owner.toBase58(),
          mint: a.mint.toBase58(),
          delegate: a.delegate ? a.delegate.toBase58() : null,
          delegatedAmount: a.delegatedAmount,
        };
      } catch {
        return null;
      }
    },
  };
}
