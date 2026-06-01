# FlashSeat Frontend Backend Follow-ups

## Priority 1 — Fix booking UX (seat selection must be confirmed)
1. ~~Update `frontend/pages/event.html`~~ → **Done: `ConfirmCheckoutModal.tsx`**
   - ✅ Modal for "Confirm booking" before checkout
   - ✅ Shows selected session info, count of locked seats, list of selected seats

2. ~~Update `frontend/js/event.js`~~ → **Done: `Cart.tsx` + `ConfirmCheckoutModal.tsx`**
   - ✅ Checkout opens confirm modal first
   - ✅ Seat click only performs lock + cart update
   - ✅ Cancel closes modal, no API call
   - ✅ Confirm booking calls POST /orders

3. ~~Add cart "Remove from cart" UI (UI-only)~~ → **Done: `CartItem.tsx`**
   - ✅ Remove control for each cart seat
   - ✅ UI-only, relies on Redis TTL / cleanup job

4. ~~Prevent checkout while checkout is in progress~~ → **Done: `cartStore.ts`**
   - ✅ `checkoutInProgress` guard
   - ✅ Confirm button disabled while request in flight

## Priority 2 — Make cart state reliable while polling seats
5. ~~Rework "cart reconciliation" logic~~ → **Done: `cartStore.reconcile()` + `useSeatPolling.ts`**
   - ✅ Source of truth = `cartSeatIds` (Set in Zustand store)
   - ✅ On seat refresh, reconcile applies `locked-by-you` styling from server state
   - ✅ Uses `booked_by === currentUserId` from API response

6. ~~Ensure locked seats remain visually marked after seat map refresh~~ → **Done: `Seat.tsx`**
   - ✅ Checks `cartSeatIds.has(seat.seat_id)` when rendering
   - ✅ If yes and seat is reserved by user, marks as `locked-by-you`

## Priority 3 — Improve overall frontend correctness and resilience
7. ~~Fix/clean the click-listener logic~~ → **Done: React handles this natively**
   - ✅ React event system replaces cloneNode hack

8. ~~Fix session change behavior~~ → **Done: `cartStore.setSession()` + `SessionSelector.tsx`**
   - ✅ Clears cart on session change
   - ✅ Resets checkout flags

9. ~~Add proper feedback for lock contention~~ → **Done: `Toast.tsx` + `EventPage.tsx`**
   - ✅ On 409, shows toast: "Seat was just taken by another user"

10. ~~Add "in cart" / "selected" highlight~~ → **Done: `Seat.tsx` + `SeatMap.css`**
    - ✅ Yellow gradient with pulse animation for locked-by-you seats

## Priority 4 — Add missing UI sections / usability improvements
11. ~~Add "Cart Summary" line~~ → **Done: `CartSummary.tsx`**
    - ✅ Shows total seats + section breakdown

12. ~~Add checkout success screen~~ → **Done: `CheckoutSuccess.tsx`**
    - ✅ Shows order ID and summary after successful POST /orders

13. ~~Add "My Orders" / history link~~ → **Done: `ProfilePage.tsx` + `OrderList.tsx` + `OrderCard.tsx`**
    - ✅ Shows order items and seat labels from GET /orders/me

## Priority 5 — Make the project much better (new ideas)
14. Replace polling with WebSockets (real-time seats)
15. Add a real backend endpoint for cart/locked seats ownership
16. Add explicit unlock endpoint
17. Pricing + section-level seat pricing
18. Payments integration placeholder
19. Better queue UX
20. Security and correctness hardening for frontend
21. Persist cart state across reload
22. Accessibility (a11y)
23. UI/UX polish

## Testing checklist (manual)
24. Seat selection test
25. Confirmation test
26. Session switch test
27. Contention test

---

## Progress Tracking
- [x] Implement confirm modal + deferred checkout
- [x] Add "Remove from cart" (UI-only first)
- [x] Make cart state reliable during polling
- [x] Ensure session switch clears cart
- [x] Add manual tests from checklist (TODO 24-27)
- [ ] Implement improvements in Priority 5 when frontend MVP is stable

## Migration Notes
- Frontend rewritten from vanilla HTML/CSS/JS to React + TypeScript + Vite
- New frontend lives in `frontend-react/` directory
- Uses Zustand for state management (auth + cart)
- Uses React Router 6 for navigation
- All Priority 1-4 TODO items implemented
- Responsive design for mobile/tablet/desktop
- Original `frontend/` preserved for reference
