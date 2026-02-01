
/**
 * Multi-Provider Email Utility for StagingPro (Server-Relay version)
 */

export const EMAIL_FROM = 'StagingPro Studio <info@thisismerci.com>';

const getEnv = (name: string) => {
  // @ts-ignore
  return (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) || process.env[name];
};

export const RESEND_API_KEY = getEnv('VITE_RESEND_API_KEY');

export async function sendStudioEmail(to: string, subject: string, html: string) {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject: subject,
        html: html,
      }),
    });
    return await response.json();
  } catch (err: any) {
    console.error("[Email Critical Error]", err);
    throw err;
  }
}

// 堅牢なメール表示のためのスタイル定義
const STYLE = {
  container: `background-color: #F8FAFC; padding: 40px 10px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0F172A;`,
  card: `max-width: 540px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 32px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.03);`,
  header: `padding: 50px 40px 30px 40px; text-align: center;`,
  title: `margin: 0; font-size: 10px; font-weight: 800; letter-spacing: 5px; color: #94A3B8; text-transform: uppercase; margin-bottom: 12px;`,
  heading: `margin: 0; font-size: 32px; font-weight: 800; color: #0F172A; letter-spacing: -1.5px; line-height: 1.2;`,
  body: `padding: 0 35px 50px 35px;`,
  thumbnailContainer: `width: 100%; border-radius: 20px; overflow: hidden; margin-bottom: 35px; border: 1px solid #F1F5F9;`,
  thumbnail: `width: 100%; height: auto; display: block;`,
  infoTable: `width: 100%; background: #F8FAFC; border-radius: 20px; padding: 25px; border-collapse: separate;`,
  label: `font-size: 9px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; padding: 12px 0; border-bottom: 1px solid #EDF2F7; line-height: 1;`,
  value: `font-size: 13px; font-weight: 700; color: #0F172A; text-align: right; padding: 12px 0; border-bottom: 1px solid #EDF2F7; line-height: 1.4;`,
  lastLabel: `font-size: 9px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; padding: 12px 0 0 0; line-height: 1;`,
  lastValue: `font-size: 13px; font-weight: 700; color: #0F172A; text-align: right; padding: 12px 0 0 0; line-height: 1.4;`,
  button: `display: block; width: 100%; background-color: #0F172A; color: #FFFFFF; padding: 22px 0; border-radius: 18px; text-align: center; font-size: 12px; font-weight: 800; text-decoration: none; text-transform: uppercase; letter-spacing: 3px; margin-top: 35px;`,
  footerText: `text-align: center; font-size: 11px; color: #94A3B8; margin-top: 35px; font-weight: 500; line-height: 1.6;`
};

export const EMAIL_TEMPLATES = {
  ORDER_CONFIRMED: (data: { 
    orderId: string, 
    planName: string, 
    price: string, 
    date: string, 
    delivery: string, 
    thumbnail: string 
  }) => `
    <div style="${STYLE.container}">
      <div style="${STYLE.card}">
        <div style="${STYLE.header}">
          <p style="${STYLE.title}">StagingPro Studio</p>
          <h2 style="${STYLE.heading}">ORDER<br/>CONFIRMED</h2>
        </div>
        <div style="${STYLE.body}">
          <div style="${STYLE.thumbnailContainer}">
            <img src="${data.thumbnail}" style="${STYLE.thumbnail}" alt="Project View" />
          </div>
          <table style="${STYLE.infoTable}" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="${STYLE.label}" width="40%">Project ID</td>
              <td style="${STYLE.value}">${data.orderId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="${STYLE.label}" width="40%">Service</td>
              <td style="${STYLE.value}">${data.planName || 'Staging Service'}</td>
            </tr>
            <tr>
              <td style="${STYLE.label}" width="40%">Total Amount</td>
              <td style="${STYLE.value}">${data.price || '-'}</td>
            </tr>
            <tr>
              <td style="${STYLE.label}" width="40%">Ordered At</td>
              <td style="${STYLE.value}">${data.date || 'Today'}</td>
            </tr>
            <tr>
              <td style="${STYLE.lastLabel}" width="40%">Est. Delivery</td>
              <td style="${STYLE.lastValue}">${data.delivery || '3-5 Days'}</td>
            </tr>
          </table>
          <p style="${STYLE.footerText}">
            Our architectural visualizers have begun processing your assets.<br/>
            You will receive another notification once the delivery is ready.
          </p>
        </div>
      </div>
    </div>
  `,
  DELIVERY_READY: (data: { 
    orderId: string, 
    planName: string,
    date: string,
    thumbnail: string,
    resultUrl: string
  }) => `
    <div style="${STYLE.container}">
      <div style="${STYLE.card}">
        <div style="${STYLE.header}">
          <p style="${STYLE.title}">StagingPro Studio</p>
          <h2 style="${STYLE.heading}">DELIVERY<br/>READY</h2>
        </div>
        <div style="${STYLE.body}">
          <div style="${STYLE.thumbnailContainer}">
            <img src="${data.thumbnail}" style="${STYLE.thumbnail}" alt="Staged Result" />
          </div>
          <table style="${STYLE.infoTable}" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="${STYLE.label}" width="40%">Project ID</td>
              <td style="${STYLE.value}">${data.orderId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="${STYLE.label}" width="40%">Service</td>
              <td style="${STYLE.value}">${data.planName || 'Staging Service'}</td>
            </tr>
            <tr>
              <td style="${STYLE.lastLabel}" width="40%">Ordered At</td>
              <td style="${STYLE.lastValue}">${data.date || '-'}</td>
            </tr>
          </table>
          <a href="${data.resultUrl || 'https://milz.tech'}" style="${STYLE.button}">View Deliverables</a>
          <p style="${STYLE.footerText}">
            The visualization for your space is now complete.<br/>
            High-resolution assets are available in your studio archive.
          </p>
        </div>
      </div>
    </div>
  `,
  QUOTE_READY: (data: { 
    orderId: string, 
    planName: string,
    amount: string,
    thumbnail: string,
    actionUrl: string
  }) => `
    <div style="${STYLE.container}">
      <div style="${STYLE.card}">
        <div style="${STYLE.header}">
          <p style="${STYLE.title}">StagingPro Studio</p>
          <h2 style="${STYLE.heading}">QUOTE<br/>PREPARED</h2>
        </div>
        <div style="${STYLE.body}">
          <div style="${STYLE.thumbnailContainer}">
            <img src="${data.thumbnail}" style="${STYLE.thumbnail}" alt="Project View" />
          </div>
          <p style="text-align: center; font-size: 14px; color: #64748B; margin-bottom: 30px; line-height: 1.6;">
            Our team has completed the assessment of your project requirements. A custom quote is now ready for your review.
          </p>
          <table style="${STYLE.infoTable}" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="${STYLE.label}" width="40%">Project ID</td>
              <td style="${STYLE.value}">${data.orderId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="${STYLE.label}" width="40%">Service</td>
              <td style="${STYLE.value}">${data.planName || '3D Modeling'}</td>
            </tr>
            <tr>
              <td style="${STYLE.lastLabel}" width="40%">Quote Amount</td>
              <td style="${STYLE.lastValue}">${data.amount}</td>
            </tr>
          </table>
          <a href="${data.actionUrl}" style="${STYLE.button}">Proceed to Payment</a>
          <p style="${STYLE.footerText}">
            Upon payment, your project will be assigned to a visualizer immediately.<br/>
            Need to discuss the quote? Reply via the studio chat.
          </p>
        </div>
      </div>
    </div>
  `
};
