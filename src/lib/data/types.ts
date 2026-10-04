/**
 * Domain types + the repository contract.
 *
 * Everything the UI reads or writes goes through `ResolutRepository`. Two
 * adapters implement it: an in-memory one (default) and a Prisma one that
 * switches on automatically once DATABASE_URL exists. Swapping the datastore
 * therefore never touches a component.
 */

export type ProductSpec = { k: string; v: string };
export type ProductDetail = { h: string; p: string };

export type Product = {
  slug: string;
  name: string;
  tagline: string;
  /** Rand. Null means "coming soon" — not orderable. */
  price: number | null;
  priceLabel: string;
  badge?: string;
  images?: string[];
  image: string;
  imageAlt: string;
  detailImage: string;
  intro: string;
  body: string[];
  specs: ProductSpec[];
  details: ProductDetail[];
  addId?: string;
  /** false hides the piece from the storefront (studio still sees it). */
  published?: boolean;
};

export type OrderStatus = "await" | "paid" | "making" | "shipped" | "cancelled";

export type OrderLine = {
  slug: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type ShippingAddress = {
  addressLine: string;
  addressLine2?: string;
  suburb?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  deliveryNotes?: string;
};

export type Order = {
  reference: string;
  userId?: string;
  status: OrderStatus;
  customerName: string;
  email: string;
  city: string;
  total: number;
  createdAt: string;
  lines: OrderLine[];
  phone?: string;
  shipping?: ShippingAddress;
};

export type CreateOrderInput = {
  /** Assigned by the server from the customer session, never client input. */
  userId?: string;
  customerName: string;
  email: string;
  phone?: string;
  addressLine: string;
  addressLine2?: string;
  suburb?: string;
  city: string;
  province: string;
  postalCode: string;
  country?: string;
  deliveryNotes?: string;
  lines: { slug: string; quantity: number; expectedUnitPriceCents: number }[];
};

export type CreateProductInput = {
  name: string;
  slug?: string;
  tagline: string;
  /** Rand. Null/undefined means "coming soon". */
  price?: number | null;
  badge?: string;
  images?: string[];
  image?: string;
  imageAlt?: string;
  intro: string;
  body?: string[];
  specs?: ProductSpec[];
  details?: ProductDetail[];
  capacity?: number;
  readyStock?: number;
};

export type ProductionJob = {
  id: string;
  title: string;
  detail: string;
  due: string;
  overdue: boolean;
};

export type StockLevel = { slug: string; ready: number; capacity: number; sold: number };

export type Kpi = {
  key: string;
  value: string;
  delta: string;
  direction: "up" | "down";
  note: string;
};

export type RevenuePoint = { month: string; value: number };

export type WaitlistBucket = { label: string; count: number };

export type DashboardData = {
  kpis: Kpi[];
  revenue: RevenuePoint[];
  orders: Order[];
  orderCount: number;
  queue: ProductionJob[];
  stock: StockLevel[];
  waitlist: WaitlistBucket[];
};

/** Patch shape for editing an existing piece from the studio. */
export type UpdateProductInput = {
  name?: string;
  tagline?: string;
  intro?: string;
  price?: number | null;
  badge?: string | null;
  images?: string[];
  image?: string;
  imageAlt?: string;
  body?: string[];
  specs?: ProductSpec[];
  details?: ProductDetail[];
  capacity?: number;
  readyStock?: number;
  published?: boolean;
};

export type WaitlistEntry = {
  id: string;
  email: string;
  label: string;
  createdAt: string;
};

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  handled: boolean;
  createdAt: string;
};

export type CreateJobInput = {
  title: string;
  detail: string;
  due?: string;
  overdue?: boolean;
};

/** Server-side cart: slug -> quantity, keyed by an anonymous cart id cookie. */
export type CartItems = Record<string, number>;

/** Saved contact + delivery details for a signed-in customer. */
export type CustomerProfile = {
  /** The account (session) email — the immutable key for the profile. */
  accountEmail: string;
  /** Where the studio contacts the customer; editable. */
  contactEmail: string;
  phone?: string;
  addressLine?: string;
  addressLine2?: string;
  suburb?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country: string;
  deliveryNotes?: string;
};

export type SaveProfileInput = Omit<CustomerProfile, "accountEmail" | "country"> & {
  country?: string;
};

export interface ResolutRepository {
  /** Human-readable name of the active adapter, surfaced in the dashboard. */
  readonly name: "in-memory" | "prisma";
  listProducts(): Promise<Product[]>;
  /** Every piece, including unpublished ones — studio only. */
  listAllProducts(): Promise<Product[]>;
  getProduct(slug: string): Promise<Product | null>;
  createProduct(input: CreateProductInput): Promise<Product>;
  updateProduct(slug: string, patch: UpdateProductInput): Promise<Product>;
  deleteProduct(slug: string): Promise<{ ok: true }>;
  getCart(cartId: string): Promise<CartItems>;
  /** Sets an absolute quantity; 0 removes the line. Returns the full cart. */
  setCartItem(cartId: string, slug: string, quantity: number): Promise<CartItems>;
  /** Replaces the whole cart (used to merge a legacy client cart upward). */
  setCart(cartId: string, items: CartItems): Promise<CartItems>;
  clearCart(cartId: string): Promise<{ ok: true }>;
  createOrder(input: CreateOrderInput): Promise<Order>;
  listOrders(): Promise<Order[]>;
  /** Linked orders plus unclaimed guest orders for a currently verified email. */
  listOrdersForCustomer(userId: string, verifiedEmail?: string): Promise<Order[]>;
  /** Opaque profile key (customer:<userId>); email keys are legacy records. */
  getProfile(accountEmail: string): Promise<CustomerProfile | null>;
  saveProfile(accountEmail: string, input: SaveProfileInput): Promise<CustomerProfile>;
  getOrder(reference: string): Promise<Order | null>;
  updateOrderStatus(reference: string, status: OrderStatus): Promise<Order>;
  joinWaitlist(input: { email: string; label: string }): Promise<{ ok: true }>;
  listWaitlist(): Promise<WaitlistEntry[]>;
  createMessage(input: { name: string; email: string; message: string }): Promise<{ ok: true }>;
  listMessages(): Promise<ContactMessage[]>;
  setMessageHandled(id: string, handled: boolean): Promise<ContactMessage>;
  listJobs(): Promise<ProductionJob[]>;
  createJob(input: CreateJobInput): Promise<ProductionJob>;
  updateJob(id: string, patch: Partial<CreateJobInput>): Promise<ProductionJob>;
  deleteJob(id: string): Promise<{ ok: true }>;
  getDashboard(): Promise<DashboardData>;
}
