import { readFileSync } from 'fs';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromB64 } from '@mysten/sui/utils';
import * as readline from 'readline';

export interface WalletManager {
  getKeypair(): Ed25519Keypair;
  getClient(): SuiClient;
  getAddress(): string;
}

export class SuiWalletManager implements WalletManager {
  private keypair: Ed25519Keypair;
  private client: SuiClient;
  private address: string;

  constructor(keystorePath: string, password?: string, network: string = 'mainnet') {
    // Load and decrypt keystore
    const keypair = this.loadKeystore(keystorePath, password);
    this.keypair = keypair;
    this.address = keypair.toSuiAddress();

    // Initialize Sui client
    const rpcUrl = this.getRpcUrl(network);
    this.client = new SuiClient({ url: rpcUrl });
  }

  private loadKeystore(keystorePath: string, password?: string): Ed25519Keypair {
    try {
      // Support loading keystore from environment variable (Railway-friendly)
      // If KEYSTORE_DATA is set, use it directly (base64 encoded JSON)
      let keystoreData: string;
      if (process.env.KEYSTORE_DATA) {
        keystoreData = Buffer.from(process.env.KEYSTORE_DATA, 'base64').toString('utf-8');
      } else {
        // Otherwise, load from file path
        keystoreData = readFileSync(keystorePath, 'utf-8');
      }
      
      const keystore = JSON.parse(keystoreData);

      // Handle different keystore formats
      let privateKeyBytes: Uint8Array;

      if (keystore.privateKey) {
        // Direct private key format
        privateKeyBytes = fromB64(keystore.privateKey);
      } else if (keystore.encryptedPrivateKey && password) {
        // Encrypted keystore - would need decryption logic here
        // For now, assume it's a base64 encoded private key
        throw new Error('Encrypted keystore decryption not yet implemented. Please use unencrypted keystore format.');
      } else {
        // Try to extract from sui keypair format
        if (keystore.schema === 'ED25519' && keystore.privateKey) {
          privateKeyBytes = fromB64(keystore.privateKey);
        } else {
          throw new Error('Unsupported keystore format');
        }
      }

      // Create keypair from private key
      return Ed25519Keypair.fromSecretKey(privateKeyBytes);
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        throw new Error(`Keystore file not found at: ${keystorePath}`);
      }
      throw new Error(`Failed to load keystore: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getRpcUrl(network: string): string {
    switch (network.toLowerCase()) {
      case 'mainnet':
        return getFullnodeUrl('mainnet');
      case 'testnet':
        return getFullnodeUrl('testnet');
      case 'devnet':
        return getFullnodeUrl('devnet');
      default:
        // Assume it's a custom RPC URL
        if (network.startsWith('http')) {
          return network;
        }
        return getFullnodeUrl('mainnet');
    }
  }

  getKeypair(): Ed25519Keypair {
    return this.keypair;
  }

  getClient(): SuiClient {
    return this.client;
  }

  getAddress(): string {
    return this.address;
  }

  static async promptPassword(): Promise<string> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question('Enter keystore password: ', (password) => {
        rl.close();
        resolve(password);
      });
    });
  }
}

