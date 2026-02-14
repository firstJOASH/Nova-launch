# Design: Stellar Token Deployer

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React/TS)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Token Deploy │  │   Wallet     │  │  Transaction │      │
│  │     Form     │  │  Connection  │  │   History    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Integration Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Stellar SDK  │  │   Freighter  │  │     IPFS     │      │
│  │              │  │    Wallet    │  │   (Pinata)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Stellar Network (Soroban)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          Token Factory Contract (Rust)               │   │
│  │  - create_token()                                    │   │
│  │  - mint_tokens()                                     │   │
│  │  - set_metadata()                                    │   │
│  │  - collect_fees()                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Deployed Token Instances                     │   │
│  │  (Standard Soroban Token Contract)                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Component Responsibilities

**Frontend**:
- User interface for token deployment
- Form validation and user input handling
- Wallet connection management
- Transaction status tracking
- IPFS upload coordination

**Integration Layer**:
- Stellar SDK: Contract invocation, transaction building
- Freighter Wallet: Transaction signing, account access
- IPFS Service: Metadata storage and retrieval

**Smart Contracts**:
- Token Factory: Orchestrates token deployment, fee collection
- Token Instances: Standard Soroban tokens with custom parameters

## 2. Smart Contract Design (Rust/Soroban)

### 2.1 Token Factory Contract

**Contract State**:
```rust
pub struct FactoryState {
    pub admin: Address,              // Platform admin
    pub treasury: Address,           // Fee collection wallet
    pub base_fee: i128,              // Base deployment fee (stroops)
    pub metadata_fee: i128,          // Metadata add-on fee (stroops)
    pub deployed_tokens: Vec<Address>, // Registry of deployed tokens
}
```

**Core Functions**:

```rust
// Deploy a new token with basic parameters
pub fn create_token(
    env: Env,
    creator: Address,
    name: String,
    symbol: String,
    decimals: u32,
    initial_supply: i128,
    fee_payment: i128,
) -> Address;

// Add metadata to an existing token
pub fn set_metadata(
    env: Env,
    token_address: Address,
    admin: Address,
    metadata_uri: String,
    fee_payment: i128,
) -> Result<(), Error>;

// Mint additional tokens (post-deployment)
pub fn mint_tokens(
    env: Env,
    token_address: Address,
    admin: Address,
    to: Address,
    amount: i128,
    fee_payment: i128,
) -> Result<(), Error>;

// Update fee structure (admin only)
pub fn update_fees(
    env: Env,
    admin: Address,
    base_fee: Option<i128>,
    metadata_fee: Option<i128>,
) -> Result<(), Error>;

// Get deployed token info
pub fn get_token_info(
    env: Env,
    token_address: Address,
) -> TokenInfo;
```

**Data Structures**:
```rust
pub struct TokenInfo {
    pub address: Address,
    pub creator: Address,
    pub name: String,
    pub symbol: String,
    pub decimals: u32,
    pub total_supply: i128,
    pub metadata_uri: Option<String>,
    pub created_at: u64,
}

pub enum Error {
    InsufficientFee,
    Unauthorized,
    InvalidParameters,
    TokenNotFound,
    MetadataAlreadySet,
}
```

### 2.2 Token Instance Contract

Uses standard `soroban-token-sdk` implementation with:
- Standard token interface (transfer, balance, approve, etc.)
- Admin-controlled minting capability
- Metadata storage extension

## 3. Frontend Design (React/TypeScript)

### 3.1 Component Structure

```
src/
├── components/
│   ├── TokenDeployForm/
│   │   ├── BasicInfoStep.tsx
│   │   ├── MetadataStep.tsx
│   │   ├── ReviewStep.tsx
│   │   └── index.tsx
│   ├── WalletConnect/
│   │   ├── ConnectButton.tsx
│   │   └── WalletInfo.tsx
│   ├── TransactionHistory/
│   │   ├── TokenList.tsx
│   │   └── TokenCard.tsx
│   └── NetworkToggle/
│       └── index.tsx
├── services/
│   ├── stellar.ts          // Stellar SDK integration
│   ├── wallet.ts           // Freighter wallet integration
│   ├── ipfs.ts             // IPFS upload service
│   └── factory.ts          // Factory contract interactions
├── hooks/
│   ├── useWallet.ts
│   ├── useTokenDeploy.ts
│   └── useTransactionHistory.ts
├── types/
│   └── index.ts
└── utils/
    ├── validation.ts
    └── formatting.ts
```

