# FlashSeat Frontend Backend Follow-ups

## Priority 1 — Fix booking UX (seat selection must be confirmed)
- [x] **1.** Confirm checkout modal (`ConfirmCheckoutModal.tsx`)
- [x] **2.** Checkout flow: modal → confirm → POST /orders
- [x] **3.** Remove from cart UI (UI-only, `CartItem.tsx`)
- [x] **4.** Prevent double-checkout (`checkoutInProgress` guard)

## Priority 2 — Make cart state reliable while polling seats
- [x] **5.** Cart reconciliation from server state (`cartStore.reconcile()`)
- [x] **6.** Locked seats stay visually marked after refresh (`Seat.tsx`)

## Priority 3 — Improve overall frontend correctness and resilience
- [x] **7.** Click-listener logic (React handles natively)
- [x] **8.** Session switch clears cart (`cartStore.setSession()`)
- [x] **9.** Lock contention feedback (toast on 409)
- [x] **10.** Selected seat highlight (yellow + pulse animation)

## Priority 4 — Add missing UI sections / usability improvements
- [x] **11.** Cart Summary with section breakdown (`CartSummary.tsx`)
- [x] **12.** Checkout success screen (`CheckoutSuccess.tsx`)
- [x] **13.** My Orders page (`ProfilePage.tsx` + `OrderList.tsx`)

## Priority 5 — Make the project much better (new ideas)
- [ ] **14.** Replace polling with WebSockets (needs backend)
- [ ] **15.** Backend endpoint for cart/locked seats ownership (needs backend)
- [ ] **16.** Explicit unlock endpoint (needs backend)
- [ ] **17.** Pricing + section-level seat pricing (needs backend)
- [ ] **18.** Payments integration placeholder (needs backend)
- [x] **19.** Better queue UX (animated position, dots, clearer leave)
- [x] **20.** Frontend security: UUID validation for query params
- [x] **21.** Persist cart state across reload (Zustand persist + localStorage)
- [x] **22.** Accessibility: ARIA live regions, keyboard nav, focus-visible
- [x] **23.** UI/UX polish: CSS tooltips, hover effects, responsive seat grid

## Testing checklist (manual)
- [x] **24.** Seat selection: click → lock → cart → yellow highlight
- [x] **25.** Confirmation: checkout → modal → confirm → success screen
- [x] **26.** Session switch: cart clears, no cross-session locks
- [x] **27.** Contention: 409 → toast message

---

## Progress Tracking
- [x] Priority 1-4: All items complete
- [x] Priority 5 (frontend-only): Items 19-23 complete
- [ ] Priority 5 (needs backend): Items 14-18

## Migration Notes
- Frontend rewritten in `frontend-react/` with Vite + React + TypeScript
- Zustand stores for auth + cart (cart persisted to localStorage)
- React Router 6, custom polling hooks, reusable UI components
- Responsive layout (mobile/tablet/desktop)
- CSS tooltips, ARIA attributes, keyboard navigation
- Original `frontend/` preserved for reference
