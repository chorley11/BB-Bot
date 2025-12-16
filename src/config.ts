import { readFileSync } from 'fs';
import { join } from 'path';
import { TWAPConfig } from './types.js';

export interface AppConfig {
  suiNetwork: string;
  keystorePath: string;
  keystorePassword?: string;
  bluefinApiUrl?: string;
  logLevel: string;
  twap: TWAPConfig;
}

export function loadConfig(): AppConfig {
  // Load environment variables
  const suiNetwork = process.env.SUI_NETWORK || 'mainnet';
  const keystorePath = process.env.KEYSTORE_PATH || './wallet.keystore';
  const keystorePassword = process.env.KEYSTORE_PASSWORD;
  const bluefinApiUrl = process.env.BLUEFIN_API_URL;
  const logLevel = process.env.LOG_LEVEL || 'info';

  // Load TWAP config from JSON file
  let twapConfig: TWAPConfig;
  try {
    const configPath = join(process.cwd(), 'config', 'config.json');
    const configFile = readFileSync(configPath, 'utf-8');
    twapConfig = JSON.parse(configFile);
  } catch (error) {
    throw new Error(`Failed to load config/config.json: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Validate TWAP config
  validateTWAPConfig(twapConfig);

  return {
    suiNetwork,
    keystorePath,
    keystorePassword,
    bluefinApiUrl,
    logLevel,
    twap: twapConfig,
  };
}

function validateTWAPConfig(config: TWAPConfig): void {
  if (!config.pair) {
    throw new Error('TWAP config: pair is required');
  }
  if (!config.totalAmount || parseFloat(config.totalAmount) <= 0) {
    throw new Error('TWAP config: totalAmount must be a positive number');
  }
  if (!config.duration || config.duration <= 0) {
    throw new Error('TWAP config: duration must be a positive number');
  }
  if (!config.interval || config.interval <= 0) {
    throw new Error('TWAP config: interval must be a positive number');
  }
  if (config.interval > config.duration) {
    throw new Error('TWAP config: interval cannot be greater than duration');
  }
  if (config.slippageTolerance < 0 || config.slippageTolerance > 1) {
    throw new Error('TWAP config: slippageTolerance must be between 0 and 1');
  }
  if (!config.minOrderSize || parseFloat(config.minOrderSize) <= 0) {
    throw new Error('TWAP config: minOrderSize must be a positive number');
  }
  if (!config.maxOrderSize || parseFloat(config.maxOrderSize) <= 0) {
    throw new Error('TWAP config: maxOrderSize must be a positive number');
  }
  if (parseFloat(config.minOrderSize) > parseFloat(config.maxOrderSize)) {
    throw new Error('TWAP config: minOrderSize cannot be greater than maxOrderSize');
  }
}

