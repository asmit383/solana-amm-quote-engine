import { Connection, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { DexHandler, QuoteRequest, QuoteResponse, DexType } from '../types.js';
import { PROGRAM_IDS } from '../utils/constants.js';
import { WhirlpoolContext, buildWhirlpoolClient, swapQuoteByInputToken } from '@orca-so/whirlpools-sdk';
import { Percentage } from '@orca-so/common-sdk';


const dummyWallet = {
    publicKey: new PublicKey('11111111111111111111111111111111'),
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs
};

export class OrcaHandler implements DexHandler {
    dexType = DexType.OrcaWhirlpool;
    programIds = [PROGRAM_IDS.ORCA_WHIRLPOOL];

    async getQuote(connection: Connection, request: QuoteRequest): Promise<QuoteResponse> {

        const context = WhirlpoolContext.from(
            connection,
            dummyWallet as any
        );
        const client = buildWhirlpoolClient(context);

        // Get pool
        const whirlpool = await client.getPool(request.poolAddress);

        // Check mints
        const tokenAInfo = whirlpool.getTokenAInfo();
        const tokenBInfo = whirlpool.getTokenBInfo();
        const inputMint = request.inputMint;

        const isAtoB = inputMint.equals(tokenAInfo.mint);
        if (!isAtoB && !inputMint.equals(tokenBInfo.mint)) {
            throw new Error(`Input mint ${inputMint.toBase58()} not found in Orca pool ${request.poolAddress.toBase58()}`);
        }

        const amountIn = request.inputAmount;
        const slippage = Percentage.fromFraction(Math.floor(request.slippagePercent * 100), 10000);

        // swapQuoteByInputToken
        const quote = await swapQuoteByInputToken(
            whirlpool,
            inputMint,
            amountIn,
            slippage,
            PROGRAM_IDS.ORCA_WHIRLPOOL,
            client.getFetcher(),
            undefined // opts
        );

        // Log the quote for debugging
        console.log('Orca Quote:', JSON.stringify(quote, (key, value) =>
            BN.isBN(value) ? value.toString() : (typeof value === 'bigint' ? value.toString() : value), 2));

        return {
            dexType: this.dexType,
            outputMint: isAtoB ? tokenBInfo.mint.toBase58() : tokenAInfo.mint.toBase58(),
            estimatedOutputAmount: quote.estimatedAmountOut,
            minOutputAmount: quote.otherAmountThreshold,
            priceImpact: 0,
            feePaid: quote.estimatedFeeAmount,
            reserves: [new BN(0), new BN(0)]
        };
    }
}
