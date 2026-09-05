/**
 * Prisma adapter — mirrors the in-memory adapter against prisma/schema.prisma.
 * Activated automatically once DATABASE_URL is set and @prisma/client exists.
 */
import type {
  CartItems,
  ContactMessage,
  CustomerProfile,
  CreateJobInput,
  CreateOrderInput,
  DashboardData,
  Order,
  OrderStatus,
  Product,
  ProductionJob,
  ResolutRepository,
  SaveProfileInput,
  UpdateProductInput,
  WaitlistEntry,
} from "./types";

type AnyPrisma = Record<string, any>;

const ZAR = (n: number) => "R\u00a0" + n.toLocaleString("en-ZA");
const rand = (cents: number) => Math.round(cents / 100);

const STATUS_TO_DOMAIN: Record<string, OrderStatus> = {
  AWAITING_PAYMENT: "await",
  PAID: "paid",
  IN_PRODUCTION: "making",
  SHIPPED: "shipped",
  CANCELLED: "cancelled",
};

const STATUS_TO_DB: Record<OrderStatus, string> = {
  await: "AWAITING_PAYMENT",
  paid: "PAID",
  making: "IN_PRODUCTION",
  shipped: "SHIPPED",
  cancelled: "CANCELLED",
};


function toProduct(row: AnyPrisma): Product {
  const price = row.priceCents == null ? null : rand(row.priceCents);
  return {
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    price,
    priceLabel: price == null ? "Coming soon" : ZAR(price),
    badge: row.badge ?? undefined,
    image: row.image,
    imageAlt: row.imageAlt,
    detailImage: row.detailImage,
    intro: row.intro,
    body: row.body ?? [],
    specs: (row.specs ?? []) as Product["specs"],
    details: (row.details ?? []) as Product["details"],
    addId: price == null ? undefined : row.slug,
  };
}

function toProfile(row: AnyPrisma): CustomerProfile {
  return {
    accountEmail: row.accountEmail,
    contactEmail: row.contactEmail,
    phone: row.phone ?? undefined,
    addressLine: row.addressLine ?? undefined,
    addressLine2: row.addressLine2 ?? undefined,
    suburb: row.suburb ?? undefined,
    city: row.city ?? undefined,
    province: row.province ?? undefined,
    postalCode: row.postalCode ?? undefined,
    country: row.country ?? "South Africa",
    deliveryNotes: row.deliveryNotes ?? undefined,
  };
}

function toOrder(row: AnyPrisma): Order {
  return {
    reference: row.reference,
    status: STATUS_TO_DOMAIN[row.status] ?? "await",
    customerName: row.customerName,
    email: row.email,
    city: row.city,
    total: rand(row.totalCents),
    phone: row.phone ?? undefined,
    shipping: {
      addressLine: row.addressLine,
      addressLine2: row.addressLine2 ?? undefined,
      suburb: row.suburb ?? undefined,
      city: row.city,
      province: row.province ?? "",
      postalCode: row.postalCode,
      country: row.country ?? "South Africa",
      deliveryNotes: row.deliveryNotes ?? undefined,
    },
    createdAt: new Date(row.createdAt).toISOString().slice(0, 10),
    lines: (row.items ?? []).map((item: AnyPrisma) => ({
      slug: item.product?.slug ?? item.productId,
      name: item.product?.name ?? "Piece",
      quantity: item.quantity,
      unitPrice: rand(item.unitPriceCents),
    })),
  };
}

