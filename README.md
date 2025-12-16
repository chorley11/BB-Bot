# Bluefin TWAP Buyback Bot

A TypeScript-based Time-Weighted Average Price (TWAP) buyback bot for executing buy orders on the ALKIMI/USDC pair on Bluefin DEX (Sui blockchain). The bot splits large buy orders into smaller chunks executed at regular intervals to minimize market impact.

## Features

- **TWAP Execution**: Automatically executes buy orders at regular intervals over a specified duration
- **Slippage Protection**: Configurable slippage tolerance for limit orders
- **Order Tracking**: Monitors order execution and calculates average execution price
- **Graceful Shutdown**: Handles interruptions gracefully, stopping orders cleanly
- **Comprehensive Logging**: Detailed logs for monitoring and debugging
- **Error Handling**: Retry logic with exponential backoff for network failures
- **Keystore Wallet Support**: Secure wallet management using Sui keystore files

## Prerequisites

- Node.js 18+ and npm
- TypeScript 5.3+
- A Sui wallet with keystore file
- Sufficient USDC balance for buyback operations
- Sufficient SUI for transaction fees

## Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd "Operation Buyback"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

## Configuration

### Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```env
# Sui Network Configuration
SUI_NETWORK=mainnet

# Wallet Configuration
KEYSTORE_PATH=./wallet.keystore
KEYSTORE_PASSWORD=your_password_here

# Bluefin API Configuration (optional)
BLUEFIN_API_URL=

# Logging
LOG_LEVEL=info
```

**Important Security Notes:**
- Never commit your `.env` file or keystore files to version control
- Use environment variables or secure secret management in production
- The keystore password can be set via `KEYSTORE_PASSWORD` environment variable

### TWAP Configuration

Edit `config/config.json` to configure your TWAP parameters:

```json
{
  "pair": "ALKIMI/USDC",
  "totalAmount": "1000",
  "duration": 3600,
  "interval": 300,
  "slippageTolerance": 0.01,
  "minOrderSize": "10",
  "maxOrderSize": "100"
}
```

**Configuration Parameters:**

- `pair`: Trading pair (e.g., "ALKIMI/USDC")
- `totalAmount`: Total amount of tokens to buy (in token units, not wei)
- `duration`: Total duration for TWAP execution in seconds
- `interval`: Time between orders in seconds
- `slippageTolerance`: Maximum acceptable slippage (0.01 = 1%)
- `minOrderSize`: Minimum order size in token units
- `maxOrderSize`: Maximum order size in token units

**Example Calculation:**
- `totalAmount`: 1000 ALKIMI
- `duration`: 3600 seconds (1 hour)
- `interval`: 300 seconds (5 minutes)
- Result: 12 orders of ~83.33 ALKIMI every 5 minutes

## Usage

### Development Mode

Run the bot in development mode with TypeScript:

```bash
npm run dev
```

### Production Mode

1. Build the project:
   ```bash
   npm run build
   ```

2. Run the compiled bot:
   ```bash
   npm start
   ```

### Stopping the Bot

Press `Ctrl+C` to gracefully stop the bot. The bot will:
- Stop placing new orders
- Complete any pending operations
- Log final statistics
- Exit cleanly

## How It Works

1. **Initialization**: The bot loads configuration, initializes the wallet, and connects to Bluefin DEX
2. **Order Calculation**: Calculates the number of orders and order size based on duration and interval
3. **Order Execution**: Places limit buy orders at regular intervals with slippage-adjusted prices
4. **Monitoring**: Tracks order execution, calculates average price, and logs progress
5. **Completion**: Stops automatically when all orders are executed or duration expires

## Architecture

```
┌─────────────┐
│  Config     │
│  (JSON/ENV) │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│  Bot.ts     │────▶│  TWAP.ts    │
│ (Orchestrator)    │  (Strategy) │
└──────┬──────┘     └──────┬───────┘
       │                   │
       ▼                   ▼
