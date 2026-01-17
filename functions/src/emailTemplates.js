// functions/src/emailTemplates.js
// ============================================
// BRANDED HTML EMAIL TEMPLATES FOR MYKRIB
// ============================================
// Use with Resend or any email service
// Templates are responsive and work in all major email clients

const BRAND = {
  primary: '#10b981',      // Emerald-600
  primaryDark: '#059669',  // Emerald-700
  secondary: '#6366f1',    // Indigo-500
  text: '#1e293b',         // Slate-800
  textLight: '#64748b',    // Slate-500
  background: '#f8fafc',   // Slate-50
  white: '#ffffff',
  warning: '#f59e0b',      // Amber-500
  danger: '#ef4444',       // Red-500
  success: '#22c55e',      // Green-500
};

// ============================================
// BASE LAYOUT WRAPPER
// ============================================
const baseLayout = (content, preheader = '') => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>MyKrib</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset */
    body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    
    /* Base Styles */
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: ${BRAND.background};
    }
    
    .wrapper { background-color: ${BRAND.background}; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background: ${BRAND.white}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%); padding: 32px; text-align: center; }
    .logo { font-size: 28px; font-weight: 800; color: white; text-decoration: none; }
    .content { padding: 40px 32px; }
    .footer { background: ${BRAND.background}; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0; }
    
    /* Buttons */
    .btn { 
      display: inline-block; 
      background: ${BRAND.primary}; 
      color: white !important; 
      padding: 14px 28px; 
      border-radius: 12px; 
      text-decoration: none; 
      font-weight: 700; 
      font-size: 16px;
    }
    .btn:hover { background: ${BRAND.primaryDark}; }
    .btn-secondary { background: ${BRAND.white}; color: ${BRAND.text} !important; border: 2px solid #e2e8f0; }
    .btn-danger { background: ${BRAND.danger}; }
    
    /* Typography */
    h1 { color: ${BRAND.text}; font-size: 24px; margin: 0 0 16px; line-height: 1.3; }
    h2 { color: ${BRAND.text}; font-size: 20px; margin: 0 0 12px; }
    p { color: ${BRAND.textLight}; font-size: 16px; line-height: 1.6; margin: 0 0 16px; }
    .highlight { color: ${BRAND.text}; font-weight: 600; }
    .small { font-size: 14px; }
    .muted { color: ${BRAND.textLight}; }
    
    /* Components */
    .card { background: ${BRAND.background}; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .divider { height: 1px; background: #e2e8f0; margin: 24px 0; }
    .preheader { display: none; max-height: 0; overflow: hidden; }
    
    /* Stats */
    .stat { text-align: center; padding: 16px; }
    .stat-value { font-size: 32px; font-weight: 800; color: ${BRAND.primary}; }
    .stat-label { font-size: 12px; color: ${BRAND.textLight}; text-transform: uppercase; letter-spacing: 0.5px; }
    
    /* Task Items */
    .task-item { padding: 12px 16px; background: white; border-radius: 8px; margin-bottom: 8px; border-left: 4px solid ${BRAND.primary}; }
    .task-overdue { border-left-color: ${BRAND.danger}; background: #fef2f2; }
    .task-warning { border-left-color: ${BRAND.warning}; background: #fffbeb; }
    
    /* Mobile */
    @media only screen and (max-width: 600px) {
      .wrapper { padding: 16px !important; }
      .content { padding: 24px 20px !important; }
      .btn { display: block !important; text-align: center !important; }
      .stat { padding: 12px 8px !important; }
      .stat-value { font-size: 24px !important; }
    }
  </style>
</head>
<body>
  <span class="preheader">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</span>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <a href="https://mykrib.app" class="logo">🏠 MyKrib</a>
      </div>
      ${content}
      <div class="footer">
        <p style="margin: 0; font-size: 14px; color: ${BRAND.textLight};">
          © ${new Date().getFullYear()} MyKrib. All rights reserved.
        </p>
        <p style="margin: 8px 0 0; font-size: 12px;">
          <a href="https://mykrib.app/settings" style="color: ${BRAND.textLight};">Manage Preferences</a>
          &nbsp;•&nbsp;
          <a href="https://mykrib.app/privacy" style="color: ${BRAND.textLight};">Privacy</a>
        </p>
      </div>
    </div>
    <!-- Ad space placeholder for future use -->
    <!--
    <div style="max-width: 600px; margin: 20px auto; text-align: center;">
      <p style="font-size: 10px; color: #94a3b8; margin-bottom: 8px;">SPONSORED</p>
      [AD CONTENT HERE]
    </div>
    -->
  </div>
</body>
</html>
`;

// ============================================
// WELCOME EMAIL
// ============================================
function generateWelcomeHtml(data) {
  const { userName, propertyAddress } = data;
  
  const content = `
    <div class="content">
      <h1>Welcome to MyKrib, ${userName}! 🎉</h1>
      <p>
        You've taken the first step toward smarter home ownership. MyKrib helps you 
        track everything about your home—from appliances and warranties to maintenance schedules.
      </p>
      
      ${propertyAddress ? `
      <div class="card">
        <p style="margin: 0; font-size: 12px; color: ${BRAND.textLight}; text-transform: uppercase; letter-spacing: 0.5px;">YOUR PROPERTY</p>
        <p style="margin: 8px 0 0; font-size: 18px; font-weight: 600; color: ${BRAND.text};">
          ${propertyAddress}
        </p>
      </div>
      ` : ''}
      
      <p style="font-weight: 600; color: ${BRAND.text}; margin-top: 24px;">Here's how to get started:</p>
      
      <div class="card">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="44" valign="top" style="padding-right: 12px; padding-bottom: 16px;">
              <div style="width: 32px; height: 32px; background: ${BRAND.primary}; border-radius: 50%; text-align: center; line-height: 32px; color: white; font-weight: bold; font-size: 14px;">1</div>
            </td>
            <td style="padding-bottom: 16px;">
              <p style="margin: 0; font-weight: 600; color: ${BRAND.text};">Scan your first receipt</p>
              <p style="margin: 4px 0 0; font-size: 14px; color: ${BRAND.textLight};">Our AI automatically extracts item details, warranties, and contractor info.</p>
            </td>
          </tr>
          <tr>
            <td width="44" valign="top" style="padding-right: 12px; padding-bottom: 16px;">
              <div style="width: 32px; height: 32px; background: ${BRAND.primary}; border-radius: 50%; text-align: center; line-height: 32px; color: white; font-weight: bold; font-size: 14px;">2</div>
            </td>
            <td style="padding-bottom: 16px;">
              <p style="margin: 0; font-weight: 600; color: ${BRAND.text};">Set up maintenance reminders</p>
              <p style="margin: 4px 0 0; font-size: 14px; color: ${BRAND.textLight};">Never miss an HVAC filter change or roof inspection again.</p>
            </td>
          </tr>
          <tr>
            <td width="44" valign="top" style="padding-right: 12px;">
              <div style="width: 32px; height: 32px; background: ${BRAND.primary}; border-radius: 50%; text-align: center; line-height: 32px; color: white; font-weight: bold; font-size: 14px;">3</div>
            </td>
            <td>
              <p style="margin: 0; font-weight: 600; color: ${BRAND.text};">Generate your Home Report</p>
              <p style="margin: 4px 0 0; font-size: 14px; color: ${BRAND.textLight};">A professional summary perfect for insurance, selling, or your records.</p>
            </td>
          </tr>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 32px;">
        <a href="https://mykrib.app" class="btn">Get Started →</a>
      </div>
      
      <div class="divider"></div>
      
      <p style="font-size: 14px; text-align: center; margin: 0;">
        Questions? Reply to this email or reach us at 
        <a href="mailto:support@mykrib.app" style="color: ${BRAND.primary};">support@mykrib.app</a>
      </p>
    </div>
  `;
  
  return baseLayout(content, 'Your home management journey starts now');
}

// ============================================
// MAINTENANCE DIGEST EMAIL
// ============================================
function generateDigestHtml(data) {
  const { 
    userName, 
    propertyAddress,
    overdueCount = 0,
    upcomingCount = 0,
    overdueTasks = [],
    upcomingTasks = [],
    completedThisMonth = 0,
    frequency = 'monthly'
  } = data;
  
  const hasOverdue = overdueCount > 0;
  const periodLabel = frequency === 'weekly' ? 'This Week' : 'This Month';
  
  const renderTask = (task, isOverdue = false) => `
    <div class="task-item ${isOverdue ? 'task-overdue' : ''}" style="border-left: 4px solid ${isOverdue ? BRAND.danger : BRAND.primary}; background: ${isOverdue ? '#fef2f2' : BRAND.background}; padding: 12px 16px; border-radius: 8px; margin-bottom: 8px;">
      <p style="margin: 0; font-weight: 600; color: ${BRAND.text}; font-size: 14px;">
        ${task.taskName || 'Maintenance Task'}
      </p>
      <p style="margin: 4px 0 0; font-size: 12px; color: ${BRAND.textLight};">
        ${task.item || ''} • ${isOverdue ? `${Math.abs(task.daysUntil)} days overdue` : `Due ${task.formattedDate || 'soon'}`}
      </p>
    </div>
  `;
  
  const content = `
    <div class="content">
      <h1>${hasOverdue ? '⚠️' : '📋'} Your ${frequency === 'weekly' ? 'Weekly' : 'Monthly'} Home Update</h1>
      <p>
        Here's what's happening at <span class="highlight">${propertyAddress || 'your home'}</span>
      </p>
      
      <!-- Stats Row -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background: ${BRAND.background}; border-radius: 12px; margin: 24px 0;">
        <tr>
          <td class="stat" style="text-align: center; padding: 16px; border-right: 1px solid #e2e8f0; width: 33%;">
            <div class="stat-value" style="font-size: 32px; font-weight: 800; color: ${overdueCount > 0 ? BRAND.danger : BRAND.primary};">
              ${overdueCount}
            </div>
            <div class="stat-label" style="font-size: 12px; color: ${BRAND.textLight}; text-transform: uppercase;">Overdue</div>
          </td>
          <td class="stat" style="text-align: center; padding: 16px; border-right: 1px solid #e2e8f0; width: 33%;">
            <div class="stat-value" style="font-size: 32px; font-weight: 800; color: ${BRAND.warning};">${upcomingCount}</div>
            <div class="stat-label" style="font-size: 12px; color: ${BRAND.textLight}; text-transform: uppercase;">Coming Up</div>
          </td>
          <td class="stat" style="text-align: center; padding: 16px; width: 34%;">
            <div class="stat-value" style="font-size: 32px; font-weight: 800; color: ${BRAND.success};">${completedThisMonth}</div>
            <div class="stat-label" style="font-size: 12px; color: ${BRAND.textLight}; text-transform: uppercase;">Completed</div>
          </td>
        </tr>
      </table>
      
      ${hasOverdue ? `
      <!-- Overdue Section -->
      <div style="margin: 24px 0;">
        <p style="font-size: 12px; font-weight: 700; color: ${BRAND.danger}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
          🚨 NEEDS ATTENTION
        </p>
        ${overdueTasks.slice(0, 5).map(t => renderTask(t, true)).join('')}
      </div>
      ` : ''}
      
      ${upcomingTasks.length > 0 ? `
      <!-- Upcoming Section -->
      <div style="margin: 24px 0;">
        <p style="font-size: 12px; font-weight: 700; color: ${BRAND.textLight}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
          📅 COMING UP ${periodLabel.toUpperCase()}
        </p>
        ${upcomingTasks.slice(0, 5).map(t => renderTask(t, false)).join('')}
      </div>
      ` : ''}
      
      <div style="text-align: center; margin-top: 32px;">
        <a href="https://mykrib.app/maintenance" class="btn" style="background: ${hasOverdue ? BRAND.danger : BRAND.primary};">
          ${hasOverdue ? 'Take Action Now' : 'View All Tasks'} →
        </a>
      </div>
      
      ${!hasOverdue && overdueCount === 0 ? `
      <div class="card" style="text-align: center; background: #ecfdf5; border: 1px solid #a7f3d0; margin-top: 24px;">
        <p style="margin: 0; color: ${BRAND.primary}; font-weight: 600;">
          ✓ Great job! You're staying on top of your home maintenance.
        </p>
      </div>
      ` : ''}
    </div>
  `;
  
  return baseLayout(content, `${overdueCount} overdue, ${upcomingCount} upcoming tasks`);
}

// ============================================
// OVERDUE ALERT EMAIL
// ============================================
function generateOverdueHtml(data) {
  const { userName, task, propertyAddress, daysOverdue } = data;
  
  const content = `
    <div class="content">
      <h1>🚨 Maintenance Overdue</h1>
      <p>
        Hi ${userName || 'there'}, you have a maintenance task that's now 
        <span style="color: ${BRAND.danger}; font-weight: 700;">${daysOverdue} days overdue</span>.
      </p>
      
      <div class="card" style="border-left: 4px solid ${BRAND.danger}; background: #fef2f2;">
        <p style="font-size: 12px; color: ${BRAND.textLight}; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;">
          ${task.category || 'MAINTENANCE'}
        </p>
        <p style="font-size: 20px; font-weight: 700; color: ${BRAND.text}; margin: 0;">
          ${task.taskName || 'Task'}
        </p>
        <p style="font-size: 14px; color: ${BRAND.textLight}; margin: 8px 0 0;">
          ${task.item || ''} ${task.frequency ? `• ${task.frequency}` : ''}
        </p>
        ${task.contractor ? `
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #fecaca;">
          <p style="font-size: 12px; color: ${BRAND.textLight}; margin: 0 0 4px; text-transform: uppercase;">CONTRACTOR</p>
          <p style="font-size: 14px; color: ${BRAND.text}; margin: 0; font-weight: 600;">
            ${task.contractor}
          </p>
          ${task.contractorPhone ? `
          <p style="margin: 4px 0 0;">
            <a href="tel:${task.contractorPhone}" style="color: ${BRAND.primary}; font-size: 14px;">
              📞 ${task.contractorPhone}
            </a>
          </p>
          ` : ''}
        </div>
        ` : ''}
      </div>
      
      <div style="text-align: center; margin-top: 24px;">
        <a href="https://mykrib.app/maintenance" class="btn btn-danger" style="background: ${BRAND.danger};">Mark as Done →</a>
      </div>
      <div style="text-align: center; margin-top: 12px;">
        <a href="https://mykrib.app/maintenance?snooze=${task.id || ''}" style="color: ${BRAND.textLight}; font-size: 14px;">
          Snooze for 1 week
        </a>
      </div>
    </div>
  `;
  
  return baseLayout(content, `Action needed: ${task.taskName} for ${task.item}`);
}

// ============================================
// WARRANTY EXPIRING EMAIL
// ============================================
function generateWarrantyHtml(data) {
  const { userName, item, warrantyEndDate, daysRemaining, propertyAddress } = data;
  
  const urgencyColor = daysRemaining <= 30 ? BRAND.danger : BRAND.warning;
  
  const content = `
    <div class="content">
      <h1>⏰ Warranty Expiring Soon</h1>
      <p>
        Hi ${userName || 'there'}, a warranty at <span class="highlight">${propertyAddress || 'your property'}</span> is expiring soon.
      </p>
      
      <div class="card" style="border-left: 4px solid ${urgencyColor};">
        <p style="font-size: 20px; font-weight: 700; color: ${BRAND.text}; margin: 0;">
          ${item.name || item.item || 'Item'}
        </p>
        <p style="font-size: 14px; color: ${BRAND.textLight}; margin: 8px 0;">
          ${item.brand || ''} ${item.model || ''}
        </p>
        <div style="display: inline-block; background: ${urgencyColor}; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 700; margin-top: 8px;">
          ${daysRemaining} days remaining
        </div>
        <p style="font-size: 12px; color: ${BRAND.textLight}; margin: 16px 0 0;">
          Expires: ${warrantyEndDate}
        </p>
      </div>
      
      <p style="margin-top: 24px; font-weight: 600; color: ${BRAND.text};">
        What you should do:
      </p>
      <ul style="color: ${BRAND.textLight}; padding-left: 20px; margin: 8px 0;">
        <li style="margin-bottom: 8px;">Schedule any needed repairs before coverage ends</li>
        <li style="margin-bottom: 8px;">Check if an extended warranty is available</li>
        <li>Save your warranty documents for reference</li>
      </ul>
      
      <div style="text-align: center; margin-top: 24px;">
        <a href="https://mykrib.app/warranties" class="btn">View Warranty Details →</a>
      </div>
    </div>
  `;
  
  return baseLayout(content, `Warranty expiring: ${item.name || item.item}`);
}

// ============================================
// FINANCING APPROVED EMAIL (Customer)
// ============================================
function generateFinancingApprovedHtml(data) {
  const {
    customerName,
    contractorName,
    quoteTitle,
    approvedAmount,
    monthlyPayment,
    termMonths,
    apr,
    applicationUrl,
    quoteUrl
  } = data;

  const content = `
    <div class="content">
      <h1>🎉 Your Financing is Approved!</h1>
      <p>
        Great news, ${customerName || 'there'}! Your financing application with
        <span class="highlight">${contractorName}</span> has been approved.
      </p>

      <div class="card" style="border-left: 4px solid ${BRAND.success}; background: #f0fdf4;">
        <p style="font-size: 12px; color: ${BRAND.textLight}; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;">
          APPROVED FINANCING
        </p>
        <p style="font-size: 36px; font-weight: 800; color: ${BRAND.success}; margin: 0;">
          $${(approvedAmount || 0).toLocaleString()}
        </p>
        <p style="font-size: 14px; color: ${BRAND.textLight}; margin: 8px 0 0;">
          ${quoteTitle || 'Service Quote'}
        </p>

        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #bbf7d0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 8px 0;">
                <span style="color: ${BRAND.textLight}; font-size: 14px;">Monthly Payment</span>
              </td>
              <td style="text-align: right; padding: 8px 0;">
                <span style="color: ${BRAND.text}; font-weight: 700; font-size: 18px;">$${(monthlyPayment || 0).toLocaleString()}/mo</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <span style="color: ${BRAND.textLight}; font-size: 14px;">Term</span>
              </td>
              <td style="text-align: right; padding: 8px 0;">
                <span style="color: ${BRAND.text}; font-weight: 600;">${termMonths || 12} months</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <span style="color: ${BRAND.textLight}; font-size: 14px;">APR</span>
              </td>
              <td style="text-align: right; padding: 8px 0;">
                <span style="color: ${BRAND.text}; font-weight: 600;">${apr || '0'}%</span>
              </td>
            </tr>
          </table>
        </div>
      </div>

      <p style="font-weight: 600; color: ${BRAND.text}; margin-top: 24px;">
        Next Steps:
      </p>
      <ol style="color: ${BRAND.textLight}; padding-left: 20px; margin: 8px 0;">
        <li style="margin-bottom: 12px;">Complete your loan agreement to finalize financing</li>
        <li style="margin-bottom: 12px;">Once complete, ${contractorName} will be paid directly</li>
        <li>Your work will be scheduled and completed</li>
      </ol>

      <div style="text-align: center; margin-top: 32px;">
        ${applicationUrl ? `
        <a href="${applicationUrl}" class="btn" style="background: ${BRAND.success};">
          Complete Your Loan Agreement →
        </a>
        ` : `
        <a href="${quoteUrl || 'https://mykrib.app'}" class="btn" style="background: ${BRAND.success};">
          View Quote Details →
        </a>
        `}
      </div>

      <div class="divider"></div>

      <p style="font-size: 14px; text-align: center; color: ${BRAND.textLight};">
        Questions about your financing? Contact Wisetack at
        <a href="mailto:support@wisetack.com" style="color: ${BRAND.primary};">support@wisetack.com</a>
      </p>
    </div>
  `;

  return baseLayout(content, `Your $${(approvedAmount || 0).toLocaleString()} financing is approved!`);
}

// ============================================
// FINANCING DENIED EMAIL (Customer)
// ============================================
function generateFinancingDeniedHtml(data) {
  const {
    customerName,
    contractorName,
    quoteTitle,
    quoteTotal,
    quoteUrl,
    contractorPhone
  } = data;

  const content = `
    <div class="content">
      <h1>Financing Update</h1>
      <p>
        Hi ${customerName || 'there'}, we wanted to let you know that your financing application
        for the quote from <span class="highlight">${contractorName}</span> was not approved at this time.
      </p>

      <div class="card">
        <p style="font-size: 14px; color: ${BRAND.textLight}; margin: 0 0 8px;">
          ${quoteTitle || 'Service Quote'}
        </p>
        <p style="font-size: 24px; font-weight: 700; color: ${BRAND.text}; margin: 0;">
          $${(quoteTotal || 0).toLocaleString()}
        </p>
      </div>

      <p style="font-weight: 600; color: ${BRAND.text}; margin-top: 24px;">
        What You Can Do:
      </p>
      <ul style="color: ${BRAND.textLight}; padding-left: 20px; margin: 8px 0;">
        <li style="margin-bottom: 12px;">
          <strong>Pay in full</strong> - You can still accept the quote and pay directly
        </li>
        <li style="margin-bottom: 12px;">
          <strong>Discuss payment plans</strong> - Contact ${contractorName} about alternative payment arrangements
        </li>
        <li style="margin-bottom: 12px;">
          <strong>Try again later</strong> - Credit factors change over time, you may qualify in the future
        </li>
      </ul>

      ${contractorPhone ? `
      <div class="card" style="text-align: center;">
        <p style="margin: 0 0 8px; color: ${BRAND.textLight}; font-size: 14px;">
          Contact ${contractorName}:
        </p>
        <a href="tel:${contractorPhone}" style="color: ${BRAND.primary}; font-size: 18px; font-weight: 600; text-decoration: none;">
          📞 ${contractorPhone}
        </a>
      </div>
      ` : ''}

      <div style="text-align: center; margin-top: 24px;">
        <a href="${quoteUrl || 'https://mykrib.app'}" class="btn btn-secondary" style="background: white; color: ${BRAND.text}; border: 2px solid #e2e8f0;">
          View Quote Options →
        </a>
      </div>

      <div class="divider"></div>

      <p style="font-size: 12px; color: ${BRAND.textLight}; text-align: center;">
        This decision was made by Wisetack based on credit evaluation. MyKrib does not make financing decisions.
      </p>
    </div>
  `;

  return baseLayout(content, 'Update on your financing application');
}

// ============================================
// FINANCING FUNDED EMAIL (Contractor)
// ============================================
function generateFinancingFundedContractorHtml(data) {
  const {
    contractorName,
    customerName,
    customerEmail,
    customerPhone,
    customerAddress,
    quoteTitle,
    fundedAmount,
    quoteId,
    dashboardUrl
  } = data;

  const content = `
    <div class="content">
      <h1>💰 Financing Funded - Ready to Schedule!</h1>
      <p>
        Great news! The financing for <span class="highlight">${customerName}</span>'s quote has been
        <span style="color: ${BRAND.success}; font-weight: 700;">funded</span>.
        You'll receive payment directly from Wisetack.
      </p>

      <div class="card" style="border-left: 4px solid ${BRAND.success}; background: #f0fdf4;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 8px 0;">
              <span style="color: ${BRAND.textLight}; font-size: 12px; text-transform: uppercase;">Customer</span>
              <p style="margin: 4px 0 0; font-weight: 600; color: ${BRAND.text}; font-size: 16px;">${customerName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">
              <span style="color: ${BRAND.textLight}; font-size: 12px; text-transform: uppercase;">Quote</span>
              <p style="margin: 4px 0 0; color: ${BRAND.text}; font-size: 14px;">${quoteTitle || 'Service Quote'}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 0 8px;">
              <span style="color: ${BRAND.textLight}; font-size: 12px; text-transform: uppercase;">Funded Amount</span>
              <p style="margin: 4px 0 0; font-weight: 800; color: ${BRAND.success}; font-size: 28px;">
                $${(fundedAmount || 0).toLocaleString()}
              </p>
            </td>
          </tr>
        </table>
      </div>

      <p style="font-weight: 600; color: ${BRAND.text}; margin-top: 24px;">
        Customer Contact Info:
      </p>
      <div class="card">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${customerPhone ? `
          <tr>
            <td style="padding: 8px 0;">
              <span style="color: ${BRAND.textLight}; font-size: 14px;">📞 Phone:</span>
              <a href="tel:${customerPhone}" style="color: ${BRAND.primary}; font-weight: 600; margin-left: 8px; text-decoration: none;">
                ${customerPhone}
              </a>
            </td>
          </tr>
          ` : ''}
          ${customerEmail ? `
          <tr>
            <td style="padding: 8px 0;">
              <span style="color: ${BRAND.textLight}; font-size: 14px;">✉️ Email:</span>
              <a href="mailto:${customerEmail}" style="color: ${BRAND.primary}; font-weight: 600; margin-left: 8px; text-decoration: none;">
                ${customerEmail}
              </a>
            </td>
          </tr>
          ` : ''}
          ${customerAddress ? `
          <tr>
            <td style="padding: 8px 0;">
              <span style="color: ${BRAND.textLight}; font-size: 14px;">📍 Address:</span>
              <span style="color: ${BRAND.text}; margin-left: 8px;">
                ${customerAddress}
              </span>
            </td>
          </tr>
          ` : ''}
        </table>
      </div>

      <p style="font-weight: 600; color: ${BRAND.text}; margin-top: 24px;">
        Next Steps:
      </p>
      <ol style="color: ${BRAND.textLight}; padding-left: 20px; margin: 8px 0;">
        <li style="margin-bottom: 12px;">Contact the customer to schedule the work</li>
        <li style="margin-bottom: 12px;">A job has been automatically created in your dashboard</li>
        <li>Complete the work and mark the job as done</li>
      </ol>

      <div style="text-align: center; margin-top: 32px;">
        <a href="${dashboardUrl || 'https://mykrib.app/contractor'}" class="btn">
          View in Dashboard →
        </a>
      </div>
    </div>
  `;

  return baseLayout(content, `Financing funded: $${(fundedAmount || 0).toLocaleString()} from ${customerName}`);
}

// ============================================
// FINANCING APPLICATION STARTED EMAIL (Contractor)
// ============================================
function generateFinancingStartedContractorHtml(data) {
  const {
    contractorName,
    customerName,
    quoteTitle,
    quoteTotal,
    quoteId,
    dashboardUrl
  } = data;

  const content = `
    <div class="content">
      <h1>📋 Customer Started Financing Application</h1>
      <p>
        <span class="highlight">${customerName}</span> has started a financing application
        for their quote. They're one step closer to accepting!
      </p>

      <div class="card">
        <p style="font-size: 14px; color: ${BRAND.textLight}; margin: 0 0 8px;">
          ${quoteTitle || 'Service Quote'}
        </p>
        <p style="font-size: 28px; font-weight: 700; color: ${BRAND.text}; margin: 0;">
          $${(quoteTotal || 0).toLocaleString()}
        </p>
        <p style="font-size: 14px; color: ${BRAND.primary}; margin: 12px 0 0; font-weight: 600;">
          ⏳ Financing Application Pending
        </p>
      </div>

      <p style="color: ${BRAND.textLight};">
        You'll receive another notification when the application is approved or if any action is needed.
        Most applications are decided within minutes.
      </p>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${dashboardUrl || 'https://mykrib.app/contractor'}" class="btn btn-secondary" style="background: white; color: ${BRAND.text}; border: 2px solid #e2e8f0;">
          View Quote →
        </a>
      </div>
    </div>
  `;

  return baseLayout(content, `${customerName} started financing for ${quoteTitle || 'quote'}`);
}

// ============================================
// MEMBERSHIP EMAIL TEMPLATES
// ============================================

/**
 * Membership Welcome Email
 */
function generateMembershipWelcomeHtml({ customerName, planName, planColor, benefits, endDate, contractorName, managementUrl }) {
  const content = `
    <div style="text-align: center; padding: 32px 0;">
      <div style="width: 80px; height: 80px; background: ${planColor || BRAND.primary}; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 40px;">&#128081;</span>
      </div>
      <h1 style="color: ${BRAND.text}; font-size: 28px; margin: 0 0 8px 0;">Welcome to ${planName}!</h1>
      <p style="color: ${BRAND.textLight}; font-size: 16px; margin: 0;">Thank you for becoming a member, ${customerName.split(' ')[0] || 'there'}!</p>
    </div>

    <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0;">
      <h2 style="color: ${BRAND.text}; font-size: 18px; margin: 0 0 16px 0;">Your Member Benefits:</h2>
      <ul style="color: ${BRAND.textLight}; margin: 0; padding-left: 20px; line-height: 1.8;">
        ${benefits?.discountPercent > 0 ? `<li><strong>${benefits.discountPercent}% discount</strong> on all repairs</li>` : ''}
        ${benefits?.priorityScheduling ? '<li><strong>Priority scheduling</strong> for appointments</li>' : ''}
        ${benefits?.waiveDiagnosticFee ? '<li><strong>No diagnostic fee</strong></li>' : ''}
        ${benefits?.emergencyResponse ? `<li><strong>${benefits.emergencyResponse} emergency response</strong></li>` : ''}
        ${benefits?.transferable ? '<li><strong>Transferable</strong> to new homeowner</li>' : ''}
      </ul>
    </div>

    <div style="background: ${planColor || BRAND.primary}15; border: 2px solid ${planColor || BRAND.primary}; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
      <p style="color: ${BRAND.textLight}; margin: 0 0 4px 0; font-size: 14px;">Membership Valid Until</p>
      <p style="color: ${BRAND.text}; margin: 0; font-size: 24px; font-weight: bold;">${endDate}</p>
    </div>

    ${managementUrl ? `
    <div style="text-align: center; margin: 32px 0;">
      <a href="${managementUrl}" style="display: inline-block; background: ${planColor || BRAND.primary}; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">View Your Membership</a>
    </div>
    ` : ''}

    <p style="color: ${BRAND.textLight}; text-align: center; margin-top: 24px;">
      Welcome to the ${contractorName || ''} family! We're excited to serve you.
    </p>
  `;

  return baseLayout(content, `Welcome to ${planName} - Your membership is now active!`);
}

/**
 * Membership Renewal Reminder Email
 */
function generateMembershipRenewalReminderHtml({ customerName, planName, planColor, daysLeft, endDate, totalSavings, renewUrl, contractorName }) {
  const isUrgent = daysLeft <= 7;

  const content = `
    <div style="text-align: center; padding: 32px 0;">
      <div style="width: 80px; height: 80px; background: ${isUrgent ? BRAND.warning : planColor || BRAND.primary}; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 40px;">${isUrgent ? '&#9888;' : '&#128276;'}</span>
      </div>
      <h1 style="color: ${BRAND.text}; font-size: 28px; margin: 0 0 8px 0;">
        ${isUrgent ? 'Your Membership Expires Soon!' : 'Time to Renew Your Membership'}
      </h1>
      <p style="color: ${BRAND.textLight}; font-size: 16px; margin: 0;">
        Your ${planName} membership expires in <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>
      </p>
    </div>

    ${totalSavings > 0 ? `
    <div style="background: #ecfdf5; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
      <p style="color: #065f46; margin: 0 0 8px 0; font-size: 14px;">As a member, you've saved</p>
      <p style="color: #047857; margin: 0; font-size: 36px; font-weight: bold;">$${totalSavings.toFixed(2)}</p>
    </div>
    ` : ''}

    <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <p style="color: ${BRAND.textLight}; margin: 0; font-size: 14px;">
        Don't lose your member benefits like priority scheduling, repair discounts, and waived fees!
      </p>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${renewUrl}" style="display: inline-block; background: ${isUrgent ? BRAND.warning : BRAND.primary}; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Renew My Membership</a>
    </div>

    <p style="color: ${BRAND.textLight}; text-align: center; font-size: 14px;">
      Membership expires: ${endDate}
    </p>
  `;

  return baseLayout(content, `Your ${planName} membership expires in ${daysLeft} days`);
}

/**
 * Membership Expired Email
 */
function generateMembershipExpiredHtml({ customerName, planName, planColor, totalSavings, renewUrl, contractorName }) {
  const content = `
    <div style="text-align: center; padding: 32px 0;">
      <div style="width: 80px; height: 80px; background: ${BRAND.danger}; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 40px;">&#128532;</span>
      </div>
      <h1 style="color: ${BRAND.text}; font-size: 28px; margin: 0 0 8px 0;">Your Membership Has Expired</h1>
      <p style="color: ${BRAND.textLight}; font-size: 16px; margin: 0;">We're sorry to see your ${planName} membership end</p>
    </div>

    ${totalSavings > 0 ? `
    <div style="background: #f8fafc; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
      <p style="color: ${BRAND.textLight}; margin: 0 0 8px 0; font-size: 14px;">During your membership, you saved</p>
      <p style="color: #059669; margin: 0; font-size: 32px; font-weight: bold;">$${totalSavings.toFixed(2)}</p>
    </div>
    ` : ''}

    <div style="background: #fef2f2; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <p style="color: #991b1b; margin: 0; font-size: 14px;">
        <strong>You no longer have access to:</strong><br>
        &bull; Member discounts on repairs<br>
        &bull; Priority scheduling<br>
        &bull; Waived diagnostic fees<br>
        &bull; Emergency response priority
      </p>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${renewUrl}" style="display: inline-block; background: ${BRAND.primary}; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Renew My Membership</a>
    </div>

    <p style="color: ${BRAND.textLight}; text-align: center; font-size: 14px;">
      We'd love to have you back as a member!
    </p>
  `;

  return baseLayout(content, `Your ${planName} membership has expired`);
}

/**
 * Membership Renewal Confirmation Email
 */
function generateMembershipRenewedHtml({ customerName, planName, planColor, price, endDate, managementUrl }) {
  const content = `
    <div style="text-align: center; padding: 32px 0;">
      <div style="width: 80px; height: 80px; background: ${BRAND.success}; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 40px;">&#127881;</span>
      </div>
      <h1 style="color: ${BRAND.text}; font-size: 28px; margin: 0 0 8px 0;">Membership Renewed!</h1>
      <p style="color: ${BRAND.textLight}; font-size: 16px; margin: 0;">Your ${planName} membership has been renewed</p>
    </div>

    <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: ${BRAND.textLight}; padding: 8px 0;">Plan</td>
          <td style="color: ${BRAND.text}; padding: 8px 0; text-align: right; font-weight: 600;">${planName}</td>
        </tr>
        <tr>
          <td style="color: ${BRAND.textLight}; padding: 8px 0;">Amount Paid</td>
          <td style="color: ${BRAND.text}; padding: 8px 0; text-align: right; font-weight: 600;">$${price}</td>
        </tr>
        <tr>
          <td style="color: ${BRAND.textLight}; padding: 8px 0;">Next Renewal</td>
          <td style="color: ${BRAND.text}; padding: 8px 0; text-align: right; font-weight: 600;">${endDate}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${managementUrl}" style="display: inline-block; background: ${planColor || BRAND.primary}; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">View My Membership</a>
    </div>

    <p style="color: ${BRAND.textLight}; text-align: center;">
      Thank you for your continued membership!
    </p>
  `;

  return baseLayout(content, `Your ${planName} membership has been renewed!`);
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
  generateWelcomeHtml,
  generateDigestHtml,
  generateOverdueHtml,
  generateWarrantyHtml,
  generateFinancingApprovedHtml,
  generateFinancingDeniedHtml,
  generateFinancingFundedContractorHtml,
  generateFinancingStartedContractorHtml,
  // Membership emails
  generateMembershipWelcomeHtml,
  generateMembershipRenewalReminderHtml,
  generateMembershipExpiredHtml,
  generateMembershipRenewedHtml,
  baseLayout,
  BRAND,
};
