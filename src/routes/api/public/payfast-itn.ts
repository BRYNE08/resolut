import { createFileRoute } from "@tanstack/react-router";

/**
 * PayFast ITN callback. Public by necessity — PayFast's servers call it — so
 * every request is verified three ways before an order changes state:
 * source host, MD5 signature, and a server-to-server validation POST.
 */
export const Route = createFileRoute("/api/public/payfast-itn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyItn, isPayfastHost } = await import("@/lib/payments/payfast.server");
        const body = await request.text();

        const referer = request.headers.get("referer");
        if (referer) {
          try {
            if (!isPayfastHost(new URL(referer).hostname)) {
              return new Response("Untrusted origin", { status: 403 });
            }
          } catch {
            /* malformed referer — the signature check below still applies */
          }
        }

        const result = await verifyItn(body);
        if (!result.ok) {
          console.error("[payfast] rejected ITN:", result.reason);
          return new Response("Invalid notification", { status: 400 });
        }

        const { getRepository } = await import("@/lib/data/repository.server");
        const repo = await getRepository();
        const order = await repo.getOrder(result.reference);
        if (!order) return new Response("Unknown order", { status: 404 });

        // Guard against an amount mismatch between our record and the payment.
        if (result.status === "paid" && Math.abs(result.amount - order.total) > 0.01) {
          console.error(
            `[payfast] amount mismatch on ${order.reference}: paid ${result.amount}, expected ${order.total}`,
          );
          return new Response("Amount mismatch", { status: 400 });
        }

        if (order.status === "await") {
          const updated = await repo.updateOrderStatus(order.reference, result.status);
          const { sendOrderConfirmationEmail, sendOrderStatusEmail, sendAdminPurchaseEmail } = await import(
            "@/lib/email-templates/order-emails.server"
          );
          if (result.status === "paid") {
            const { payfastConfig } = await import("@/lib/payments/payfast.server");
            await Promise.all([
              sendOrderConfirmationEmail(updated),
              sendAdminPurchaseEmail(updated, {
                transactionId: result.pfPaymentId,
                sandbox: payfastConfig().sandbox,
              }),
            ]);
          } else {
            await sendOrderStatusEmail(updated, updated.status);
          }
        }
        return new Response("ok");

      },
    },
  },
});