export function createPrismaRepository(prisma: AnyPrisma): ResolutRepository {
  return {
    name: "prisma",

    async listAllProducts(): Promise<Product[]> {
      const rows = await prisma.product.findMany({ orderBy: { createdAt: "asc" } });
      return rows.map((row: AnyPrisma) => ({ ...toProduct(row), published: row.published }));
    },

    async updateProduct(slug: string, patch: UpdateProductInput): Promise<Product> {
      const data: AnyPrisma = {};
      if (patch.name !== undefined) data.name = patch.name;
      if (patch.tagline !== undefined) data.tagline = patch.tagline;
      if (patch.intro !== undefined) data.intro = patch.intro;
      if (patch.badge !== undefined) data.badge = patch.badge?.trim() || null;
      if (patch.body !== undefined) data.body = patch.body.filter((l) => l.trim().length > 0);
      if (patch.specs !== undefined) data.specs = patch.specs;
      if (patch.details !== undefined) data.details = patch.details;

      if (patch.price !== undefined) data.priceCents = patch.price == null ? null : Math.round(patch.price * 100);
      if (patch.image !== undefined && patch.image.trim()) {
        data.image = patch.image.trim();
        data.detailImage = patch.image.trim();
      }
      if (patch.imageAlt !== undefined) data.imageAlt = patch.imageAlt;
      if (patch.capacity !== undefined) data.capacity = patch.capacity;
      if (patch.readyStock !== undefined) data.readyStock = patch.readyStock;
      if (patch.published !== undefined) data.published = patch.published;
      const row = await prisma.product.update({ where: { slug }, data });
      return { ...toProduct(row), published: row.published };
    },

    async deleteProduct(slug: string) {
      await prisma.product.update({ where: { slug }, data: { published: false } });
      return { ok: true as const };
    },

    async getCart(cartId: string): Promise<CartItems> {
      const row = await prisma.cart.findUnique({
        where: { id: cartId },
        include: { items: { include: { product: true } } },
      });
      const items: CartItems = {};
      (row?.items ?? []).forEach((item: AnyPrisma) => {
        if (item.product?.slug && item.product.priceCents != null) {
          items[item.product.slug] = item.quantity;
        }
      });
      return items;
    },

    async setCartItem(cartId: string, slug: string, quantity: number): Promise<CartItems> {
      await prisma.cart.upsert({ where: { id: cartId }, update: {}, create: { id: cartId } });
      const product = await prisma.product.findUnique({ where: { slug } });
      if (!product) return this.getCart(cartId);
      if (quantity <= 0) {
        await prisma.cartItem.deleteMany({ where: { cartId, productId: product.id } });
      } else {
        await prisma.cartItem.upsert({
          where: { cartId_productId: { cartId, productId: product.id } },
          update: { quantity: Math.min(99, quantity) },
          create: { cartId, productId: product.id, quantity: Math.min(99, quantity) },
        });
      }
      return this.getCart(cartId);
    },

    async setCart(cartId: string, items: CartItems): Promise<CartItems> {
      await prisma.cart.upsert({ where: { id: cartId }, update: {}, create: { id: cartId } });
      await prisma.cartItem.deleteMany({ where: { cartId } });
      const products = await prisma.product.findMany({ where: { slug: { in: Object.keys(items) } } });
      const rows = products
        .filter((p: AnyPrisma) => p.priceCents != null && (items[p.slug] ?? 0) > 0)
        .map((p: AnyPrisma) => ({ cartId, productId: p.id, quantity: Math.min(99, Math.floor(items[p.slug]!)) }));
      if (rows.length > 0) await prisma.cartItem.createMany({ data: rows });
      return this.getCart(cartId);
    },

    async clearCart(cartId: string) {
      await prisma.cartItem.deleteMany({ where: { cartId } });
      return { ok: true as const };
    },

    async listOrders(): Promise<Order[]> {
      const rows = await prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        include: { items: { include: { product: true } } },
      });
      return rows.map(toOrder);
    },

    async listOrdersByEmail(email: string): Promise<Order[]> {
      const rows = await prisma.order.findMany({
        where: { email: { equals: email, mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        include: { items: { include: { product: true } } },
      });
      return rows.map(toOrder);
    },

    async getProfile(accountEmail: string): Promise<CustomerProfile | null> {
      const row = await prisma.customerProfile.findUnique({
        where: { accountEmail: accountEmail.toLowerCase() },
      });
      return row ? toProfile(row) : null;
    },

    async saveProfile(accountEmail: string, input: SaveProfileInput): Promise<CustomerProfile> {
      const key = accountEmail.toLowerCase();
      const data = {
        contactEmail: input.contactEmail,
        phone: input.phone ?? null,
        addressLine: input.addressLine ?? null,
        addressLine2: input.addressLine2 ?? null,
        suburb: input.suburb ?? null,
        city: input.city ?? null,
        province: input.province ?? null,
        postalCode: input.postalCode ?? null,
        country: input.country ?? "South Africa",
        deliveryNotes: input.deliveryNotes ?? null,
      };
      const row = await prisma.customerProfile.upsert({
        where: { accountEmail: key },
        update: data,
        create: { accountEmail: key, ...data },
      });
      return toProfile(row);
    },

    async getOrder(reference: string) {
      const row = await prisma.order.findUnique({
        where: { reference },
        include: { items: { include: { product: true } } },
      });
      return row ? toOrder(row) : null;
    },

    async updateOrderStatus(reference: string, status: OrderStatus): Promise<Order> {
      const row = await prisma.order.update({
        where: { reference },
        data: { status: STATUS_TO_DB[status] },
        include: { items: { include: { product: true } } },
      });
      return toOrder(row);
    },

    async listWaitlist(): Promise<WaitlistEntry[]> {
      const rows = await prisma.waitlistSignup.findMany({ orderBy: { createdAt: "desc" } });
      return rows.map((r: AnyPrisma) => ({
        id: r.id,
        email: r.email,
        label: r.label,
        createdAt: new Date(r.createdAt).toISOString().slice(0, 10),
      }));
    },

    async listMessages(): Promise<ContactMessage[]> {
      const rows = await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" } });
      return rows.map((r: AnyPrisma) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        message: r.message,
        handled: r.handled,
        createdAt: new Date(r.createdAt).toISOString().slice(0, 10),
      }));
    },

    async setMessageHandled(id: string, handled: boolean): Promise<ContactMessage> {
      const r = await prisma.contactMessage.update({ where: { id }, data: { handled } });
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        message: r.message,
        handled: r.handled,
        createdAt: new Date(r.createdAt).toISOString().slice(0, 10),
      };
    },

    async listJobs(): Promise<ProductionJob[]> {
      const rows = await prisma.productionJob.findMany({ orderBy: { createdAt: "desc" } });
      return rows.map((j: AnyPrisma) => ({
        id: j.id,
        title: j.title,
        detail: j.detail,
        due: j.dueAt ? new Date(j.dueAt).toISOString().slice(0, 10) : "Unscheduled",
        overdue: Boolean(j.overdue),
      }));
    },

    async createJob(input: CreateJobInput): Promise<ProductionJob> {
      const dueAt = input.due && !Number.isNaN(Date.parse(input.due)) ? new Date(input.due) : null;
      const j = await prisma.productionJob.create({
        data: { title: input.title, detail: input.detail, dueAt, overdue: input.overdue ?? false },
      });
      return {
        id: j.id,
        title: j.title,
        detail: j.detail,
        due: dueAt ? dueAt.toISOString().slice(0, 10) : input.due || "Unscheduled",
        overdue: Boolean(j.overdue),
      };
    },

    async updateJob(id: string, patch: Partial<CreateJobInput>): Promise<ProductionJob> {
      const data: AnyPrisma = {};
      if (patch.title !== undefined) data.title = patch.title;
      if (patch.detail !== undefined) data.detail = patch.detail;
      if (patch.overdue !== undefined) data.overdue = patch.overdue;
      if (patch.due !== undefined) {
        data.dueAt = patch.due && !Number.isNaN(Date.parse(patch.due)) ? new Date(patch.due) : null;
      }
      const j = await prisma.productionJob.update({ where: { id }, data });
      return {
        id: j.id,
        title: j.title,
        detail: j.detail,
        due: j.dueAt ? new Date(j.dueAt).toISOString().slice(0, 10) : "Unscheduled",
        overdue: Boolean(j.overdue),
      };
    },

    async deleteJob(id: string) {
      await prisma.productionJob.delete({ where: { id } });
      return { ok: true as const };
    },



    async listProducts() {
      const rows = await prisma.product.findMany({
        where: { published: true },
        orderBy: { createdAt: "asc" },
      });
      return rows.map(toProduct);
    },

    async getProduct(slug) {
      const row = await prisma.product.findUnique({ where: { slug } });
      return row ? toProduct(row) : null;
    },

    async createProduct(input) {
      const base = (input.slug?.trim() || input.name)
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const slug = base || `piece-${Date.now()}`;
      const image = input.image?.trim() || "/resolut/placeholder.svg";
      const row = await prisma.product.create({
        data: {
          slug,
          name: input.name,
          tagline: input.tagline,
          intro: input.intro,
          badge: input.badge?.trim() || null,
          body: input.body?.filter((line) => line.trim().length > 0) ?? [],
          priceCents: input.price == null ? null : Math.round(input.price * 100),
          image,
          imageAlt: input.imageAlt?.trim() || `${input.name} lighting piece`,
          detailImage: image,
          specs: input.specs ?? [],
          details: input.details ?? [],
          capacity: input.capacity ?? 12,
          readyStock: input.readyStock ?? 0,
        },
      });
      return toProduct(row);
    },

    async createOrder(input: CreateOrderInput) {
      const products = await prisma.product.findMany({
        where: { slug: { in: input.lines.map((l) => l.slug) } },
      });
      const items = input.lines.flatMap((line) => {
        const product = products.find((p: AnyPrisma) => p.slug === line.slug);
        if (!product || product.priceCents == null) return [];
        return [
          {
            productId: product.id,
            quantity: line.quantity,
            unitPriceCents: product.priceCents,
          },
        ];
      });
      const subtotalCents = items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
      const row = await prisma.order.create({
        data: {
          reference: `RSL-${Date.now().toString().slice(-6)}`,
          customerName: input.customerName,
          email: input.email,
          phone: input.phone ?? null,
          addressLine: input.addressLine,
          addressLine2: input.addressLine2 ?? null,
          suburb: input.suburb ?? null,
          city: input.city,
          province: input.province,
          postalCode: input.postalCode,
          country: input.country ?? "South Africa",
          deliveryNotes: input.deliveryNotes ?? null,
          subtotalCents,
          totalCents: subtotalCents,
          items: { create: items },
        },
        include: { items: { include: { product: true } } },
      });
      return toOrder(row);
    },

    async joinWaitlist({ email, label }) {
      await prisma.waitlistSignup.upsert({
        where: { email_label: { email, label } },
        update: {},
        create: { email, label },
      });
      return { ok: true as const };
    },

    async getDashboard(): Promise<DashboardData> {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [orderRows, products, jobs, waitlistGroups, orderCount, revenueAgg] =
        await Promise.all([
          prisma.order.findMany({
            take: 6,
            orderBy: { createdAt: "desc" },
            include: { items: { include: { product: true } } },
          }),
          prisma.product.findMany(),
          prisma.productionJob.findMany({ take: 6, orderBy: { createdAt: "desc" } }),
          prisma.waitlistSignup.groupBy({ by: ["label"], _count: { _all: true } }),
          prisma.order.count(),
          prisma.order.aggregate({
            _sum: { totalCents: true },
            where: { createdAt: { gte: since }, status: { not: "CANCELLED" } },
          }),
        ]);

      const revenue30 = rand(revenueAgg?._sum?.totalCents ?? 0);
      const awaiting = await prisma.order.count({ where: { status: "AWAITING_PAYMENT" } });
      const waitlist = waitlistGroups.map((g: AnyPrisma) => ({
        label: g.label,
        count: g._count?._all ?? 0,
      }));

      // Twelve-month series, bucketed client-side from order dates.
      const now = new Date();
      const months: { month: string; value: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ month: d.toLocaleString("en-ZA", { month: "short" }), value: 0 });
      }
      const yearOrders = await prisma.order.findMany({
        where: { createdAt: { gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) } },
        select: { createdAt: true, totalCents: true },
      });
      yearOrders.forEach((o: AnyPrisma) => {
        const created = new Date(o.createdAt);
        const idx =
          11 - ((now.getFullYear() - created.getFullYear()) * 12 + now.getMonth() - created.getMonth());
        if (idx >= 0 && idx < 12) months[idx]!.value += rand(o.totalCents) / 1000;
      });

      return {
        kpis: [
          { key: "Revenue · 30 days", value: ZAR(revenue30), delta: "", direction: "up", note: "last 30 days" },
          { key: "Orders", value: String(orderCount), delta: "", direction: "up", note: `${awaiting} awaiting payment` },
          {
            key: "Average order",
            value: ZAR(orderCount ? Math.round(revenue30 / Math.max(1, orderCount)) : 0),
            delta: "",
            direction: "up",
            note: "all time orders",
          },
          {
            key: "Waitlist",
            value: String(waitlist.reduce((s: number, w: { count: number }) => s + w.count, 0)),
            delta: "",
            direction: "up",
            note: "signups",
          },
        ],
        revenue: months,
        orders: orderRows.map(toOrder),
        orderCount,
        queue: jobs.map((j: AnyPrisma) => ({
          id: j.id,
          title: j.title,
          detail: j.detail,
          due: j.dueAt ? new Date(j.dueAt).toDateString().slice(0, 10) : "Unscheduled",
          overdue: Boolean(j.overdue),
        })),
        stock: products.map((p: AnyPrisma) => ({
          slug: p.slug,
          ready: p.readyStock,
          capacity: p.capacity,
          sold: 0,
        })),
        waitlist,
      };
    },
  };
}
