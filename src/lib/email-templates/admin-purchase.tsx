import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  reference: string
  customerName: string
  customerEmail: string
  phone?: string
  total: string
  transactionId: string
  sandbox: boolean
  address: string
  deliveryNotes?: string
  lines: { name: string; quantity: number; lineTotal: string }[]
}

function Email(data: Props) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{`${data.sandbox ? 'Test purchase' : 'New purchase'} ${data.reference} — ${data.total}`}</Preview>
      <Body style={{ fontFamily: 'Helvetica, Arial, sans-serif', color: '#1f2a24' }}>
        <Container style={{ padding: '32px 28px', maxWidth: '560px' }}>
          <Text>RESOLUT</Text>
          <Heading>{data.sandbox ? 'New sandbox test purchase' : 'An item has been purchased'}</Heading>
          <Text>PayFast has verified payment for order {data.reference}.</Text>
          {data.sandbox ? <Text>This is a sandbox test. No money was charged.</Text> : null}
          <Text>Customer: {data.customerName}<br />Email: {data.customerEmail}{data.phone ? <><br />Phone: {data.phone}</> : null}</Text>
          {data.lines.map((line, index) => (
            <Text key={index}>{line.quantity} × {line.name} · {line.lineTotal}</Text>
          ))}
          <Text><strong>{data.sandbox ? 'Test amount' : 'Total paid'}: {data.total}</strong></Text>
          <Text>PayFast transaction ID: {data.transactionId}</Text>
          <Text>Delivery address: {data.address}</Text>
          {data.deliveryNotes ? <Text>Delivery notes: {data.deliveryNotes}</Text> : null}
          <Text>Sign in to the studio admin to review and fulfil this order.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  to: 'james@resolutdesign.co.za',
  subject: (data: Record<string, any>) => `${data.sandbox ? '[Sandbox] ' : ''}New purchase ${data.reference} — Resolut`,
  displayName: 'Admin purchase notification',
} satisfies TemplateEntry
