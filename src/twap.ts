import { TWAPConfig, TWAPState, OrderExecution, BluefinOrderParams } from './types.js';
import { BluefinClient } from './bluefin-client.js';
import { Logger } from 'winston';

export class TWAPStrategy {
  private config: TWAPConfig;
  private bluefinClient: BluefinClient;
  private logger: Logger;
  private state: TWAPState;
  private intervalTimer?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(config: TWAPConfig, bluefinClient: BluefinClient, logger: Logger) {
    this.config = config;
    this.bluefinClient = bluefinClient;
    this.logger = logger;
    this.state = this.initializeState();
  }

  private initializeState(): TWAPState {
    const now = Date.now();
    return {
      totalAmount: this.config.totalAmount,
      remainingAmount: this.config.totalAmount,
      executedAmount: '0',
      orders: [],
      startTime: now,
      endTime: now + (this.config.duration * 1000),
    };
  }

  /**
   * Calculate the number of orders to place
   */
  private calculateNumberOfOrders(): number {
    return Math.floor(this.config.duration / this.config.interval);
  }

  /**
   * Calculate the size for each order
   */
  private calculateOrderSize(): string {
    const numberOfOrders = this.calculateNumberOfOrders();
    if (numberOfOrders === 0) {
      throw new Error('Duration must be greater than interval');
    }

    const totalAmountFloat = parseFloat(this.config.totalAmount);
    const orderSize = totalAmountFloat / numberOfOrders;

    // Ensure order size is within min/max bounds
    const minSize = parseFloat(this.config.minOrderSize);
    const maxSize = parseFloat(this.config.maxOrderSize);

    if (orderSize < minSize) {
      this.logger.warn(`Calculated order size ${orderSize} is below minimum ${minSize}, using minimum`);
      return this.config.minOrderSize;
    }

    if (orderSize > maxSize) {
      this.logger.warn(`Calculated order size ${orderSize} is above maximum ${maxSize}, using maximum`);
      return this.config.maxOrderSize;
    }

    return orderSize.toFixed(8);
  }

