import { t } from "@lingui/macro";

import type { MarketInfo, MarketsInfoData } from "domain/synthetics/markets/types";
import { getMarketIndexName, getMarketPoolName } from "domain/synthetics/markets/utils";
import { OrderType } from "domain/synthetics/orders";
import { TokenData, adaptToV1TokenInfo, getTokensRatioByAmounts } from "domain/synthetics/tokens";
import { SwapTradeAction, TradeActionType } from "domain/synthetics/tradeHistory/types";
import type { Token, TokenInfo } from "domain/tokens/types";
import { getExchangeRateDisplay } from "lib/legacy";
import { formatTokenAmount } from "lib/numbers";

import { getActionTitle } from "../../keys";
import {
  INEQUALITY_GT,
  INEQUALITY_LT,
  MakeOptional,
  RowDetails,
  formatTradeActionTimestamp,
  formatTradeActionTimestampISO,
  getErrorTooltipTitle,
  infoRow,
  lines,
  tryGetError,
} from "./shared";

const ELLIPSIS = "...";
const ARROW_SEPARATOR = " → ";

/**
 * getTokensRatioByAmounts return the same type as the input. But types are TokenData.
 */
const adapt = (token: Token | undefined): TokenInfo | undefined => {
  return token ? adaptToV1TokenInfo(token as TokenData) : undefined;
};

