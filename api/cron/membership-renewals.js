/**
 * Membership Renewals Cron Job
 *
 * Handles:
 * - Sending renewal reminders (30 days and 7 days before expiration)
 * - Processing auto-renewals
 * - Marking expired memberships
 * - Sending notification emails
 *
 * Schedule: Daily at 8 AM
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

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

// Email sending function (uses existing email service)
async function sendEmail(to, subject, html) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html })
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

// Generate renewal reminder email
function generateRenewalReminderEmail(membership, daysLeft, contractor) {
  const urgency = daysLeft <= 7 ? 'urgent' : 'friendly';
  const actionColor = daysLeft <= 7 ? '#ef4444' : '#10b981';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">

          <!-- Header -->
          <div style="background: ${membership.planColor || '#10b981'}; padding: 32px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px;">Your Membership is ${daysLeft <= 7 ? 'Expiring Soon!' : 'Up for Renewal'}</h1>
          </div>

          <!-- Content -->
          <div style="padding: 32px;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Hi ${membership.customerName?.split(' ')[0] || 'there'},
            </p>

            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              ${daysLeft <= 7
                ? `Your <strong>${membership.planName}</strong> membership expires in <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>. Don't lose your benefits!`
                : `Your <strong>${membership.planName}</strong> membership is coming up for renewal in ${daysLeft} days.`
              }
            </p>

            <!-- Plan Summary -->
            <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 16px;">Your Benefits Include:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #64748b;">
                ${membership.benefits?.discountPercent > 0 ? `<li>${membership.benefits.discountPercent}% discount on all repairs</li>` : ''}
                ${membership.benefits?.priorityScheduling ? '<li>Priority scheduling</li>' : ''}
                ${membership.benefits?.waiveDiagnosticFee ? '<li>No diagnostic fees</li>' : ''}
                ${membership.benefits?.emergencyResponse ? `<li>${membership.benefits.emergencyResponse} emergency response</li>` : ''}
              </ul>
            </div>

            ${membership.totalSavings > 0 ? `
              <div style="background: #ecfdf5; border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0; color: #065f46; font-size: 14px;">You've saved</p>
                <p style="margin: 8px 0 0 0; color: #047857; font-size: 28px; font-weight: bold;">$${membership.totalSavings.toFixed(2)}</p>
                <p style="margin: 4px 0 0 0; color: #065f46; font-size: 14px;">with your membership!</p>
              </div>
            ` : ''}

            <!-- CTA -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/membership/renew/${membership.id}"
                 style="display: inline-block; background: ${actionColor}; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Renew Now - $${membership.price}/${membership.billingCycle === 'monthly' ? 'mo' : 'yr'}
              </a>
            </div>

            ${membership.autoRenew ? `
              <p style="color: #64748b; font-size: 14px; text-align: center; margin: 0;">
                <em>Your membership is set to auto-renew. No action needed unless you want to make changes.</em>
              </p>
            ` : ''}

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">

            <p style="color: #64748b; font-size: 14px; margin: 0;">
              Questions? Contact ${contractor?.businessName || 'us'} at ${contractor?.email || ''} or ${contractor?.phone || ''}
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Generate auto-renewal confirmation email
function generateAutoRenewalEmail(membership, contractor) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">

          <div style="background: #10b981; padding: 32px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px;">Membership Renewed!</h1>
          </div>

          <div style="padding: 32px;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Hi ${membership.customerName?.split(' ')[0] || 'there'},
            </p>

            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Great news! Your <strong>${membership.planName}</strong> membership has been automatically renewed. You'll continue to enjoy all your member benefits without interruption.
            </p>

            <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; padding: 8px 0;">Plan</td>
                  <td style="color: #1e293b; padding: 8px 0; text-align: right; font-weight: 600;">${membership.planName}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 8px 0;">Amount</td>
                  <td style="color: #1e293b; padding: 8px 0; text-align: right; font-weight: 600;">$${membership.price}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 8px 0;">New Expiration</td>
                  <td style="color: #1e293b; padding: 8px 0; text-align: right; font-weight: 600;">${new Date(membership.endDate?.toDate ? membership.endDate.toDate() : membership.endDate).toLocaleDateString()}</td>
                </tr>
              </table>
            </div>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/membership/${membership.id}"
                 style="display: inline-block; background: #3b82f6; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                View Membership
              </a>
            </div>

            <p style="color: #64748b; font-size: 14px; text-align: center;">
              Thank you for being a valued member!
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Generate expiration notification email
function generateExpirationEmail(membership, contractor) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">

          <div style="background: #ef4444; padding: 32px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px;">Your Membership Has Expired</h1>
          </div>

          <div style="padding: 32px;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Hi ${membership.customerName?.split(' ')[0] || 'there'},
            </p>

            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Your <strong>${membership.planName}</strong> membership has expired. You no longer have access to your member benefits, including:
            </p>

            <ul style="color: #64748b; margin: 0 0 24px 0; padding-left: 20px;">
              ${membership.benefits?.discountPercent > 0 ? `<li>${membership.benefits.discountPercent}% discount on repairs</li>` : ''}
              ${membership.benefits?.priorityScheduling ? '<li>Priority scheduling</li>' : ''}
              ${membership.benefits?.waiveDiagnosticFee ? '<li>Waived diagnostic fees</li>' : ''}
            </ul>

            ${membership.totalSavings > 0 ? `
              <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                During your membership, you saved <strong>$${membership.totalSavings.toFixed(2)}</strong>. Renew now to keep saving!
              </p>
            ` : ''}

            <div style="text-align: center; margin: 32px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/membership/renew/${membership.id}"
                 style="display: inline-block; background: #10b981; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Renew Your Membership
              </a>
            </div>

            <p style="color: #64748b; font-size: 14px; text-align: center;">
              We'd love to have you back as a member!
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export default async function handler(req, res) {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results = {
    processed: 0,
    reminders30Day: 0,
    reminders7Day: 0,
    autoRenewed: 0,
    expired: 0,
    errors: []
  };

  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const oneDayFromNow = new Date(now);
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);

    // Get all contractors
    const contractorsSnap = await db.collection('contractors').get();

    for (const contractorDoc of contractorsSnap.docs) {
      const contractorId = contractorDoc.id;
      const contractor = contractorDoc.data();

      // Get active memberships for this contractor
      const membershipsSnap = await db
        .collection('contractors')
        .doc(contractorId)
        .collection('memberships')
        .where('status', '==', 'active')
        .get();

      for (const membershipDoc of membershipsSnap.docs) {
        const membership = { id: membershipDoc.id, ...membershipDoc.data() };
        const endDate = membership.endDate?.toDate ? membership.endDate.toDate() : new Date(membership.endDate);

        try {
          results.processed++;

          // Check if already expired
          if (endDate <= now) {
            // Process auto-renewal if enabled
            if (membership.autoRenew && membership.paymentMethod === 'stripe' && membership.stripeSubscriptionId) {
              // Stripe handles the actual payment, we just need to update the dates
              const newEndDate = new Date(endDate);
              if (membership.billingCycle === 'monthly') {
                newEndDate.setMonth(newEndDate.getMonth() + 1);
              } else {
                newEndDate.setFullYear(newEndDate.getFullYear() + 1);
              }

              await membershipDoc.ref.update({
                startDate: Timestamp.now(),
                endDate: Timestamp.fromDate(newEndDate),
                renewedAt: Timestamp.now(),
                servicesUsed: (membership.servicesUsed || []).map(s => ({
                  ...s,
                  usedCount: 0,
                  lastUsedDate: null,
                  jobIds: []
                }))
              });

              // Send confirmation email
              await sendEmail(
                membership.customerEmail,
                `Your ${membership.planName} Membership Has Been Renewed`,
                generateAutoRenewalEmail({ ...membership, endDate: newEndDate }, contractor)
              );

              results.autoRenewed++;
            } else {
              // Mark as expired
              await membershipDoc.ref.update({
                status: 'expired'
              });

              // Send expiration email
              await sendEmail(
                membership.customerEmail,
                `Your ${membership.planName} Membership Has Expired`,
                generateExpirationEmail(membership, contractor)
              );

              results.expired++;
            }
            continue;
          }

          // Send 30-day reminder (only if not already sent this month)
          if (endDate <= thirtyDaysFromNow && endDate > sevenDaysFromNow) {
            const lastReminder30 = membership.lastReminder30Day?.toDate ?
              membership.lastReminder30Day.toDate() : null;

            const shouldSend = !lastReminder30 ||
              (now - lastReminder30) > (25 * 24 * 60 * 60 * 1000); // 25 days since last

            if (shouldSend) {
              const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

              await sendEmail(
                membership.customerEmail,
                `Your ${membership.planName} Membership Renews in ${daysLeft} Days`,
                generateRenewalReminderEmail(membership, daysLeft, contractor)
              );

              await membershipDoc.ref.update({
                lastReminder30Day: Timestamp.now()
              });

              results.reminders30Day++;
            }
          }

          // Send 7-day urgent reminder
          if (endDate <= sevenDaysFromNow && endDate > oneDayFromNow) {
            const lastReminder7 = membership.lastReminder7Day?.toDate ?
              membership.lastReminder7Day.toDate() : null;

            const shouldSend = !lastReminder7 ||
              (now - lastReminder7) > (5 * 24 * 60 * 60 * 1000); // 5 days since last

            if (shouldSend) {
              const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

              await sendEmail(
                membership.customerEmail,
                `URGENT: Your ${membership.planName} Membership Expires in ${daysLeft} Days`,
                generateRenewalReminderEmail(membership, daysLeft, contractor)
              );

              await membershipDoc.ref.update({
                lastReminder7Day: Timestamp.now()
              });

              results.reminders7Day++;
            }
          }

        } catch (error) {
          console.error(`Error processing membership ${membership.id}:`, error);
          results.errors.push({
            membershipId: membership.id,
            error: error.message
          });
        }
      }
    }

    console.log('Membership renewal cron completed:', results);

    return res.status(200).json({
      success: true,
      message: 'Membership renewals processed',
      results
    });

  } catch (error) {
    console.error('Membership renewal cron failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      results
    });
  }
}
