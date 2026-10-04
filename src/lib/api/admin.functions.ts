import { createServerFn } from "@tanstack/react-start";

import {
  createJobSchema,
  createPieceSchema,
  deletePieceSchema,
  jobIdSchema,
  messageHandledSchema,
  orderStatusSchema,
  updateJobSchema,
  updatePieceSchema,
} from "./admin.schemas";

/**
 * Every studio mutation goes through this guard: the route gate is UX, this is
 * the security boundary. Customer OAuth sessions are never accepted here.
 */
async function studioContext() {
  const [{ getRepository }, { readStudioSession }, { canAccessStudio }] = await Promise.all([
    import("@/lib/data/repository.server"),
    import("@/lib/auth/session.server"),
    import("@/lib/auth/config"),
  ]);
  const { session, live } = await readStudioSession();
  if (!canAccessStudio(session)) throw new Error("Not authorised for the studio.");
  const repo = await getRepository();
  return { repo, session: session!, live };
}

export const fetchDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { repo, session, live } = await studioContext();
  return {
    source: repo.name,
    authLive: live,
    viewer: session.user,
    dashboard: await repo.getDashboard(),
  };
});

/** Studio-only reads that the storefront never needs. */
export const fetchStudioData = createServerFn({ method: "GET" }).handler(async () => {
  const { repo } = await studioContext();
  const [pieces, orders, waitlist, messages, jobs] = await Promise.all([
    repo.listAllProducts(),
    repo.listOrders(),
    repo.listWaitlist(),
    repo.listMessages(),
    repo.listJobs(),
  ]);
  return { pieces, orders, waitlist, messages, jobs };
});

export const createPiece = createServerFn({ method: "POST" })
  .inputValidator((input) => createPieceSchema.parse(input))
  .handler(async ({ data }) => {
    const { repo } = await studioContext();
    return { product: await repo.createProduct(data) };
  });

export const updatePiece = createServerFn({ method: "POST" })
  .inputValidator((input) => updatePieceSchema.parse(input))
  .handler(async ({ data }) => {
    const { repo } = await studioContext();
    const { slug, ...patch } = data;
    return { product: await repo.updateProduct(slug, patch) };
  });

export const deletePiece = createServerFn({ method: "POST" })
  .inputValidator((input) => deletePieceSchema.parse(input))
  .handler(async ({ data }) => {
    const { repo } = await studioContext();
    return repo.deleteProduct(data.slug);
  });

export const setOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => orderStatusSchema.parse(input))
  .handler(async ({ data }) => {
    const { repo } = await studioContext();
    const order = await repo.updateOrderStatus(data.reference, data.status);
    if (data.status === "paid") {
      const { sendOrderConfirmationEmail } = await import(
        "@/lib/email-templates/order-emails.server"
      );
      await sendOrderConfirmationEmail(order);
    } else {
      const { sendOrderStatusEmail } = await import("@/lib/email-templates/order-emails.server");
      await sendOrderStatusEmail(order, data.status);
    }
    return { order };
  });

export const createJob = createServerFn({ method: "POST" })
  .inputValidator((input) => createJobSchema.parse(input))
  .handler(async ({ data }) => {
    const { repo } = await studioContext();
    return { job: await repo.createJob(data) };
  });

export const updateJob = createServerFn({ method: "POST" })
  .inputValidator((input) => updateJobSchema.parse(input))
  .handler(async ({ data }) => {
    const { repo } = await studioContext();
    const { id, ...patch } = data;
    return { job: await repo.updateJob(id, patch) };
  });

export const deleteJob = createServerFn({ method: "POST" })
  .inputValidator((input) => jobIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { repo } = await studioContext();
    return repo.deleteJob(data.id);
  });

export const setMessageHandled = createServerFn({ method: "POST" })
  .inputValidator((input) => messageHandledSchema.parse(input))
  .handler(async ({ data }) => {
    const { repo } = await studioContext();
    return { message: await repo.setMessageHandled(data.id, data.handled) };
  });