export const formatSwapMessage = (
  tradeAction: SwapTradeAction,
  marketsInfoData?: MarketsInfoData,
  relativeTimestamp = true
): RowDetails => {
  const tokenIn = tradeAction.initialCollateralToken;

  const tokenOut = tradeAction.targetCollateralToken!;
  const amountIn = tradeAction.initialCollateralDeltaAmount!;

  const fromText = formatTokenAmount(amountIn, tokenIn.decimals, tokenIn.symbol, {
    useCommas: true,
  });
  const fromAmountText = formatTokenAmount(amountIn, tokenIn.decimals, undefined, {
    useCommas: true,
  });

  const toMinText = formatTokenAmount(tradeAction.minOutputAmount, tokenOut?.decimals, tokenOut?.symbol, {
    useCommas: true,
  });

  const tokensExecutionRatio =
    tradeAction.executionAmountOut !== undefined
      ? getTokensRatioByAmounts({
          fromToken: tokenIn,
          toToken: tokenOut,
          fromTokenAmount: amountIn,
          toTokenAmount: tradeAction.executionAmountOut,
        })
      : undefined;

  const tokensMinRatio =
    tradeAction.minOutputAmount !== undefined
      ? getTokensRatioByAmounts({
          fromToken: tokenIn,
          toToken: tokenOut,
          fromTokenAmount: amountIn,
          toTokenAmount: tradeAction.minOutputAmount,
        })
      : undefined;

  const acceptablePriceInequality =
    tokensMinRatio?.largestToken?.address === tokenOut?.address ? INEQUALITY_LT : INEQUALITY_GT;

  const executionRate = getExchangeRateDisplay(
    tokensExecutionRatio?.ratio,
    adapt(tokensExecutionRatio?.smallestToken),
    adapt(tokensExecutionRatio?.largestToken)
  );

  const acceptableRate = getExchangeRateDisplay(
    tokensMinRatio?.ratio,
    adapt(tokensMinRatio?.smallestToken),
    adapt(tokensMinRatio?.largestToken)
  );

  const pathTokenSymbols = getSwapPathTokenSymbols(marketsInfoData, tokenIn, tradeAction.swapPath!);

  const market = !pathTokenSymbols ? ELLIPSIS : pathTokenSymbols.join(ARROW_SEPARATOR);

  const fullMarket = !marketsInfoData
    ? ELLIPSIS
    : tradeAction.swapPath
        ?.filter((marketAddress) => marketsInfoData?.[marketAddress])
        .map((marketAddress) => marketsInfoData?.[marketAddress]?.name ?? ELLIPSIS)
        .join(ARROW_SEPARATOR);

  const fullMarketNames: RowDetails["fullMarketNames"] = getSwapPathMarketFullNames(
    marketsInfoData,
    tradeAction.swapPath
  );

  let actionText = getActionTitle(tradeAction.orderType, tradeAction.eventName);

  let result: MakeOptional<RowDetails, "action" | "market" | "timestamp" | "timestampISO">;

  const ot = tradeAction.orderType;
  const ev = tradeAction.eventName;

  if (
    (ot === OrderType.LimitSwap && ev === TradeActionType.OrderCreated) ||
    (ot === OrderType.LimitSwap && ev === TradeActionType.OrderUpdated) ||
    (ot === OrderType.LimitSwap && ev === TradeActionType.OrderCancelled)
  ) {
    const toMinAmountText = formatTokenAmount(tradeAction.minOutputAmount, tokenOut?.decimals, undefined, {
      useCommas: true,
    });
    result = {
      price: `${acceptablePriceInequality}${acceptableRate}`,
      priceComment: lines(
        t`Acceptable price for the order.`,
        "",
        t`The trigger price for this order is based on the swap fees and price impact to guarantee that you will receive at least ${toMinText} on order execution.`
      ),
      size: t`${fromText} to ${toMinText}`,
      swapToTokenAmount: toMinAmountText,
    };
  } else if (ot === OrderType.LimitSwap && ev === TradeActionType.OrderExecuted) {
    const toExecutionText = formatTokenAmount(tradeAction.executionAmountOut, tokenOut?.decimals, tokenOut?.symbol, {
      useCommas: true,
    });
    const toExecutionAmountText = formatTokenAmount(tradeAction.executionAmountOut, tokenOut?.decimals, undefined, {
      useCommas: true,
    });
    result = {
      price: executionRate,
      priceComment: lines(
        t`Execution price for the order.`,
        "",
        infoRow(t`Order Acceptable Price`, `${acceptablePriceInequality}${acceptableRate}`)
      ),
      size: t`${fromText} to ${toExecutionText}`,
      swapToTokenAmount: toExecutionAmountText,
    };
  } else if (ot === OrderType.LimitSwap && ev === TradeActionType.OrderFrozen) {
    const error = tradeAction.reasonBytes ? tryGetError(tradeAction.reasonBytes) ?? undefined : undefined;
    const outputAmount = error?.args?.outputAmount as bigint | undefined;
    const ratio =
      outputAmount !== undefined
        ? getTokensRatioByAmounts({
            fromToken: tokenIn,
            toToken: tokenOut,
            fromTokenAmount: amountIn,
            toTokenAmount: outputAmount,
          })
        : undefined;
    const rate = getExchangeRateDisplay(ratio?.ratio, adapt(ratio?.smallestToken), adapt(ratio?.largestToken));
    const toExecutionText = formatTokenAmount(outputAmount, tokenOut?.decimals, tokenOut?.symbol, {
      useCommas: true,
    });
    const toExecutionAmountText = formatTokenAmount(outputAmount, tokenOut?.decimals, undefined, {
      useCommas: true,
    });

    result = {
      actionComment:
        error &&
        lines({
          text: getErrorTooltipTitle(error.name, false),
          state: "error",
        }),
      price: rate,
      priceComment: lines(
        t`Execution price for the order.`,
        "",
        infoRow(t`Order Acceptable Price`, `${acceptablePriceInequality}${acceptableRate}`)
      ),
      size: t`${fromText} to ${toExecutionText}`,
      swapToTokenAmount: toExecutionAmountText,
      isActionError: true,
    };
  } else if (
    (ot === OrderType.MarketSwap && ev === TradeActionType.OrderCreated) ||
    (ot === OrderType.MarketSwap && ev === TradeActionType.OrderUpdated)
  ) {
    const toMinAmountText = formatTokenAmount(tradeAction.minOutputAmount, tokenOut?.decimals, undefined, {
      useCommas: true,
    });
    result = {
      price: `${acceptablePriceInequality}${acceptableRate}`,
      priceComment: lines(t`Acceptable price for the order.`),
      size: t`${fromText} to ${toMinText}`,
      swapToTokenAmount: toMinAmountText,
    };
  } else if (ot === OrderType.MarketSwap && ev === TradeActionType.OrderExecuted) {
    const toExecutionText = formatTokenAmount(tradeAction.executionAmountOut, tokenOut?.decimals, tokenOut?.symbol, {
      useCommas: true,
    });
    const toExecutionAmountText = formatTokenAmount(tradeAction.executionAmountOut, tokenOut?.decimals, undefined, {
      useCommas: true,
    });

    result = {
      price: executionRate,
      priceComment: lines(
        t`Execution price for the order.`,
        "",
        infoRow(t`Order Acceptable Price`, `${acceptablePriceInequality}${acceptableRate}`)
      ),
      size: t`${fromText} to ${toExecutionText}`,
      swapToTokenAmount: toExecutionAmountText,
    };
  } else if (ot === OrderType.MarketSwap && ev === TradeActionType.OrderCancelled) {
    const error = tradeAction.reasonBytes ? tryGetError(tradeAction.reasonBytes) ?? undefined : undefined;
    const outputAmount = error?.args?.outputAmount as bigint | undefined;
    const ratio =
      outputAmount !== undefined
        ? getTokensRatioByAmounts({
            fromToken: tokenIn,
            toToken: tokenOut,
            fromTokenAmount: amountIn,
            toTokenAmount: outputAmount,
          })
        : undefined;
    const rate = getExchangeRateDisplay(ratio?.ratio, adapt(ratio?.smallestToken), adapt(ratio?.smallestToken));
    const toExecutionText = formatTokenAmount(outputAmount, tokenOut?.decimals, tokenOut?.symbol, {
      useCommas: true,
    });
    const toExecutionAmountText = formatTokenAmount(outputAmount, tokenOut?.decimals, undefined, {
      useCommas: true,
    });

    result = {
      actionComment:
        error &&
        lines({
          text: getErrorTooltipTitle(error.name, true),
          state: "error",
        }),
      price: rate,
      priceComment: lines(
        t`Execution price for the order.`,
        "",
        infoRow(t`Order Acceptable Price`, `${acceptablePriceInequality}${acceptableRate}`)
      ),
      size: t`${fromText} to ${toExecutionText}`,
      swapToTokenAmount: toExecutionAmountText,
      isActionError: true,
    };
  }

  return {
    action: actionText,
    market: market,
    fullMarket: fullMarket,
    timestamp: formatTradeActionTimestamp(tradeAction.transaction.timestamp, relativeTimestamp),
    timestampISO: formatTradeActionTimestampISO(tradeAction.transaction.timestamp),
    acceptablePrice: `${acceptablePriceInequality}${acceptableRate}`,
    executionPrice: executionRate,
    fullMarketNames,
    swapFromTokenSymbol: tokenIn.symbol,
    swapToTokenSymbol: tokenOut.symbol,
    swapFromTokenAmount: fromAmountText,
    ...result!,
  };
};

