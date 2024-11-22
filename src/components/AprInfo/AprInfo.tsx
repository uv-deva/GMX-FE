import { Trans, t } from "@lingui/macro";
import { addDays, formatDistanceToNowStrict } from "date-fns";
import { useCallback, useMemo } from "react";

import { getIncentivesV2Url } from "config/links";
import { ENOUGH_DAYS_SINCE_LISTING_FOR_APY, getMarketListingDate } from "config/markets";
import { useLiquidityProvidersIncentives } from "domain/synthetics/common/useIncentiveStats";
import { getIsBaseApyReadyToBeShown } from "domain/synthetics/markets/getIsBaseApyReadyToBeShown";
import { useLpAirdroppedTokenTitle } from "domain/synthetics/tokens/useAirdroppedTokenTitle";
import { useChainId } from "lib/chains";
import { formatAmount } from "lib/numbers";
import { ETHENA_DASHBOARD_URL, isEthenaSatsIncentivizedMarket } from "config/ethena";
import { LIDO_APR_DECIMALS } from "domain/stake/useLidoStakeApr";

import ExternalLink from "components/ExternalLink/ExternalLink";
import StatsTooltipRow from "components/StatsTooltip/StatsTooltipRow";
import TooltipWithPortal from "components/Tooltip/TooltipWithPortal";

import sparkleIcon from "img/sparkle.svg";

function getApyReadyToBeShownDate(listingDate: Date): Date {
  return addDays(listingDate, ENOUGH_DAYS_SINCE_LISTING_FOR_APY);
}

export function AprInfo({
  apy,
  incentiveApr,
  lidoApr,
  showTooltip = true,
  tokenAddress,
}: {
  apy: bigint | undefined;
  incentiveApr: bigint | undefined;
  lidoApr: bigint | undefined;
  showTooltip?: boolean;
  tokenAddress: string;
}) {
  const { chainId } = useChainId();

  const listingDate = getMarketListingDate(chainId, tokenAddress);
  const { isBaseAprReadyToBeShown, apyReadyToBeShownDate } = useMemo(
    () => ({
      isBaseAprReadyToBeShown: getIsBaseApyReadyToBeShown(listingDate),
      apyReadyToBeShownDate: getApyReadyToBeShownDate(listingDate),
    }),
    [listingDate]
  );

  let totalApr = (incentiveApr ?? 0n) + (lidoApr ?? 0n);
  if (isBaseAprReadyToBeShown) {
    totalApr += apy ?? 0n;
  }
  const incentivesData = useLiquidityProvidersIncentives(chainId);
  const isIncentiveActive = !!incentivesData && incentivesData?.rewardsPerMarket[tokenAddress] !== undefined;
  const isLidoApr = lidoApr !== undefined && lidoApr > 0n;
  const isEthenaSatsIncentive = isEthenaSatsIncentivizedMarket(tokenAddress);

  const airdropTokenTitle = useLpAirdroppedTokenTitle();

  const renderTooltipContent = useCallback(() => {
    return (
      <div className="flex flex-col gap-y-14">
        <div>
          <StatsTooltipRow
            showDollar={false}
            label={t`Base APY`}
            value={isBaseAprReadyToBeShown ? `${formatAmount(apy, 28, 2)}%` : t`NA`}
          />
          {isIncentiveActive && (
            <StatsTooltipRow showDollar={false} label={t`Bonus APR`} value={`${formatAmount(incentiveApr, 28, 2)}%`} />
          )}
          {isLidoApr && (
            <StatsTooltipRow
              showDollar={false}
              label={t`wstETH APR`}
              value={`${formatAmount(lidoApr, LIDO_APR_DECIMALS, 2)}%`}
            />
          )}
        </div>
        {!isBaseAprReadyToBeShown && (
          <div>
            <Trans>
              The base APY estimate will be available{" "}
              {formatDistanceToNowStrict(apyReadyToBeShownDate as Date, { addSuffix: true })} to ensure accurate data
              display.
            </Trans>
          </div>
        )}
        {isIncentiveActive && (
          <div>
            <Trans>
              The Bonus APR will be airdropped as {airdropTokenTitle} tokens.{" "}
              <ExternalLink href={getIncentivesV2Url(chainId)}>Read more</ExternalLink>.
            </Trans>
          </div>
        )}
        {isEthenaSatsIncentive && (
          <div>
            <Trans>
              You will earn a 20x Ethena sats multiplier per dollar of GM value. Check your earned sats on the
              <ExternalLink href={ETHENA_DASHBOARD_URL}>Ethena dashboard</ExternalLink>.
            </Trans>
          </div>
        )}
      </div>
    );
  }, [
    airdropTokenTitle,
    apy,
    apyReadyToBeShownDate,
    chainId,
    incentiveApr,
    isBaseAprReadyToBeShown,
    isIncentiveActive,
    lidoApr,
    isLidoApr,
    isEthenaSatsIncentive,
  ]);

  const aprNode = useMemo(() => {
    const node = <>{apy !== undefined ? `${formatAmount(totalApr, 28, 2)}%` : "..."}</>;

    if (incentiveApr !== undefined && incentiveApr > 0) {
      return (
        <div className="inline-flex flex-nowrap">
          {node}
          <img className="relative -top-3 h-10" src={sparkleIcon} alt="sparkle" />
        </div>
      );
    } else {
      return node;
    }
  }, [apy, incentiveApr, totalApr]);

  return showTooltip && (isIncentiveActive || !isBaseAprReadyToBeShown || isLidoApr || isEthenaSatsIncentive) ? (
    <TooltipWithPortal
      maxAllowedWidth={280}
      handle={aprNode}
      position="bottom-end"
      renderContent={renderTooltipContent}
    />
  ) : (
    aprNode
  );
}
