import { encodeFunctionData, maxUint256, type Address } from "viem";
import type { DepositWalletCall } from "@polymarket/builder-relayer-client";
import { ADDRESSES } from "./contracts.js";

const erc20ApproveAbi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const erc1155ApprovalAbi = [
  {
    name: "setApprovalForAll",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
] as const;

// The three contracts Polymarket trading needs spending rights for.
const SPENDERS: Address[] = [
  ADDRESSES.ctfExchange as Address,
  ADDRESSES.negRiskCtfExchange as Address,
  ADDRESSES.negRiskAdapter as Address,
];

/**
 * The canonical approval set the Polymarket UI grants:
 *  - pUSD.approve(spender, max)            -> lets the exchange pull your collateral (BUYs)
 *  - ConditionalTokens.setApprovalForAll() -> lets it move your outcome tokens (SELLs / redeem)
 * for each of the three trading contracts. Submitted as one deposit-wallet batch.
 */
export function buildApprovalCalls(): DepositWalletCall[] {
  const calls: DepositWalletCall[] = [];
  for (const spender of SPENDERS) {
    calls.push({
      target: ADDRESSES.pUSD,
      value: "0",
      data: encodeFunctionData({
        abi: erc20ApproveAbi,
        functionName: "approve",
        args: [spender, maxUint256],
      }),
    });
    calls.push({
      target: ADDRESSES.conditionalTokens,
      value: "0",
      data: encodeFunctionData({
        abi: erc1155ApprovalAbi,
        functionName: "setApprovalForAll",
        args: [spender, true],
      }),
    });
  }
  return calls;
}
