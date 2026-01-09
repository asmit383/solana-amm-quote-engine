import { Connection, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import * as BufferLayout from '@solana/buffer-layout';
import { DexHandler, QuoteRequest, QuoteResponse, DexType } from '../types.js';
import { PROGRAM_IDS, MINT_SOL } from '../utils/constants.js';

const PUMP_LAYOUT = BufferLayout.struct<any>([
    BufferLayout.blob(8, 'discriminator'),
    BufferLayout.blob(8, 'virtualTokenReserves'),
    BufferLayout.blob(8, 'virtualSolReserves'),
    BufferLayout.blob(8, 'realTokenReserves'),
    BufferLayout.blob(8, 'realSolReserves'),
    BufferLayout.blob(8, 'tokenTotalSupply'),
    BufferLayout.u8('complete'),
]);

const PUMP_FEE_BPS = new BN(100);

export class PumpHandler implements DexHandler {
    dexType = DexType.PumpSwap;
    programIds = [PROGRAM_IDS.PUMP_FUN, PROGRAM_IDS.PUMP_AMM];

    async getQuote(connection: Connection, request: QuoteRequest): Promise<QuoteResponse> {
        const accountInfo = await connection.getAccountInfo(request.poolAddress);
        if (!accountInfo) throw new Error('Pool account not found');

        if (!this.programIds.some(pid => accountInfo.owner.equals(pid))) {
            throw new Error('Pool owner mismatch for Pump.fun');
        }

        const decoded = PUMP_LAYOUT.decode(accountInfo.data);


        let tokenMintStr: string = '';
        const isBuy = request.inputMint.equals(MINT_SOL);

        if (isBuy) {

            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(request.poolAddress, {
                programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
            });

            const vault = tokenAccounts.value.find(ta => ta.account.data.parsed.info.mint !== MINT_SOL.toBase58());

            if (vault) {
                tokenMintStr = vault.account.data.parsed.info.mint;
            } else {
                tokenMintStr = 'Unknown Token';
            }
        } else {
            tokenMintStr = MINT_SOL.toBase58();
        }

        let vSol = new BN(decoded.virtualSolReserves, 'le');
        let vToken = new BN(decoded.virtualTokenReserves, 'le');

        if (request.overrideReserves) {
            vSol = request.overrideReserves.reserveA;
            vToken = request.overrideReserves.reserveB;
        }

        let amountOut = new BN(0);
        const fee = request.inputAmount.mul(PUMP_FEE_BPS).div(new BN(10000));
        const amountInWithFee = request.inputAmount.sub(fee);

        let impact = 0;

        if (isBuy) {

            const k = vSol.mul(vToken);
            const newVSol = vSol.add(amountInWithFee);
            const newVToken = k.div(newVSol).add(new BN(1));

            amountOut = vToken.sub(newVToken);

            const ratio = amountInWithFee.mul(new BN(10000)).div(vSol);
            impact = ratio.toNumber() / 100;

        } else {

            const k = vSol.mul(vToken);
            const newVToken = vToken.add(amountInWithFee);
            const newVSol = k.div(newVToken).add(new BN(1));

            amountOut = vSol.sub(newVSol);

            const ratio = amountInWithFee.mul(new BN(10000)).div(vToken);
            impact = ratio.toNumber() / 100;
        }

        const minOutput = amountOut.mul(new BN(100 - request.slippagePercent)).div(new BN(100));

        if (request.overrideReserves) {
            return {
                dexType: this.dexType,
                outputMint: tokenMintStr,
                estimatedOutputAmount: amountOut,
                minOutputAmount: minOutput,
                priceImpact: impact,
                feePaid: fee,
                reserves: [request.overrideReserves.reserveA, request.overrideReserves.reserveB]
            };
        }

        const realSol = new BN(decoded.realSolReserves, 'le');
        const realToken = new BN(decoded.realTokenReserves, 'le');

        return {
            dexType: this.dexType,
            outputMint: tokenMintStr,
            estimatedOutputAmount: amountOut,
            minOutputAmount: minOutput,
            priceImpact: impact,
            feePaid: fee,
            reserves: [realSol, realToken]
        };
    }
}
