import { Chain } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

export function getPositiveOrNegativeClass(
  value?: bigint,
  zeroValue: "" | "text-red-500" | "text-green-500" = ""
): string {
  if (value === undefined) {
    return "";
  }
  return value === 0n ? zeroValue : value < 0n ? "text-red-500" : "text-green-500";
}

export function getPlusOrMinusSymbol(value?: bigint, opts: { showPlusForZero?: boolean } = {}): string {
  if (value === undefined) {
    return "";
  }

  const { showPlusForZero = false } = opts;
  return value === 0n ? (showPlusForZero ? "+" : "") : value < 0n ? "-" : "+";
}

export function promiseWithResolvers<T = void>() {
  let resolve: (value: T) => void;
  let reject: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve: resolve!, reject: reject! };
}

// export const depo = {
//   id: 51181,
//   name: "TDepo",
//   iconUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png",
//   iconBackground: "#fff",
//   nativeCurrency: { name: "TDepo", symbol: "tDepo", decimals: 18 },
//   rpcUrls: {
//     default: { http: ["https://test1rpc.depo.network/"] },
//   },
//   blockExplorers: {
//     default: { name: "Depo", url: "https://test1exp.depo.network/" },
//   },
// } as const satisfies Chain;

export const depo = defineChain({
  id: 51181,
  name: "TDepo",
  nativeCurrency: {
    decimals: 18,
    name: "TDepo",
    symbol: "tDepo",
  },
  rpcUrls: {
    default: { http: ["https://test1rpc.depo.network/"] },
  },
  blockExplorers: {
    default: {
      name: "Depo",
      url: "https://test1exp.depo.network/",
      // apiUrl: "https://api.snowscan.xyz/api",
    },
  },
  contracts: {
    multicall3: {
      address: "0xEe9e67455250D4B25c69Acf11e335f8D0Ae6d84A",
      blockCreated: 11907934,
    },
  },
});