export function getSwapPathMarketFullNames(
  marketsInfoData: MarketsInfoData | undefined,
  swapPath: string[]
): { indexName: string; poolName: string }[] | undefined {
  if (!marketsInfoData) {
    return undefined;
  }

  return swapPath.map((marketAddress) => {
    const marketInfo = marketsInfoData[marketAddress];

    if (!marketInfo) {
      return {
        indexName: ELLIPSIS,
        poolName: ELLIPSIS,
      };
    }

    const indexName = getMarketIndexName({
      indexToken: marketInfo.indexToken,
      isSpotOnly: marketInfo.isSpotOnly,
    });
    const poolName = getMarketPoolName({
      longToken: marketInfo.longToken,
      shortToken: marketInfo.shortToken,
    });

    return {
      indexName: indexName,
      poolName: poolName,
    };
  });
}

export function getSwapPathTokenSymbols(
  marketsInfoData: MarketsInfoData | undefined,
  initialCollateralToken: TokenData,
  swapPath: string[]
): string[] | undefined {
  if (!marketsInfoData || !swapPath) {
    return undefined;
  }

  let pathTokenSymbolsLoading = false;

  const pathTokenSymbols: string[] = swapPath
    .map((marketAddress) => marketsInfoData[marketAddress])
    .reduce(
      (acc: TokenData[], marketInfo: MarketInfo | undefined) => {
        if (!marketInfo || pathTokenSymbolsLoading) {
          pathTokenSymbolsLoading = true;
          return [];
        }

        const last = acc[acc.length - 1];

        if (last.address === marketInfo.longToken.address) {
          acc.push(marketInfo.shortToken);
        } else if (last.address === marketInfo.shortToken.address) {
          acc.push(marketInfo.longToken);
        }

        return acc;
      },
      [initialCollateralToken] as TokenData[]
    )
    .map((token: TokenData) => token?.symbol);

  if (pathTokenSymbolsLoading) {
    return undefined;
  }

  return pathTokenSymbols;
}
