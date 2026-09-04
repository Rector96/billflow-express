import { createFileRoute } from '@tanstack/react-router';
// TEMP: broken file recovery in progress - see scripts/restore-pay-slug.mjs
export const Route = createFileRoute('/pay/$slug')({ component: () => null });
