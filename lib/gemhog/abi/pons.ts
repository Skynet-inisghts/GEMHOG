import { parseAbi, toEventSelector } from "viem";

/**
 * pons v2 on Robinhood Chain.
 * Adapted from bodkin (MIT) — https://github.com/Phosphenq/bodkin
 *
 * Sources: docs.ponsfamily.com/v2, the verified PonsV2LaunchFactory /
 * V2FeeEscrow ABIs on Blockscout and contractsV2/src/v2 in
 * github.com/ponsdotdev/ponsfamily (the curve is not verified on Blockscout,
 * so its ABI comes from the repo).
 */

export const factoryAbi = parseAbi([
  "struct LaunchedToken { address token; address curve; address deployer; address creatorFeeRecipient; address pairToken; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; uint16 creatorTaxBps; bool buybackEnabled; uint8 phase; uint256 sweptQuote; uint256 sweptTokens; uint256 sweptAt; bool exists; }",
  "function getLaunchedToken(address token) view returns (LaunchedToken)",
  "function snipeTaxStartBps() view returns (uint256)",
  "function snipeTaxSeconds() view returns (uint256)",
  "function launchEnabled() view returns (bool)",
  "function feeEscrow() view returns (address)",
  "function memeHook() view returns (address)",
  "function launchDeployer() view returns (address)",
  "event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)",
  "event PoolGraduated(address indexed token, uint256 positionId, uint256 tokenAmount, uint256 pairTokenAmount)",
]);

export const curveAbi = parseAbi([
  "function getReserves() view returns (uint256 quoteReserve, uint256 tokenReserve)",
  "function realQuoteReserve() view returns (uint256)",
  "function graduationThreshold() view returns (uint256)",
  "function graduated() view returns (bool)",
  "function readyToGraduate() view returns (bool)",
  "function feeBps() view returns (uint256)",
  "function creatorTaxBps() view returns (uint256)",
  "function isNativeQuote() view returns (bool)",
  "function pairToken() view returns (address)",
  "function launchedAt() view returns (uint256)",
  "event CurveBuy(address indexed buyer, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 tax)",
  "event CurveSell(address indexed seller, address indexed recipient, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 tax)",
]);

export const erc20Abi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

export const escrowAbi = parseAbi([
  "function balanceOf(address recipient) view returns (uint256)",
  "event Credited(address indexed recipient, address indexed depositor, uint256 amount)",
  "event Claimed(address indexed recipient, uint256 amount)",
]);

export const TOPIC = {
  tokenLaunched: toEventSelector("TokenLaunched(address,address,address,address,uint256,uint256)"),
  curveBuy: toEventSelector("CurveBuy(address,address,uint256,uint256,uint256,uint256)"),
  curveSell: toEventSelector("CurveSell(address,address,uint256,uint256,uint256,uint256)"),
  poolGraduated: toEventSelector("PoolGraduated(address,uint256,uint256,uint256)"),
  transfer: toEventSelector("Transfer(address,address,uint256)"),
  credited: toEventSelector("Credited(address,address,uint256)"),
  claimed: toEventSelector("Claimed(address,uint256)"),
} as const;

export const Phase = { NotGraduated: 0, Swept: 1, PoolCreated: 2, Rescued: 3 } as const;
export const PHASE_NAME = ["curve", "swept", "pool", "rescued"] as const;

export const BPS = 10_000n;
/** 1B tokens, the only launch config live at the time of writing (id 0). */
export const SUPPLY = 1_000_000_000n * 10n ** 18n;
