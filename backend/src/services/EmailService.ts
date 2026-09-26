import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

export class EmailService {
  private static transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  static async sendOtpEmail(targetEmail: string, otpCode: string): Promise<boolean> {
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        logger.warn("SMTP credentials not configured. Skipping real email delivery.");
        return false;
      }

      const digits = otpCode.split('');
      const year = new Date().getFullYear();

      // This preheader text appears in the notification panel / email preview
      const preheaderText = `Your verification code is ${otpCode}. It expires in 5 minutes. Do not share this code with anyone.`;

      const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>Your Verification Code — ${otpCode}</title>
      </head>
      <body style="margin:0;padding:0;background-color:#F4F0FF;font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">

        <!-- Preheader (controls notification panel preview text) -->
        <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
          ${preheaderText}
          ${'&nbsp;&zwnj;'.repeat(40)}
        </div>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F4F0FF;">
          <tr>
            <td align="center" style="padding:32px 16px 48px 16px;">

              <!-- Main Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 60px rgba(99,102,241,0.12),0 2px 8px rgba(0,0,0,0.04);">

                <!-- Hero Banner -->
                <tr>
                  <td style="background:linear-gradient(135deg,#6366F1 0%,#8B5CF6 35%,#A855F7 60%,#D946EF 100%);padding:40px 40px 36px 40px;text-align:center;">
                    <!-- Logo Circle -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                      <tr>
                        <td style="width:64px;height:64px;background-color:rgba(255,255,255,0.2);border-radius:20px;text-align:center;vertical-align:middle;border:2px solid rgba(255,255,255,0.3);">
                          <span style="font-size:32px;line-height:64px;color:#ffffff;">&#9670;</span>
                        </td>
                      </tr>
                    </table>
                    <h1 style="margin:16px 0 0 0;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:0.3px;">Invisible Web3</h1>
                    <p style="margin:6px 0 0 0;font-size:13px;font-weight:500;color:rgba(255,255,255,0.75);letter-spacing:1.5px;text-transform:uppercase;">Secure Verification</p>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding:36px 40px 0 40px;text-align:center;">
                    <h2 style="margin:0;font-size:20px;font-weight:700;color:#1e1b4b;">Your verification code</h2>
                    <p style="margin:10px 0 0 0;font-size:15px;color:#6b7280;line-height:1.6;">Enter this code to securely access your Smart Wallet and digital assets.</p>
                  </td>
                </tr>

                <!-- OTP Code -->
                <tr>
                  <td style="padding:28px 20px 0 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:linear-gradient(135deg,#FAF5FF 0%,#F0EBFF 100%);border:2px solid #E9E0FF;border-radius:20px;">
                      <tr>
                        <td style="padding:20px 10px;text-align:center;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">
                            <tr>
                              ${digits.map(d => `
                              <td style="padding:0 3px;">
                                <div style="width:40px;height:50px;line-height:50px;background-color:#ffffff;border:2px solid #D8B4FE;border-radius:12px;text-align:center;font-size:24px;font-weight:800;color:#6D28D9;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
                                  ${d}
                                </div>
                              </td>
                              `).join('')}
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Timer -->
                <tr>
                  <td style="padding:20px 40px 0 40px;text-align:center;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                      <tr>
                        <td style="background:linear-gradient(135deg,#EDE9FE,#F3E8FF);border:1px solid #DDD6FE;border-radius:100px;padding:10px 24px;">
                          <span style="font-size:13px;font-weight:700;color:#7C3AED;">&#9201; Valid for 5 minutes</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Trust Strip -->
                <tr>
                  <td style="padding:24px 20px 0 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F0FDF4;border:1px solid #D1FAE5;border-radius:12px;">
                      <tr>
                        <td style="padding:14px 16px;text-align:center;">
                          <span style="font-size:13px;color:#15803D;font-weight:600;">&#128274; Encrypted &nbsp;&middot;&nbsp; &#9939; Polygon Network &nbsp;&middot;&nbsp; &#128737; Verified Sender</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Warning -->
                <tr>
                  <td style="padding:16px 20px 0 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;">
                      <tr>
                        <td style="padding:14px 16px;">
                          <p style="margin:0;font-size:12px;font-weight:600;color:#92400E;line-height:1.5;text-align:center;">&#9888;&#65039; Never share this code. We will never ask for it via phone, SMS, or chat.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding:28px 40px 0 40px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr><td style="height:1px;background:linear-gradient(90deg,transparent,#E9E0FF,transparent);">&nbsp;</td></tr>
                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:24px 40px 32px 40px;text-align:center;">
                    <p style="margin:0;font-size:13px;font-weight:600;color:#6D28D9;">Invisible Web3</p>
                    <p style="margin:6px 0 0 0;font-size:12px;color:#9CA3AF;line-height:1.5;">Borderless Payments &middot; Smart Wallets &middot; Decentralized Finance</p>
                    <p style="margin:12px 0 0 0;font-size:11px;color:#D1D5DB;">&copy; ${year} Invisible Web3. All rights reserved.</p>
                  </td>
                </tr>

              </table>
              <!-- End Main Card -->

            </td>
          </tr>
        </table>

      </body>
      </html>
      `;

      const info = await this.transporter.sendMail({
        from: `"Invisible Web3" <${process.env.SMTP_USER}>`,
        to: targetEmail,
        subject: `${otpCode} is your Invisible Web3 code`,
        text: preheaderText,
        html: htmlTemplate,
      });

      logger.info(`OTP Email sent successfully to ${targetEmail} (Message ID: ${info.messageId})`);
      return true;
    } catch (error) {
      logger.error(`Failed to send OTP email to ${targetEmail}: ${error}`);
      return false;
    }
  }
}
