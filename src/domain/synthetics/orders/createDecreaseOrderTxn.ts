import ExchangeRouter from "abis/ExchangeRouter.json";
import { getContract } from "config/contracts";
import { NATIVE_TOKEN_ADDRESS, convertTokenAddress } from "config/tokens";
import { SetPendingFundingFeeSettlement, SetPendingOrder, SetPendingPosition } from "context/SyntheticsEvents";
import { TokensData, convertToContractPrice } from "domain/synthetics/tokens";
import { Token } from "domain/tokens";
import { Signer, ethers } from "ethers";
import { callContract } from "lib/contracts";
import { getPositionKey } from "../positions";
import { applySlippageToMinOut, applySlippageToPrice } from "../trade";
import { PriceOverrides, simulateExecuteTxn } from "./simulateExecuteTxn";
import { DecreasePositionSwapType, OrderType } from "./types";
import { isMarketOrderType, getPendingOrderFromParams } from "./utils";
import { t } from "@lingui/macro";
import { Subaccount } from "context/SubaccountContext/SubaccountContext";
import { getSubaccountRouterContract } from "../subaccount/getSubaccountContract";
import { UI_FEE_RECEIVER_ACCOUNT } from "config/ui";

const { ZeroAddress } = ethers;

export type DecreaseOrderParams = {
  account: string;
  marketAddress: string;
  initialCollateralAddress: string;
  initialCollateralDeltaAmount: bigint;
  swapPath: string[];
  receiveTokenAddress: string;
  sizeDeltaUsd: bigint;
  sizeDeltaInTokens: bigint;
  acceptablePrice: bigint;
  triggerPrice: bigint | undefined;
  minOutputUsd: bigint;
  isLong: boolean;
  decreasePositionSwapType: DecreasePositionSwapType;
  orderType: OrderType.MarketDecrease | OrderType.LimitDecrease | OrderType.StopLossDecrease;
  executionFee: bigint;
  allowedSlippage: number;
  skipSimulation?: boolean;
  referralCode?: string;
  indexToken: Token;
  tokensData: TokensData;
};

export type DecreaseOrderCallbacks = {
  setPendingTxns: (txns: any) => void;
  setPendingOrder?: SetPendingOrder;
  setPendingPosition?: SetPendingPosition;
  setPendingFundingFeeSettlement?: SetPendingFundingFeeSettlement;
};

export async function createDecreaseOrderTxn(
  chainId: number,
  signer: Signer,
  subaccount: Subaccount,
  params: DecreaseOrderParams | DecreaseOrderParams[],
  callbacks: DecreaseOrderCallbacks,
  metricId?: string
) {
  const ps = Array.isArray(params) ? params : [params];
  const exchangeRouter = new ethers.Contract(getContract(chainId, "ExchangeRouter"), ExchangeRouter.abi, signer);
  const router = subaccount ? getSubaccountRouterContract(chainId, subaccount.signer) : exchangeRouter;

  const orderVaultAddress = getContract(chainId, "OrderVault");
  const totalWntAmount = ps.reduce((acc, p) => acc + "25000000000000", 0n);
  const account = ps[0].account;
  const encodedPayload = createDecreaseEncodedPayload({
    router,
    orderVaultAddress,
    ps,
    subaccount,
    mainAccountAddress: account,
    chainId,
  });
  const simulationEncodedPayload = createDecreaseEncodedPayload({
    router: exchangeRouter,
    orderVaultAddress,
    ps,
    subaccount: null,
    mainAccountAddress: account,
    chainId,
  });

  await Promise.all(
    ps.map(async (p) => {
      if (subaccount && callbacks.setPendingOrder) {
        callbacks.setPendingOrder(getPendingOrderFromParams(chainId, "create", p));
      }

      if (!p.skipSimulation) {
        const primaryPriceOverrides: PriceOverrides = {};
        if (p.triggerPrice != undefined) {
          primaryPriceOverrides[p.indexToken.address] = {
            minPrice: p.triggerPrice,
            maxPrice: p.triggerPrice,
          };
        }
        await simulateExecuteTxn(chainId, {
          account,
          primaryPriceOverrides,
          createMulticallPayload: simulationEncodedPayload,
          value: totalWntAmount,
          tokensData: p.tokensData,
          errorTitle: t`Order error.`,
        });
      }
    })
  );

  const txnCreatedAt = Date.now();

  if (!signer.provider) throw new Error("No provider found");
  const txnCreatedAtBlock = await signer.provider.getBlockNumber();

  await callContract(chainId, router, "multicall", [encodedPayload], {
    value: totalWntAmount,
    hideSentMsg: true,
    hideSuccessMsg: true,
    customSigners: subaccount?.customSigners,
    metricId,
    setPendingTxns: callbacks.setPendingTxns,
  });

  ps.forEach((p) => {
    if (isMarketOrderType(p.orderType)) {
      if (callbacks.setPendingPosition) {
        callbacks.setPendingPosition(getPendingPositionFromParams(txnCreatedAt, txnCreatedAtBlock, p));
      }
    }

    if (!subaccount && callbacks.setPendingOrder) {
      callbacks.setPendingOrder(getPendingOrderFromParams(chainId, "create", p));
    }
  });

  if (callbacks.setPendingFundingFeeSettlement) {
    callbacks.setPendingFundingFeeSettlement({
      orders: ps.map((p) => getPendingOrderFromParams(chainId, "create", p)),
      positions: ps.map((p) => getPendingPositionFromParams(txnCreatedAt, txnCreatedAtBlock, p)),
    });
  }
}

