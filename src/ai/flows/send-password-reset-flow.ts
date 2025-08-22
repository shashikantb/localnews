
'use server';
/**
 * @fileOverview An AI flow for sending a password reset OTP email.
 *
 * - sendPasswordResetOtp - The main function that handles generating and sending the OTP email.
 */

import { getAi } from '@/utils/firebaseAdmin';
import { z } from 'zod';
import sgMail from '@sendgrid/mail';
import { SendOtpInputSchema } from '@/lib/db-types';
import type { SendOtpInput } from '@/lib/db-types';

const ai = getAi();

/**
 * A tool for sending an email using SendGrid.
 */
const sendEmail = ai.defineTool(
    {
        name: 'sendEmail',
        description: 'Sends an email to a user using the SendGrid API.',
        inputSchema: z.object({
            to: z.string().email(),
            subject: z.string(),
            htmlBody: z.string(),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            message: z.string(),
        }),
    },
    async (input) => {
        const apiKey = process.env.SENDGRID_API_KEY;
        const fromEmail = process.env.SENDGRID_FROM_EMAIL;

        if (!apiKey || !fromEmail) {
            const errorMsg = 'SendGrid API Key or From Email is not configured in environment variables.';
            console.error(`--- SEND EMAIL FAILED ---: ${errorMsg}`);
            return { success: false, message: errorMsg };
        }

        sgMail.setApiKey(apiKey);

        const msg = {
          to: input.to,
          from: fromEmail,
          subject: input.subject,
          html: input.htmlBody,
        };

        try {
            await sgMail.send(msg);
            console.log(`--- Password Reset OTP Email sent to ${input.to} ---`);
            return { success: true, message: 'Email sent successfully.' };
        } catch (error: any) {
            console.error('--- SENDGRID ERROR ---');
            console.error(error);
            if (error.response) {
                console.error(error.response.body)
            }
            return { success: false, message: 'Failed to send email via SendGrid.' };
        }
    }
);

/**
 * Creates the HTML content for the password reset OTP email.
 * @param name The user's name.
 * @param otp The 6-digit one-time password.
 * @returns The HTML string for the email body.
 */
function createPasswordResetEmailHtml(name: string, otp: string): string {
    return `
        <div style="font-family: Arial, sans-serif; color: #333;">
            <h2 style="color: #18053c;">LocalPulse Password Reset</h2>
            <p>Hi ${name},</p>
            <p>A password reset was requested for your account. Please use the following One-Time Password (OTP) to set a new password:</p>
            <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #ff6f00;">${otp}</p>
            <p>This code is valid for 10 minutes.</p>
            <p>If you did not request a password reset, you can safely ignore this email.</p>
            <br/>
            <p>Thanks,</p>
            <p>The LocalPulse Team</p>
        </div>
    `;
}


const sendPasswordResetOtpFlow = ai.defineFlow(
  {
    name: 'sendPasswordResetOtpFlow',
    inputSchema: SendOtpInputSchema,
    outputSchema: z.custom<void>(),
  },
  async (input) => {
    // 1. Generate the email content using the hardcoded template.
    const subject = `Your LocalPulse Password Reset Code`;
    const htmlBody = createPasswordResetEmailHtml(input.name, input.otp);
    
    // 2. Use the sendEmail tool to dispatch the generated email.
    const sendResult = await sendEmail({
        to: input.email,
        subject: subject,
        htmlBody: htmlBody,
    });

    if (!sendResult.success) {
      throw new Error(sendResult.message);
    }
  }
);

// This is the exported function that will be called by our server actions.
export async function sendPasswordResetOtp(input: SendOtpInput): Promise<void> {
  await sendPasswordResetOtpFlow(input);
}
