import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { StorefrontChrome } from "@/components/resolut/chrome";
import { sendContactMessage } from "@/lib/api/contact.functions";
import "@/lib/resolut/resolut.css";

const TITLE = "Contact the studio — Resolut";
const DESCRIPTION =
  "Get in touch with Resolut for sculptural lighting, project enquiries and help with your order. Made in the Eastern Cape, South Africa.";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await sendContactMessage({
        data: {
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          message: String(form.get("message") ?? ""),
          website: String(form.get("website") ?? ""),
        },
      });
      setSent(true);
    } catch {
      setError(
        "Your message couldn’t be sent. Please try again, or email hello@resolutdesign.co.za.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <StorefrontChrome>
      <main className="contact-page">
        <div className="wrap">
          <nav className="pdp-crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Contact</span>
          </nav>
          <div className="contact-heading">
            <p className="eyebrow">Contact the studio</p>
            <h1>
              Good things begin
              <br />
              with a <em>conversation.</em>
            </h1>
            <p>
              A question about a piece, a space you’re shaping, or an order already in the making.
              We’d love to hear from you.
            </p>
          </div>
          <div className="contact-grid">
            <aside className="contact-details" aria-label="Studio contact details">
              <div className="contact-detail">
                <p className="eyebrow">01 / Write to us</p>
                <a href="mailto:hello@resolutdesign.co.za">
                  hello@resolutdesign.co.za <ArrowUpRight size={18} aria-hidden="true" />
                </a>
                <p>For pieces, projects and everything in between.</p>
              </div>
              <div className="contact-detail">
                <p className="eyebrow">02 / Start a chat</p>
                <a href="https://wa.me/27693837314" target="_blank" rel="noopener noreferrer">
                  WhatsApp · +27 69 383 7314 <ArrowUpRight size={18} aria-hidden="true" />
                </a>
                <p>Share your space or ask us about a finish.</p>
              </div>
              <div className="contact-detail">
                <p className="eyebrow">03 / Made here</p>
                <h2>King William’s Town</h2>
                <p>
                  Eastern Cape, South Africa.
                  <br />
                  Designed, printed and assembled in our studio.
                </p>
              </div>
              <div className="contact-order-note">
                <h2>Already ordered?</h2>
                <p>Include your order reference in your message so we can help with your piece.</p>
                <Link to="/shipping">
                  Shipping &amp; order tracking <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </aside>
            <section className="contact-form-panel" aria-labelledby="contact-form-title">
              <p className="eyebrow">A direct line to Resolut</p>
              <h2 id="contact-form-title">Tell us what you have in mind.</h2>
              {sent ? (
                <div className="contact-success" role="status" aria-live="polite">
                  <Check size={28} aria-hidden="true" />
                  <h3>Message received.</h3>
                  <p>
                    Thank you for getting in touch. The studio will reply to the email address you
                    shared.
                  </p>
                  <button className="btn btn-ghost" onClick={() => setSent(false)}>
                    Send another message
                  </button>
                </div>
              ) : (
                <form className="contact-form" onSubmit={submit} aria-busy={pending}>
                  <div className="contact-field">
                    <label htmlFor="contact-name">Your name</label>
                    <input
                      id="contact-name"
                      name="name"
                      autoComplete="name"
                      placeholder="Full name"
                      required
                      maxLength={120}
                    />
                  </div>
                  <div className="contact-field">
                    <label htmlFor="contact-email">Email address</label>
                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      required
                      maxLength={254}
                    />
                  </div>
                  <div className="contact-field">
                    <label htmlFor="contact-message">Your message</label>
                    <textarea
                      id="contact-message"
                      name="message"
                      placeholder="Tell us about your space, the piece you’re considering, or how we can help…"
                      rows={6}
                      required
                      maxLength={5000}
                    />
                  </div>
                  <div hidden aria-hidden="true">
                    <label htmlFor="contact-website">Website</label>
                    <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
                  </div>
                  {error && (
                    <p className="contact-error" role="alert">
                      {error}
                    </p>
                  )}
                  <button className="btn btn-primary" type="submit" disabled={pending}>
                    {pending ? "Sending…" : "Send message"}{" "}
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </button>
                  <p className="contact-privacy">
                    We’ll use your details to respond to your enquiry.
                  </p>
                </form>
              )}
            </section>
          </div>
          <div className="contact-signoff">
            <span className="eyebrow">Precision, resolved in light.</span>
            <Link to="/collection" search={{ availability: "all", sort: "curated" }}>
              Explore the collection <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </main>
    </StorefrontChrome>
  );
}