┌─────────────┐     ┌──────────────┐
│  Wallet.ts  │     │ Bluefin.ts   │
│  (Sui SDK)  │     │  (DEX API)   │
└─────────────┘     └──────────────┘
```

## File Structure

```
/
├── src/
│   ├── bot.ts              # Main bot orchestrator
│   ├── twap.ts             # TWAP strategy implementation
│   ├── bluefin-client.ts   # Bluefin client wrapper
│   ├── wallet.ts           # Wallet/keystore management
│   ├── config.ts           # Configuration loader
│   └── types.ts            # TypeScript type definitions
├── config/
│   └── config.json         # TWAP parameters configuration
├── .env                    # Environment variables (create from .env.example)
├── package.json
├── tsconfig.json
└── README.md
```

## Logging

The bot uses Winston for logging with the following levels:
- `error`: Errors and exceptions
- `warn`: Warnings and retries
- `info`: General information and order execution
- `debug`: Detailed debugging information

Logs are written to:
- Console (with colors)
- `combined.log` (all logs)
- `error.log` (errors only)

Set `LOG_LEVEL` in `.env` to control verbosity.

## Error Handling

The bot includes robust error handling:

- **Network Failures**: Automatic retry with exponential backoff
- **Order Failures**: Logs errors but continues with next order
- **Insufficient Balance**: Logs error and stops gracefully
- **Invalid Configuration**: Validates config on startup and exits with clear error messages

## Bluefin API Integration

**Note**: The current implementation includes a placeholder for Bluefin API integration. You'll need to:

1. Install the actual Bluefin client library:
   ```bash
   npm install @fireflyprotocol/bluefin-v2-client-ts
   ```

2. Update `src/bluefin-client.ts` to use the actual Bluefin client library methods for:
   - Order placement
   - Order status monitoring
   - Market price queries
   - WebSocket connections for real-time updates

3. Ensure proper authentication and signing with your wallet

## Important Notes

### Bluefin API Conventions

- All numbers use 18 decimals (e.g., `2 x 10^18` for 2 tokens)
- The bot automatically converts between token units and Bluefin's decimal format

### Gas Management

- Ensure your wallet has sufficient SUI for transaction fees
- Each order placement requires gas fees
- Monitor your SUI balance regularly

### Rate Limiting

- The bot respects Bluefin API rate limits
- Retry logic includes exponential backoff to avoid overwhelming the API

### Security Best Practices

1. **Never commit sensitive files:**
   - `.env` file
   - Keystore files (`*.keystore`)
   - Private keys

2. **Use secure password storage:**
   - Use environment variables for passwords
   - Consider using secret management services in production

3. **Test on testnet first:**
   - Always test your configuration on Sui testnet before using mainnet
   - Verify order execution and slippage behavior

## Troubleshooting

### "Keystore file not found"
- Verify `KEYSTORE_PATH` in `.env` points to your keystore file
- Ensure the file path is correct (relative or absolute)

### "Failed to load keystore"
- Check that your keystore file is valid JSON
- Verify the keystore format matches Sui's expected format
- Ensure `KEYSTORE_PASSWORD` is correct

### "Insufficient balance"
- Check your USDC balance is sufficient for the total buyback amount
- Ensure you have SUI for gas fees
- Verify the wallet address matches your keystore

### "Bluefin API error"
- Check your network connection
- Verify Bluefin API is accessible
- Check if Bluefin API URL is correct (if using custom endpoint)
- Review API rate limits

### Orders not executing
- Check market liquidity for the pair
- Verify slippage tolerance is reasonable
- Check order size is within min/max bounds
- Review logs for specific error messages

## Development

### Building

```bash
npm run build
```

### Cleaning Build Artifacts

```bash
npm run clean
```

### Type Checking

TypeScript will check types during build. For continuous type checking:

```bash
npx tsc --watch
```

## License

MIT

## Support

For issues related to:
- **Bluefin API**: Consult [Bluefin Documentation](https://bluefin-exchange.readme.io)
- **Sui Blockchain**: Consult [Sui Documentation](https://docs.sui.io)
- **This Bot**: Review logs and configuration, check GitHub issues

## Disclaimer

This bot is provided as-is for educational and development purposes. Trading cryptocurrencies involves risk. Always:
- Test thoroughly on testnet before using real funds
- Start with small amounts
- Monitor the bot closely
- Understand the risks involved in automated trading

