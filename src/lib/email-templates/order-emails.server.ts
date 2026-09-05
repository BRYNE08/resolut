import { sendTemplateEmail } from './send-email'
import { estimatedDelivery } from '@/lib/resolut/delivery'
import { ZAR } from '@/lib/money'
import type { Order, OrderStatus } from '@/lib/data/types'

/** Copy for each status change we notify the customer about. */
const STATUS_COPY: Partial<Record<OrderStatus, { label: string; note: string; showEta: boolean }>> = {
  making: {
    label: 'In the workshop',
    note: 'Your piece is being printed, cured and hand-assembled by the studio team.',
    showEta: true,
  },
  shipped: {
    label: 'Dispatched',
    note: 'Your piece has left the studio in a braced crate and is with the courier.',
    showEta: true,
  },
  cancelled: {
    label: 'Order cancelled',
    note: 'This order was cancelled and nothing was charged. Reply if this was unexpected.',
    showEta: false,
  },
}

function addressOf(order: Order) {
  const s = order.shipping
  if (!s) return order.city
  return [s.addressLine, s.addressLine2, s.suburb, s.city, s.province, s.postalCode, s.country]
    .filter((p) => p && p.trim())
    .join(', ')
}

/** Never let a mail failure break the order flow it is attached to. */
async function safeSend(promise: Promise<unknown>, context: string) {
  try {
    await promise
  } catch (error) {
    console.error(`[email] ${context} failed:`, error)
  }
}

export async function sendOrderConfirmationEmail(order: Order) {
  await safeSend(
    sendTemplateEmail('order-confirmation', order.email, {
      idempotencyKey: `order-confirmation-${order.reference}`,
      templateData: {
        customerName: order.customerName,
        reference: order.reference,
        total: ZAR(order.total),
        estimatedDelivery: estimatedDelivery(order.createdAt),
        address: addressOf(order),
        lines: order.lines.map((l) => ({
          name: l.name,
          quantity: l.quantity,
          lineTotal: ZAR(l.unitPrice * l.quantity),
        })),
      },
    }),
    `order confirmation ${order.reference}`,
  )
}

export async function sendOrderStatusEmail(order: Order, status: OrderStatus) {
  const copy = STATUS_COPY[status]
  if (!copy) return
  await safeSend(
    sendTemplateEmail('order-status-update', order.email, {
      idempotencyKey: `order-status-${status}-${order.reference}`,
      templateData: {
        customerName: order.customerName,
        reference: order.reference,
        statusLabel: copy.label,
        statusNote: copy.note,
        showEta: copy.showEta,
        estimatedDelivery: estimatedDelivery(order.createdAt),
      },
    }),
    `order status ${status} ${order.reference}`,
  )
}
