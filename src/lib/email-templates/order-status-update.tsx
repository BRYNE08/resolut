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

interface Props {
  customerName?: string
  reference?: string
  statusLabel?: string
  statusNote?: string
  estimatedDelivery?: string
  showEta?: boolean
}

const Email = ({
  customerName,
  reference = '—',
  statusLabel = 'Updated',
  statusNote,
  estimatedDelivery,
  showEta = true,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Order ${reference}: ${statusLabel}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>RESOLUT</Text>
        <Heading style={h1}>{statusLabel}</Heading>
        <Text style={p}>
          {customerName ? `Hi ${customerName},` : 'Hi there,'} there&rsquo;s an update on your order{' '}
          <strong>{reference}</strong>.
        </Text>
        {statusNote ? <Text style={p}>{statusNote}</Text> : null}

        {showEta && estimatedDelivery ? (
          <Section style={card}>
            <Text style={label}>Estimated delivery</Text>
            <Text style={value}>{estimatedDelivery}</Text>
          </Section>
        ) : null}

        <Hr style={hr} />
        <Text style={foot}>
          You can track this order any time on our shipping page using the reference above.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Order ${data['reference'] ?? ''} — ${data['statusLabel'] ?? 'update'}`,
  displayName: 'Order status update',
  previewData: {
    customerName: 'Thandi',
    reference: 'RSL-104822',
    statusLabel: 'In the workshop',
    statusNote: 'Your piece is being printed, cured and hand-assembled.',
    estimatedDelivery: 'Thu 25 Sep 2026',
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
  margin: '0 0 2px',
}
const value = { fontSize: '17px', color: '#12180f', margin: '0', fontWeight: 600 as const }
const hr = { borderColor: '#e3e0d7', margin: '20px 0' }
const foot = { fontSize: '13px', lineHeight: '1.6', color: '#6a7266', margin: '0' }
