import { getKeepLeverageKey } from "config/localStorage";
import { SettingsContextType, useSettings } from "context/SettingsContext/SettingsContextProvider";
import { UserReferralInfo, useUserReferralInfoRequest } from "domain/referrals";
import { PeriodAccountStats, useAccountStats, usePeriodAccountStats } from "domain/synthetics/accountStats";
import { useGasLimits, useGasPrice } from "domain/synthetics/fees";
import { RebateInfoItem, useRebatesInfoRequest } from "domain/synthetics/fees/useRebatesInfo";
import useUiFeeFactorRequest from "domain/synthetics/fees/utils/useUiFeeFactor";
import {
  MarketsInfoResult,
  MarketsResult,
  useMarketTokensDataRequest,
  useMarkets,
  useMarketsInfoRequest,
} from "domain/synthetics/markets";
import { OrderEditorState, useOrderEditorState } from "domain/synthetics/orders/useOrderEditorState";
import { AggregatedOrdersDataResult, useOrdersInfoRequest } from "domain/synthetics/orders/useOrdersInfo";
import {
  PositionsConstantsResult,
  PositionsInfoResult,
  usePositionsConstantsRequest,
  usePositionsInfoRequest,
} from "domain/synthetics/positions";
import { TokensData } from "domain/synthetics/tokens";
import { ConfirmationBoxState, useConfirmationBoxState } from "domain/synthetics/trade/useConfirmationBoxState";
import { PositionEditorState, usePositionEditorState } from "domain/synthetics/trade/usePositionEditorState";
import { PositionSellerState, usePositionSellerState } from "domain/synthetics/trade/usePositionSellerState";
import { TradeboxState, useTradeboxState } from "domain/synthetics/trade/useTradeboxState";
import { ethers } from "ethers";
import { useChainId } from "lib/chains";
import { getTimePeriodsInSeconds } from "lib/dates";
import { useLocalStorageSerializeKey } from "lib/localStorage";
import { useMeasureLoadTime } from "lib/metrics";
import useWallet from "lib/wallets/useWallet";
import { ReactNode, useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Context, createContext, useContext, useContextSelector } from "use-context-selector";
import { LeaderboardState, useLeaderboardState } from "./useLeaderboardState";
import { AccountStats } from "domain/synthetics/accountStats";

export type SyntheticsPageType =
  | "accounts"
  | "trade"
  | "pools"
  | "leaderboard"
  | "competitions"
  | "dashboard"
  | "earn"
  | "buy"
  | "home";

export type SyntheticsState = {
  pageType: SyntheticsPageType;
  globals: {
    chainId: number;
    markets: MarketsResult;
    marketsInfo: MarketsInfoResult;
    positionsInfo: PositionsInfoResult;
    account: string | undefined;
    ordersInfo: AggregatedOrdersDataResult;
    positionsConstants: PositionsConstantsResult["positionsConstants"];
    uiFeeFactor: bigint;
    userReferralInfo: UserReferralInfo | undefined;
    depositMarketTokensData: TokensData | undefined;

    closingPositionKey: string | undefined;
    setClosingPositionKey: (key: string | undefined) => void;

    keepLeverage: boolean | undefined;
    setKeepLeverage: (value: boolean) => void;

    gasLimits: ReturnType<typeof useGasLimits>;
    gasPrice: ReturnType<typeof useGasPrice>;

    lastWeekAccountStats?: PeriodAccountStats;
    lastMonthAccountStats?: PeriodAccountStats;
    accountStats?: AccountStats;
  };
  claims: {
    accruedPositionPriceImpactFees: RebateInfoItem[];
    claimablePositionPriceImpactFees: RebateInfoItem[];
  };
  leaderboard: LeaderboardState;
  settings: SettingsContextType;
  tradebox: TradeboxState;
  orderEditor: OrderEditorState;
  positionSeller: PositionSellerState;
  positionEditor: PositionEditorState;
  confirmationBox: ConfirmationBoxState;
};

const StateCtx = createContext<SyntheticsState | null>(null);

let latestState: SyntheticsState | null = null;

