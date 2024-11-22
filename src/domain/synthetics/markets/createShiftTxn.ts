import { t } from "@lingui/macro";
import { Signer, ethers } from "ethers";

import { getContract } from "config/contracts";
import { UI_FEE_RECEIVER_ACCOUNT } from "config/ui";
import type { SetPendingShift } from "context/SyntheticsEvents";
import { callContract } from "lib/contracts";

import { simulateExecuteTxn } from "../orders/simulateExecuteTxn";
import type { TokensData } from "../tokens";
import { applySlippageToMinOut } from "../trade";

import ExchangeRouter from "abis/ExchangeRouter.json";

type Params = {
  account: string;
  fromMarketTokenAddress: string;
  fromMarketTokenAmount: bigint;
  toMarketTokenAddress: string;
  minToMarketTokenAmount: bigint;
  executionFee: bigint;
  allowedSlippage: number;
  tokensData: TokensData;
  skipSimulation?: boolean;
  metricId?: string;
  setPendingTxns: (txns: any) => void;
  setPendingShift: SetPendingShift;
};

export async function createShiftTxn(chainId: number, signer: Signer, p: Params) {
  const contract = new ethers.Contract(getContract(chainId, "ExchangeRouter"), ExchangeRouter.abi, signer);
  const shiftVaultAddress = getContract(chainId, "ShiftVault");

  const minToMarketTokenAmount = applySlippageToMinOut(p.allowedSlippage, p.minToMarketTokenAmount);

  const multicall = [
    { method: "sendWnt", params: [shiftVaultAddress, p.executionFee] },
    { method: "sendTokens", params: [p.fromMarketTokenAddress, shiftVaultAddress, p.fromMarketTokenAmount] },
    {
      method: "createShift",
      params: [
        {
          receiver: p.account,
          callbackContract: ethers.ZeroAddress,
          uiFeeReceiver: UI_FEE_RECEIVER_ACCOUNT ?? ethers.ZeroAddress,
          fromMarket: p.fromMarketTokenAddress,
          toMarket: p.toMarketTokenAddress,
          minMarketTokens: minToMarketTokenAmount,
          executionFee: p.executionFee,
          callbackGasLimit: 0n,
        },
      ],
    },
  ];

  const encodedPayload = multicall.map((call) => contract.interface.encodeFunctionData(call!.method, call!.params));

  if (!p.skipSimulation) {
    await simulateExecuteTxn(chainId, {
      account: p.account,
      primaryPriceOverrides: {},
      tokensData: p.tokensData,
      createMulticallPayload: encodedPayload,
      method: "simulateExecuteShift",
      errorTitle: t`Shift error.`,
      value: p.executionFee,
    });
  }

  return callContract(chainId, contract, "multicall", [encodedPayload], {
    value: p.executionFee,
    hideSentMsg: true,
    hideSuccessMsg: true,
    metricId: p.metricId,
    setPendingTxns: p.setPendingTxns,
  }).then(() => {
    p.setPendingShift({
      account: p.account,
      fromMarket: p.fromMarketTokenAddress,
      marketTokenAmount: p.fromMarketTokenAmount,
      toMarket: p.toMarketTokenAddress,
      minMarketTokens: minToMarketTokenAmount,
    });
  });
}
