import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  typescript: true,
})

export const PRICE_AMOUNT = 250000 // $2,500 in cents

export async function createCheckoutSession(
  email: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: PRICE_AMOUNT,
          product_data: {
            name: 'AI Ghostwriter — Complete Book Package',
            description:
              'Full AI-assisted ghostwriting service: 10–20+ hours of recorded interviews, ' +
              'complete chapter framework, full manuscript draft, revision support, and final proofread.',
          },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      service: 'ai_ghostwriter',
    },
    allow_promotion_codes: true,
    payment_intent_data: {
      description: 'AIGhostwriter.org — Book Manuscript Package',
    },
  })
}
