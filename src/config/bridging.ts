type BridgingOption = {
  name: string;
  generateLink: (chainId: number) => string;
};
const BRIDGING_OPTIONS: { [symbol: string]: BridgingOption[] } = {
  SOL: [
    {
      name: "Portalbridge",
      generateLink: () => "https://portalbridge.com/?sourceChain=solana&targetChain=arbitrum",
    },
  ],
  BNB: [
    {
      name: "Stargate",
      generateLink: () => "https://stargate.finance/transfer",
    },
  ],
  AAVE: [
    {
      name: "Arbitrum",
      generateLink: () =>
        "https://bridge.arbitrum.io/?destinationChain=arbitrum-one&sourceChain=ethereum&token=0xba5ddd1f9d7f570dc94a51479a000e3bce967196",
    },
  ],
  AVAX: [
    {
      name: "Portalbridge",
      generateLink: () => "https://portalbridge.com/?sourceChain=avalanche&targetChain=arbitrum",
    },
  ],
  OP: [
    {
      name: "Stargate",
      generateLink: () => " https://stargate.finance/transfer",
    },
  ],
  PEPE: [
    {
      name: "Stargate",
      generateLink: () => "https://stargate.finance/bridge",
    },
  ],
  WIF: [
    {
      name: "Portalbridge",
      generateLink: () => "https://portalbridge.com/advanced-tools/#/transfer?sourceChain=solana&targetChain=arbitrum",
    },
  ],
  USDe: [
    {
      name: "Stargate",
      generateLink: () => "https://stargate.finance/bridge",
    },
  ],
  wstETH: [
    {
      name: "Arbitrum",
      generateLink: () => "https://bridge.arbitrum.io/?destinationChain=arbitrum-one&sourceChain=ethereum",
    },
  ],
};

export function getBridgingOptionsForToken(tokenSymbol?: string): BridgingOption[] | undefined {
  if (!tokenSymbol) return;
  return BRIDGING_OPTIONS[tokenSymbol];
}
