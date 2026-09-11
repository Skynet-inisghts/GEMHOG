# Launch kit

What to do, in order, the day $GEMHOG goes live. Everything that must change is listed here; nothing else should.

## 1. Paste the contract address

One file is the source of truth: [`lib/gemhog/project-token.ts`](../lib/gemhog/project-token.ts).

```ts
export const PROJECT_TOKEN = {
  ticker: "$GEMHOG",
  address: "0x…the live CA…",
} as const;
```

That single edit activates, everywhere at once:

- the token rail on the landing page (CA with Pons and Blockscout links instead of TBA);
- the live $GEMHOG holder receipt slot on `/holders`;
- the `official $GEMHOG` line in every CLI holders table.

Then update the `Official $GEMHOG contract` line in `README.md` with the address and its Blockscout / Pons links, commit, tag, deploy.

## 2. Verify in public

- Run `pnpm gemhog check <CA>` and post the certificate screenshot — the tool grading its own token, whatever the grade says. Credibility comes from not special-casing yourself.
- Check the address renders correctly on `/`, `/holders`, and in the README.

## 3. Where to post

- **X / Twitter**: the banner (`assets/twitter-header.png` for the profile), a thread: what GEMHOG measures, the certificate of a known token, the certificate of $GEMHOG itself, repo link. The pig is the meme; the certificate is the product.
- **Telegram**: the public bot (`docs/BOT.md`), pinned message with `/check` usage.
- **The repo**: this is part of the product. Six tagged releases with a real changelog are the trust signal; keep the rhythm after launch.

## 4. What never changes at launch

- No signing, no transaction path, no keys — launch does not add a buy button anywhere.
- `GET /api/top` keeps returning counters only; the hunt list stays in the CLI.
- Grades are not edited for the home token. If $GEMHOG grades SI1, it shows SI1.

## Deployment reference

Site: Vercel, standard Next.js (`pnpm build`). Optional env: `RPC_URL`, `BLOCKSCOUT_API_KEY`. Bot: any box with Node 22 + Python 3.11, `docker-compose.yml` at the repo root runs the serve + bot pair; `hunt --follow` next to it feeds `/top` and `/alerts`.
