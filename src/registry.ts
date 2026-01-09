import { Connection, PublicKey } from '@solana/web3.js';
import { DexHandler, QuoteRequest, QuoteResponse } from './types.js';
import { PumpHandler } from './dex/pump.js';
import { RaydiumCPMMHandler } from './dex/raydium-cpmm.js';
import { RaydiumCLMMHandler } from './dex/raydium-clmm.js';
import { OrcaHandler } from './dex/orca.js';
import { MeteoraHandler } from './dex/meteora.js';
import { MeteoraDAMMHandler } from './dex/meteora-damm.js';

export class DexRegistry {
    private handlers: DexHandler[];

    constructor() {
        this.handlers = [
            new PumpHandler(),
            new RaydiumCPMMHandler(),
            new RaydiumCLMMHandler(),
            new OrcaHandler(),
            new MeteoraHandler(),
            new MeteoraDAMMHandler()
        ];
    }

    async getQuote(connection: Connection, request: QuoteRequest): Promise<QuoteResponse> {
        // 1. Detect Dex via Owner
        const accountInfo = await connection.getAccountInfo(request.poolAddress);
        if (!accountInfo) throw new Error('Pool account not found');

        const owner = accountInfo.owner;

        // Find handler
        const handler = this.handlers.find(h => h.programIds.some(pid => pid.equals(owner)));

        if (!handler) {
            throw new Error(`Unknown DEX type for owner: ${owner.toBase58()}`);
        }

        // console.log(`Detected DEX: ${handler.dexType}`);

        return handler.getQuote(connection, request);
    }
}
