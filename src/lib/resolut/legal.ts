/** Final, owner-supplied policy text. Trusted HTML for the storefront policy modal. */
export type LegalKey = "terms" | "refund" | "privacy" | "shipping";

export const LEGAL_DOCS: Record<LegalKey, { title: string; html: string }> = {
  terms: {
    title: "Terms & Conditions",
    html: `
      <p class="updated">Last updated: 5 October 2026</p>
      <h4>1. Who we are</h4>
      <p>This website is operated by Slash Resolut (Pty) Ltd, trading as Resolut ("Resolut", "we", "us"), a company registered in South Africa (registration no. 2024/854669/07), of Zone 4, Zwelitsha, Qonce (King William’s Town), Eastern Cape, 5600, South Africa.</p>
      <p>You can reach us at hello@resolutdesign.co.za, orders@resolutdesign.co.za (for orders), or on WhatsApp at +27 69 383 7314. Our website is resolutdesign.co.za.</p>
      <h4>2. These terms</h4>
      <p>By browsing this site or placing an order, you agree to these Terms &amp; Conditions. Please read them alongside our Refund &amp; Returns Policy, Shipping &amp; Delivery information and Privacy Policy. If you do not agree, please do not use the site or place an order.</p>
      <h4>3. Our products</h4>
      <p>Resolut lamps are 3D-printed in PLA, finished by hand and assembled before dispatch. Because each piece is printed layer by layer, faint layer lines or tiny surface marks are a normal characteristic of the process and are not defects. Product photographs are as accurate as we can make them, but screens differ, and the warm glow of a lit lamp will look slightly different in your own space.</p>
      <p>Each lamp is supplied fully assembled, with a warm-white (2700K) LED bulb fitted. It is designed for indoor domestic use with LED bulbs only, rated at a maximum of 9W. Please do not use incandescent or halogen bulbs, or any bulb above 9W. The heat can damage the shade, and doing so is at your own risk.</p>
      <h4>4. Orders</h4>
      <p>When you place an order you will receive an order confirmation by email. This confirms that we have received your order. The contract is concluded once we accept your order and your payment has been received. We may decline or cancel an order, for example if we cannot fulfil it or a pricing error has occurred, in which case we will refund any payment already made.</p>
      <p>Every piece is made to order. Please allow 2 to 3 weeks from the date of your order before dispatch. We aim to begin printing within 3 business days of your order, and we will tell you if there is ever a delay.</p>
      <h4>5. Prices and payment</h4>
      <p>All prices are in South African Rand (ZAR) and include VAT where applicable. Delivery is free on orders over R 7,500, and for smaller orders the delivery fee is shown at checkout before you pay. We take care to keep prices accurate but may correct genuine errors, and will tell you before proceeding if that affects your order.</p>
      <p>Payment is processed securely by our third-party payment provider, PayFast. We do not see or store your full card details.</p>
      <h4>6. Delivery</h4>
      <p>Delivery times, costs and conditions are set out in our Shipping &amp; Delivery information. Risk in the goods passes to you when they are delivered to you.</p>
      <h4>7. Your rights under the Consumer Protection Act and ECTA</h4>
      <p>Nothing in these terms limits your rights under the Consumer Protection Act (CPA) or the Electronic Communications and Transactions Act (ECTA). These include your right to cancel an online purchase within seven days of receiving the goods, and your right to a repair, replacement or refund if goods are defective or not as described. Our Refund &amp; Returns Policy explains how this works in practice.</p>
      <h4>8. Warranty</h4>
      <p>We offer a 2-year warranty against defects in materials and workmanship under normal domestic use, starting from the date of delivery. This is in addition to your statutory rights. It does not cover damage from misuse, accidents, incorrect bulbs, or normal wear.</p>
      <h4>9. Intellectual property</h4>
      <p>All content on this site (designs, images, text, logos and the Resolut name) belongs to us and may not be copied or used without our permission.</p>
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
      <p class="updated">Last updated: 5 October 2026</p>
      <h4>Our promise</h4>
      <p>We want you to love your Resolut lamp. If something isn’t right, we will work with you fairly and within your rights under the South African Consumer Protection Act (CPA) and the Electronic Communications and Transactions Act (ECTA).</p>
      <h4>Made to order</h4>
      <p>Every lamp is made after you order it, so please check the dimensions and details on the product page before you buy, and ask us anything first. This does not affect your cancellation rights below, or your rights if an item is faulty.</p>
      <h4>Cancelling before your lamp is delivered</h4>
      <p>If you cancel before we start printing (we aim to start within 3 business days of your order), we will cancel the order and refund you in full. You can still cancel after printing has started and before delivery, and we will refund you. We just ask that you tell us as early as you can. Email orders@resolutdesign.co.za with your order number.</p>
      <h4>Your 7-day right to cancel after delivery</h4>
      <p>You may cancel your purchase within 7 days of receiving it, without giving a reason. Please email orders@resolutdesign.co.za within that time with your order number.</p>
      <p>The lamp must be returned unused, in its original packaging and in the condition you received it. The only charge we may make is the direct cost of returning the goods, so you cover the return courier unless the item is faulty, damaged or not as described. Because the lamp is fragile, please pack it carefully in its original packaging. If you prefer, we can arrange collection, and the courier’s actual cost will be deducted from your refund.</p>
      <h4>Faulty, damaged or not as described</h4>
      <p>If your lamp arrives damaged, is defective, or is materially not as described, you are entitled under the CPA to a repair, replacement or refund.</p>
      <p>Please check the parcel when it arrives. If the box is visibly damaged, take photos before opening it. Please contact us at orders@resolutdesign.co.za within 7 days of delivery with your order number and photos, so we can sort it out quickly and claim from the courier. We cover the return costs for faulty, damaged or incorrect items.</p>
      <p>If a defect shows up later, your CPA right to a repair, replacement or refund within six months of delivery, and our 2-year warranty, still apply.</p>
      <h4>How refunds are made</h4>
      <p>Approved refunds are paid to your original payment method. We will refund you within 7 business days of receiving the returned item (or, for a cancellation before dispatch, of agreeing the cancellation), and always within 30 days of the cancellation.</p>
      <h4>Warranty</h4>
      <p>Your lamp is covered by our 2-year warranty against defects in materials and workmanship under normal domestic use, starting from the date of delivery, in addition to your CPA rights. Contact us and we will help.</p>
      <h4>How to reach us</h4>
      <p>Email orders@resolutdesign.co.za with your order number, or WhatsApp +27 69 383 7314. We respond within 2 business days.</p>
    `,
  },
  privacy: {
    title: "Privacy Policy",
    html: `
      <p class="updated">Last updated: 5 October 2026</p>
      <h4>Who we are</h4>
      <p>Slash Resolut (Pty) Ltd, trading as Resolut, is the responsible party for your personal information under the Protection of Personal Information Act (POPIA). Our Information Officer is our founder, Sandiso Mkwaqa. Contact us at hello@resolutdesign.co.za about anything in this policy.</p>
      <h4>What we collect</h4>
      <p>When you order or enquire, we collect what we need to serve you: your name, email address, delivery address, contact number and order details, and any messages you send us. Payment is handled by our payment provider. We do not see or store your full card details.</p>
      <h4>Why we use it</h4>
      <ul>
      <li>To process and deliver your order and communicate with you about it</li>
      <li>To handle returns, warranty and support</li>
      <li>To meet our legal and tax obligations</li>
      <li>Where you’ve agreed, to send you occasional updates. You can opt out at any time</li>
      </ul>
      <h4>Who we share it with</h4>
      <p>Only those who help us fulfil your order, and only what they need: our payment provider (PayFast), our courier or delivery partner, and the technology providers that host our website and email. We don’t sell your information.</p>
      <h4>How we protect it and how long we keep it</h4>
      <p>We take reasonable steps to keep your information secure. We keep it only as long as needed for the purposes above or as the law requires, which includes keeping order and invoice records for five years for tax and company-law purposes.</p>
      <h4>Your rights</h4>
      <p>Under POPIA you can ask to see, correct or delete your personal information, or object to certain uses. Email hello@resolutdesign.co.za and we will help. If you are unhappy with how we have handled your information, you can complain to the Information Regulator at inforegulator.org.za.</p>
    `,
  },
  shipping: {
    title: "Shipping & Delivery",
    html: `
      <p class="updated">Last updated: 5 October 2026</p>
      <h4>Made to order</h4>
      <p>Every piece is made to order. Please allow 2 to 3 weeks for your lamp to be printed, finished, assembled and prepared before it is dispatched. We will email you when it ships.</p>
      <h4>Delivery across South Africa</h4>
      <p>We deliver to your door anywhere in South Africa by courier. Once dispatched, delivery typically takes 2 to 5 business days to major centres and up to 7 business days to outlying areas. These are estimates, not guarantees, and the courier can affect timing. We will send you tracking details when your order ships.</p>
      <p>Please make sure someone can receive the parcel, as couriers may require a signature.</p>
      <h4>Delivery cost</h4>
      <p>Delivery on orders over R 7,500 is free. For smaller orders, the delivery fee is shown at checkout before you pay.</p>
      <h4>Careful packaging</h4>
      <p>Your lamp ships fully assembled, with the bulb fitted, in protective packaging. Because it is fragile, please check the parcel on arrival. If the box is damaged, take photos before opening it and contact us at orders@resolutdesign.co.za within 7 days. See our Refund &amp; Returns Policy.</p>
      <h4>International</h4>
      <p>We currently ship within South Africa only.</p>
    `,
  },
};
