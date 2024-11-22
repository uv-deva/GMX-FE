import { ethers } from "ethers";

import { getContract } from "config/contracts";
import { isMarketEnabled } from "config/markets";
import { convertTokenAddress, getToken } from "config/tokens";
import { useMulticall } from "lib/multicall";
import { CONFIG_UPDATE_INTERVAL } from "lib/timeConstants";

import { MarketsData } from "./types";
import { getMarketFullName } from "./utils";

import SyntheticsReader from "abis/SyntheticsReader.json";
import { useReadContract } from "wagmi";

export type MarketsResult = {
  marketsData?: MarketsData;
  marketsAddresses?: string[];
  error?: Error | undefined;
};

const MARKETS_COUNT = 100;

export function useMarkets(chainId: number): MarketsResult {
  const { data, error } = useMulticall(chainId, "useMarketsData", {
    key: [],
    refreshInterval: CONFIG_UPDATE_INTERVAL,
    request: () => {
      const obj = {
        reader: {
          contractAddress: getContract(chainId, "SyntheticsReader"),
          abi: SyntheticsReader.abi,
          calls: {
            markets: {
              methodName: "getMarkets",
              params: [getContract(chainId, "DataStore"), 0, MARKETS_COUNT],
            },
          },
        },
      };
      return obj;
    },
    parseResponse: (res) => {
      const data = res.data.reader.markets.returnValues.reduce(
        (acc: { marketsData: MarketsData; marketsAddresses: string[] }, marketValues) => {
          if (!isMarketEnabled(chainId, marketValues.marketToken)) {
            return acc;
          }

          try {
            const indexToken = getToken(chainId, convertTokenAddress(chainId, marketValues.indexToken, "native"));
            const longToken = getToken(chainId, marketValues.longToken);
            const shortToken = getToken(chainId, marketValues.shortToken);

            const isSameCollaterals = marketValues.longToken === marketValues.shortToken;
            const isSpotOnly = marketValues.indexToken === ethers.ZeroAddress;

            const name = getMarketFullName({ indexToken, longToken, shortToken, isSpotOnly });

            acc.marketsData[marketValues.marketToken] = {
              marketTokenAddress: marketValues.marketToken,
              indexTokenAddress: marketValues.indexToken,
              longTokenAddress: marketValues.longToken,
              shortTokenAddress: marketValues.shortToken,
              isSameCollaterals,
              isSpotOnly,
              name,
              data: "",
            };

            acc.marketsAddresses.push(marketValues.marketToken);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("unsupported market", e);
          }

          return acc;
        },
        { marketsData: {}, marketsAddresses: [] }
      );
      return data;
    },
  });

  return {
    marketsData: data?.marketsData,
    marketsAddresses: data?.marketsAddresses,
    error,
  };
}
