# Agent Handoff (2026-02-04)

## Current State
- Student menu page now contains payment flows (one-time + subscription) and both use modals.
- `/student/pay` route redirects to `/student/menu` (payment page is no longer used).
- Paid/covered menus move into the "Готовящиеся меню" block.
- Menus with `meal_issue.status === confirmed` are not shown in "Готовящиеся меню".
- Payment history UI for student was removed.
- Modal styles are in `frontend/src/index.css`.

## Key Files
- `frontend/src/pages/StudentMenu.jsx`
- `frontend/src/routes/AppRoutes.jsx`
- `frontend/src/index.css`
- `frontend/src/pages/StudentPay.jsx` (still exists, but route redirects away)

## Known Limitation (Backend)
If a subscription is purchased and a menu is created later, `meal_issue` is NOT created automatically.
Result: the menu is "covered by subscription" but no `issued` record exists.
Frontend cannot fix this because `meal_issue` is a backend record.

Needed backend options (not implemented yet):
1. On menu creation, auto-create `issued` for users with active subscriptions.
2. Add endpoint for students to "reserve/issue" a menu covered by subscription.

## Notes
- Subscription overlap error was handled in UI: the page now shows upcoming subscriptions and pre-fills the next valid period in the modal.
- If Docker backend container was built earlier, it may only have 2 migration files. Rebuild to pick up all 4 migrations if needed.

## Suggested Next Steps
1. Decide how to generate `issued` for menus covered by subscription created after the subscription date.
2. If needed, remove `frontend/src/pages/StudentPay.jsx` to avoid confusion.
