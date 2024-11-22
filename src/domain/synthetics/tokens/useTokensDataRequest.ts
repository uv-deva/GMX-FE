import { getTokensMap, getV2Tokens } from "config/tokens";
import { useMemo } from "react";
import { TokensData } from "./types";
import { useTokenBalances } from "./useTokenBalances";
import { useTokenRecentPricesRequest } from "./useTokenRecentPricesData";

type TokensDataResult = {
  tokensData?: TokensData;
  pricesUpdatedAt?: number;
  error?: Error;
};

export function useTokensDataRequest(chainId: number): TokensDataResult {
  const tokenConfigs = getTokensMap(chainId);
  const { balancesData, error: balancesError } = useTokenBalances(chainId); // user balances for all token present under token section
  const { pricesData, updatedAt: pricesUpdatedAt, error: pricesError } = useTokenRecentPricesRequest(chainId); // calling tickers api and return only ETH and BTC token info

  const error = balancesError || pricesError;

  const data = useMemo(() => {
    if (error) {
      return {
        error,
      };
    }

    const tokenAddresses = getV2Tokens(chainId)?.map((token) => token.address);

    if (!pricesData) {
      return {
        tokensData: undefined,
        pricesUpdatedAt: undefined,
      };
    }

    return {
      tokensData: tokenAddresses.reduce((acc: TokensData, tokenAddress) => {
        const prices = pricesData?.[tokenAddress];
        const balance = balancesData?.[tokenAddress];
        const tokenConfig = tokenConfigs[tokenAddress];

        if (!prices) {
          return acc;
        }

        acc[tokenAddress] = {
          ...tokenConfig,
          prices,
          balance,
        };
        return acc;
      }, {} as TokensData),
      pricesUpdatedAt,
    };
  }, [error, chainId, pricesData, pricesUpdatedAt, balancesData, tokenConfigs]);

  return data;
}