### 3.2 Key Interfaces

```typescript
interface TokenDeployParams {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  adminWallet: string;
  metadata?: {
    image: File;
    description: string;
  };
}

interface DeploymentResult {
  tokenAddress: string;
  transactionHash: string;
  totalFee: string;
  timestamp: number;
}

interface WalletState {
  connected: boolean;
  address: string | null;
  network: 'testnet' | 'mainnet';
}

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  creator: string;
  metadataUri?: string;
  deployedAt: number;
  transactionHash: string;
}
```

### 3.3 Service Layer APIs

**Stellar Service** (`services/stellar.ts`):
```typescript
class StellarService {
  // Initialize with network configuration
  constructor(network: 'testnet' | 'mainnet');
  
  // Build and submit token deployment transaction
  async deployToken(params: TokenDeployParams): Promise<DeploymentResult>;
  
  // Mint additional tokens
  async mintTokens(
    tokenAddress: string,
    recipient: string,
    amount: string
  ): Promise<string>;
  
  // Get token information
  async getTokenInfo(tokenAddress: string): Promise<TokenInfo>;
  
  // Get transaction details
  async getTransaction(hash: string): Promise<TransactionDetails>;
}
```

**IPFS Service** (`services/ipfs.ts`):
```typescript
class IPFSService {
  // Upload metadata to IPFS
  async uploadMetadata(
    image: File,
    description: string,
    tokenName: string
  ): Promise<string>; // Returns IPFS URI
  
  // Retrieve metadata from IPFS
  async getMetadata(uri: string): Promise<TokenMetadata>;
}
```

**Wallet Service** (`services/wallet.ts`):
```typescript
class WalletService {
  // Connect to Freighter wallet
  async connect(): Promise<string>; // Returns wallet address
  
  // Disconnect wallet
  disconnect(): void;
  
  // Sign transaction
  async signTransaction(xdr: string): Promise<string>;
  
  // Get wallet balance
  async getBalance(address: string): Promise<string>;
  
  // Check if Freighter is installed
  isInstalled(): boolean;
}
```

## 4. Data Flow

### 4.1 Token Deployment Flow

1. **User Input**: User fills form with token parameters
2. **Validation**: Frontend validates all inputs
3. **Metadata Upload** (optional): 
   - Upload image to IPFS
   - Generate metadata JSON
   - Get IPFS URI
4. **Fee Calculation**: Calculate total fee based on selected features
5. **Transaction Building**:
   - Create contract invocation for `create_token`
   - Include fee payment
   - Add metadata URI if applicable
6. **Wallet Signing**: Request signature from Freighter
7. **Submission**: Submit signed transaction to Stellar network
8. **Confirmation**: Wait for transaction confirmation
9. **Result Display**: Show token address and transaction details
10. **History Update**: Store deployment info locally

### 4.2 State Management

Using React Context + Hooks:

```typescript
// Wallet Context
interface WalletContextType {
  wallet: WalletState;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: (network: 'testnet' | 'mainnet') => void;
}

// Deployment Context
interface DeploymentContextType {
  isDeploying: boolean;
  currentStep: number;
  deployToken: (params: TokenDeployParams) => Promise<DeploymentResult>;
  reset: () => void;
}

// History Context
interface HistoryContextType {
  tokens: TokenInfo[];
  loading: boolean;
  refresh: () => Promise<void>;
}
```

## 5. Fee Structure Implementation

### 5.1 Fee Calculation

```typescript
function calculateFee(params: TokenDeployParams): {
  baseFee: number;
  metadataFee: number;
  totalFee: number;
} {
  const baseFee = 7; // 7 XLM base fee
  const metadataFee = params.metadata ? 3 : 0; // 3 XLM for metadata
  const totalFee = baseFee + metadataFee;
  
  return { baseFee, metadataFee, totalFee };
}
```

