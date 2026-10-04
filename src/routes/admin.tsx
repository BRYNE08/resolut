import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  createJob,
  createPiece,
  deleteJob,
  deletePiece,
  setMessageHandled,
  setOrderStatus,
  updateJob,
  updatePiece,
} from "@/lib/api/admin.functions";
import { signOutStudio } from "@/lib/api/auth.functions";
import { uploadPieceImage } from "@/lib/api/uploads.functions";
import { pieceBodySchema } from "@/lib/api/admin.schemas";
import { canAccessStudio } from "@/lib/auth/config";
import { dashboardQuery, productsQuery, queryKeys, studioSessionQuery, studioQuery } from "@/lib/api/queries";

import type {
  ContactMessage,
  DashboardData,
  Order,
  OrderStatus,
  Product,
  ProductionJob,
  ProductDetail,
  ProductSpec,

  WaitlistEntry,
} from "@/lib/data/types";
import "@/lib/resolut/resolut.css";
import "@/lib/resolut/resolut-admin.css";


const TITLE = "Studio Dashboard — Resolut";
const DESCRIPTION =
  "Resolut studio dashboard: orders, revenue, production queue, stock levels and waitlist demand for the lighting collection.";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  // Route gate: UX only — every studio server function re-checks the role.
  beforeLoad: async ({ context, location }) => {
    const auth = await context.queryClient.fetchQuery(studioSessionQuery);
    if (!canAccessStudio(auth.session)) {
      throw redirect({ to: "/admin/signin" });
    }
  },
  // Prime the cache on the server so the dashboard renders fully formed.
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(productsQuery);
    context.queryClient.ensureQueryData(studioQuery);
    return context.queryClient.ensureQueryData(dashboardQuery);
  },

  errorComponent: ({ error }) => (
    <div className="admin-gate" role="alert">
      <h1>Studio unavailable</h1>
      <p>{error instanceof Error ? error.message : "Something went wrong. Please try again."}</p>
      <Link to="/">Back to the storefront</Link>
    </div>
  ),
  component: AdminPage,
});

const ZAR = (n: number) =>
  // Deterministic grouping: Intl locale data differs between server and browser.
  "R\u00a0" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const NAV = [
  { id: "overview", label: "Overview", d: "M3 10.5 12 4l9 6.5V20H3z" },
  { id: "orders", label: "Orders", d: "M6 6h15l-1.5 9h-12z" },
  { id: "pieces", label: "Pieces", d: "M12 3l8 4.5v9L12 21l-8-4.5v-9z" },
  { id: "production", label: "Production", d: "M4 20V9l5 3V9l5 3V4l6 4v12z" },
  { id: "waitlist", label: "Waitlist", d: "M4 19c0-3.3 3.6-5 8-5s8 1.7 8 5M12 4a3.5 3.5 0 110 7 3.5 3.5 0 010-7z" },
  { id: "messages", label: "Messages", d: "M4 6h16v12H4zM4 7l8 6 8-6" },
];

const STATUS_LABEL: Record<OrderStatus, string> = {
  paid: "Paid",
  making: "In production",
  await: "Awaiting payment",
  shipped: "Shipped",
  cancelled: "Cancelled",
};

const STATUS_FLOW: OrderStatus[] = ["await", "paid", "making", "shipped", "cancelled"];

const HEADINGS: Record<string, string> = {
  overview: "Good evening, Ruan.",
  orders: "Orders.",
  pieces: "The collection.",
  production: "On the bench.",
  waitlist: "Demand.",
  messages: "The inbox.",
};

