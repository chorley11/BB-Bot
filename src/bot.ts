import 'dotenv/config';
import { createLogger, format, transports, Logger } from 'winston';
import { loadConfig, AppConfig } from './config.js';
import { SuiWalletManager, WalletManager } from './wallet.js';
import { BluefinClient } from './bluefin-client.js';
import { TWAPStrategy } from './twap.js';

class BuybackBot {
  private config: AppConfig;
  private logger: Logger;
  private wallet: WalletManager;
  private bluefinClient: BluefinClient;
  private twapStrategy: TWAPStrategy;
  private shutdownHandlers: (() => Promise<void>)[] = [];

  constructor() {
    // Initialize logger first
    this.logger = this.createLogger();

    try {
      // Load configuration
      this.config = loadConfig();
      this.logger.info('Configuration loaded successfully');

      // Initialize wallet
      this.wallet = this.initializeWallet();
      this.logger.info(`Wallet initialized: ${this.wallet.getAddress()}`);

      // Initialize Bluefin client
      this.bluefinClient = new BluefinClient(
        this.wallet,
        this.logger,
        this.config.bluefinApiUrl
      );
      this.logger.info('Bluefin client initialized');

      // Initialize TWAP strategy
      this.twapStrategy = new TWAPStrategy(
        this.config.twap,
        this.bluefinClient,
        this.logger
      );
      this.logger.info('TWAP strategy initialized');

      // Set up graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      this.logger.error(`Failed to initialize bot: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }

  private createLogger(): Logger {
    const logLevel = process.env.LOG_LEVEL || 'info';

    return createLogger({
      level: logLevel,
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.splat(),
        format.json()
      ),
      defaultMeta: { service: 'bluefin-twap-bot' },
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.printf(({ timestamp, level, message, ...meta }) => {
              let msg = `${timestamp} [${level}]: ${message}`;
              if (Object.keys(meta).length > 0) {
                msg += ` ${JSON.stringify(meta)}`;
              }
              return msg;
            })
          ),
        }),
        new transports.File({ filename: 'error.log', level: 'error' }),
        new transports.File({ filename: 'combined.log' }),
      ],
    });
  }

  private initializeWallet(): WalletManager {
    let password = this.config.keystorePassword;

    // If password is not provided, try to prompt (but in continuous mode, it should be in env)
    if (!password) {
      this.logger.warn('KEYSTORE_PASSWORD not set in environment. Please set it for automated operation.');
      // In production, password should be in env vars
      throw new Error('KEYSTORE_PASSWORD must be set in environment variables');
    }

    return new SuiWalletManager(
      this.config.keystorePath,
      password,
      this.config.suiNetwork
    );
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, initiating graceful shutdown...`);

      // Stop TWAP strategy
      if (this.twapStrategy && this.twapStrategy.isActive()) {
        this.logger.info('Stopping TWAP strategy...');
        this.twapStrategy.stop();
      }

      // Execute all registered shutdown handlers
      for (const handler of this.shutdownHandlers) {
        try {
          await handler();
        } catch (error) {
          this.logger.error(`Error in shutdown handler: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      this.logger.info('Shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      this.logger.error(`Uncaught exception: ${error.message}`, error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
      shutdown('unhandledRejection');
    });
  }

  /**
   * Register a shutdown handler
   */
  registerShutdownHandler(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    this.logger.info('Starting Bluefin TWAP Buyback Bot...');
    this.logger.info(`Pair: ${this.config.twap.pair}`);
    this.logger.info(`Total Amount: ${this.config.twap.totalAmount}`);
    this.logger.info(`Duration: ${this.config.twap.duration}s`);
    this.logger.info(`Interval: ${this.config.twap.interval}s`);

    try {
      // Start TWAP strategy
      await this.twapStrategy.start();

      // Keep the process alive
      this.logger.info('Bot is running. Press Ctrl+C to stop.');
      
      // Monitor TWAP state periodically
      const monitorInterval = setInterval(() => {
        const state = this.twapStrategy.getState();
        if (!this.twapStrategy.isActive() && state.remainingAmount === '0') {
          this.logger.info('TWAP execution completed successfully');
          clearInterval(monitorInterval);
          // Optionally exit, or keep running for continuous mode
          // For continuous mode, we might want to restart after completion
        }
      }, 5000); // Check every 5 seconds

      this.registerShutdownHandler(async () => {
        clearInterval(monitorInterval);
      });

    } catch (error) {
      this.logger.error(`Failed to start bot: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get current bot status
   */
  getStatus(): {
    isRunning: boolean;
    twapState: any;
    walletAddress: string;
  } {
    return {
      isRunning: this.twapStrategy.isActive(),
      twapState: this.twapStrategy.getState(),
      walletAddress: this.wallet.getAddress(),
    };
  }
}

// Main entry point
async function main() {
  const bot = new BuybackBot();
  await bot.start();
}

// Run the bot
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Export for potential use as a module
export { BuybackBot };

