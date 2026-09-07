# PART II — UI/UX Design

## 1. Design philosophy

The interface must look and behave like a mature commercial application rather than a template or marketing page.

Priorities:

- Usability
- Clarity
- Speed
- Conversion
- Accessibility
- Consistency
- Responsive behavior
- Clear feedback
- High information quality

The existing requirements explicitly call for customer and admin experiences, realistic production states, responsive behavior, clickable workflows and an enterprise-quality visual system. fileciteturn3file0L32-L65 fileciteturn4file0L270-L336

## 2. Application shells

### Customer

Header:

- Brand
- Search
- Categories
- Wishlist
- Notifications
- Cart
- Profile

Mobile:

- Bottom navigation for core destinations
- Search-first interaction
- Filter drawer
- Sticky purchase actions where useful

### Admin

Desktop:

- Persistent sidebar
- Top bar
- Breadcrumb
- Main content
- Context actions

Mobile:

- Drawer navigation
- Compact top bar
- Responsive tables/cards

## 3. Design system

Use Bootstrap 5 as the layout/component foundation but override the visual language through SASS tokens.

Define:

- Color roles
- Typography scale
- Spacing
- Radius
- Borders
- Focus rings
- Elevation
- Motion
- Breakpoints
- Z-index layers

Avoid generic Bootstrap styling.

Every interactive component must define:

- Default
- Hover
- Focus
- Active
- Disabled
- Loading
- Error
- Success

The source specification explicitly requires these states and a custom SASS system. fileciteturn3file1L1076-L1121

## 4. Customer screens

### Public

- Home
- Category
- Search results
- Product details
- Login
- Registration
- Password reset
- Terms/privacy
- Help

### Authenticated

- Dashboard
- Orders
- Order detail
- Tracking
- Wishlist
- Cart
- Checkout
- Confirmation
- Returns/refunds
- Profile
- Addresses
- Notifications
- Support

## 5. Admin screens

- Dashboard
- Products
- Product editor
- Categories
- Brands
- Attributes
- Inventory
- Inventory history
- Orders
- Order detail
- Customers
- Customer detail
- Coupons
- Promotions
- Payments
- Refunds
- Returns
- Shipments
- Reports
- Users
- Roles
- Notifications
- Settings
- Audit log

## 6. Product editor UX

Use a structured editor:

1. General
2. Pricing
3. Tax
4. Inventory
5. Variants
6. Images
7. Shipping
8. SEO
9. Publication

Support:

- Save draft
- Publish
- Preview
- Unsaved changes warning
- Server validation
- Optimistic locking conflict
- Image upload progress

## 7. Data tables

Admin tables are first-class components.

Support:

- Server-side pagination
- Sorting
- Filtering
- Search
- Column visibility
- Row actions
- Bulk actions
- Sticky headers
- Responsive card transformation
- Export
- Loading skeleton
- Empty state
- Error state

Never load 100,000 records merely to paginate in the browser.

## 8. Checkout UX

Steps:

1. Customer
2. Address
3. Delivery
4. Payment
5. Review
6. Confirmation

Show a persistent order summary.

Handle:

- Address errors
- Shipping recalculation
- Tax recalculation
- Coupon changes
- Inventory changes
- Price changes
- Payment failure
- Payment pending
- Retry
- Refresh/re-entry

Order placement uses an idempotency key.

## 9. Global async behavior

Standardize:

`Idle -> Loading -> Success`

and

`Idle -> Loading -> Error -> Retry`

For long operations:

`Submitted -> Processing -> Complete/Failed`

Use:

- Skeletons for page/data loading
- Button spinners for mutations
- Toasts for non-blocking success
- Inline errors for field issues
- Dialogs only for decisions requiring attention

## 10. Error UX

Map API behavior consistently:

- 400/422: validation
- 401: re-authentication/session flow
- 403: access denied
- 404: not found
- 409: business/concurrency conflict
- 429: rate limit
- 5xx: generic error with retry/support path

Do not expose stack traces or internal error details.

## 11. Accessibility

Target WCAG 2.1 AA or current equivalent accessibility practices.

Require:

- Keyboard navigation
- Visible focus
- Semantic HTML
- Labels
- Accessible dialogs
- Correct ARIA
- Screen-reader-friendly status updates
- Sufficient contrast
- No color-only meaning
- Minimum touch target around 44px

## 12. Responsive behavior

Desktop:

- Multi-column product grids
- Full admin tables
- Persistent filters

Tablet:

- Collapsible navigation
- Scrollable tables

Mobile:

- Bottom navigation
- Offcanvas filters
- Card/list transformations
- Sticky CTAs
- One-handed controls

The existing UI requirements explicitly distinguish desktop/tablet/mobile interaction patterns rather than merely shrinking the desktop layout. fileciteturn3file0L117-L148

## 13. Clickable workflows

At minimum:

Customer:
`Login -> Store -> Product -> Cart -> Checkout -> Confirmation -> Tracking`

Admin:
`Dashboard -> Products -> Product -> Edit -> Publish`

and

`Dashboard -> Orders -> Order -> Update/Refund`

All relevant menus, tabs, drawers, modals, filters and actions should be functionally connected.
