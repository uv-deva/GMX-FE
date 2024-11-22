import { Trans } from "@lingui/macro";
import keys from "lodash/keys";
import uniq from "lodash/uniq";
import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";

import { ARBITRUM, AVALANCHE } from "config/chains";
import { getIcon } from "config/icons";
import { getIncentivesV2Url } from "config/links";
import { getMarketListingDate } from "config/markets";
import useIncentiveStats from "domain/synthetics/common/useIncentiveStats";
import { getIsBaseApyReadyToBeShown } from "domain/synthetics/markets/getIsBaseApyReadyToBeShown";
import type { MarketTokensAPRData } from "domain/synthetics/markets/types";
import { useGmMarketsApy } from "domain/synthetics/markets/useGmMarketsApy";
import { useChainId } from "lib/chains";
import { isHomeSite } from "lib/legacy";
import { formatAmount } from "lib/numbers";
import { switchNetwork } from "lib/wallets";
import useWallet from "lib/wallets/useWallet";

import BannerButton from "components/Banner/BannerButton";
import Button from "components/Button/Button";
import ExternalLink from "components/ExternalLink/ExternalLink";
import APRLabel from "../APRLabel/APRLabel";
import { HeaderLink } from "../Header/HeaderLink";

import sparkleIcon from "img/sparkle.svg";

const glpIcon = getIcon("common", "glp");
const gmxIcon = getIcon("common", "gmx");
const gmIcon = getIcon("common", "gm");

function calculateMaxApr(chainId: number, apr: MarketTokensAPRData, incentiveApr: MarketTokensAPRData) {
  const allKeys = uniq(keys(apr).concat(keys(incentiveApr)));

  let maxApr = 0n;

  for (const key of allKeys) {
    const isBaseApyReadyToBeShown = getIsBaseApyReadyToBeShown(getMarketListingDate(chainId, key));

    let aprValue = 0n;
    if (isBaseApyReadyToBeShown) {
      aprValue = apr[key] ?? 0n;
    }

    const incentiveAprValue = incentiveApr[key] ?? 0n;
    const totalApr = aprValue + incentiveAprValue;

    if (totalApr > maxApr) {
      maxApr = totalApr;
    }
  }

  return maxApr;
}

type Props = {
  showRedirectModal?: (to: string) => void;
};

