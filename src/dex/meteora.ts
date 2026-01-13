import { Connection, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { DexHandler, QuoteRequest, QuoteResponse, DexType } from '../types.js';
import { PROGRAM_IDS } from '../utils/constants.js';
import DLMM from '@meteora-ag/dlmm';

import { getMint } from '@solana/spl-token';

export class MeteoraHandler implements DexHandler {
    dexType = DexType.MeteoraDLMM;
    programIds = [PROGRAM_IDS.METEORA_DLMM];

    async getQuote(connection: Connection, request: QuoteRequest): Promise<QuoteResponse> {
        const dlmmPool = await (DLMM as any).create(connection, request.poolAddress);

        const tokenX = dlmmPool.tokenX;
        const tokenY = dlmmPool.tokenY;


        const isXtoY = request.inputMint.equals(tokenX.publicKey);
        const isYtoX = request.inputMint.equals(tokenY.publicKey);

        if (!isXtoY && !isYtoX) {
            throw new Error(`Input mint ${request.inputMint.toBase58()} not in Meteora pool`);
        }


        const swapForY = isXtoY;
        const outputMint = swapForY ? tokenY.publicKey : tokenX.publicKey;

        let outputMintDecimals = 0;
        try {
            const mintInfo = await getMint(connection, outputMint);
            outputMintDecimals = mintInfo.decimals;
        } catch (e) {
            console.error('Failed to fetch mint decimals via spl-token:', e);
            // Fallback
            outputMintDecimals = swapForY ? (tokenY as any).decimal : (tokenX as any).decimal;
        }

        const binArrays = await dlmmPool.getBinArrayForSwap(swapForY);
        const slippage = new BN(request.slippagePercent * 100);


        const quote = await dlmmPool.swapQuote(
            request.inputAmount,
            swapForY,
            slippage,
            binArrays
        );

        return {
            dexType: this.dexType,
            outputMint: outputMint.toBase58(),
            estimatedOutputAmount: quote.outAmount,
            minOutputAmount: quote.minOutAmount,
            priceImpact: 0,
            feePaid: quote.fee,
            outputMintDecimals: outputMintDecimals,
            reserves: [new BN(0), new BN(0)]
        };
    }
}
