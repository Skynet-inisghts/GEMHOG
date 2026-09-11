# Security

## The boundary

GEMHOG holds no keys and has no transaction path. The repository contains no signing primitive of any kind, and the `no-signer` CI job fails any commit that introduces one (`PRIVATE_KEY`, `privateKeyToAccount`, `signTransaction`, `sendTransaction`, `writeContract`, `walletClient`, `signMessage`) into `lib/`, `app/` or `bin/`.

Holder Check requests exactly one thing from an injected wallet: `eth_requestAccounts`, the public address. No signatures, no approvals, no network switching, no transaction requests — verifiable in the browser's devtools and in `app/holders/page.tsx`, which contains the only wallet call in the repository.

The only outbound write anywhere is the optional Telegram alert, sent exclusively to a bot token and chat id the user placed in their own `.env`.

## What a grade is not

A grade measures past holder behaviour from public chain data. It is not a prediction, not an endorsement, and not a proof that a token is safe. Nothing in this repository can protect anyone from a token's contract, its dev, or the market.

## Reporting

Open a GitHub issue for anything that does not expose users (rate limits, RPC handling, wrong math). If you find something that could harm users of the hosted site — a way to make the site request a signature, leak an address, or serve tampered data — open a private security advisory on the repository instead of a public issue.

## Scope for reports

In scope: the engine (`lib/`), the site (`app/`), the CLI (`bin/`), the bot (`bot/`), the workflows. Out of scope: the pons contracts, the chain, the third-party APIs this tool reads.