### 5.2 Fee Collection

Fees are collected in the factory contract:
- User sends fee payment as part of transaction
- Factory contract validates fee amount
- Fee is transferred to treasury wallet
- Transaction proceeds only if fee is sufficient

## 6. Error Handling

### 6.1 Frontend Error Scenarios

| Error | Cause | User Message | Recovery Action |
|-------|-------|--------------|-----------------|
| Wallet Not Connected | User not connected | "Please connect your wallet" | Show connect button |
| Insufficient Balance | Not enough XLM | "Insufficient XLM balance for fees" | Show required amount |
| Invalid Input | Form validation failed | Specific field error | Highlight field |
| IPFS Upload Failed | Network/service issue | "Failed to upload image. Please try again" | Retry button |
| Transaction Failed | Network/contract error | "Transaction failed: [reason]" | Show details, retry |
| Wallet Rejected | User cancelled | "Transaction cancelled" | Return to form |

### 6.2 Contract Error Handling

```rust
pub enum Error {
    InsufficientFee,      // Fee payment too low
    Unauthorized,         // Caller not authorized
    InvalidParameters,    // Invalid token parameters
    TokenNotFound,        // Token address not found
    MetadataAlreadySet,   // Metadata already exists
}
```

## 7. Security Considerations

### 7.1 Input Validation

**Frontend**:
- Token name: 1-32 characters, alphanumeric + spaces
- Symbol: 1-12 characters, uppercase letters
- Decimals: 0-18
- Supply: Positive number, max 2^63-1
- Wallet address: Valid Stellar address format

**Contract**:
- Validate all parameters before token creation
- Check fee payment amount
- Verify caller authorization for admin functions
- Prevent overflow in supply calculations

### 7.2 Access Control

- Only token admin can mint additional tokens
- Only factory admin can update fee structure
- Treasury address can only be changed by factory admin

### 7.3 Fee Protection

- Minimum fee enforced at contract level
- Fee payment validated before execution
- No refunds for failed deployments (network fees consumed)

## 8. Testing Strategy

### 8.1 Property-Based Testing Framework

**Framework**: `fast-check` for TypeScript, `proptest` for Rust

### 8.2 Correctness Properties

#### Property 1: Token Creation Atomicity
**Validates: Requirements 2.1**

For any valid token deployment parameters, either:
- Token is created AND fees are collected AND tokens are minted to creator, OR
- Transaction fails AND no state changes occur

```typescript
property('Token creation is atomic', async () => {
  fc.assert(fc.asyncProperty(
    validTokenParams(),
    async (params) => {
      const initialState = await captureState();
      try {
        const result = await deployToken(params);
        // If successful, all effects must be present
        assert(tokenExists(result.tokenAddress));
        assert(feeCollected(params.fee));
        assert(balanceOf(params.creator, result.tokenAddress) === params.supply);
      } catch (error) {
        // If failed, no state changes
        const finalState = await captureState();
        assert(statesEqual(initialState, finalState));
      }
    }
  ));
});
```

#### Property 2: Fee Calculation Consistency
**Validates: Requirements 3**

For any deployment parameters, the calculated fee must match the fee structure:
- Base deployment = 5-10 XLM
- With metadata = base + 2-5 XLM

```typescript
property('Fee calculation matches fee structure', () => {
  fc.assert(fc.property(
    tokenParamsGenerator(),
    (params) => {
      const fee = calculateFee(params);
      assert(fee.baseFee >= 5 && fee.baseFee <= 10);
      if (params.metadata) {
        assert(fee.metadataFee >= 2 && fee.metadataFee <= 5);
      } else {
        assert(fee.metadataFee === 0);
      }
      assert(fee.totalFee === fee.baseFee + fee.metadataFee);
    }
  ));
});
```

#### Property 3: Supply Conservation
**Validates: Requirements 2.1, 2.4**

For any token, the total supply must equal the sum of all balances at all times:
- After initial deployment: supply = creator balance
- After minting: new supply = old supply + minted amount
- After transfers: supply remains constant

