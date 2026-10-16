# Admin dashboard React/TypeScript starter

This is a **visual starter component**, designed for the `AJPrj/ecommerce-production-blueprint` specification and intended to be integrated into your existing React application, **not** a new backend or an assertion that a dashboard API exists.

## What is included

- `AdminDashboard.tsx` — UI, typed snapshot contract, demo fixture, 7/30/90 day choices, line chart, restricted navigation, loading/error states, recent-order filter and responsive drawer.
- `AdminDashboard.scss` — Bootstrap-compatible, component-scoped styling.
- `../admin-dashboard-preview.html` — self-contained, interactive design exploration with sample values.

## Integrate into the current frontend

1. Place the component and SCSS under `frontend/src/features/admin/dashboard/` (adapt to your actual structure).
2. The repo blueprint already uses `react`, `react-bootstrap`, `bootstrap`, and SASS. Install one additional UI dependency **only if not already installed**: `npm install lucide-react`.
3. Add the component to the existing lazy-loaded `/admin` staff route. Keep `/admin/login` and `/admin/fulfillment` routes as already documented. The component is **not** the authentication guard.
4. Pass `allowedRoutes` from a trusted authenticated staff capability representation for menu UX, while enforcing each API permission independently in Spring Security. Do not rely on menu hiding for authorization.
5. Use the existing typed API client and TanStack Query (or your current server-state approach) to implement `loadDashboard(period)`. Existing endpoints should be reused where possible; the **proposed** read API `/api/v1/admin/dashboard` must be specified/implemented before calling it. Return capability-scoped `AdminDashboardSnapshot` data only. Keep finance-only data inaccessible to Support, and shipping addresses inaccessible to Finance/Reporting.
6. Implement a real, permission-checked report/export operation separately; the React starter's Export button is intentionally disabled. Do not export sensitive datasets from cached client lists.
7. Replace demo fixtures automatically by supplying the `loadDashboard` function. Without it the component visibly labels data as demo.

```tsx
import AdminDashboard, { type DashboardPeriod, type AdminDashboardSnapshot } from './features/admin/dashboard/AdminDashboard';
import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';

function AdminHome() {
  const navigate = useNavigate();
  // Illustrative only: implement through the existing typed, credentialed API client.
  const loadDashboard = useCallback(async (period: DashboardPeriod): Promise<AdminDashboardSnapshot> => {
    const response = await apiClient.get<AdminDashboardSnapshot>('/api/v1/admin/dashboard', {
      params: { period },
    });
    return response.data;
  }, []);
  return <AdminDashboard
    loadDashboard={loadDashboard}
    allowedRoutes={permissions.allowedAdminRoutes}
    onNavigate={navigate}
    staffName={staff.displayName}
  />;
}
```

`apiClient`, `permissions`, and `staff` above are integration placeholders, not exports from this starter. **Do not call the proposed endpoint unless the backend actually implements it.** Verify existing operations controller paths in `STAGE-2-OPERATIONS.md` before adding APIs. In a production implementation, memoize the loader or define it outside the render path, or use TanStack Query to avoid unnecessary fetches.

## Critical domain behavior

- GMV is not captured revenue. COD is not a verified online capture.
- Stock availability is authoritative in PostgreSQL: on-hand minus active reservations.
- This dashboard is read-only; fulfillment/refund/inventory commands belong to existing protected business workflows.
- The dashboard API must be bounded, server-aggregated, role-scoped and carry snapshot freshness. Do not retrieve all order rows to derive totals in the browser.
- Never show an unavailable metric as zero. Render an error or explicit unavailable indicator instead.
- Demo items and monetary numbers are intentionally fictional. No fake data should be presented as production evidence.
