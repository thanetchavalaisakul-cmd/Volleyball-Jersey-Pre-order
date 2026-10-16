// Shared UI eligibility checks (server validates rules again when writing).
export function canBuyerCancel(order) {
  return Boolean(order && order.order_status === 'submitted' &&
    ['pending','rejected'].includes(order.payment_status) &&
    !order.paid_at && !order.receipt_no && !order.archived_at &&
    !order.has_submitted_slip);
}
// Administrators may archive ANY existing order, including paid and fulfilled orders.
// This hides an order from production lists; it NEVER deletes bank, receipt or slip records.
export function canAdminArchive(order) {
  return Boolean(order && !order.archived_at);
}