/** Downloads any table of rows as a CSV file, client-side. */
function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function useStudioMutation<TInput, TResult>(fn: (input: { data: TInput }) => Promise<TResult>) {
  const queryClient = useQueryClient();
  const submit = useServerFn(fn as never) as unknown as (input: { data: TInput }) => Promise<TResult>;
  return useMutation({
    mutationFn: submit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.studio });
      queryClient.invalidateQueries({ queryKey: queryKeys.products });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

function AdminPage() {
  const [active, setActive] = useState("overview");
  const [composerOpen, setComposerOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Server state comes from the repository (in-memory or Prisma) via TanStack Query.
  const { data } = useSuspenseQuery(dashboardQuery);
  const { data: catalog } = useSuspenseQuery(productsQuery);
  const { data: studio } = useSuspenseQuery(studioQuery);
  const products = studio.pieces.length ? studio.pieces : catalog.products;
  const dashboard = data.dashboard;

  const awaiting = studio.orders.filter((o) => o.status === "await").length;
  const unread = studio.messages.filter((m) => !m.handled).length;

  // Sign-out: cancel in-flight studio reads, drop cached studio data, clear the
  // cookie, then leave via a history replace so Back can't restore the shell.
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const leave = useServerFn(signOutStudio);
  const leaving = useMutation({ mutationFn: () => leave({}) });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    await leaving.mutateAsync();
    queryClient.clear();
    navigate({ to: "/signin", replace: true });
  }




  return (
    <div className="admin">
      <aside className="ad-side">
        <div className="ad-brand">
          <div className="arch-mark" aria-hidden="true" />
          <div>
            <b>Resolut</b>
            <span>Studio</span>
          </div>
        </div>

        <nav className="ad-nav" aria-label="Dashboard sections">
          <div className="lbl">Studio</div>
          {NAV.map((item) => (
            <button
              key={item.id}
              className={active === item.id ? "on" : ""}
              onClick={() => setActive(item.id)}
              aria-current={active === item.id ? "page" : undefined}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d={item.d} />
              </svg>
              {item.label}
              {item.id === "orders" && awaiting > 0 ? <span className="pill">{awaiting}</span> : null}
              {item.id === "pieces" ? <span className="pill">{products.length}</span> : null}
              {item.id === "messages" && unread > 0 ? <span className="pill">{unread}</span> : null}
            </button>
          ))}
          <div className="lbl">Site</div>
          <Link to="/" className="ad-nav-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M4 5h16v14H4zM4 9h16" />
            </svg>
            Storefront
          </Link>
        </nav>

        <div className="ad-side-foot">
          <div className="ad-avatar">
            {data.viewer.name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div>
            <strong>{data.viewer.name}</strong>
            <small>{data.viewer.role === "admin" ? "Administrator" : "Studio owner"}</small>
          </div>
          <button className="link" type="button" onClick={handleSignOut} disabled={leaving.isPending}>
            {leaving.isPending ? "Signing out…" : "Sign out"}
          </button>

        </div>
      </aside>

      <main className="ad-main">
        <header className="ad-top">
          <div>
            <p className="eyebrow">Thursday, 13 August</p>
            <h1>{HEADINGS[active] ?? "Studio."}</h1>
          </div>
          <div className="ad-top-actions">
            <label className="ad-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16 16l4.5 4.5" />
              </svg>
              <input
                placeholder="Search orders, pieces, people"
                aria-label="Search the studio"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <button
              className="ad-btn ghost"
              onClick={() =>
                downloadCsv(
                  "resolut-orders.csv",
                  ["Reference", "Date", "Customer", "Email", "City", "Status", "Total (ZAR)"],
                  studio.orders.map((o) => [
                    o.reference,
                    o.createdAt,
                    o.customerName,
                    o.email,
                    o.city,
                    STATUS_LABEL[o.status],
                    o.total,
                  ]),
                )
              }
            >
              Export orders
            </button>
            <button
              className="ad-btn"
              onClick={() => {
                setActive("pieces");
                setComposerOpen(true);
              }}
            >
              New piece
            </button>
          </div>
        </header>

        {active === "pieces" ? (
          <PiecesView
            products={products}
            dashboard={dashboard}
            search={search}
            composerOpen={composerOpen}
            setComposerOpen={setComposerOpen}
          />
        ) : active === "orders" ? (
          <OrdersView orders={studio.orders} products={products} search={search} />
        ) : active === "production" ? (
          <ProductionView jobs={studio.jobs} search={search} />
        ) : active === "waitlist" ? (
          <WaitlistView entries={studio.waitlist} dashboard={dashboard} search={search} />
        ) : active === "messages" ? (
          <MessagesView messages={studio.messages} search={search} />
        ) : (
          <OverviewView dashboard={dashboard} products={products} onJump={setActive} />
        )}


        <p className="ad-note">
          Data source: <strong>{data.source === "prisma" ? "Prisma database" : "in-memory sample data"}</strong> ·
          auth: <strong>{data.authLive ? "Auth.js session" : "demo studio session"}</strong>. Set DATABASE_URL and
          AUTH_SECRET to switch both to live without touching this page.
        </p>
      </main>
    </div>
  );
}

/* ------------------------------- overview ------------------------------- */

function OverviewView({
  dashboard,
  products,
  onJump,
}: {
  dashboard: DashboardData;
  products: Product[];
  onJump: (tab: string) => void;
}) {

  const { kpis, revenue, orders, orderCount, queue, stock, waitlist } = dashboard;

  const values = revenue.map((r) => r.value);
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * 100;
    const y = 100 - (v / max) * 88;
    return `${x},${y}`;
  });
  const line = `M ${pts.join(" L ")}`;
  const area = `${line} L 100,100 L 0,100 Z`;
  const lastY = 100 - ((values[values.length - 1] ?? 0) / max) * 88;
  const wlMax = Math.max(...waitlist.map((w) => w.count), 1);

  return (
    <>
      <section className="ad-kpis">
        {kpis.map((kpi) => (
          <article className="kpi" key={kpi.key}>
            <div className="k">{kpi.key}</div>
            <div className="v">{kpi.value}</div>
            <div className={`d ${kpi.direction}`}>
              {kpi.delta} <em>{kpi.note}</em>
            </div>
          </article>
        ))}
      </section>

      <div className="ad-row two">
        <section className="card chart">
          <div className="card-head">
            <div>
              <h2>Revenue</h2>
              <p>Twelve months · made-to-order, net of delivery</p>
            </div>
            <button className="link" type="button" onClick={() => onJump("production")}>
              Production
            </button>

          </div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Revenue trend over twelve months">
            <defs>
              <linearGradient id="adFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#214425" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#214425" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[25, 50, 75].map((y) => (
              <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#214425" strokeOpacity="0.1" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={area} fill="url(#adFill)" />
            <path d={line} fill="none" stroke="#214425" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            <line
              x1="100"
              y1={lastY}
              x2="100"
              y2={lastY}
              stroke="#741C35"
              strokeWidth="7"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="months">
            {revenue.map((r) => (
              <span key={r.month}>{r.month}</span>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Production queue</h2>
              <p>{queue.length} jobs on the bench</p>
            </div>
          </div>
          <ul className="queue">
            {queue.map((q) => (
              <li key={q.id}>
                <span className={`dot${q.overdue ? " warn" : ""}`} aria-hidden="true" />
                <div>
                  <strong>{q.title}</strong>
                  <p>{q.detail}</p>
                </div>
                <time>{q.due}</time>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="ad-row two">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Recent orders</h2>
              <p>Latest {orders.length} of {orderCount}</p>
            </div>
            <button className="link" type="button" onClick={() => onJump("orders")}>
              View all
            </button>

          </div>
          <table className="ad-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Piece</th>
                <th>Status</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const first = o.lines[0];
                const p = products.find((x) => x.slug === first?.slug);
                return (
                  <tr key={o.reference}>
                    <td>
                      <div className="who">
                        <div className="ad-thumb">
                          <img src={p?.image ?? "/resolut/placeholder.svg"} alt="" />
                        </div>
                        <div>
                          <strong>{o.customerName}</strong>
                          <small>
                            {o.reference} · {o.city}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {first?.name ?? "—"}
                      {first && first.quantity > 1 ? ` ×${first.quantity}` : ""}
                    </td>
                    <td>
                      <span className={`tag ${o.status}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
                    </td>
                    <td className="num">{ZAR(o.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <div className="ad-row">
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Pieces</h2>
                <p>Finished stock against monthly capacity</p>
              </div>
            </div>
            {products.map((p) => {
              const s = stock.find((x) => x.slug === p.slug) ?? { ready: 0, capacity: 12, sold: 0 };
              const pct = Math.round((s.ready / Math.max(1, s.capacity)) * 100);
              const low = s.ready > 0 && s.ready <= 3;
              return (
                <div className="piece" key={p.slug}>
                  <div className="ad-thumb">
                    <img src={p.image} alt="" />
                  </div>
                  <div className="pn">
                    <strong>{p.name}</strong>
                    <small>{p.price ? p.priceLabel : "Not yet for sale"}</small>
                    <div className={`bar${low ? " low" : ""}`}>
                      <i style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="pv">
                    <b>{s.ready ? `${s.ready} ready` : "—"}</b>
                    <small>{s.sold ? `${s.sold} sold` : "In development"}</small>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>Waitlist demand</h2>
                <p>Signups by interest</p>
              </div>
            </div>
            <div className="wl-total">
              <b>{waitlist.reduce((sum, w) => sum + w.count, 0)}</b>
              <span>people on the list</span>
            </div>
            {waitlist.map((w) => (
              <div className="wl-row" key={w.label}>
                <span>{w.label}</span>
                <b>{w.count}</b>
                <div className="bar">
                  <i style={{ width: `${(w.count / wlMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}

/* -------------------------------- pieces -------------------------------- */

function PiecesView({
  products,
  dashboard,
  search,
  composerOpen,
  setComposerOpen,
}: {
  products: Product[];
  dashboard: DashboardData;
  search: string;
  composerOpen: boolean;
  setComposerOpen: (open: boolean) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const save = useStudioMutation(updatePiece);
  const remove = useStudioMutation(deletePiece);

  const forSale = products.filter((p) => p.price != null);
  const readyTotal = dashboard.stock.reduce((sum, s) => sum + s.ready, 0);
  const soldTotal = dashboard.stock.reduce((sum, s) => sum + s.sold, 0);
  const term = search.trim().toLowerCase();
  const visible = term
    ? products.filter((p) => `${p.name} ${p.tagline} ${p.slug}`.toLowerCase().includes(term))
    : products;
  const editingPiece = products.find((p) => p.slug === editing) ?? null;


  return (
    <>
      <section className="ad-kpis">
        <article className="kpi">
          <div className="k">Pieces</div>
          <div className="v">{products.length}</div>
          <div className="d up">
            {forSale.length} <em>live for sale</em>
          </div>
        </article>
        <article className="kpi">
          <div className="k">In development</div>
          <div className="v">{products.length - forSale.length}</div>
          <div className="d up">
            — <em>not yet priced</em>
          </div>
        </article>
        <article className="kpi">
          <div className="k">Finished stock</div>
          <div className="v">{readyTotal}</div>
          <div className="d up">
            — <em>ready to ship</em>
          </div>
        </article>
        <article className="kpi">
          <div className="k">Units sold</div>
          <div className="v">{soldTotal}</div>
          <div className="d up">
            — <em>all time</em>
          </div>
        </article>
      </section>

      <div className={`ad-row ${composerOpen || editingPiece ? "pieces-split" : ""}`}>
        <section className="card">
          <div className="card-head">
            <div>
              <h2>The collection</h2>
              <p>
                {visible.length} of {products.length} pieces · stock, pricing and storefront visibility
              </p>
            </div>
            {!composerOpen ? (
              <button
                className="ad-btn"
                onClick={() => {
                  setEditing(null);
                  setComposerOpen(true);
                }}
              >
                Add a piece
              </button>
            ) : null}
          </div>

          <table className="ad-table pieces-table">
            <thead>
              <tr>
                <th>Piece</th>
                <th>Status</th>
                <th className="num">Stock</th>
                <th className="num">Price</th>
                <th className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const s = dashboard.stock.find((x) => x.slug === p.slug) ?? {
                  ready: 0,
                  capacity: 12,
                  sold: 0,
                };
                const hidden = p.published === false;
                return (
                  <tr key={p.slug} className={hidden ? "is-hidden" : ""}>
                    <td>
                      <div className="who">
                        <div className="ad-thumb">
                          <img src={p.image} alt="" />
                        </div>
                        <div>
                          <strong>{p.name}</strong>
                          <small>{p.tagline}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`tag ${hidden ? "cancelled" : p.price == null ? "await" : "paid"}`}>
                        {hidden ? "Unpublished" : p.price == null ? "In development" : "For sale"}
                      </span>
                    </td>
                    <td className="num">
                      {s.ready} / {s.capacity}
                    </td>
                    <td className="num">{p.price == null ? "—" : ZAR(p.price)}</td>
                    <td className="num">
                      <div className="row-actions">
                        <button
                          className="link"
                          type="button"
                          onClick={() => {
                            setComposerOpen(false);
                            setEditing(p.slug);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="link"
                          type="button"
                          disabled={save.isPending}
                          onClick={() => save.mutate({ data: { slug: p.slug, published: hidden } })}
                        >
                          {hidden ? "Publish" : "Unpublish"}
                        </button>
                        <Link to="/product/$slug" params={{ slug: p.slug }} className="link">
                          View
                        </Link>
                        <button
                          className="link danger"
                          type="button"
                          disabled={remove.isPending}
                          onClick={() => {
                            if (confirm(`Permanently delete ${p.name}? This cannot be undone. It will also be removed from customer carts.`)) {
                              remove.mutate({ data: { slug: p.slug } });
                            }
                          }}
                        >
                          Delete permanently
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5}>No piece matches “{search}”.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        {remove.error ? (
          <p className="ad-form-msg err" role="alert">{remove.error.message || "Could not delete the piece."}</p>
        ) : null}
        {composerOpen ? <NewPieceCard onClose={() => setComposerOpen(false)} /> : null}
        {editingPiece && !composerOpen ? (
          <EditPieceCard
            piece={editingPiece}
            stock={
              dashboard.stock.find((x) => x.slug === editingPiece.slug) ?? {
                slug: editingPiece.slug,
                ready: 0,
                capacity: 12,
                sold: 0,
              }
            }
            onClose={() => setEditing(null)}
          />
        ) : null}
      </div>
    </>
  );
}


/** Ordered gallery; the first image is used on cards and in the cart. */
function PieceImageField({ defaultValue = [] }: { defaultValue?: string[] }) {
  const upload = useServerFn(uploadPieceImage);
  const [images, setImages] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (!files.length) return;
    if (images.length + files.length > 10) { setError("Choose up to 10 images per piece."); return; }
    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        if (file.size > 4 * 1024 * 1024) throw new Error(`${file.name} is larger than 4 MB.`);
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        const result = await upload({ data: { name: file.name, contentType: file.type as never, data: btoa(binary) } });
        setImages((current) => [...new Set([...current, result.url])]);
      }
    } catch (err) { setError((err as Error).message || "Upload failed. Please retry the remaining images."); }
    finally { setBusy(false); }
  }
  return (
    <div className="wide ad-upload">
      <span className="ad-upload-label">Piece images</span>
      <input type="hidden" name="images" value={JSON.stringify(images.filter((image) => image.trim()))} />
      <fieldset disabled={busy} className="ad-upload-gallery">
        {images.map((image, index) => (
          <div className="ad-upload-row" key={index}>
            <div className="ad-upload-preview">{image ? <img src={image} alt={`Piece image ${index + 1}`} /> : <span>No image</span>}</div>
            <div className="ad-upload-actions">
              <label className="ad-upload-url">{index === 0 ? "Cover image" : `Image ${index + 1}`}<input className="ad-upload-path" value={image} onChange={(event) => { const value = event.currentTarget.value; setImages((current) => current.map((url, i) => i === index ? value : url)); }} /></label>
              {index > 0 && <button type="button" className="ad-btn ghost" onClick={() => setImages((current) => [current[index], ...current.filter((_, i) => i !== index)])}>Make cover</button>}
              <button type="button" className="ad-btn ghost" onClick={() => setImages((current) => current.filter((_, i) => i !== index))}>Remove</button>
            </div>
          </div>
        ))}
        <div className="ad-upload-toolbar">
        <label className="ad-btn ghost ad-upload-btn">{busy ? "Uploading…" : "Upload images"}<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml" onChange={onPick} disabled={busy || images.length >= 10} /></label>
        <button type="button" className="ad-btn ghost" disabled={images.length >= 10} onClick={() => setImages((current) => [...current, ""])}>Add image URL</button>
        </div>
      </fieldset>
      {busy && <input aria-label="Images are still uploading" required value="" onChange={() => {}} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />}
      <p className="ad-upload-hint">Up to 10 images · 4 MB each. The first image is the cover.</p>
      {error && <p className="ad-form-msg err" role="alert">{error}</p>}
    </div>
  );
}


function SpecsField({ defaultValue = [] }: { defaultValue?: ProductSpec[] }) {
  const [rows, setRows] = useState<ProductSpec[]>(
    defaultValue.length ? defaultValue : [{ v: "", k: "" }],
  );

  return (
    <div className="wide ad-rows">
      <div className="ad-rows-head">
        <span className="ad-upload-label">Specs</span>
        <p className="ad-upload-hint">Value plus label, up to six — e.g. “212 mm” · “Diameter”.</p>
      </div>
      {rows.map((row, index) => (
        <div className="ad-row" key={index}>
          <input
            name="specV"
            value={row.v}
            placeholder="212 mm"
            onChange={(event) =>
              setRows((prev) =>
                prev.map((r, i) => (i === index ? { ...r, v: event.target.value } : r)),
              )
            }
          />
          <input
            name="specK"
            value={row.k}
            placeholder="Diameter"
            onChange={(event) =>
              setRows((prev) =>
                prev.map((r, i) => (i === index ? { ...r, k: event.target.value } : r)),
              )
            }
          />
          <button
            className="ad-btn ghost"
            type="button"
            aria-label="Remove spec"
            onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      {rows.length < 6 ? (
        <button
          className="ad-btn ghost"
          type="button"
          onClick={() => setRows((prev) => [...prev, { v: "", k: "" }])}
        >
          Add spec
        </button>
      ) : null}
    </div>
  );
}

/** Repeatable heading/paragraph blocks (Materials, Light, Lead time…). */
function DetailsField({ defaultValue = [] }: { defaultValue?: ProductDetail[] }) {
  const [rows, setRows] = useState<ProductDetail[]>(
    defaultValue.length ? defaultValue : [{ h: "", p: "" }],
  );

  return (
    <div className="wide ad-rows">
      <div className="ad-rows-head">
        <span className="ad-upload-label">Details</span>
        <p className="ad-upload-hint">Heading and paragraph blocks, up to six.</p>
      </div>
      {rows.map((row, index) => (
        <div className="ad-row detail" key={index}>
          <input
            name="detailH"
            value={row.h}
            placeholder="Materials"
            onChange={(event) =>
              setRows((prev) =>
                prev.map((r, i) => (i === index ? { ...r, h: event.target.value } : r)),
              )
            }
          />
          <textarea
            name="detailP"
            rows={2}
            value={row.p}
            placeholder="Seamless single-path 3D print, finished by hand."
            onChange={(event) =>
              setRows((prev) =>
                prev.map((r, i) => (i === index ? { ...r, p: event.target.value } : r)),
              )
            }
          />
          <button
            className="ad-btn ghost"
            type="button"
            aria-label="Remove detail"
            onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      {rows.length < 6 ? (
        <button
          className="ad-btn ghost"
          type="button"
          onClick={() => setRows((prev) => [...prev, { h: "", p: "" }])}
        >
          Add detail
        </button>
      ) : null}
    </div>
  );
}

/** Pairs the repeatable inputs back into the shapes the server expects. */
function readSpecs(values: FormData): ProductSpec[] {
  const vs = values.getAll("specV").map((v) => String(v).trim());
  const ks = values.getAll("specK").map((v) => String(v).trim());
  return vs
    .map((v, i) => ({ v, k: ks[i] ?? "" }))
    .filter((row) => row.v.length > 0 && row.k.length > 0)
    .slice(0, 6);
}

function readDetails(values: FormData): ProductDetail[] {
  const hs = values.getAll("detailH").map((v) => String(v).trim());
  const ps = values.getAll("detailP").map((v) => String(v).trim());
  return hs
    .map((h, i) => ({ h, p: ps[i] ?? "" }))
    .filter((row) => row.h.length >= 2 && row.p.length >= 2)
    .slice(0, 6);
}


function NewPieceCard({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const submit = useServerFn(createPiece);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  /** Bumped after a successful save so the repeatable spec/detail rows clear. */
  const [formKey, setFormKey] = useState(0);


  const mutation = useMutation({
    mutationFn: submit,
    onSuccess: (result) => {
      setError(null);
      setCreated(result.product.name);
      queryClient.invalidateQueries({ queryKey: queryKeys.products });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
    onError: (err: Error) => setError(err.message || "Could not save the piece."),
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const text = (key: string) => String(values.get(key) ?? "").trim();

    const name = text("name");
    const tagline = text("tagline");
    const intro = text("intro");
    if (name.length < 2 || tagline.length < 3 || intro.length < 3) {
      setError("Name, tagline and intro are all required.");
      return;
    }

    const rawPrice = text("price");
    const price = rawPrice ? Math.round(Number(rawPrice)) : null;
    if (rawPrice && (!Number.isFinite(price) || (price ?? 0) <= 0)) {
      setError("Price must be a positive number in rand, or left blank for “coming soon”.");
      return;
    }

    const body = text("body")
      .split("\n\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const bodyValidation = pieceBodySchema.safeParse(body);
    if (!bodyValidation.success) {
      setError(bodyValidation.error.issues[0].message);
      return;
    }

    const specs = readSpecs(values);
    const details = readDetails(values);


    mutation.mutate({
      data: {
        name,
        tagline,
        intro,
        price,
        badge: text("badge") || undefined,
        images: JSON.parse(text("images") || "[]"),
        imageAlt: text("imageAlt") || undefined,
        body: body.length ? body : undefined,
        specs: specs.length ? specs : undefined,
        details: details.length ? details : undefined,
        capacity: Number(text("capacity")) || undefined,
        readyStock: Number(text("readyStock")) || undefined,
      },
    });
    form.reset();
    setFormKey((key) => key + 1);

  }

  return (
    <section className="card ad-form-card">
      <div className="card-head">
        <div>
          <h2>New piece</h2>
          <p>Adds the piece to the catalogue and the storefront</p>
        </div>
        <button className="ad-btn ghost" onClick={onClose} type="button">
          Close
        </button>
      </div>

      <form className="ad-form" onSubmit={onSubmit} key={formKey}>

        <label>
          <span>Name</span>
          <input name="name" placeholder="Strata" required />
        </label>
        <label>
          <span>Tagline</span>
          <input name="tagline" placeholder="Pendant · layered tiers" required />
        </label>
        <label className="wide">
          <span>Intro line</span>
          <input name="intro" placeholder="Light, read as architecture." required />
        </label>
        <label>
          <span>Price (ZAR)</span>
          <input name="price" inputMode="numeric" placeholder="Leave blank for coming soon" />
        </label>
        <label>
          <span>Badge</span>
          <input name="badge" placeholder="New release" />
        </label>
        <label>
          <span>Ready stock</span>
          <input name="readyStock" inputMode="numeric" placeholder="0" />
        </label>
        <label>
          <span>Monthly capacity</span>
          <input name="capacity" inputMode="numeric" placeholder="12" />
        </label>
        <PieceImageField />
        <label className="wide">
          <span>Image alt text</span>
          <input name="imageAlt" placeholder="Strata pendant, lit" />
        </label>
        <label className="wide">
          <span>Description</span>
          <textarea name="body" rows={4} placeholder="Separate paragraphs with a blank line. Up to 6 paragraphs, 5,000 characters each." />
        </label>
        <SpecsField />
        <DetailsField />


        {error ? (
          <p className="ad-form-msg err" role="alert">
            {error}
          </p>
        ) : null}
        {created && !error ? (
          <p className="ad-form-msg ok" role="status">
            {created} added to the collection.
          </p>
        ) : null}

        <div className="ad-form-actions">
          <button className="ad-btn ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="ad-btn" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Add piece"}
          </button>
        </div>
      </form>
    </section>
  );
}

function EditPieceCard({
  piece,
  stock,
  onClose,
}: {
  piece: Product;
  stock: { slug: string; ready: number; capacity: number; sold: number };
  onClose: () => void;
}) {
  const save = useStudioMutation(updatePiece);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const text = (key: string) => String(values.get(key) ?? "").trim();

    const rawPrice = text("price");
    const price = rawPrice ? Math.round(Number(rawPrice)) : null;
    if (rawPrice && (!Number.isFinite(price) || (price ?? 0) <= 0)) {
      setError("Price must be a positive number in rand, or blank for “coming soon”.");
      return;
    }
    const body = text("body")
      .split("\n\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const bodyValidation = pieceBodySchema.safeParse(body);
    if (!bodyValidation.success) {
      setError(bodyValidation.error.issues[0].message);
      return;
    }

    const specs = readSpecs(values);
    const details = readDetails(values);

    setError(null);
    save.mutate(
      {
        data: {
          slug: piece.slug,
          name: text("name"),
          tagline: text("tagline"),
          intro: text("intro"),
          price,
          badge: text("badge") || null,
          images: JSON.parse(text("images") || "[]"),
          imageAlt: text("imageAlt") || undefined,
          body: body.length ? body : undefined,
          specs,
          details,

          readyStock: Number(text("readyStock")) || 0,
          capacity: Number(text("capacity")) || 12,
          published: values.get("published") === "on",
        },
      },
      {
        onSuccess: () => setSaved(true),
        onError: (err: Error) => setError(err.message || "Could not save the piece."),
      },
    );
  }

  return (
    <section className="card ad-form-card">
      <div className="card-head">
        <div>
          <h2>Edit {piece.name}</h2>
          <p>Changes appear on the storefront immediately</p>
        </div>
        <button className="ad-btn ghost" onClick={onClose} type="button">
          Close
        </button>
      </div>

      <form className="ad-form" onSubmit={onSubmit} key={piece.slug}>
        <label>
          <span>Name</span>
          <input name="name" defaultValue={piece.name} required />
        </label>
        <label>
          <span>Tagline</span>
          <input name="tagline" defaultValue={piece.tagline} required />
        </label>
        <label className="wide">
          <span>Intro line</span>
          <input name="intro" defaultValue={piece.intro} required />
        </label>
        <label>
          <span>Price (ZAR)</span>
          <input name="price" inputMode="numeric" defaultValue={piece.price ?? ""} />
        </label>
        <label>
          <span>Badge</span>
          <input name="badge" defaultValue={piece.badge ?? ""} />
        </label>
        <label>
          <span>Ready stock</span>
          <input name="readyStock" inputMode="numeric" defaultValue={stock.ready} />
        </label>
        <label>
          <span>Monthly capacity</span>
          <input name="capacity" inputMode="numeric" defaultValue={stock.capacity} />
        </label>
        <PieceImageField defaultValue={piece.images?.length ? piece.images : [...new Set([piece.image, piece.detailImage])]} />
        <label className="wide">
          <span>Image alt text</span>
          <input name="imageAlt" defaultValue={piece.imageAlt} />
        </label>
        <label className="wide">
          <span>Description</span>
          <textarea name="body" rows={4} defaultValue={piece.body.join("\n\n")} placeholder="Separate paragraphs with a blank line. Up to 6 paragraphs, 5,000 characters each." />
        </label>
        <SpecsField defaultValue={piece.specs} />
        <DetailsField defaultValue={piece.details} />

        <label className="wide check">
          <input type="checkbox" name="published" defaultChecked={piece.published !== false} />
          <span>Visible on the storefront</span>
        </label>

        {error ? (
          <p className="ad-form-msg err" role="alert">
            {error}
          </p>
        ) : null}
        {saved && !error ? (
          <p className="ad-form-msg ok" role="status">
            {piece.name} updated.
          </p>
        ) : null}

        <div className="ad-form-actions">
          <button className="ad-btn ghost" type="button" onClick={onClose}>
            Done
          </button>
          <button className="ad-btn" type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </section>
  );
}

/* -------------------------------- orders -------------------------------- */

function OrdersView({
  orders,
  products,
  search,
}: {
  orders: Order[];
  products: Product[];
  search: string;
}) {
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  const advance = useStudioMutation(setOrderStatus);

  const term = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      orders.filter((o) => {
        if (filter !== "all" && o.status !== filter) return false;
        if (!term) return true;
        return `${o.reference} ${o.customerName} ${o.email} ${o.city}`.toLowerCase().includes(term);
      }),
    [orders, filter, term],
  );
  const selected = orders.find((o) => o.reference === open) ?? null;
  const revenue = orders
    .filter((o) => o.status !== "await" && o.status !== "cancelled")
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <>
      <section className="ad-kpis">
        <article className="kpi">
          <div className="k">Orders</div>
          <div className="v">{orders.length}</div>
          <div className="d up">
            — <em>all time</em>
          </div>
        </article>
        <article className="kpi">
          <div className="k">Awaiting payment</div>
          <div className="v">{orders.filter((o) => o.status === "await").length}</div>
          <div className="d down">
            — <em>chase via PayFast</em>
          </div>
        </article>
        <article className="kpi">
          <div className="k">In production</div>
          <div className="v">{orders.filter((o) => o.status === "making").length}</div>
          <div className="d up">
            — <em>on the bench</em>
          </div>
        </article>
        <article className="kpi">
          <div className="k">Confirmed revenue</div>
          <div className="v">{ZAR(revenue)}</div>
          <div className="d up">
            — <em>paid and beyond</em>
          </div>
        </article>
      </section>

      <div className={`ad-row ${selected ? "pieces-split" : ""}`}>
        <section className="card">
          <div className="card-head">
            <div>
              <h2>All orders</h2>
              <p>
                {visible.length} of {orders.length} shown
              </p>
            </div>
            <div className="ad-chips">
              {(["all", ...STATUS_FLOW] as (OrderStatus | "all")[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`ad-chip${filter === status ? " on" : ""}`}
                  onClick={() => setFilter(status)}
                >
                  {status === "all" ? "Everything" : STATUS_LABEL[status]}
                </button>
              ))}
            </div>
          </div>

          <table className="ad-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Piece</th>
                <th>Status</th>
                <th className="num">Total</th>
                <th className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => {
                const first = o.lines[0];
                const p = products.find((x) => x.slug === first?.slug);
                return (
                  <tr key={o.reference}>
                    <td>
                      <div className="who">
                        <div className="ad-thumb">
                          <img src={p?.image ?? "/resolut/placeholder.svg"} alt="" />
                        </div>
                        <div>
                          <strong>{o.customerName}</strong>
                          <small>
                            {o.reference} · {o.createdAt} · {o.email}
                          </small>
                          <small>
                            {[
                              o.shipping?.addressLine,
                              o.shipping?.suburb,
                              o.shipping?.city ?? o.city,
                              o.shipping?.province,
                              o.shipping?.postalCode,
                            ]
                              .filter((part) => part && String(part).trim().length > 0)
                              .join(", ")}
                          </small>
                        </div>

                      </div>
                    </td>
                    <td>
                      {first?.name ?? "—"}
                      {first && first.quantity > 1 ? ` ×${first.quantity}` : ""}
                    </td>
                    <td>
                      <span className={`tag ${o.status}`}>{STATUS_LABEL[o.status]}</span>
                    </td>
                    <td className="num">{ZAR(o.total)}</td>
                    <td className="num">
                      <div className="row-actions">
                        <button className="link" type="button" onClick={() => setOpen(o.reference)}>
                          Open
                        </button>
                        <select
                          className="ad-select sm"
                          value={o.status}
                          disabled={advance.isPending}
                          onChange={(event) =>
                            advance.mutate({
                              data: { reference: o.reference, status: event.target.value as OrderStatus },
                            })
                          }
                          aria-label={`Status for ${o.reference}`}
                        >
                          {STATUS_FLOW.map((status) => (
                            <option key={status} value={status}>
                              {STATUS_LABEL[status]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5}>No orders match this filter.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        {selected ? (
          <section className="card ad-form-card">
            <div className="card-head">
              <div>
                <h2>{selected.reference}</h2>
                <p>
                  {selected.createdAt} · {STATUS_LABEL[selected.status]}
                </p>
              </div>
              <button className="ad-btn ghost" type="button" onClick={() => setOpen(null)}>
                Close
              </button>
            </div>
            <dl className="ad-detail">
              <div>
                <dt>Customer</dt>
                <dd>{selected.customerName}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${selected.email}`}>{selected.email}</a>
                </dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{selected.phone ? <a href={`tel:${selected.phone}`}>{selected.phone}</a> : "—"}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{ZAR(selected.total)}</dd>
              </div>
              <div className="wide">
                <dt>Shipping address</dt>
                <dd>
                  {selected.shipping ? (
                    <>
                      {[
                        selected.shipping.addressLine,
                        selected.shipping.addressLine2,
                        selected.shipping.suburb,
                        selected.shipping.city,
                        selected.shipping.province,
                        selected.shipping.postalCode,
                        selected.shipping.country,
                      ]
                        .filter((part) => part && part.trim().length > 0)
                        .join(", ")}
                    </>
                  ) : (
                    selected.city
                  )}
                </dd>
              </div>
              {selected.shipping?.deliveryNotes ? (
                <div className="wide">
                  <dt>Delivery notes</dt>
                  <dd>{selected.shipping.deliveryNotes}</dd>
                </div>
              ) : null}
            </dl>

            <table className="ad-table">
              <thead>
                <tr>
                  <th>Line</th>
                  <th className="num">Qty</th>
                  <th className="num">Line total</th>
                </tr>
              </thead>
              <tbody>
                {selected.lines.map((line) => (
                  <tr key={line.slug + line.name}>
                    <td>{line.name}</td>
                    <td className="num">{line.quantity}</td>
                    <td className="num">{ZAR(line.unitPrice * line.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ad-form-actions">
              {STATUS_FLOW.filter((s) => s !== selected.status).map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`ad-btn ${status === "cancelled" ? "ghost" : ""}`}
                  disabled={advance.isPending}
                  onClick={() => advance.mutate({ data: { reference: selected.reference, status } })}
                >
                  Mark {STATUS_LABEL[status].toLowerCase()}
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}

/* ------------------------------ production ------------------------------ */

function ProductionView({ jobs, search }: { jobs: ProductionJob[]; search: string }) {
  const add = useStudioMutation(createJob);
  const edit = useStudioMutation(updateJob);
  const remove = useStudioMutation(deleteJob);
  const term = search.trim().toLowerCase();
  const visible = term
    ? jobs.filter((j) => `${j.title} ${j.detail}`.toLowerCase().includes(term))
    : jobs;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const title = String(values.get("title") ?? "").trim();
    const detail = String(values.get("detail") ?? "").trim();
    if (title.length < 2 || detail.length < 2) return;
    add.mutate({
      data: { title, detail, due: String(values.get("due") ?? "").trim() || undefined },
    });
    form.reset();
  }

  return (
    <>
      <section className="ad-kpis">
        <article className="kpi">
          <div className="k">Jobs on the bench</div>
          <div className="v">{jobs.length}</div>
          <div className="d up">
            — <em>active</em>
          </div>
        </article>
        <article className="kpi">
          <div className="k">Overdue</div>
          <div className="v">{jobs.filter((j) => j.overdue).length}</div>
          <div className="d down">
            — <em>needs attention</em>
          </div>
        </article>
      </section>

      <div className="ad-row pieces-split">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Production queue</h2>
              <p>{visible.length} jobs</p>
            </div>
          </div>
          <ul className="queue">
            {visible.map((j) => (
              <li key={j.id}>
                <span className={`dot${j.overdue ? " warn" : ""}`} aria-hidden="true" />
                <div>
                  <strong>{j.title}</strong>
                  <p>{j.detail}</p>
                  <div className="row-actions">
                    <button
                      className="link"
                      type="button"
                      disabled={edit.isPending}
                      onClick={() => edit.mutate({ data: { id: j.id, overdue: !j.overdue } })}
                    >
                      {j.overdue ? "Clear overdue" : "Flag overdue"}
                    </button>
                    <button
                      className="link danger"
                      type="button"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate({ data: { id: j.id } })}
                    >
                      Complete
                    </button>
                  </div>
                </div>
                <time>{j.due}</time>
              </li>
            ))}
            {visible.length === 0 ? <li>Nothing on the bench.</li> : null}
          </ul>
        </section>

        <section className="card ad-form-card">
          <div className="card-head">
            <div>
              <h2>Add a job</h2>
              <p>Anything the bench needs to make or finish</p>
            </div>
          </div>
          <form className="ad-form" onSubmit={onSubmit}>
            <label className="wide">
              <span>Title</span>
              <input name="title" placeholder="Cornice · RSL-1186" required />
            </label>
            <label className="wide">
              <span>Detail</span>
              <input name="detail" placeholder="Printing, then hand-finish" required />
            </label>
            <label className="wide">
              <span>Due</span>
              <input name="due" placeholder="Due Fri" />
            </label>
            <div className="ad-form-actions">
              <button className="ad-btn" type="submit" disabled={add.isPending}>
                {add.isPending ? "Adding…" : "Add job"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}

/* -------------------------------- waitlist ------------------------------- */

function WaitlistView({
  entries,
  dashboard,
  search,
}: {
  entries: WaitlistEntry[];
  dashboard: DashboardData;
  search: string;
}) {
  const term = search.trim().toLowerCase();
  const visible = term
    ? entries.filter((e) => `${e.email} ${e.label}`.toLowerCase().includes(term))
    : entries;
  const max = Math.max(...dashboard.waitlist.map((w) => w.count), 1);

  return (
    <>
      <section className="ad-kpis">
        {dashboard.waitlist.slice(0, 4).map((w) => (
          <article className="kpi" key={w.label}>
            <div className="k">{w.label}</div>
            <div className="v">{w.count}</div>
            <div className="d up">
              — <em>signups</em>
            </div>
          </article>
        ))}
      </section>

      <div className="ad-row two">
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Signups</h2>
              <p>{visible.length} recent entries</p>
            </div>
            <button
              className="ad-btn ghost"
              type="button"
              onClick={() =>
                downloadCsv(
                  "resolut-waitlist.csv",
                  ["Email", "Interest", "Date"],
                  entries.map((e) => [e.email, e.label, e.createdAt]),
                )
              }
            >
              Export CSV
            </button>
          </div>
          <table className="ad-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Interest</th>
                <th className="num">Joined</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <tr key={e.id}>
                  <td>{e.email}</td>
                  <td>{e.label}</td>
                  <td className="num">{e.createdAt}</td>
                </tr>
              ))}
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={3}>No signups yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h2>Demand by piece</h2>
              <p>Where the interest sits</p>
            </div>
          </div>
          {dashboard.waitlist.map((w) => (
            <div className="wl-row" key={w.label}>
              <span>{w.label}</span>
              <b>{w.count}</b>
              <div className="bar">
                <i style={{ width: `${(w.count / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

/* -------------------------------- messages ------------------------------- */

function MessagesView({ messages, search }: { messages: ContactMessage[]; search: string }) {
  const mark = useStudioMutation(setMessageHandled);
  const term = search.trim().toLowerCase();
  const visible = term
    ? messages.filter((m) => `${m.name} ${m.email} ${m.message}`.toLowerCase().includes(term))
    : messages;
  const unread = messages.filter((m) => !m.handled).length;

  return (
    <>
      <section className="ad-kpis">
        <article className="kpi">
          <div className="k">Messages</div>
          <div className="v">{messages.length}</div>
          <div className="d up">
            — <em>all time</em>
          </div>
        </article>
        <article className="kpi">
          <div className="k">Needs a reply</div>
          <div className="v">{unread}</div>
          <div className="d down">
            — <em>open enquiries</em>
          </div>
        </article>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Enquiries</h2>
            <p>{visible.length} shown</p>
          </div>
          <button
            className="ad-btn ghost"
            type="button"
            onClick={() =>
              downloadCsv(
                "resolut-messages.csv",
                ["Date", "Name", "Email", "Handled", "Message"],
                messages.map((m) => [m.createdAt, m.name, m.email, m.handled ? "yes" : "no", m.message]),
              )
            }
          >
            Export CSV
          </button>
        </div>
        <ul className="ad-inbox">
          {visible.map((m) => (
            <li key={m.id} className={m.handled ? "done" : ""}>
              <div className="ad-inbox-head">
                <div>
                  <strong>{m.name}</strong>
                  <small>
                    <a href={`mailto:${m.email}`}>{m.email}</a> · {m.createdAt}
                  </small>
                </div>
                <div className="row-actions">
                  <span className={`tag ${m.handled ? "shipped" : "await"}`}>
                    {m.handled ? "Handled" : "Open"}
                  </span>
                  <button
                    className="link"
                    type="button"
                    disabled={mark.isPending}
                    onClick={() => mark.mutate({ data: { id: m.id, handled: !m.handled } })}
                  >
                    {m.handled ? "Reopen" : "Mark handled"}
                  </button>
                </div>
              </div>
              <p>{m.message}</p>
            </li>
          ))}
          {visible.length === 0 ? <li>No messages match.</li> : null}
        </ul>
      </section>
    </>
  );
}
