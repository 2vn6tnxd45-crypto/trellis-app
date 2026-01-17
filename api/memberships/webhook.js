/**
 * Membership Stripe Webhook Handler
 *
 * Handles subscription lifecycle events:
 * - checkout.session.completed - Subscription created
 * - invoice.paid - Successful renewal payment
 * - invoice.payment_failed - Failed payment
 * - customer.subscription.updated - Subscription changed
 * - customer.subscription.deleted - Subscription cancelled
 */

import Stripe from 'stripe';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

// Disable body parsing, we need the raw body for signature verification
export const config = {
  api: {
    bodyParser: false
  }
};

// Helper to get raw body
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Send notification email
async function sendEmail(to, subject, html) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html })
    });
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.STRIPE_MEMBERSHIP_WEBHOOK_SECRET;
  const signature = req.headers['stripe-signature'];

  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error('Webhook signature verification failed:', error.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  console.log('Received membership webhook:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        // Only process subscription checkouts
        if (session.mode !== 'subscription') break;

        const { contractorId, membershipId, planId, customerId } = session.metadata;

        if (!contractorId || !membershipId) {
          console.log('Missing metadata in checkout session');
          break;
        }

        // Get the subscription details
        const subscription = await stripe.subscriptions.retrieve(session.subscription);

        // Update membership to active
        const membershipRef = db
          .collection('contractors')
          .doc(contractorId)
          .collection('memberships')
          .doc(membershipId);

        const membershipSnap = await membershipRef.get();

        if (!membershipSnap.exists) {
          console.log('Membership not found:', membershipId);
          break;
        }

        const membership = membershipSnap.data();

        // Calculate end date from subscription
        const periodEnd = new Date(subscription.current_period_end * 1000);

        await membershipRef.update({
          status: 'active',
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: session.customer,
          startDate: Timestamp.now(),
          endDate: Timestamp.fromDate(periodEnd),
          paymentMethod: 'stripe'
        });

        // Send confirmation email
        await sendEmail(
          membership.customerEmail,
          `Welcome to ${membership.planName}!`,
          generateWelcomeEmail(membership, periodEnd)
        );

        console.log('Membership activated:', membershipId);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;

        // Only process subscription invoices
        if (!invoice.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const { contractorId, membershipId } = subscription.metadata;

        if (!contractorId || !membershipId) break;

        const membershipRef = db
          .collection('contractors')
          .doc(contractorId)
          .collection('memberships')
          .doc(membershipId);

        const membershipSnap = await membershipRef.get();
        if (!membershipSnap.exists) break;

        const membership = membershipSnap.data();

        // Update end date for renewal
        const periodEnd = new Date(subscription.current_period_end * 1000);

        // Reset service usage for new period
        const servicesUsed = (membership.servicesUsed || []).map(s => ({
          ...s,
          usedCount: 0,
          lastUsedDate: null,
          jobIds: []
        }));

        await membershipRef.update({
          status: 'active',
          endDate: Timestamp.fromDate(periodEnd),
          renewedAt: Timestamp.now(),
          servicesUsed
        });

        // Send renewal confirmation email
        await sendEmail(
          membership.customerEmail,
          `Your ${membership.planName} Membership Has Been Renewed`,
          generateRenewalConfirmationEmail(membership, periodEnd, invoice.amount_paid / 100)
        );

        console.log('Membership renewed via Stripe:', membershipId);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;

        if (!invoice.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const { contractorId, membershipId } = subscription.metadata;

        if (!contractorId || !membershipId) break;

        const membershipRef = db
          .collection('contractors')
          .doc(contractorId)
          .collection('memberships')
          .doc(membershipId);

        const membershipSnap = await membershipRef.get();
        if (!membershipSnap.exists) break;

        const membership = membershipSnap.data();

        // Send payment failed email
        await sendEmail(
          membership.customerEmail,
          `Payment Failed for ${membership.planName} Membership`,
          generatePaymentFailedEmail(membership, invoice.hosted_invoice_url)
        );

        // Also notify the contractor
        const contractorDoc = await db.collection('contractors').doc(contractorId).get();
        const contractor = contractorDoc.data();

        if (contractor?.email) {
          await sendEmail(
            contractor.email,
            `Membership Payment Failed - ${membership.customerName}`,
            `<p>The membership payment for ${membership.customerName} (${membership.planName}) has failed.</p>
             <p>Customer email: ${membership.customerEmail}</p>
             <p>Amount: $${(invoice.amount_due / 100).toFixed(2)}</p>`
          );
        }

        console.log('Membership payment failed:', membershipId);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const { contractorId, membershipId } = subscription.metadata;

        if (!contractorId || !membershipId) break;

        const membershipRef = db
          .collection('contractors')
          .doc(contractorId)
          .collection('memberships')
          .doc(membershipId);

        // Update auto-renew status based on cancel_at_period_end
        await membershipRef.update({
          autoRenew: !subscription.cancel_at_period_end
        });

        console.log('Membership subscription updated:', membershipId);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const { contractorId, membershipId } = subscription.metadata;

        if (!contractorId || !membershipId) break;

        const membershipRef = db
          .collection('contractors')
          .doc(contractorId)
          .collection('memberships')
          .doc(membershipId);

        const membershipSnap = await membershipRef.get();
        if (!membershipSnap.exists) break;

        const membership = membershipSnap.data();

        // Mark as cancelled or expired
        await membershipRef.update({
          status: 'cancelled',
          cancelledAt: Timestamp.now(),
          cancellationReason: 'Subscription cancelled'
        });

        // Update plan member count
        const planRef = db
          .collection('contractors')
          .doc(contractorId)
          .collection('membershipPlans')
          .doc(membership.planId);

        const planSnap = await planRef.get();
        if (planSnap.exists) {
          await planRef.update({
            memberCount: Math.max(0, (planSnap.data().memberCount || 1) - 1)
          });
        }

        // Send cancellation email
        await sendEmail(
          membership.customerEmail,
          `Your ${membership.planName} Membership Has Been Cancelled`,
          generateCancellationEmail(membership)
        );

        console.log('Membership subscription cancelled:', membershipId);
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

// Email templates
function generateWelcomeEmail(membership, endDate) {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; padding: 20px;">
      <h1 style="color: ${membership.planColor || '#10b981'};">Welcome to ${membership.planName}!</h1>
      <p>Hi ${membership.customerName?.split(' ')[0] || 'there'},</p>
      <p>Thank you for becoming a member! Your membership is now active and will renew on ${endDate.toLocaleDateString()}.</p>
      <h3>Your Benefits:</h3>
      <ul>
        ${membership.benefits?.discountPercent > 0 ? `<li>${membership.benefits.discountPercent}% off repairs</li>` : ''}
        ${membership.benefits?.priorityScheduling ? '<li>Priority scheduling</li>' : ''}
        ${membership.benefits?.waiveDiagnosticFee ? '<li>No diagnostic fee</li>' : ''}
      </ul>
      <p>We're excited to have you as a member!</p>
    </body>
    </html>
  `;
}

function generateRenewalConfirmationEmail(membership, endDate, amount) {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; padding: 20px;">
      <h1 style="color: #10b981;">Membership Renewed!</h1>
      <p>Hi ${membership.customerName?.split(' ')[0] || 'there'},</p>
      <p>Your ${membership.planName} membership has been successfully renewed.</p>
      <p><strong>Amount charged:</strong> $${amount.toFixed(2)}</p>
      <p><strong>Next renewal:</strong> ${endDate.toLocaleDateString()}</p>
      <p>Thank you for your continued membership!</p>
    </body>
    </html>
  `;
}

function generatePaymentFailedEmail(membership, invoiceUrl) {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; padding: 20px;">
      <h1 style="color: #ef4444;">Payment Failed</h1>
      <p>Hi ${membership.customerName?.split(' ')[0] || 'there'},</p>
      <p>We were unable to process the payment for your ${membership.planName} membership.</p>
      <p>Please update your payment information to keep your membership active.</p>
      ${invoiceUrl ? `<p><a href="${invoiceUrl}" style="color: #3b82f6;">Update Payment Method</a></p>` : ''}
      <p>If you have any questions, please contact us.</p>
    </body>
    </html>
  `;
}

function generateCancellationEmail(membership) {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; padding: 20px;">
      <h1 style="color: #64748b;">Membership Cancelled</h1>
      <p>Hi ${membership.customerName?.split(' ')[0] || 'there'},</p>
      <p>Your ${membership.planName} membership has been cancelled.</p>
      ${membership.totalSavings > 0 ?
        `<p>During your membership, you saved $${membership.totalSavings.toFixed(2)}!</p>` : ''}
      <p>We're sorry to see you go. If you'd like to rejoin, you can do so at any time.</p>
    </body>
    </html>
  `;
}
