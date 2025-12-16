import { WalletManager } from './wallet.js';
import { BluefinOrderParams, BluefinOrderResponse } from './types.js';
import { Logger } from 'winston';

// Bluefin API uses 18 decimals for all numbers
const DECIMALS = 18;
const DECIMAL_MULTIPLIER = BigInt(10 ** DECIMALS);

export class BluefinClient {
  private wallet: WalletManager;
  private logger: Logger;
  private apiUrl: string;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second

  constructor(wallet: WalletManager, logger: Logger, apiUrl?: string) {
    this.wallet = wallet;
    this.logger = logger;
    this.apiUrl = apiUrl || 'https://dapi.api.sui-prod.bluefin.io';
  }

  /**
   * Convert token amount to Bluefin's 18 decimal format
   */
  private toBluefinAmount(amount: string): string {
    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat) || amountFloat < 0) {
      throw new Error(`Invalid amount: ${amount}`);
    }
    const amountBigInt = BigInt(Math.floor(amountFloat * Number(DECIMAL_MULTIPLIER)));
    return amountBigInt.toString();
  }

  /**
   * Convert Bluefin's 18 decimal format back to token amount
   */
  private fromBluefinAmount(amount: string): string {
    const amountBigInt = BigInt(amount);
    const amountFloat = Number(amountBigInt) / Number(DECIMAL_MULTIPLIER);
    return amountFloat.toString();
  }

  /**
   * Place a buy order on Bluefin
   */
  async placeOrder(params: BluefinOrderParams): Promise<BluefinOrderResponse> {
    const { pair, side, size, price, orderType } = params;

    this.logger.info(`Placing ${orderType} ${side} order: ${size} ${pair}`);

    // Convert size to Bluefin format (18 decimals)
    const sizeInDecimals = this.toBluefinAmount(size);
    const priceInDecimals = price ? this.toBluefinAmount(price) : undefined;

    // Prepare order payload
    const orderPayload = {
      pair,
      side,
      size: sizeInDecimals,
      orderType,
      ...(priceInDecimals && { price: priceInDecimals }),
    };

    return this.executeWithRetry(async () => {
      // Note: This is a placeholder implementation
      // The actual Bluefin client library should be used here
      // Based on @fireflyprotocol/bluefin-v2-client-ts documentation
      
      // For now, we'll create a mock implementation that would need to be
      // replaced with actual Bluefin client calls
      const response = await this.callBluefinAPI('/orders', {
        method: 'POST',
        body: JSON.stringify(orderPayload),
      });

      return {
        orderId: response.orderId || `order_${Date.now()}`,
        status: response.status || 'pending',
        filledSize: response.filledSize,
        averagePrice: response.averagePrice,
      };
    });
  }

  /**
   * Get order status
   */
  async getOrderStatus(orderId: string): Promise<BluefinOrderResponse> {
    return this.executeWithRetry(async () => {
      const response = await this.callBluefinAPI(`/orders/${orderId}`, {
        method: 'GET',
      });

      return {
        orderId: response.orderId || orderId,
        status: response.status || 'unknown',
        filledSize: response.filledSize,
        averagePrice: response.averagePrice,
      };
    });
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<void> {
    await this.executeWithRetry(async () => {
      await this.callBluefinAPI(`/orders/${orderId}`, {
        method: 'DELETE',
      });
    });
  }

  /**
   * Get current market price for a pair
   */
  async getMarketPrice(pair: string): Promise<string> {
    return this.executeWithRetry(async () => {
      const response = await this.callBluefinAPI(`/markets/${pair}/price`, {
        method: 'GET',
      });
      
      // Convert from 18 decimals back to readable format
      if (response.price) {
        return this.fromBluefinAmount(response.price);
      }
      throw new Error('Failed to get market price');
    });
  }

  /**
   * Execute API call with retry logic and exponential backoff
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const isRetryable = this.isRetryableError(lastError);

        if (!isRetryable || attempt === this.maxRetries - 1) {
          throw lastError;
        }

        const delay = this.retryDelay * Math.pow(2, attempt);
        this.logger.warn(`Retry attempt ${attempt + 1}/${this.maxRetries} after ${delay}ms: ${lastError.message}`);
        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Unknown error');
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableMessages = [
      'network',
      'timeout',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'rate limit',
      '503',
      '502',
      '500',
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableMessages.some(msg => errorMessage.includes(msg));
  }

  /**
   * Make API call to Bluefin
   * Note: This should be replaced with actual Bluefin client library calls
   */
  private async callBluefinAPI(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.apiUrl}${endpoint}`;
    
    // TODO: Integrate with actual Bluefin client library
    // The @fireflyprotocol/bluefin-v2-client-ts should provide:
    // - Signed order creation
    // - Order placement
    // - Order status monitoring
    // - WebSocket connections for real-time updates
    
    // For now, this is a placeholder that would need actual implementation
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bluefin API error: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

