# Resend sender setup

Domain: `notify.resolutdesign.co.za`. Sender: `Resolut <noreply@notify.resolutdesign.co.za>`.

The domain has been added to Resend; it must be verified before sending to customers. Add the following records at the DNS provider authoritative for this subdomain. Names below are exactly as returned by Resend; check whether your DNS host expects the full name or the name relative to your zone.

| Type | Name | Value | Priority |
| --- | --- | --- | --- |
| TXT | `resend._domainkey.notify` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDF1KDA1xT1cM4F8V0VmVjYE71QZ8ex5m/KPyS9LDdGU6stGl69VobHAf7+d7WUAm2jBK7M+ENpY1Pce/V3RNePcNOHyI57ChTlJkqmJK3pLdwCvmvFYV6w3LWk3D3ZCTPcq/Ib1PCGY9nnjPjfluR/Y8moz5/j7qbeGofskKmPUwIDAQAB` | — |
| MX | `send.notify` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| TXT | `send.notify` | `v=spf1 include:amazonses.com ~all` | — |
| CNAME | `rsend.notify` | `send.forge.rmta.net` | — |

Use the default/automatic TTL. These records configure outbound email; do not replace your root domain's existing MX records. If `notify` is delegated to Lovable using NS records, these records must be served by the authoritative provider for that subdomain; adding them only to the parent zone will not work. Choose a separate sending subdomain if retaining that delegation.

After saving the records, open [Resend Domains](https://resend.com/domains), select the domain, and verify it. Keep click/open tracking disabled for authentication and private order links.

Set `RESEND_API_KEY` and `EMAIL_FROM` in the deployment environment as well as locally. No customer emails were sent during setup.
