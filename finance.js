// Confirmed revenue shown on the active-orders dashboard only.
// Archived orders stay in the audit history, not in this displayed total.
export function totalConfirmedActiveRevenue(orders = []) {
  return orders
    .filter(order => order && order.archived_at == null && order.payment_status === 'paid')
    .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
}