```typescript
property('Total supply equals sum of balances', async () => {
  fc.assert(fc.asyncProperty(
    tokenOperationsSequence(),
    async (operations) => {
      let expectedSupply = 0;
      for (const op of operations) {
        if (op.type === 'deploy') {
          expectedSupply = op.initialSupply;
        } else if (op.type === 'mint') {
          expectedSupply += op.amount;
        }
        const actualSupply = await getTotalSupply(op.tokenAddress);
        const balancesSum = await sumAllBalances(op.tokenAddress);
        assert(actualSupply === expectedSupply);
        assert(actualSupply === balancesSum);
      }
    }
  ));
});
```

#### Property 4: Admin-Only Minting
**Validates: Requirements 2.4**

Only the designated admin address can mint new tokens. Any other address attempting to mint must fail.

```typescript
property('Only admin can mint tokens', async () => {
  fc.assert(fc.asyncProperty(
    deployedToken(),
    stellarAddress(),
    fc.nat(),
    async (token, caller, amount) => {
      if (caller === token.admin) {
        // Admin should succeed (if valid amount)
        if (amount > 0 && amount < MAX_SUPPLY) {
          await expect(mint(token.address, caller, amount)).resolves.toBeDefined();
        }
      } else {
        // Non-admin should always fail
        await expect(mint(token.address, caller, amount)).rejects.toThrow('Unauthorized');
      }
    }
  ));
});
```

#### Property 5: Metadata Immutability
**Validates: Requirements 2.3**

Once metadata is set for a token, it cannot be changed or overwritten.

```typescript
property('Metadata cannot be changed once set', async () => {
  fc.assert(fc.asyncProperty(
    deployedTokenWithMetadata(),
    metadataUri(),
    async (token, newUri) => {
      // Attempt to set metadata again should fail
      await expect(
        setMetadata(token.address, token.admin, newUri)
      ).rejects.toThrow('MetadataAlreadySet');
      
      // Original metadata should remain unchanged
      const metadata = await getMetadata(token.address);
      assert(metadata === token.originalMetadataUri);
    }
  ));
});
```

#### Property 6: Fee Payment Validation
**Validates: Requirements 3**

Any deployment or operation with insufficient fee payment must fail without state changes.

```typescript
property('Insufficient fee causes transaction failure', async () => {
  fc.assert(fc.asyncProperty(
    validTokenParams(),
    fc.integer({ min: 0, max: 4 }), // Fee less than minimum
    async (params, insufficientFee) => {
      const initialState = await captureState();
      
      await expect(
        deployToken({ ...params, fee: insufficientFee })
      ).rejects.toThrow('InsufficientFee');
      
      // No state changes should occur
      const finalState = await captureState();
      assert(statesEqual(initialState, finalState));
    }
  ));
});
```

#### Property 7: Wallet Address Validation
**Validates: Requirements 2.1**

All wallet addresses (creator, admin, recipient) must be valid Stellar addresses, or the transaction must fail.

```typescript
property('Invalid addresses cause validation failure', () => {
  fc.assert(fc.property(
    invalidStellarAddress(),
    (invalidAddress) => {
      const params = {
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 7,
        initialSupply: '1000000',
        adminWallet: invalidAddress,
      };
      
      expect(() => validateTokenParams(params)).toThrow('Invalid wallet address');
    }
  ));
});
```

### 8.3 Test Generators

```typescript
// Generator for valid token parameters
const validTokenParams = () => fc.record({
  name: fc.string({ minLength: 1, maxLength: 32 }),
  symbol: fc.string({ minLength: 1, maxLength: 12 }).map(s => s.toUpperCase()),
  decimals: fc.integer({ min: 0, max: 18 }),
  initialSupply: fc.bigInt({ min: 1n, max: BigInt(2**63 - 1) }),
  adminWallet: validStellarAddress(),
  metadata: fc.option(fc.record({
    image: mockFile(),
    description: fc.string({ maxLength: 500 }),
  })),
});

// Generator for valid Stellar addresses
const validStellarAddress = () => fc.string({ minLength: 56, maxLength: 56 })
  .filter(s => /^G[A-Z2-7]{55}$/.test(s));

// Generator for invalid Stellar addresses
const invalidStellarAddress = () => fc.oneof(
  fc.string({ maxLength: 55 }),
  fc.string({ minLength: 57 }),
  fc.string().filter(s => !/^G/.test(s)),
);
```

