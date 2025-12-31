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
// EXPORTS
// ============================================
module.exports = {
  generateWelcomeHtml,
  generateDigestHtml,
  generateOverdueHtml,
  generateWarrantyHtml,
  baseLayout,
  BRAND,
};
