import { ZAR } from "../money";
import { normalizeLines, validateProducts } from "./product-availability";
/**
 * In-memory adapter — the default until DATABASE_URL is set.
 *
 * Writes land in module state so the flow is demonstrable end to end without a
 * database. Sample dashboard figures live here (not in the route) so the Prisma
 * adapter can replace them with real aggregates.
 */
import { RESOLUT_PRODUCTS } from "@/lib/resolut/products";
import { createOrderReference } from "../auth/order-access.server";
import type {
  CartItems,
  ContactMessage,
  CustomerProfile,
  CreateJobInput,
  CreateOrderInput,
  CreateProductInput,
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

const MONTHS = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
const REVENUE = [42, 51, 47, 63, 58, 74, 69, 88, 96, 91, 118, 149];

const seedOrders: Order[] = [
  {
    reference: "RSL-1184",
    customerName: "Thandi Mokoena",
    email: "thandi@example.co.za",
    city: "Cape Town",
    status: "making",
    total: 4450,
    createdAt: "2026-08-12",
    lines: [{ slug: "cornice", name: "Cornice", quantity: 1, unitPrice: 4450 }],
  },
  {
    reference: "RSL-1183",
    customerName: "Jaco van Wyk",
    email: "jaco@example.co.za",
    city: "Stellenbosch",
    status: "paid",
    total: 6900,
    createdAt: "2026-08-11",
    lines: [{ slug: "volute", name: "Volute", quantity: 2, unitPrice: 3450 }],
  },
  {
    reference: "RSL-1182",
    customerName: "Lerato Dube",
    email: "lerato@example.co.za",
    city: "Johannesburg",
    status: "shipped",
    total: 4450,
    createdAt: "2026-08-10",
    lines: [{ slug: "cornice", name: "Cornice", quantity: 1, unitPrice: 4450 }],
  },
  {
    reference: "RSL-1181",
    customerName: "Ana Ferreira",
    email: "ana@example.co.za",
    city: "Umhlanga",
    status: "await",
    total: 3450,
    createdAt: "2026-08-09",
    lines: [{ slug: "volute", name: "Volute", quantity: 1, unitPrice: 3450 }],
  },
  {
    reference: "RSL-1180",
    customerName: "Sipho Ndlovu",
    email: "sipho@example.co.za",
    city: "Pretoria",
    status: "making",
    total: 8900,
    createdAt: "2026-08-08",
    lines: [{ slug: "cornice", name: "Cornice", quantity: 2, unitPrice: 4450 }],
  },
  {
    reference: "RSL-1179",
    customerName: "Claire Bennett",
    email: "claire@example.co.za",
    city: "Knysna",
    status: "shipped",
    total: 3450,
    createdAt: "2026-08-07",
    lines: [{ slug: "volute", name: "Volute", quantity: 1, unitPrice: 3450 }],
  },
];

/** Customer profiles, keyed by lower-cased account email. */
const profiles = new Map<string, CustomerProfile>();

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "piece";

const state = {
  products: RESOLUT_PRODUCTS.map((p) => ({ ...p, published: true })) as Product[],
  orders: [...seedOrders],
  waitlistEntries: [
    { id: "w1", email: "thandi@example.co.za", label: "Strata pendant", createdAt: "2026-08-12" },
    { id: "w2", email: "jaco@example.co.za", label: "Strata pendant", createdAt: "2026-08-11" },
    { id: "w3", email: "ana@example.co.za", label: "Vellum table lamp", createdAt: "2026-08-10" },
    {
      id: "w4",
      email: "studio@interiors.co.za",
      label: "Trade & interior studios",
      createdAt: "2026-08-09",
    },
  ] as WaitlistEntry[],
  /** Historic counts folded into the demo totals alongside live signups. */
  waitlistBase: [
    { label: "Strata pendant", count: 236 },
    { label: "Vellum table lamp", count: 120 },
    { label: "Trade & interior studios", count: 52 },
  ],
  messages: [
    {
      id: "m1",
      name: "Nadia Petersen",
      email: "nadia@studionorth.co.za",
      message:
        "We are specifying lighting for a Bantry Bay renovation — do you offer trade pricing on six Cornice pendants?",
      handled: false,
      createdAt: "2026-08-12",
    },
    {
      id: "m2",
      name: "Grant Willemse",
      email: "grant@example.co.za",
      message:
        "Is the Volute available in a brushed brass finish, and what is the current lead time?",
      handled: false,
      createdAt: "2026-08-11",
    },
    {
      id: "m3",
      name: "Michelle Adams",
      email: "michelle@example.co.za",
      message: "Received RSL-1179 today — beautifully packed, thank you.",
      handled: true,
      createdAt: "2026-08-08",
    },
  ] as ContactMessage[],
  stock: [
    { slug: "cornice", ready: 3, capacity: 12, sold: 19 },
    { slug: "volute", ready: 8, capacity: 12, sold: 15 },
    { slug: "strata", ready: 0, capacity: 12, sold: 0 },
    { slug: "vellum", ready: 0, capacity: 12, sold: 0 },
  ],
  queue: [
    {
      id: "j1",
      title: "Cornice · RSL-1184",
      detail: "Printed, curing before hand-finish",
      due: "Due Thu",
      overdue: false,
    },
    {
      id: "j2",
      title: "Cornice · RSL-1180 (×2)",
      detail: "Awaiting polymer batch — supplier delayed",
      due: "Overdue 2d",
      overdue: true,
    },
    {
      id: "j3",
      title: "Volute · RSL-1183 (×2)",
      detail: "Wiring and electrical QC",
      due: "Due Fri",
      overdue: false,
    },
    {
      id: "j4",
      title: "Strata prototype",
      detail: "Third revision on tier spacing",
      due: "Next week",
      overdue: false,
    },
  ] as ProductionJob[],
  nextRef: 1185,
  nextId: 100,
  /** Anonymous carts keyed by the cart-id cookie. */
  carts: new Map<string, CartItems>(),
};

function readCart(cartId: string): CartItems {
  return { ...(state.carts.get(cartId) ?? {}) };
}

function writeCart(cartId: string, items: CartItems): CartItems {
  const lines = normalizeLines(
    Object.entries(items).map(([slug, quantity]) => ({ slug, quantity })),
    true,
  );
  validateProducts(
    lines,
    state.products.map((p) => ({
      ...p,
      priceCents: p.price == null ? null : Math.round(p.price * 100),
    })),
  );
  const clean = Object.fromEntries(lines.map((line) => [line.slug, line.quantity]));
  state.carts.set(cartId, clean);
  return { ...clean };
}

const today = () => new Date().toISOString().slice(0, 10);

function waitlistBuckets() {
  const buckets = state.waitlistBase.map((b) => ({ ...b }));
  for (const entry of state.waitlistEntries) {
    const bucket = buckets.find((b) => b.label === entry.label);
    if (bucket) bucket.count += 1;
    else buckets.push({ label: entry.label, count: 1 });
  }
  return buckets.sort((a, b) => b.count - a.count);
}

export function createMockRepository(): ResolutRepository {
  return {
    name: "in-memory",

    async listProducts(): Promise<Product[]> {
      return state.products.filter((p) => p.published !== false);
    },

    async listAllProducts(): Promise<Product[]> {
      return state.products;
    },

    async getProduct(slug) {
      return state.products.find((p) => p.slug === slug && p.published !== false) ?? null;
    },

    async createProduct(input: CreateProductInput): Promise<Product> {
      const base = input.slug?.trim() ? slugify(input.slug) : slugify(input.name);
      let slug = base;
      let n = 2;
      while (state.products.some((p) => p.slug === slug)) slug = `${base}-${n++}`;

      const price = input.price == null ? null : input.price;
      const product: Product = {
        slug,
        name: input.name,
        tagline: input.tagline,
        price,
        priceLabel: price == null ? "Coming soon" : ZAR(price),
        badge: input.badge?.trim() || undefined,
        images: input.images ?? (input.image ? [input.image.trim()] : []),
        image: input.images?.[0] || input.image?.trim() || "/resolut/placeholder.svg",
        imageAlt: input.imageAlt?.trim() || `${input.name} lighting piece`,
        detailImage: input.images?.[1] || input.images?.[0] || input.image?.trim() || "/resolut/placeholder.svg",
        intro: input.intro,
        body: input.body?.filter((line) => line.trim().length > 0) ?? [],
        specs: input.specs ?? [],
        details: input.details ?? [],
        addId: price == null || price <= 0 ? undefined : slug,
        published: true,
      };
      state.products = [...state.products, product];
      state.stock = [
        ...state.stock,
        {
          slug,
          ready: input.readyStock ?? 0,
          capacity: input.capacity ?? 12,
          sold: 0,
        },
      ];
      return product;
    },

    async updateProduct(slug: string, patch: UpdateProductInput): Promise<Product> {
      const current = state.products.find((p) => p.slug === slug);
      if (!current) throw new Error(`No piece with slug “${slug}”.`);

      const price = patch.price === undefined ? current.price : patch.price;
      const images = patch.images ?? (patch.image ? [patch.image.trim()] : current.images);
      const image = patch.images !== undefined ? patch.images[0] || "/resolut/placeholder.svg" : patch.image?.trim() || current.image;
      const next: Product = {
        ...current,
        name: patch.name?.trim() || current.name,
        tagline: patch.tagline?.trim() || current.tagline,
        intro: patch.intro?.trim() || current.intro,
        price,
        priceLabel: price == null ? "Coming soon" : ZAR(price),
        badge: patch.badge === undefined ? current.badge : patch.badge?.trim() || undefined,
        image,
        images,
        detailImage: patch.images !== undefined ? patch.images[1] || image : patch.image?.trim() || current.detailImage,
        imageAlt: patch.imageAlt?.trim() || current.imageAlt,
        body: patch.body ? patch.body.filter((line) => line.trim().length > 0) : current.body,
        specs: patch.specs ? patch.specs : current.specs,
        details: patch.details ? patch.details : current.details,

        addId: price == null || price <= 0 ? undefined : slug,
        published: patch.published === undefined ? current.published !== false : patch.published,
      };
      state.products = state.products.map((p) => (p.slug === slug ? next : p));

      if (patch.readyStock !== undefined || patch.capacity !== undefined) {
        const existing = state.stock.find((s) => s.slug === slug);
        if (existing) {
          if (patch.readyStock !== undefined) existing.ready = patch.readyStock;
          if (patch.capacity !== undefined) existing.capacity = patch.capacity;
        } else {
          state.stock.push({
            slug,
            ready: patch.readyStock ?? 0,
            capacity: patch.capacity ?? 12,
            sold: 0,
          });
        }
      }
      return next;
    },

    async deleteProduct(slug: string) {
      if (state.orders.some((order) => order.lines.some((line) => line.slug === slug))) {
        throw new Error("This piece is linked to existing orders and cannot be permanently deleted. Unpublish it to remove it from the storefront.");
      }
      state.products = state.products.filter((p) => p.slug !== slug);
      state.stock = state.stock.filter((s) => s.slug !== slug);
      for (const items of state.carts.values()) delete items[slug];
      return { ok: true as const };
    },

    async getCart(cartId: string): Promise<CartItems> {
      return readCart(cartId);
    },

    async setCartItem(cartId: string, slug: string, quantity: number): Promise<CartItems> {
      const items = readCart(cartId);
      if (quantity === 0) delete items[slug];
      else {
        validateProducts(
          normalizeLines([{ slug, quantity }]),
          state.products.map((p) => ({
            ...p,
            priceCents: p.price == null ? null : Math.round(p.price * 100),
          })),
        );
        items[slug] = quantity;
      }
      state.carts.set(cartId, items);
      return { ...items };
    },

    async setCart(cartId: string, items: CartItems): Promise<CartItems> {
      return writeCart(cartId, items);
    },

    async clearCart(cartId: string) {
      state.carts.delete(cartId);
      return { ok: true as const };
    },

    async createOrder(input: CreateOrderInput): Promise<Order> {
      const requested = normalizeLines(input.lines);
      const validated = validateProducts(
        requested,
        state.products.map((p) => ({
          ...p,
          priceCents: p.price == null ? null : Math.round(p.price * 100),
        })),
        true,
      );
      const lines = validated.map(({ product: p, quantity }) => ({
        slug: p.slug,
        name: p.name,
        quantity,
        unitPrice: p.priceCents! / 100,
      }));
      const order: Order = {
        reference: createOrderReference(),
        userId: input.userId,
        status: "await",
        customerName: input.customerName,
        email: input.email,
        city: input.city,
        total: lines.reduce((s, l) => s + Math.round(l.unitPrice * 100) * l.quantity, 0) / 100,
        createdAt: today(),
        lines,
        phone: input.phone,
        shipping: {
          addressLine: input.addressLine,
          addressLine2: input.addressLine2,
          suburb: input.suburb,
          city: input.city,
          province: input.province,
          postalCode: input.postalCode,
          country: input.country ?? "South Africa",
          deliveryNotes: input.deliveryNotes,
        },
      };
      state.orders = [order, ...state.orders];
      return order;
    },

    async listOrders(): Promise<Order[]> {
      return state.orders;
    },

    async listOrdersForCustomer(userId: string, verifiedEmail?: string): Promise<Order[]> {
      const wanted = verifiedEmail?.trim().toLowerCase();
      return state.orders.filter(
        (o) => o.userId === userId || (!o.userId && wanted && o.email.toLowerCase() === wanted),
      );
    },

    async getProfile(accountEmail: string): Promise<CustomerProfile | null> {
      return profiles.get(accountEmail.toLowerCase()) ?? null;
    },

    async saveProfile(accountEmail: string, input: SaveProfileInput): Promise<CustomerProfile> {
      const key = accountEmail.toLowerCase();
      const profile: CustomerProfile = {
        ...input,
        accountEmail: key,
        country: input.country ?? "South Africa",
      };
      profiles.set(key, profile);
      return profile;
    },

    async getOrder(reference: string) {
      return state.orders.find((o) => o.reference === reference) ?? null;
    },

    async updateOrderStatus(reference: string, status: OrderStatus): Promise<Order> {
      const order = state.orders.find((o) => o.reference === reference);
      if (!order) throw new Error(`No order ${reference}.`);
      order.status = status;
      state.orders = [...state.orders];
      return order;
    },

    async joinWaitlist({ email, label }) {
      const exists = state.waitlistEntries.some((w) => w.email === email && w.label === label);
      if (!exists) {
        state.waitlistEntries = [
          { id: `w${state.nextId++}`, email, label, createdAt: today() },
          ...state.waitlistEntries,
        ];
      }
      return { ok: true as const };
    },

    async listWaitlist(): Promise<WaitlistEntry[]> {
      return state.waitlistEntries;
    },

    async listMessages(): Promise<ContactMessage[]> {
      return state.messages;
    },

    async setMessageHandled(id: string, handled: boolean): Promise<ContactMessage> {
      const message = state.messages.find((m) => m.id === id);
      if (!message) throw new Error("Message not found.");
      message.handled = handled;
      state.messages = [...state.messages];
      return message;
    },

    async listJobs(): Promise<ProductionJob[]> {
      return state.queue;
    },

    async createJob(input: CreateJobInput): Promise<ProductionJob> {
      const job: ProductionJob = {
        id: `j${state.nextId++}`,
        title: input.title,
        detail: input.detail,
        due: input.due?.trim() || "Unscheduled",
        overdue: input.overdue ?? false,
      };
      state.queue = [...state.queue, job];
      return job;
    },

    async updateJob(id: string, patch: Partial<CreateJobInput>): Promise<ProductionJob> {
      const job = state.queue.find((j) => j.id === id);
      if (!job) throw new Error("Job not found.");
      if (patch.title !== undefined) job.title = patch.title;
      if (patch.detail !== undefined) job.detail = patch.detail;
      if (patch.due !== undefined) job.due = patch.due || "Unscheduled";
      if (patch.overdue !== undefined) job.overdue = patch.overdue;
      state.queue = [...state.queue];
      return job;
    },

    async deleteJob(id: string) {
      state.queue = state.queue.filter((j) => j.id !== id);
      return { ok: true as const };
    },

    async getDashboard(): Promise<DashboardData> {
      const revenue = REVENUE.map((value, i) => ({ month: MONTHS[i]!, value }));
      const waitlist = waitlistBuckets();
      const paidTotal = 148600;
      const orderCount = state.orders.length + 28;
      const waitlistTotal = waitlist.reduce((s, w) => s + w.count, 0);
      return {
        kpis: [
          {
            key: "Revenue · 30 days",
            value: ZAR(paidTotal),
            delta: "+18.4%",
            direction: "up",
            note: "vs. previous 30",
          },
          {
            key: "Orders",
            value: String(orderCount),
            delta: "+6",
            direction: "up",
            note: `${state.orders.filter((o) => o.status === "await").length + 8} awaiting payment`,
          },
          {
            key: "Average order",
            value: ZAR(Math.round(paidTotal / orderCount)),
            delta: "-2.1%",
            direction: "down",
            note: "mix shifted to Volute",
          },
          {
            key: "Waitlist",
            value: String(waitlistTotal),
            delta: "+63",
            direction: "up",
            note: "Strata & Vellum",
          },
        ],
        revenue,
        orders: state.orders.slice(0, 6),
        orderCount,
        queue: state.queue,
        stock: state.stock,
        waitlist,
      };
    },
  };
}
