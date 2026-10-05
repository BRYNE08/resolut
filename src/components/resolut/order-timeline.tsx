import { Link } from "@tanstack/react-router";

import type { Order, OrderStatus } from "@/lib/data/types";
import { addBusinessDays, formatDate } from "@/lib/resolut/delivery";
import { ZAR } from "@/lib/money";

/** Made-to-order timeline, in business-day offsets from the order date. */
export const STAGES: { key: OrderStatus | "delivered"; label: string; note: string; days: number }[] = [
  { key: "paid", label: "Order confirmed", note: "Payment cleared through PayFast.", days: 0 },
  { key: "making", label: "In the workshop", note: "Printed, finished and hand-assembled.", days: 3 },
  { key: "shipped", label: "Dispatched", note: "Courier collects and tracking is emailed.", days: 15 },
  { key: "delivered", label: "Delivered", note: "Signed for at your address.", days: 20 },
];

const ORDER_OF: Record<string, number> = { await: -1, paid: 0, making: 1, shipped: 2, cancelled: -1 };

export function OrderTimeline({ order, showLink = true }: { order: Order; showLink?: boolean }) {
  const placed = new Date(order.createdAt);
  const current = ORDER_OF[order.status] ?? -1;
  const cancelled = order.status === "cancelled";
  const eta = addBusinessDays(placed, STAGES[3]!.days);

  return (
    <div className="ship-order">
      <div className="ship-order-head">
        <div>
          <p className="eyebrow">Order {order.reference}</p>
          <strong>{order.lines.map((l) => `${l.quantity} × ${l.name}`).join(", ")}</strong>
          <span>
            Placed {formatDate(placed)} · {ZAR(order.total)} · to {order.shipping?.city ?? order.city}
          </span>
        </div>
        <div className="ship-eta">
          <span>{cancelled ? "Not scheduled" : "Estimated delivery"}</span>
          <strong>{cancelled ? "—" : formatDate(eta)}</strong>
        </div>
      </div>

      {order.status === "await" ? (
        <p className="ship-status">
          Payment hasn’t cleared yet, so the making queue hasn’t started. Dates appear as soon as
          PayFast confirms.
        </p>
      ) : null}
      {cancelled ? (
        <p className="ship-status ship-status-miss">
          This order was cancelled and nothing was charged.
        </p>
      ) : null}

      <ol className="ship-timeline">
        {STAGES.map((s, i) => {
          const done = !cancelled && current >= i;
          const active = !cancelled && current === i;
          return (
            <li key={s.key} className={done ? (active ? "done active" : "done") : ""}>
              <span className="dot" aria-hidden="true" />
              <div>
                <strong>{s.label}</strong>
                <span>{s.note}</span>
              </div>
              <em>{cancelled ? "—" : formatDate(addBusinessDays(placed, s.days))}</em>
            </li>
          );
        })}
      </ol>

      {showLink ? (
        <div className="sig-actions">
          <Link className="btn btn-primary" to="/order/$reference" params={{ reference: order.reference }}>
            Open order page
          </Link>
        </div>
      ) : null}
    </div>
  );
}