### 8.4 Unit Tests

**Frontend**:
- Component rendering tests
- Form validation tests
- Service integration tests (mocked)
- Hook behavior tests

**Smart Contracts**:
- Function-level tests for each contract method
- Edge case tests (zero amounts, max values, etc.)
- Access control tests
- Fee validation tests

### 8.5 Integration Tests

- End-to-end deployment flow on testnet
- Wallet connection and signing
- IPFS upload and retrieval
- Transaction history persistence

## 9. Deployment Strategy

### 9.1 Smart Contract Deployment

```bash
# Build contract
cd contracts/token-factory
cargo build --target wasm32-unknown-unknown --release

# Optimize WASM
soroban contract optimize --wasm target/wasm32-unknown-unknown/release/token_factory.wasm

# Deploy to testnet
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/token_factory.wasm \
  --network testnet \
  --source ADMIN_SECRET_KEY

# Initialize factory
soroban contract invoke \
  --id CONTRACT_ID \
  --network testnet \
  --source ADMIN_SECRET_KEY \
  -- initialize \
  --admin ADMIN_ADDRESS \
  --treasury TREASURY_ADDRESS \
  --base_fee 70000000 \
  --metadata_fee 30000000
```

### 9.2 Frontend Deployment

- Build: `npm run build`
- Deploy to: Vercel, Netlify, or IPFS
- Environment variables:
  - `VITE_FACTORY_CONTRACT_ID`
  - `VITE_NETWORK` (testnet/mainnet)
  - `VITE_IPFS_API_KEY`

## 10. Monitoring and Analytics

### 10.1 Metrics to Track

- Total tokens deployed
- Total fees collected
- Average deployment time
- Success/failure rate
- User retention
- Geographic distribution

### 10.2 Error Tracking

- Frontend errors (Sentry)
- Transaction failures
- IPFS upload failures
- Wallet connection issues

## 11. Future Enhancements

### 11.1 Pro Tier Features

**Clawback**:
- Admin can revoke tokens from holders
- Useful for compliance and fraud prevention

**Multi-sig**:
- Require multiple signatures for admin operations
- Enhanced security for high-value tokens

### 11.2 Additional Features

- Token templates (governance, rewards, etc.)
- Batch deployment
- Token management dashboard
- Analytics and insights
- Social features (discovery, profiles)

## 12. Technology Stack Summary

**Smart Contracts**:
- Language: Rust
- Framework: Soroban SDK
- Token Standard: soroban-token-sdk
- Testing: proptest

**Frontend**:
- Framework: React 18
- Language: TypeScript
- Build Tool: Vite
- State Management: React Context + Hooks
- Styling: Tailwind CSS
- Testing: Vitest + fast-check

**Integration**:
- Stellar SDK: @stellar/stellar-sdk
- Wallet: Freighter API
- IPFS: Pinata SDK
- Network: Stellar Testnet/Mainnet

**DevOps**:
- Version Control: Git
- CI/CD: GitHub Actions
- Hosting: Vercel/Netlify
- Monitoring: Sentry

## 13. Development Phases

### Phase 1: Core Infrastructure (Weeks 1-2)
- Smart contract development
- Basic frontend setup
- Wallet integration

### Phase 2: Token Deployment (Weeks 3-4)
- Deploy form implementation
- Transaction handling
- Basic testing

### Phase 3: Metadata & IPFS (Week 5)
- IPFS integration
- Metadata upload flow
- Enhanced UI

### Phase 4: History & Polish (Week 6)
- Transaction history
- Error handling
- UI/UX refinements

### Phase 5: Testing & Launch (Weeks 7-8)
- Comprehensive testing
- Testnet deployment
- Mainnet launch

## 14. Success Criteria

- Token deployment completes in < 10 seconds
- 99% transaction success rate
- Zero critical security vulnerabilities
- All property-based tests pass
- Mobile-responsive on all devices
- Works on 3G connections
