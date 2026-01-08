import { Connection, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { DexRegistry } from './registry.js';
import 'dotenv/config';

const connection = new Connection(process.env.RPC_URL || 'https://api.mainnet-beta.solana.com');

import * as readline from 'readline';

async function main() {
    const args = process.argv.slice(2);

    let poolAddrStr: string;
    let inputMintStr: string;
    let inputAmountStr: string;
    let slippageStr: string;
    let reserveAStr: string = '';
    let reserveBStr: string = '';

    if (args.length >= 1) {
        // Argument mode
        poolAddrStr = args[0];
        inputMintStr = args[1] || 'So11111111111111111111111111111111111111112';
        inputAmountStr = args[2] || '10000000';
        slippageStr = args[3] || '1';
        if (args[4]) reserveAStr = args[4];
        if (args[5]) reserveBStr = args[5];
    } else {
        // Interactive mode
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (query: string, defaultVal: string) => new Promise<string>(resolve => {
            rl.question(`${query} [${defaultVal}]: `, answer => {
                resolve(answer.trim() || defaultVal);
            });
        });

        poolAddrStr = await question('Enter Pool Address', 'Bd3snQsjrRmrKfEkoQk6wcm5QkZ9Hy8UCQfecZYFxd6i');
        inputMintStr = await question('Enter Input Mint Address', 'So11111111111111111111111111111111111111112');
        inputAmountStr = await question('Enter Input Amount', '10000000');
        slippageStr = await question('Enter Slippage %', '1');

        const override = await question('Override Reserves? (y/N)', 'n');
        if (override.toLowerCase() === 'y') {
            reserveAStr = await question('Enter Reserve A (SOL / TokenA)', '0');
            reserveBStr = await question('Enter Reserve B (Token / TokenB)', '0');
        }

        rl.close();
    }

    const inputAmount = new BN(inputAmountStr);
    const slippage = parseFloat(slippageStr);

    console.log('\n--- Input ---');
    console.log('Pool Address:', poolAddrStr);
    console.log('Input Mint:', inputMintStr);
    console.log('Input Amount:', inputAmount.toString());
    console.log('Slippage %:', slippage);
    if (reserveAStr && reserveBStr) {
        console.log('Override Reserve A:', reserveAStr);
        console.log('Override Reserve B:', reserveBStr);
    }

    const registry = new DexRegistry();

    let overrideReserves;
    if (reserveAStr && reserveBStr && (reserveAStr !== '0' || reserveBStr !== '0')) {
        overrideReserves = {
            reserveA: new BN(reserveAStr),
            reserveB: new BN(reserveBStr)
        };
    }

    try {
        const quote = await registry.getQuote(connection, {
            poolAddress: new PublicKey(poolAddrStr),
            inputMint: new PublicKey(inputMintStr),
            inputAmount,
            slippagePercent: slippage,
            overrideReserves
        });

        console.log('\n--- Quote Result ---');
        console.log(`Detected DEX Type: ${quote.dexType}`);
        console.log(`Output Mint: ${quote.outputMint}`);
        console.log(`Estimated Output Amount: ${quote.estimatedOutputAmount.toString()}`);
        console.log(`Minimum Output (after ${slippage}% slippage): ${quote.minOutputAmount.toString()}`);
        console.log(`Trade Fee Paid: ${quote.feePaid.toString()}`);
        // console.log(`Price Impact: ${quote.priceImpact}%`);
        if (quote.reserves) {
            console.log(`ReserveA: ${quote.reserves[0].toString()}`);
            console.log(`ReserveB: ${quote.reserves[1].toString()}`);
        }

    } catch (e: any) {
        console.error('\nError getting quote:', e.message);
        if (e.message.includes('Pool account not found')) {
            console.error('Make sure you are on the correct network (Mainnet) and the pool exists.');
        }
    }
}

main().catch(console.error);
