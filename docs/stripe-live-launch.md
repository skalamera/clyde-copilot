# Stripe Live-Mode Launch Checklist

Status: STAGED (beta running on test mode). Created 2026-06-11.

## Live objects (already created, livemode: true)

| Object | ID | Value |
|---|---|---|
| Product | `prod_UgUMF8l32gaHT7` | "Clyde Pro Agent" |
| Monthly price | `price_1Th7NmBmOXAq5RyDf0hBNW11` | $29.99/month |
| Annual price | `price_1Th7OKBmOXAq5RyDHChorxbt` | $299.88/year ($24.99/mo equiv) |

## Current Vercel production env (project: stephens-projects-345f928b/website)

Active (TEST mode — what checkout uses today):
- `STRIPE_SECRET_KEY` = sk_test
- `STRIPE_CLYDE_PRO_PRICE_ID_MONTHLY` = test $29.99/mo (price_1Th7B4BmOXAq5RyDQ2oVY614)
- `STRIPE_CLYDE_PRO_PRICE_ID_ANNUAL` = test $299.88/yr (price_1Th7BCBmOXAq5RyDLi3hEOVw)
- `STRIPE_CLYDE_PRO_PRICE_ID` = legacy $20 test price, fallback only, unused

Parked for launch (not referenced by any code yet):
- `STRIPE_LIVE_PRICE_ID_MONTHLY` = price_1Th7NmBmOXAq5RyDf0hBNW11
- `STRIPE_LIVE_PRICE_ID_ANNUAL` = price_1Th7OKBmOXAq5RyDHChorxbt

## Launch steps (when beta ends)

1. **Stripe Dashboard (live mode)**: create webhook endpoint →
   `https://clydeai.live/api/stripe-webhook`
   Events: `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copy its `whsec_...`.

2. **Swap Vercel production env** (`vercel env rm` then `vercel env add`, or dashboard):
   - `STRIPE_SECRET_KEY` → `sk_live_...` (reveal at dashboard.stripe.com/apikeys, live mode)
   - `STRIPE_WEBHOOK_SECRET` → `whsec_...` from step 1
   - `STRIPE_CLYDE_PRO_PRICE_ID_MONTHLY` → `price_1Th7NmBmOXAq5RyDf0hBNW11`
   - `STRIPE_CLYDE_PRO_PRICE_ID_ANNUAL` → `price_1Th7OKBmOXAq5RyDHChorxbt`

3. **Redeploy**: `cd website && vercel --prod`

4. **Smoke test** with a real card on https://clydeai.live/pricing
   (both toggle positions; refund yourself after).
   Verify: annual = $299.88/yr session, monthly = $29.99/mo session,
   webhook upserts the Supabase `subscriptions` row, entitlements flip to pro.

5. **Cleanup**: archive the legacy $20 test price
   (`price_1TaqwcBmOXAq5RyDPDfGmqtJ`) in the dashboard; remove the parked
   `STRIPE_LIVE_PRICE_ID_*` vars once swapped in (optional).

## Notes / gotchas

- Swapping price IDs WITHOUT swapping the secret key breaks checkout
  instantly (live price IDs are invisible to a test key). Swap all
  three together, then deploy.
- Both checkout paths (`create-pro-signup-checkout` for new users and
  `create-checkout-session` for signed-in upgrades) read `billingPeriod`
  and resolve via `getProPriceId()` in `website/api/_billing.js` —
  no code changes needed at launch.
- Stripe CLI is installed (winget, `~/AppData/Local/Microsoft/WinGet/Links`)
  and paired to acct_1OJLAaBmOXAq5RyD, but its pairing key is restricted
  and CANNOT write live mode — live writes need an sk_live or a restricted
  key with Products/Prices write. The temp restricted key used on
  2026-06-11 should be deleted from the dashboard.
- CLI pairing key expires ~2026-09-09 (90 days).
