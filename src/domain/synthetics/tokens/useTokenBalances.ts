import { useAccount, useReadContracts } from "wagmi";
import type { Abi } from "viem";

import { getContract } from "config/contracts";
import { getV2Tokens, NATIVE_TOKEN_ADDRESS } from "config/tokens";
import { PLACEHOLDER_ACCOUNT } from "lib/legacy";
import { useMulticall } from "lib/multicall";
import { TokenBalancesData } from "./types";

import Multicall from "abis/Multicall.json";
import Token from "abis/Token.json";

type AddString = `0x${string}`;

type BalancesDataResult = {
  balancesData?: TokenBalancesData;
  error?: Error;
};

export function useTokenBalances(
  chainId: number,
  overrideAccount?: string | undefined,
  overrideTokenList?: {
    address: string;
    isSynthetic?: boolean;
  }[],
  refreshInterval?: number
): BalancesDataResult {
  const { address: currentAccount } = useAccount();
  // console.log(currentAccount, chainId, overrideAccount, overrideTokenList, "<-----");
  const account = overrideAccount ?? currentAccount;

  const { data, error } = useMulticall(chainId, "useTokenBalances", {
    key: account ? [account, ...(overrideTokenList || []).map((t) => t.address)] : null,

    refreshInterval,

    request: () =>
      (overrideTokenList ?? getV2Tokens(chainId)).reduce((acc, token) => {
        // Skip synthetic tokens
        if (token.isSynthetic) return acc;
        const address = token.address;

        if (address === NATIVE_TOKEN_ADDRESS) {
          acc[address] = {
            contractAddress: getContract(chainId, "Multicall"),
            abi: Multicall.abi,
            calls: {
              balance: {
                methodName: "getEthBalance",
                params: [account],
              },
            },
          };
        } else {
          acc[address] = {
            contractAddress: address,
            abi: Token.abi,
            calls: {
              balance: {
                methodName: "balanceOf",
                params: [account ?? PLACEHOLDER_ACCOUNT],
              },
            },
          };
        }
        return acc;
      }, {}),
    parseResponse: (res) => {
      const data = Object.keys(res.data).reduce((tokenBalances: TokenBalancesData, tokenAddress) => {
        tokenBalances[tokenAddress] = res.data[tokenAddress].balance.returnValues[0];
        return tokenBalances;
      }, {} as TokenBalancesData);
      return data;
    },
  });

  return {
    balancesData: data,
    error,
  };
}
