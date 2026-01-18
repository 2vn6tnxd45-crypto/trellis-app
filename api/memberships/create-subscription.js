/**
 * Create Membership Subscription API
 *
 * Creates a Stripe subscription for recurring membership billing
 */

import Stripe from 'stripe';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://mykrib.app',
  'https://www.mykrib.app',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : null,
].filter(Boolean);

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

export default async function handler(req, res) {
  // CORS headers - restrict to allowed origins
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      contractorId,
      membershipId,
      customerId,
      customerEmail,
      customerName,
      planId,
      planName,
      price,
      billingCycle,
      successUrl,
      cancelUrl
    } = req.body;

    // Validate required fields
    if (!contractorId || !planId || !customerEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get contractor's Stripe account (for Connect)
    const contractorDoc = await db.collection('contractors').doc(contractorId).get();
    const contractor = contractorDoc.data();
    const stripeAccountId = contractor?.stripeAccountId;

    // Determine the price interval
    let interval = 'year';
    let intervalCount = 1;

    switch (billingCycle) {
      case 'monthly':
        interval = 'month';
        intervalCount = 1;
        break;
      case 'quarterly':
        interval = 'month';
        intervalCount = 3;
        break;
      case 'annual':
      default:
        interval = 'year';
        intervalCount = 1;
        break;
    }

    // Create or retrieve Stripe customer
    let stripeCustomer;

    // Search for existing customer by email
    const existingCustomers = await stripe.customers.list({
      email: customerEmail,
      limit: 1
    });

    if (existingCustomers.data.length > 0) {
      stripeCustomer = existingCustomers.data[0];
    } else {
      stripeCustomer = await stripe.customers.create({
        email: customerEmail,
        name: customerName,
        metadata: {
          contractorId,
          customerId: customerId || ''
        }
      });
    }

    // Create a price for this subscription
    const stripePrice = await stripe.prices.create({
      unit_amount: Math.round(price * 100), // Convert to cents
      currency: 'usd',
      recurring: {
        interval,
        interval_count: intervalCount
      },
      product_data: {
        name: planName,
        metadata: {
          contractorId,
          planId
        }
      }
    });

    // Create Checkout Session for subscription
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePrice.id,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/membership/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/membership/cancel`,
      metadata: {
        contractorId,
        membershipId: membershipId || '',
        planId,
        customerId: customerId || ''
      },
      subscription_data: {
        metadata: {
          contractorId,
          membershipId: membershipId || '',
          planId,
          customerId: customerId || ''
        }
      },
      // If contractor has Stripe Connect, use their account
      ...(stripeAccountId && {
        payment_intent_data: {
          application_fee_amount: Math.round(price * 100 * 0.05), // 5% platform fee
          transfer_data: {
            destination: stripeAccountId
          }
        }
      })
    });

    // Update membership with pending Stripe info
    if (membershipId) {
      await db
        .collection('contractors')
        .doc(contractorId)
        .collection('memberships')
        .doc(membershipId)
        .update({
          stripeCustomerId: stripeCustomer.id,
          stripePriceId: stripePrice.id,
          stripeCheckoutSessionId: session.id,
          paymentMethod: 'stripe',
          status: 'pending'
        });
    }

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      sessionUrl: session.url
    });

  } catch (error) {
    console.error('Error creating subscription:', error);
    return res.status(500).json({
      error: 'Failed to create subscription'
    });
  }
}
