import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session

      if (session.payment_status === 'paid') {
        const customerEmail = session.customer_email

        if (customerEmail) {
          // Update profile as paid
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', customerEmail)
            .single()

          if (profile) {
            await supabase.from('profiles').update({
              has_paid: true,
              paid_at: new Date().toISOString(),
              stripe_customer_id: session.customer as string,
            }).eq('id', profile.id)

            // Create initial project for author
            await supabase.from('projects').insert({
              author_id: profile.id,
              title: 'My Book',
              phase: 'onboarding',
            })
          } else {
            // Store pending payment to be picked up on account creation
            console.log(`Payment received for unregistered email: ${customerEmail}`)
            // Store in a pending_payments table or handle via metadata
          }
        }
      }
      break
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      console.error('Payment failed:', paymentIntent.id)
      break
    }
  }

  return NextResponse.json({ received: true })
}
