import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Line {
  name?: string
  quantity?: number
  lineTotal?: string
}

interface Props {
  customerName?: string
  reference?: string
  total?: string
  estimatedDelivery?: string
  lines?: Line[]
  address?: string
}

const Email = ({
  customerName,
  reference = '—',
  total = '',
  estimatedDelivery,
  lines = [],
  address,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Order ${reference} confirmed — Resolut`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>RESOLUT</Text>
        <Heading style={h1}>Your order is confirmed</Heading>
        <Text style={p}>
          {customerName ? `Thank you, ${customerName}.` : 'Thank you.'} Payment has cleared and your
          piece has entered the making queue. Everything is built to order in our studio.
        </Text>

        <Section style={card}>
          <Text style={label}>Order reference</Text>
          <Text style={value}>{reference}</Text>
          {estimatedDelivery ? (
            <>
              <Text style={label}>Estimated delivery</Text>
              <Text style={value}>{estimatedDelivery}</Text>
            </>
          ) : null}
        </Section>

        {lines.length ? (
          <Section>
            <Text style={label}>Your pieces</Text>
            {lines.map((l, i) => (
              <Text key={i} style={lineRow}>
                {(l.quantity ?? 1) + ' × ' + (l.name ?? 'Piece')}
                {l.lineTotal ? '  ·  ' + l.lineTotal : ''}
              </Text>
            ))}
            <Hr style={hr} />
            {total ? <Text style={totalRow}>Total paid {total}</Text> : null}
          </Section>
        ) : null}

        {address ? (
          <Section>
            <Text style={label}>Delivering to</Text>
            <Text style={p}>{address}</Text>
          </Section>
        ) : null}

        <Hr style={hr} />
        <Text style={foot}>
          We&rsquo;ll email you again the moment your order moves through the workshop and when it is
          dispatched. Questions? Reply to this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Order ${data['reference'] ?? ''} confirmed — Resolut`.replace('  ', ' '),
  displayName: 'Order confirmation',
  previewData: {
    customerName: 'Thandi',
    reference: 'RSL-104822',
    total: 'R 6 480.00',
    estimatedDelivery: 'Thu 25 Sep 2026',
    lines: [{ name: 'Cornice', quantity: 1, lineTotal: 'R 6 480.00' }],
    address: '123 Long Street, CBD, Cape Town, Western Cape, 8001, South Africa',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brand = {
  fontSize: '12px',
  letterSpacing: '0.32em',
  color: '#1f2a24',
  margin: '0 0 20px',
  fontWeight: 700 as const,
}
const h1 = { fontSize: '24px', color: '#12180f', margin: '0 0 12px', lineHeight: '1.25' }
const p = { fontSize: '15px', lineHeight: '1.6', color: '#3b4239', margin: '0 0 14px' }
const card = {
  backgroundColor: '#f4f1ea',
  borderRadius: '10px',
  padding: '18px 20px',
  margin: '18px 0',
}
const label = {
  fontSize: '11px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
  color: '#6a7266',
  margin: '10px 0 2px',
}
const value = { fontSize: '17px', color: '#12180f', margin: '0', fontWeight: 600 as const }
const lineRow = { fontSize: '15px', color: '#3b4239', margin: '6px 0' }
const totalRow = { fontSize: '16px', color: '#12180f', margin: '8px 0', fontWeight: 600 as const }
const hr = { borderColor: '#e3e0d7', margin: '20px 0' }
const foot = { fontSize: '13px', lineHeight: '1.6', color: '#6a7266', margin: '0' }