export default function TokenCard({ showRedirectModal }: Props) {
  const { chainId } = useChainId();
  const { active } = useWallet();
  const arbitrumIncentiveState = useIncentiveStats(ARBITRUM);
  const avalancheIncentiveState = useIncentiveStats(AVALANCHE);
  const { marketsTokensApyData: arbApy, marketsTokensIncentiveAprData: arbIncentiveApr } = useGmMarketsApy(ARBITRUM);
  const { marketsTokensApyData: avaxApy, marketsTokensIncentiveAprData: avaxIncentiveApr } = useGmMarketsApy(AVALANCHE);

  const maxApyText = useMemo(() => {
    if (!arbApy || !arbIncentiveApr || !avaxApy || !avaxIncentiveApr)
      return {
        [ARBITRUM]: "...%",
        [AVALANCHE]: "...%",
      };

    const maxArbApy = calculateMaxApr(ARBITRUM, arbApy, arbIncentiveApr);
    const maxAvaxApy = calculateMaxApr(AVALANCHE, avaxApy, avaxIncentiveApr);

    return {
      [ARBITRUM]: `${formatAmount(maxArbApy, 28, 2)}%`,
      [AVALANCHE]: `${formatAmount(maxAvaxApy, 28, 2)}%`,
    };
  }, [arbApy, arbIncentiveApr, avaxApy, avaxIncentiveApr]);

  const changeNetwork = useCallback(
    (network) => {
      if (network === chainId) {
        return;
      }
      if (!active) {
        setTimeout(() => {
          return switchNetwork(network, active);
        }, 500);
      } else {
        return switchNetwork(network, active);
      }
    },
    [chainId, active]
  );

  const BuyLink = ({ className, to, children, network }) => {
    const isHome = isHomeSite();
    if (isHome && showRedirectModal) {
      return (
        <HeaderLink to={to} className={className} showRedirectModal={showRedirectModal}>
          {children}
        </HeaderLink>
      );
    }

    return (
      <Link to={to} className={className} onClick={() => changeNetwork(network)}>
        {children}
      </Link>
    );
  };

  const poolsIncentivizedLabel = useMemo(() => {
    const sparkle = <img src={sparkleIcon} alt="sparkle" className="relative -top-2 -mr-10 inline h-10 align-top" />;
    const arbitrumLink = <ExternalLink href={getIncentivesV2Url(ARBITRUM)}>Arbitrum</ExternalLink>;
    const avalancheLink = <ExternalLink href={getIncentivesV2Url(AVALANCHE)}>Avalanche</ExternalLink>;
    if (arbitrumIncentiveState?.lp?.isActive && avalancheIncentiveState?.lp?.isActive) {
      return (
        <Trans>
          {arbitrumLink} and {avalancheLink} GM Pools are{" "}
          <span className="whitespace-nowrap">incentivized{sparkle}.</span>
        </Trans>
      );
    } else if (arbitrumIncentiveState?.lp?.isActive) {
      return (
        <Trans>
          {arbitrumLink} GM Pools are <span className="whitespace-nowrap">incentivized{sparkle}.</span>
        </Trans>
      );
    } else if (avalancheIncentiveState?.lp?.isActive) {
      return (
        <Trans>
          {avalancheLink} GM Pools are <span className="whitespace-nowrap">incentivized{sparkle}.</span>
        </Trans>
      );
    } else {
      return null;
    }
  }, [arbitrumIncentiveState?.lp?.isActive, avalancheIncentiveState?.lp?.isActive]);

  return (
    <div className="Home-token-card-options">
      <div className="Home-token-card-option">
        <div>
          <div className="Home-token-card-option-icon">
            <img src={gmxIcon} width="40" alt="GMX Icons" /> GMX
          </div>
          <div className="Home-token-card-option-info">
            <div className="Home-token-card-option-title">
              <Trans>
                GMX is the utility and governance token. Accrues 30% and 27% of V1 and V2 markets generated fees,
                respectively.
              </Trans>
            </div>
            <div className="Home-token-card-option-apr">
              <Trans>Arbitrum APR:</Trans> <APRLabel chainId={ARBITRUM} label="avgGMXAprForNativeToken" />,{" "}
              <Trans>Avalanche APR:</Trans> <APRLabel chainId={AVALANCHE} label="avgGMXAprForNativeToken" />
            </div>
          </div>
        </div>
        <div className="Home-token-card-option-action">
          <div className="buy">
            <BuyLink to="/buy_gmx" className="default-btn" network={ARBITRUM}>
              <Trans>View on Arbitrum</Trans>
            </BuyLink>
            <BuyLink to="/buy_gmx" className="default-btn" network={AVALANCHE}>
              <Trans>View on Avalanche</Trans>
            </BuyLink>
          </div>
          <Button
            className="!py-11 tracking-normal"
            newTab
            variant="primary"
            to="https://docs.gmx.io/docs/category/tokenomics"
          >
            <Trans>Read more</Trans>
          </Button>
        </div>
      </div>
      <div className="Home-token-card-option">
        <div>
          <div className="Home-token-card-option-icon">
            <img src={gmIcon} alt="gmxBigIcon" /> GM
          </div>
          <div className="Home-token-card-option-info">
            <div className="Home-token-card-option-title">
              <Trans>
                GM is the liquidity provider token for GMX V2 markets. Accrues 63% of the V2 markets generated fees.
              </Trans>
            </div>
          </div>
          {poolsIncentivizedLabel && (
            <div className="mt-15 rounded-4 bg-cold-blue-900 px-15 py-8 text-15">{poolsIncentivizedLabel}</div>
          )}
          <div className="Home-token-card-option-apr">
            <Trans>Arbitrum Max. APY:</Trans> {maxApyText?.[ARBITRUM]},{" "}
            <Trans>Avalanche Max. APY: {maxApyText?.[AVALANCHE]}</Trans>{" "}
          </div>
        </div>

        <div className="Home-token-card-option-action Token-card-buy">
          <div className="buy">
            <BuyLink to="/pools" className="default-btn" network={ARBITRUM}>
              <Trans>View on Arbitrum</Trans>
            </BuyLink>

            <BuyLink to="/pools" className="default-btn" network={AVALANCHE}>
              <Trans>View on Avalanche</Trans>
            </BuyLink>
          </div>
          <a
            href="https://docs.gmx.io/docs/providing-liquidity/v2"
            target="_blank"
            rel="noreferrer"
            className="default-btn read-more"
          >
            <Trans>Read more</Trans>
          </a>
        </div>
      </div>
      <div className="Home-token-card-option">
        <div>
          <div className="Home-token-card-option-icon">
            <img src={glpIcon} width="40" alt="GLP Icon" /> GLP
          </div>
          <div className="Home-token-card-option-info">
            <div className="Home-token-card-option-title">
              <Trans>
                GLP is the liquidity provider token for GMX V1 markets. Accrues 70% of the V1 markets generated fees.
              </Trans>
              {arbitrumIncentiveState?.migration?.isActive && (
                <BannerButton
                  className="mt-15"
                  label="Migrating from GLP to GM is incentivized in Arbitrum."
                  link={getIncentivesV2Url(ARBITRUM)}
                />
              )}
            </div>
            <div className="Home-token-card-option-apr">
              <Trans>Arbitrum APR:</Trans> <APRLabel chainId={ARBITRUM} label="glpAprTotal" key="ARBITRUM" />,{" "}
              <Trans>Avalanche APR:</Trans> <APRLabel chainId={AVALANCHE} label="glpAprTotal" key="AVALANCHE" />
            </div>
          </div>
        </div>
        <div className="Home-token-card-option-action">
          <div className="buy">
            <BuyLink to="/buy_glp" className="default-btn" network={ARBITRUM}>
              <Trans>View on Arbitrum</Trans>
            </BuyLink>
            <BuyLink to="/buy_glp" className="default-btn" network={AVALANCHE}>
              <Trans>View on Avalanche</Trans>
            </BuyLink>
          </div>
          <a
            href="https://docs.gmx.io/docs/providing-liquidity/v1"
            target="_blank"
            rel="noreferrer"
            className="default-btn read-more"
          >
            <Trans>Read more</Trans>
          </a>
        </div>
      </div>
    </div>
  );
}
