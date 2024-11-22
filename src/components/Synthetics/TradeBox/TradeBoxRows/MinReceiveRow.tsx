import { Trans } from "@lingui/macro";
import { ExchangeInfo } from "components/Exchange/ExchangeInfo";
import {
  selectTradeboxSwapAmounts,
  selectTradeboxToToken,
  selectTradeboxTradeFlags,
} from "context/SyntheticsStateContext/selectors/tradeboxSelectors";
import { useSelector } from "context/SyntheticsStateContext/utils";
import { applySlippageToMinOut } from "domain/synthetics/trade";
import { formatTokenAmount } from "lib/numbers";

export function MinReceiveRow({ allowedSlippage }: { allowedSlippage: number }) {
  const { isMarket, isSwap } = useSelector(selectTradeboxTradeFlags);
  const swapAmounts = useSelector(selectTradeboxSwapAmounts);

  const toToken = useSelector(selectTradeboxToToken);

  if (!isSwap) {
    return null;
  }

  return (
    <ExchangeInfo.Row label={<Trans>Min. Receive</Trans>}>
      {isMarket && swapAmounts?.minOutputAmount
        ? formatTokenAmount(
            applySlippageToMinOut(allowedSlippage, swapAmounts.minOutputAmount),
            toToken?.decimals,
            toToken?.symbol
          )
        : formatTokenAmount(swapAmounts?.minOutputAmount, toToken?.decimals, toToken?.symbol)}
    </ExchangeInfo.Row>
  );
}
