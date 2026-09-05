/**
 * Legal document content shown in the storefront legal modal.
 * Bodies are trusted, author-owned HTML rendered inside the modal.
 */
export type LegalKey = "terms" | "refund" | "privacy" | "shipping";

export const LEGAL_DOCS: Record<LegalKey, { title: string; html: string }> = {
  terms: {
    title: "Terms & Conditions",
    html: `
      <p class="updated">Last updated: <span class="fill">[date]</span></p>
      <div class="draft-note"><strong>Note to owner:</strong> This is a starter template to adapt, not lawyer-reviewed final wording. Fill every <span class="fill">[blank]</span>, and — because you sell an electrical product — have someone qualified review it before launch. It is written to align with the South African Consumer Protection Act (CPA) and ECTA, but your specific obligations should be confirmed.</div>

      <h4>1. Who we are</h4>
      <p>This website is operated by Slash Resolut (Pty) Ltd, trading as Resolut ("Resolut", "we", "us"), a company registered in South Africa (registration no. 2024/854669/07), of Zone 4, Zwelitsha, Qonce (King William’s Town), Eastern Cape, 5600, South Africa. You can reach us at hello@resolutdesign.co.za.</p>

      <h4>2. These terms</h4>
      <p>By browsing this site or placing an order, you agree to these Terms &amp; Conditions. Please read them alongside our Refund &amp; Returns Policy and Privacy Policy. If you do not agree, please do not use the site or place an order.</p>

      <h4>3. Our products</h4>
      <p>Our lighting is 3D-printed and made to order by hand. Because each piece is individually made, slight variations in finish, texture, and colour are natural characteristics of the product, not defects. Product images are as accurate as we can make them, but screens vary and the warm glow of a lit piece may appear differently in your space.</p>
      <p>Our lamps are supplied with a warm-white LED bulb and are designed to be used <strong>only</strong> with the supplied bulb or an equivalent LED bulb no greater than <span class="fill">[9W]</span>. Using an incorrect or higher-wattage bulb may damage the product and is done at your own risk.</p>

      <h4>4. Orders</h4>
      <p>When you place an order, you'll receive an order confirmation. This confirms we've received your order — a binding sale comes into effect once we accept and begin making your piece. We may decline or cancel an order (for example, if we cannot fulfil it or a pricing error has occurred), in which case we'll refund any payment already made.</p>
      <p>Because pieces are made to order, please allow a lead time of approximately <span class="fill">[2–3 weeks]</span> before dispatch, unless otherwise stated.</p>

      <h4>5. Prices and payment</h4>
      <p>All prices are in South African Rand (ZAR) and include VAT where applicable. We aim to keep prices accurate but reserve the right to correct genuine errors. Payment is processed securely via our third-party payment provider, PayFast; we do not store your full card details.</p>

      <h4>6. Delivery</h4>
      <p>Delivery terms, timeframes, and costs are set out in our Shipping &amp; Delivery information. Risk in the goods passes to you on delivery.</p>

      <h4>7. Your rights under the Consumer Protection Act</h4>
      <p>Nothing in these terms limits your rights under the South African Consumer Protection Act, including any right to return goods that are defective or not as described. Our Refund &amp; Returns Policy explains how this works in practice.</p>

      <h4>8. Warranty</h4>
      <p>We offer a <span class="fill">[2-year]</span> warranty against defects in materials and workmanship under normal domestic use. This is in addition to your statutory rights. It does not cover damage from misuse, accidents, incorrect bulbs, or normal wear.</p>

      <h4>9. Intellectual property</h4>
      <p>All content on this site — designs, images, text, logos, and the Resolut name — belongs to us and may not be copied or used without permission.</p>

      <h4>10. Our liability</h4>
      <p>We take care to make safe, quality products, but to the extent permitted by law our liability is limited to the value of the goods you purchased. We do not exclude any liability that cannot lawfully be excluded, including under the CPA.</p>

      <h4>11. Governing law</h4>
      <p>These terms are governed by the laws of South Africa.</p>

      <h4>12. Changes</h4>
      <p>We may update these terms from time to time. The version on the site at the time of your order applies to that order.</p>
    `,
  },
  refund: {
    title: "Refund & Returns Policy",
    html: `
      <p class="updated">Last updated: <span class="fill">[date]</span></p>
      <div class="draft-note"><strong>Note to owner:</strong> Starter template, CPA-aware but not lawyer-reviewed. The made-to-order carve-out below is common but must be handled carefully under the CPA — confirm the specifics with a professional, and never word it to override a customer's statutory rights to return faulty goods.</div>

      <h4>Our promise</h4>
      <p>We want you to love your Resolut piece. If something isn't right, we'll work with you fairly and within your rights under the South African Consumer Protection Act (CPA).</p>

      <h4>Faulty, damaged, or not as described</h4>
      <p>If your item arrives damaged, is defective, or is materially not as described, you are entitled under the CPA to a repair, replacement, or refund. Please contact us at orders@resolutdesign.co.za within <span class="fill">[e.g. 7]</span> days of delivery with your order number and a photo of the issue. We'll arrange the return at our cost and put it right promptly. This right applies regardless of anything else in this policy.</p>

      <h4>Made-to-order pieces</h4>
      <p>Because each lamp is 3D-printed and hand-finished specifically for you once you order, we are generally unable to accept returns simply because you've changed your mind, in the way an off-the-shelf item might allow. Please choose carefully and reach out with any questions before ordering — we're glad to help. This does <strong>not</strong> affect your rights if the item is faulty or not as described (see above).</p>

      <h4>Change of mind</h4>
      <p>If you do change your mind, please contact us as soon as possible. If we have not yet begun making your piece, we'll do our best to cancel and refund you. Once production has started, a change-of-mind cancellation may not be possible, or may be subject to a fair charge for work already done. <span class="fill">[Adjust this to the approach you decide on.]</span></p>

      <h4>How refunds are made</h4>
      <p>Approved refunds are made to your original payment method within <span class="fill">[e.g. 5–10]</span> business days of us receiving the returned item or agreeing the refund.</p>

      <h4>Warranty</h4>
      <p>Your piece is covered by our <span class="fill">[2-year]</span> warranty against defects in materials and workmanship under normal use, in addition to your CPA rights. Contact us and we'll help.</p>

      <h4>How to reach us</h4>
      <p>Email orders@resolutdesign.co.za with your order number and we'll respond within <span class="fill">[e.g. 2]</span> business days.</p>
    `,
  },
  privacy: {
    title: "Privacy Policy",
    html: `
      <p class="updated">Last updated: <span class="fill">[date]</span></p>
      <div class="draft-note"><strong>Note to owner:</strong> Starter template aligned with South Africa's POPIA. Confirm the specifics (especially your payment and delivery providers) and have it reviewed before launch.</div>

      <h4>Who we are</h4>
      <p>Slash Resolut (Pty) Ltd, trading as Resolut, is the responsible party for your personal information under the Protection of Personal Information Act (POPIA). Contact us at hello@resolutdesign.co.za about anything in this policy.</p>

      <h4>What we collect</h4>
      <p>When you order or enquire, we collect what we need to serve you: your name, email, delivery address, contact number, and order details. Payment is handled by our payment provider — we do not see or store your full card details.</p>

      <h4>Why we use it</h4>
      <ul>
        <li>To process and deliver your order and communicate with you about it</li>
        <li>To handle returns, warranty, and support</li>
        <li>To meet our legal and tax obligations</li>
        <li>Where you've agreed, to send you occasional updates — you can opt out any time</li>
      </ul>

      <h4>Who we share it with</h4>
      <p>Only those who help us fulfil your order — our payment provider (PayFast) and courier (<span class="fill">[courier]</span>) — and only what they need. We don't sell your information.</p>

      <h4>How we protect it</h4>
      <p>We take reasonable steps to keep your information secure and keep it only as long as needed for the purposes above or as the law requires.</p>

      <h4>Your rights</h4>
      <p>Under POPIA you can ask to see, correct, or delete your personal information, or object to certain uses. Email us and we'll help.</p>
    `,
  },
  shipping: {
    title: "Shipping & Delivery",
    html: `
      <p class="updated">Last updated: <span class="fill">[date]</span></p>
      <div class="draft-note"><strong>Note to owner:</strong> Fill these in once your courier and rates are confirmed. Keep it consistent with the lead time and free-shipping threshold shown elsewhere on the site.</div>

      <h4>Made to order</h4>
      <p>Each piece is made to order, so please allow a lead time of approximately <span class="fill">[2–3 weeks]</span> for your piece to be printed, finished, and prepared before it's dispatched.</p>

      <h4>Delivery across South Africa</h4>
      <p>We deliver nationwide via <span class="fill">[courier]</span>. Once dispatched, delivery typically takes <span class="fill">[X–Y]</span> business days depending on your location. We'll send tracking details when your order ships.</p>

      <h4>Delivery cost</h4>
      <p>Delivery is charged at <span class="fill">[flat rate / calculated at checkout]</span>. Orders over <span class="fill">[R 7,500]</span> qualify for free delivery.</p>

      <h4>Careful packaging</h4>
      <p>Your lamp is fragile and is packed with care to arrive safely. If anything arrives damaged, contact us within <span class="fill">[7]</span> days and we'll make it right — see our Refund &amp; Returns Policy.</p>

      <h4>International</h4>
      <p><span class="fill">[State whether you ship outside South Africa, or "We currently ship within South Africa only."]</span></p>
    `,
  },
};
