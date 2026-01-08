import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

export enum DexType {
    PumpSwap = 'PumpSwap',
    RaydiumCPMM = 'Raydium CPMM',
    RaydiumCLMM = 'Raydium CLMM',
    OrcaWhirlpool = 'Orca Whirlpools',
    MeteoraDLMM = 'Meteora DLMM',
    Unknown = 'Unknown'
}

export interface QuoteRequest {
    poolAddress: PublicKey;
    inputMint: PublicKey;
    inputAmount: BN;
    slippagePercent: number; // e.g., 1 for 1%
    overrideReserves?: {
        reserveA: BN; // Corresponds to Sol (Pump) or TokenA
        reserveB: BN; // Corresponds to Token (Pump) or TokenB
    };
}

export interface QuoteResponse {
    dexType: DexType;
    outputMint: string;
    estimatedOutputAmount: BN;
    minOutputAmount: BN;
    priceImpact: number; // percentage
    feePaid: BN;
    reserves: [BN, BN];
}

export interface DexHandler {
    dexType: DexType;
    programIds: PublicKey[];
    getQuote(connection: any, request: QuoteRequest): Promise<QuoteResponse>;
}
