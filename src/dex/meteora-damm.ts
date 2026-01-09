import { Connection, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { DexHandler, QuoteRequest, QuoteResponse, DexType } from '../types.js';
import { PROGRAM_IDS } from '../utils/constants.js';
// @ts-ignore
import { CpAmm, swapQuoteExactInput, getCurrentPoint } from '@meteora-ag/cp-amm-sdk';

export class MeteoraDAMMHandler implements DexHandler {
    dexType = DexType.MeteoraDAMM;
    programIds = [PROGRAM_IDS.METEORA_DAMM];

    async getQuote(connection: Connection, request: QuoteRequest): Promise<QuoteResponse> {
        const cpAmm = new CpAmm(connection);


        const poolState = await cpAmm.fetchPoolState(request.poolAddress);
        if (!poolState) throw new Error('Meteora DAMM pool not found');



        const tokenAMint = poolState.tokenAMint;
        const tokenBMint = poolState.tokenBMint;

        const isAtoB = request.inputMint.equals(tokenAMint);
        const isBtoA = request.inputMint.equals(tokenBMint);

        if (!isAtoB && !isBtoA) {
            throw new Error(`Input mint ${request.inputMint.toBase58()} not in Meteora DAMM pool`);
        }


        const mintAInfo = await connection.getParsedAccountInfo(tokenAMint);
        const mintBInfo = await connection.getParsedAccountInfo(tokenBMint);

        const decimalsA = (mintAInfo.value?.data as any).parsed.info.decimals;
        const decimalsB = (mintBInfo.value?.data as any).parsed.info.decimals;


        const amountIn = new BN(request.inputAmount.toString());
        const slippage = request.slippagePercent / 100;


        let currentPoint = new BN(0);
        try {

            currentPoint = await getCurrentPoint(connection, (poolState as any).activationType);
        } catch (e) {
            console.error('Error calculating current point:', e);
        }


        const quote = swapQuoteExactInput(
            (cpAmm as any)._program,
            poolState,
            currentPoint,
            amountIn,
            slippage,
            isAtoB,
            false, // hasReferral
            decimalsA,
            decimalsB
        );


        const q = quote as any;

        const amountOut = q.outputAmount || q.destinationAmountSwapped || q.tokenAmountOut || new BN(0);
        const minAmountOut = quote.minimumAmountOut || new BN(0);

        const fee = q.tradingFee || q.fee || q.feeAmount || new BN(0);


        const impact = quote.priceImpact ? quote.priceImpact.toNumber() : 0;

        return {
            dexType: this.dexType,
            outputMint: isAtoB ? tokenBMint.toBase58() : tokenAMint.toBase58(),
            estimatedOutputAmount: amountOut,
            minOutputAmount: minAmountOut,
            priceImpact: impact,
            feePaid: fee,
            reserves: [new BN(0), new BN(0)]
        };
    }
}
