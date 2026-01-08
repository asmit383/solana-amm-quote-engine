import { Connection } from '@solana/web3.js';
import BN from 'bn.js';
import { DexHandler, QuoteRequest, QuoteResponse, DexType } from '../types.js';
import { PROGRAM_IDS } from '../utils/constants.js';
// @ts-ignore
import { Raydium, PoolUtils } from '@raydium-io/raydium-sdk-v2';

export class RaydiumCLMMHandler implements DexHandler {
    dexType = DexType.RaydiumCLMM;
    programIds = [PROGRAM_IDS.RAYDIUM_CLMM];

    async getQuote(connection: Connection, request: QuoteRequest): Promise<QuoteResponse> {
        const raydium = await Raydium.load({
            connection,
            disableFeatureCheck: true,
        });

        const poolId = request.poolAddress.toBase58();


        const { poolInfo, computePoolInfo, tickData } = await raydium.clmm.getPoolInfoFromRpc(poolId);


        const inputMintStr = request.inputMint.toBase58();
        const mintAStr = typeof poolInfo.mintA === 'string' ? poolInfo.mintA : poolInfo.mintA.address;
        const mintBStr = typeof poolInfo.mintB === 'string' ? poolInfo.mintB : poolInfo.mintB.address;

        let tokenOut: any;
        if (inputMintStr === mintAStr) {
            tokenOut = poolInfo.mintB;
        } else if (inputMintStr === mintBStr) {
            tokenOut = poolInfo.mintA;
        } else {
            throw new Error(`Input mint ${inputMintStr} not found in pool ${poolId}`);
        }


        const epochInfo = await connection.getEpochInfo();


        const quote = PoolUtils.computeAmountOutFormat({
            poolInfo: computePoolInfo,
            tickArrayCache: (tickData as any)[poolId],
            amountIn: request.inputAmount,
            tokenOut: tokenOut,
            slippage: request.slippagePercent / 100,
            epochInfo: epochInfo,
            catchLiquidityInsufficient: false
        }) as any;

        return {
            dexType: this.dexType,
            outputMint: tokenOut.address || tokenOut.toString(),

            estimatedOutputAmount: quote.amountOut.amount.raw,
            minOutputAmount: quote.minAmountOut.amount.raw,
            priceImpact: 0,
            feePaid: quote.fee.raw,
            reserves: [new BN(0), new BN(0)]
        };
    }
}
