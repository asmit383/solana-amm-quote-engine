import { Connection, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { DexHandler, QuoteRequest, QuoteResponse, DexType } from '../types.js';
import { PROGRAM_IDS } from '../utils/constants.js';
import DLMM from '@meteora-ag/dlmm';

export class MeteoraHandler implements DexHandler {
    dexType = DexType.MeteoraDLMM;
    programIds = [PROGRAM_IDS.METEORA_DLMM];

    async getQuote(connection: Connection, request: QuoteRequest): Promise<QuoteResponse> {
        const dlmmPool = await (DLMM as any).create(connection, request.poolAddress);

        const tokenX = dlmmPool.tokenX;
        const tokenY = dlmmPool.tokenY;

        // inputMint must match
        // Check if tokenX has publicKey (structure might vary, usually it does)
        const isXtoY = request.inputMint.equals(tokenX.publicKey);
        const isYtoX = request.inputMint.equals(tokenY.publicKey);

        if (!isXtoY && !isYtoX) {
            throw new Error('Input mint not in Meteora pool');
        }

        const swapYtoX = isYtoX;

        const binArrays = await dlmmPool.getBinArrayForSwap(swapYtoX);
        const slippage = new BN(request.slippagePercent * 100);

        const quote = await dlmmPool.swapQuote(
            request.inputAmount,
            swapYtoX,
            slippage,
            binArrays
        );

        return {
            dexType: this.dexType,
            outputMint: swapYtoX ? tokenX.publicKey.toBase58() : tokenY.publicKey.toBase58(),
            estimatedOutputAmount: quote.estimatedAmountOut,
            minOutputAmount: quote.minOutputAmount,
            priceImpact: 0,
            feePaid: quote.protocolFee.add(quote.tradeFee),
            reserves: [new BN(0), new BN(0)]
        };
    }
}