  /**
   * Get current market price for slippage calculation
   */
  private async getCurrentPrice(): Promise<number> {
    try {
      const price = await this.bluefinClient.getMarketPrice(this.config.pair);
      return parseFloat(price);
    } catch (error) {
      this.logger.error(`Failed to get market price: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Execute a single TWAP order
   */
  private async executeOrder(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const remainingFloat = parseFloat(this.state.remainingAmount);
    if (remainingFloat <= 0) {
      this.logger.info('TWAP execution complete: no remaining amount');
      this.stop();
      return;
    }

    // Check if we've exceeded the end time
    if (Date.now() >= this.state.endTime) {
      this.logger.info('TWAP execution complete: duration exceeded');
      this.stop();
      return;
    }

    // Calculate order size (use remaining amount if it's less than calculated size)
    const calculatedSize = this.calculateOrderSize();
    const orderSize = Math.min(parseFloat(calculatedSize), remainingFloat).toFixed(8);

    if (parseFloat(orderSize) < parseFloat(this.config.minOrderSize)) {
      // If remaining amount is less than min order size, execute it all
      if (remainingFloat > 0.0001) { // Only if there's a meaningful amount left
        this.logger.info(`Executing final order with remaining amount: ${orderSize}`);
      } else {
        this.logger.info('Remaining amount too small to execute');
        this.stop();
        return;
      }
    }

    try {
      // Get current market price for limit order
      const currentPrice = await this.getCurrentPrice();
      const slippageAdjustedPrice = currentPrice * (1 + this.config.slippageTolerance);

      // Create order execution record
      const orderExecution: OrderExecution = {
        orderId: '',
        timestamp: Date.now(),
        size: orderSize,
        price: slippageAdjustedPrice.toFixed(8),
        status: 'pending',
      };

      this.logger.info(`Executing TWAP order: ${orderSize} ${this.config.pair} at price ${slippageAdjustedPrice.toFixed(8)}`);

      // Place order
      const orderParams: BluefinOrderParams = {
        pair: this.config.pair,
        side: 'buy',
        size: orderSize,
        price: slippageAdjustedPrice.toFixed(8),
        orderType: 'limit',
      };

      const response = await this.bluefinClient.placeOrder(orderParams);
      
      // Update order execution record
      orderExecution.orderId = response.orderId;
      orderExecution.status = response.status === 'filled' ? 'filled' : 'pending';
      orderExecution.filledSize = response.filledSize;
      orderExecution.averagePrice = response.averagePrice;

      // Update state
      this.state.orders.push(orderExecution);
      
      if (response.filledSize) {
        const filledFloat = parseFloat(response.filledSize);
        this.state.executedAmount = (parseFloat(this.state.executedAmount) + filledFloat).toFixed(8);
        this.state.remainingAmount = (remainingFloat - filledFloat).toFixed(8);
      } else {
        // If not filled yet, assume it will be filled with the order size
        this.state.executedAmount = (parseFloat(this.state.executedAmount) + parseFloat(orderSize)).toFixed(8);
        this.state.remainingAmount = (remainingFloat - parseFloat(orderSize)).toFixed(8);
      }

      this.logger.info(`Order placed: ${response.orderId}, Status: ${response.status}`);
      this.logger.info(`TWAP Progress: ${this.state.executedAmount}/${this.state.totalAmount} executed`);

      // Calculate and update average execution price
      this.updateAverageExecutionPrice();

    } catch (error) {
      this.logger.error(`Failed to execute TWAP order: ${error instanceof Error ? error.message : String(error)}`);
      // Continue with next order even if one fails
    }
  }

  /**
   * Update average execution price based on filled orders
   */
  private updateAverageExecutionPrice(): void {
    const filledOrders = this.state.orders.filter(
      o => o.status === 'filled' && o.filledSize && o.averagePrice
    );

    if (filledOrders.length === 0) {
      return;
    }

    let totalValue = 0;
    let totalSize = 0;

    for (const order of filledOrders) {
      if (order.filledSize && order.averagePrice) {
        const size = parseFloat(order.filledSize);
        const price = parseFloat(order.averagePrice);
        totalValue += size * price;
        totalSize += size;
      }
    }

    if (totalSize > 0) {
      this.state.averageExecutionPrice = (totalValue / totalSize).toFixed(8);
      this.logger.info(`TWAP Average Execution Price: ${this.state.averageExecutionPrice}`);
    }
  }

  /**
   * Start TWAP execution
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('TWAP strategy is already running');
      return;
    }

    this.isRunning = true;
    this.state = this.initializeState();

    const numberOfOrders = this.calculateNumberOfOrders();
    const orderSize = this.calculateOrderSize();

    this.logger.info('Starting TWAP execution');
    this.logger.info(`Configuration: ${this.config.totalAmount} ${this.config.pair} over ${this.config.duration}s`);
    this.logger.info(`Order schedule: ${numberOfOrders} orders of ~${orderSize} ${this.config.pair.split('/')[0]} every ${this.config.interval}s`);

    // Execute first order immediately
    await this.executeOrder();

    // Schedule subsequent orders
    this.intervalTimer = setInterval(async () => {
      await this.executeOrder();
    }, this.config.interval * 1000);
  }

  /**
   * Stop TWAP execution
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = undefined;
    }

    this.logger.info('TWAP execution stopped');
    this.logFinalStats();
  }

  /**
   * Get current TWAP state
   */
  getState(): TWAPState {
    return { ...this.state };
  }

  /**
   * Check if TWAP is currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Log final statistics
   */
  private logFinalStats(): void {
    const filledOrders = this.state.orders.filter(o => o.status === 'filled');
    const pendingOrders = this.state.orders.filter(o => o.status === 'pending');

    this.logger.info('=== TWAP Execution Summary ===');
    this.logger.info(`Total Orders: ${this.state.orders.length}`);
    this.logger.info(`Filled Orders: ${filledOrders.length}`);
    this.logger.info(`Pending Orders: ${pendingOrders.length}`);
    this.logger.info(`Total Executed: ${this.state.executedAmount} ${this.config.pair.split('/')[0]}`);
    this.logger.info(`Remaining: ${this.state.remainingAmount} ${this.config.pair.split('/')[0]}`);
    
    if (this.state.averageExecutionPrice) {
      this.logger.info(`Average Execution Price: ${this.state.averageExecutionPrice}`);
    }
  }
}