export function SyntheticsStateContextProvider({
  children,
  skipLocalReferralCode,
  pageType,
  overrideChainId,
}: {
  children: ReactNode;
  skipLocalReferralCode: boolean;
  pageType: SyntheticsState["pageType"];
  overrideChainId?: number;
}) {
  const { chainId: selectedChainId } = useChainId();

  const { account: walletAccount, signer } = useWallet();
  const { account: paramsAccount } = useParams<{ account?: string }>();

  let checkSummedAccount: string | undefined;

  if (paramsAccount && ethers.isAddress(paramsAccount)) {
    checkSummedAccount = ethers.getAddress(paramsAccount);
  }

  const isLeaderboardPage = pageType === "competitions" || pageType === "leaderboard";
  const isTradePage = pageType === "trade";
  const isAccountPage = pageType === "accounts";

  const account = isAccountPage ? checkSummedAccount : walletAccount;
  const leaderboard = useLeaderboardState(account, isLeaderboardPage);
  const chainId = isLeaderboardPage ? leaderboard.chainId : overrideChainId ?? selectedChainId;

  const markets = useMarkets(chainId);
  const marketsInfo = useMarketsInfoRequest(chainId);

  const { marketTokensData: depositMarketTokensData } = useMarketTokensDataRequest(chainId, {
    isDeposit: true,
    account,
  });
  const { positionsConstants } = usePositionsConstantsRequest(chainId);
  const { uiFeeFactor } = useUiFeeFactorRequest(chainId);
  const userReferralInfo = useUserReferralInfoRequest(signer, chainId, account, skipLocalReferralCode);
  const [closingPositionKey, setClosingPositionKey] = useState<string>();
  const { accruedPositionPriceImpactFees, claimablePositionPriceImpactFees } = useRebatesInfoRequest(
    chainId,
    isTradePage
  );

  const settings = useSettings();

  const {
    isLoading,
    positionsInfoData,
    error: positionsInfoError,
  } = usePositionsInfoRequest(chainId, {
    account,
    showPnlInLeverage: settings.isPnlInLeverage,
    marketsInfoData: marketsInfo.marketsInfoData,
    skipLocalReferralCode,
    tokensData: marketsInfo.tokensData,
  });

  const ordersInfo = useOrdersInfoRequest(chainId, {
    account,
    marketsInfoData: marketsInfo.marketsInfoData,
    tokensData: marketsInfo.tokensData,
  });

  const tradeboxState = useTradeboxState(chainId, isTradePage, {
    marketsInfoData: marketsInfo.marketsInfoData,
    tokensData: marketsInfo.tokensData,
    positionsInfoData,
  });

  const orderEditor = useOrderEditorState(ordersInfo.ordersInfoData);

  const timePerios = useMemo(() => getTimePeriodsInSeconds(), []);

  const { data: lastWeekAccountStats } = usePeriodAccountStats(chainId, {
    account,
    from: timePerios.week[0],
    to: timePerios.week[1],
    enabled: pageType === "trade",
  });

  const { data: lastMonthAccountStats } = usePeriodAccountStats(chainId, {
    account,
    from: timePerios.month[0],
    to: timePerios.month[1],
    enabled: pageType === "trade",
  });

  const { data: accountStats } = useAccountStats(chainId, {
    account,
    enabled: pageType === "trade",
  });

  // TODO move closingPositionKey to positionSellerState
  const positionSellerState = usePositionSellerState(chainId, positionsInfoData?.[closingPositionKey ?? ""]);
  const positionEditorState = usePositionEditorState(chainId);
  const confirmationBoxState = useConfirmationBoxState();

  const gasLimits = useGasLimits(chainId);
  const gasPrice = useGasPrice(chainId);

  const [keepLeverage, setKeepLeverage] = useLocalStorageSerializeKey(getKeepLeverageKey(chainId), true);

  useMeasureLoadTime({
    isLoaded: Boolean(positionsInfoData && !isLoading),
    error: positionsInfoError || marketsInfo.error,
    skip: !account || pageType !== "trade",
    metricType: "positionsListLoad",
  });

  const state = useMemo(() => {
    const s: SyntheticsState = {
      pageType,
      globals: {
        chainId,
        account,
        markets,
        marketsInfo,
        ordersInfo,
        positionsConstants,
        positionsInfo: {
          isLoading,
          positionsInfoData,
        },
        uiFeeFactor,
        userReferralInfo,
        depositMarketTokensData,

        closingPositionKey,
        setClosingPositionKey,

        gasLimits,
        gasPrice,

        keepLeverage,
        setKeepLeverage,
        lastWeekAccountStats,
        lastMonthAccountStats,
        accountStats,
      },
      claims: { accruedPositionPriceImpactFees, claimablePositionPriceImpactFees },
      leaderboard,
      settings,
      tradebox: tradeboxState,
      orderEditor,
      positionSeller: positionSellerState,
      positionEditor: positionEditorState,
      confirmationBox: confirmationBoxState,
    };

    return s;
  }, [
    pageType,
    chainId,
    account,
    markets,
    marketsInfo,
    ordersInfo,
    positionsConstants,
    isLoading,
    positionsInfoData,
    uiFeeFactor,
    userReferralInfo,
    depositMarketTokensData,
    closingPositionKey,
    gasLimits,
    gasPrice,
    keepLeverage,
    setKeepLeverage,
    lastWeekAccountStats,
    lastMonthAccountStats,
    accountStats,
    accruedPositionPriceImpactFees,
    claimablePositionPriceImpactFees,
    leaderboard,
    settings,
    tradeboxState,
    orderEditor,
    positionSellerState,
    positionEditorState,
    confirmationBoxState,
  ]);

  latestState = state;

  return <StateCtx.Provider value={state}>{children}</StateCtx.Provider>;
}

export function useSyntheticsStateSelector<Selected>(selector: (s: SyntheticsState) => Selected) {
  const value = useContext(StateCtx);
  if (!value) {
    throw new Error("Used useSyntheticsStateSelector outside of SyntheticsStateContextProvider");
  }
  return useContextSelector(StateCtx as Context<SyntheticsState>, selector) as Selected;
}

export function useCalcSelector() {
  return useCallback(function useCalcSelector<Selected>(selector: (state: SyntheticsState) => Selected) {
    if (!latestState) throw new Error("Used calcSelector outside of SyntheticsStateContextProvider");
    return selector(latestState);
  }, []);
}
