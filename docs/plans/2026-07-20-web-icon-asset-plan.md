# Nortia web icon and asset plan

## Objective

Give every network, collateral, market category, resolver, and wallet surface a clear icon without introducing loose or unverified imagery.

## Source policy

1. Use the installed Solana wallet adapter for connected-wallet logos and wallet selection.
2. Use tree-shaken static components from [`@web3icons/react`](https://github.com/0xa3k5/web3icons) for Solana, SOL, and USDC brand assets.
3. Use the existing [`lucide-react`](https://lucide.dev/) package for interface actions, market categories, resolver types, and proof concepts.
4. Download an external SVG only when neither maintained library covers the required concept. Store it locally with source and license notes.

The current requested surface is fully covered by maintained libraries, so no direct asset download is required.

## Mapping

| Surface | Asset source | Icon |
| --- | --- | --- |
| Solana devnet | Web3 Icons | Branded Solana network |
| USDC collateral | Web3 Icons | Branded USDC token |
| SOL fee balance | Web3 Icons | Branded SOL token |
| Connected wallet | Solana wallet adapter | Active wallet adapter icon |
| Sports | Lucide | Trophy |
| Crypto | Lucide | Bitcoin |
| Economics | Lucide | Market chart |
| Politics | Lucide | Landmark |
| Technology | Lucide | CPU |
| Culture | Lucide | Clapperboard |
| Science | Lucide | Flask |
| Other | Lucide | Shapes |
| TxLINE | Lucide | Radio tower |
| Pyth | Lucide | Candlestick chart |
| Switchboard | Lucide | Network |
| Stork | Lucide | Waypoints |
| Bonded optimistic | Lucide | Scale |

## Implementation order

1. Add the Web3 Icons dependency and reusable icon components.
2. Add category icons to discovery, cards, and market creation.
3. Add resolver icons to market creation and protocol explanation surfaces.
4. Add Solana, USDC, SOL, and active-wallet assets to header, wallet, trading, portfolio, and proof surfaces.
5. Verify type safety, optimized production build, responsive layout, accessible labels, focus states, and icon alignment.