function getPendingPositionFromParams(txnCreatedAt: number, txnCreatedAtBlock: number, p: DecreaseOrderParams) {
  const positionKey = getPositionKey(p.account, p.marketAddress, p.initialCollateralAddress, p.isLong);
  return {
    isIncrease: false,
    positionKey,
    collateralDeltaAmount: p.initialCollateralDeltaAmount,
    sizeDeltaUsd: p.sizeDeltaUsd,
    sizeDeltaInTokens: p.sizeDeltaInTokens,
    updatedAt: txnCreatedAt,
    updatedAtBlock: BigInt(txnCreatedAtBlock),
  };
}

export function createDecreaseEncodedPayload({
  router,
  orderVaultAddress,
  ps,
  subaccount,
  mainAccountAddress,
  chainId,
}: {
  router: ethers.Contract;
  orderVaultAddress: string;
  ps: DecreaseOrderParams[];
  subaccount: Subaccount;
  mainAccountAddress: string;
  chainId: number;
}) {
  const multicall = [
    ...ps.flatMap((p) => {
      const isNativeReceive = p.receiveTokenAddress === NATIVE_TOKEN_ADDRESS;

      const initialCollateralTokenAddress = convertTokenAddress(chainId, p.initialCollateralAddress, "wrapped");

      const shouldApplySlippage = isMarketOrderType(p.orderType);

      const acceptablePrice = shouldApplySlippage
        ? applySlippageToPrice(p.allowedSlippage, p.acceptablePrice, false, p.isLong)
        : p.acceptablePrice;

      const minOutputAmount = shouldApplySlippage
        ? applySlippageToMinOut(p.allowedSlippage, p.minOutputUsd)
        : p.minOutputUsd;
      const orderParams = {
        addresses: {
          cancellationReceiver: ethers.ZeroAddress,
          receiver: p.account,
          initialCollateralToken: initialCollateralTokenAddress,
          callbackContract: ZeroAddress,
          market: p.marketAddress,
          swapPath: p.swapPath,
          uiFeeReceiver: UI_FEE_RECEIVER_ACCOUNT ?? ethers.ZeroAddress,
        },
        numbers: {
          sizeDeltaUsd: p.sizeDeltaUsd,
          initialCollateralDeltaAmount: p.initialCollateralDeltaAmount,
          triggerPrice: convertToContractPrice(p.triggerPrice ?? 0n, p.indexToken.decimals),
          acceptablePrice: convertToContractPrice(acceptablePrice, p.indexToken.decimals),
          executionFee: "25000000000000",
          callbackGasLimit: 0n,
          minOutputAmount,
        },
        orderType: p.orderType,
        decreasePositionSwapType: p.decreasePositionSwapType,
        isLong: p.isLong,
        shouldUnwrapNativeToken: isNativeReceive,
        autoCancel: false,
        referralCode: p.referralCode || ethers.ZeroHash,
      };

      return [
        { method: "sendWnt", params: [orderVaultAddress, "25000000000000"] },
        {
          method: "createOrder",
          params: subaccount ? [mainAccountAddress, orderParams] : [orderParams],
        },
      ];
    }),
  ];

  return multicall.filter(Boolean).map((call) => router.interface.encodeFunctionData(call!.method, call!.params));
}
