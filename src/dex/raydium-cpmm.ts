import { Connection, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { DexHandler, QuoteRequest, QuoteResponse, DexType } from '../types.js';
import { PROGRAM_IDS } from '../utils/constants.js';
// @ts-ignore
import { Raydium } from '@raydium-io/raydium-sdk-v2';

export class RaydiumCPMMHandler implements DexHandler {
    dexType = DexType.RaydiumCPMM;
    programIds = [PROGRAM_IDS.RAYDIUM_CPMM];

    async getQuote(connection: Connection, request: QuoteRequest): Promise<QuoteResponse> {
        const raydium = await Raydium.load({
            connection,
            disableFeatureCheck: true,
        });

        const poolId = request.poolAddress.toBase58();

        // 1. Fetch live pool info including config (fee) info
        const poolRes = await raydium.cpmm.getRpcPoolInfo(poolId, true);
        if (!poolRes) throw new Error('Failed to fetch CPMM pool info');

        // 2. Fetch mint info for both tokens (required for compute data)
        const [mintAInfo, mintBInfo] = await Promise.all([
            raydium.token.getTokenInfo(poolRes.mintA),
            raydium.token.getTokenInfo(poolRes.mintB)
        ]);

        // 3. Construct the compute data object
        // We cast to any to handle potential property name variations across SDK versions
        const computeData: any = {
            ...poolRes,
            id: request.poolAddress,
            version: 7,
            mintA: mintAInfo,
            mintB: mintBInfo,
        };

        // 4. Handle Reserve Overrides
        if (request.overrideReserves) {
            computeData.vaultAAmount = request.overrideReserves.reserveA;
            computeData.vaultBAmount = request.overrideReserves.reserveB;
        }

        // 5. Determine Direction and Output Mint
        const inputMintStr = request.inputMint.toBase58();
        const mintAStr = (typeof poolRes.mintA === 'string') ? poolRes.mintA : poolRes.mintA.toBase58();
        const mintBStr = (typeof poolRes.mintB === 'string') ? poolRes.mintB : poolRes.mintB.toBase58();

        let outputMint: string;
        if (inputMintStr === mintAStr) {
            outputMint = mintBStr;
        } else if (inputMintStr === mintBStr) {
            outputMint = mintAStr;
        } else {
            throw new Error('Input mint does not match pool tokens');
        }

        // 6. Use SDK calculation method - This is strictly RPC and SDK driven (no hardcoded fees)
        const quote = raydium.cpmm.computeSwapAmount({
            pool: computeData,
            amountIn: request.inputAmount,
            outputMint: outputMint,
            slippage: request.slippagePercent / 100,
            swapBaseIn: true
        });

        return {
            dexType: this.dexType,
            outputMint,
            estimatedOutputAmount: quote.amountOut,
            minOutputAmount: quote.minAmountOut,
            priceImpact: quote.priceImpact,
            feePaid: quote.fee,
            reserves: [computeData.vaultAAmount, computeData.vaultBAmount]
        };
    }
}
