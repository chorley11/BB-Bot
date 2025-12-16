export interface TWAPConfig {
  pair: string;
  totalAmount: string;
  duration: number; // Duration in seconds
  interval: number; // Order interval in seconds
  slippageTolerance: number; // e.g., 0.01 for 1%
  minOrderSize: string;
  maxOrderSize: string;
}

export interface OrderExecution {
  orderId: string;
  timestamp: number;
  size: string;
  price: string;
  status: 'pending' | 'filled' | 'partial' | 'failed';
  filledSize?: string;
  averagePrice?: string;
}

export interface TWAPState {
  totalAmount: string;
  remainingAmount: string;
  executedAmount: string;
  orders: OrderExecution[];
  startTime: number;
  endTime: number;
  averageExecutionPrice?: string;
}

export interface BluefinOrderParams {
  pair: string;
  side: 'buy' | 'sell';
  size: string; // In token units (will be converted to 18 decimals)
  price?: string; // Optional for market orders
  orderType: 'limit' | 'market';
}

export interface BluefinOrderResponse {
  orderId: string;
  status: string;
  filledSize?: string;
  averagePrice?: string;
}

