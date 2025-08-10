
'use server';
/**
 * @fileOverview An AI flow for sending a registration OTP email.
 *
 * - sendOtp - The main function that handles generating and sending the OTP email.
 * - SendOtpInput - The input type for the sendOtp function.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'zod';
import sgMail from '@sendgrid/mail';

export const SendOtpInputSchema = z.object({
  name: z.string().describe('The name of the user to address in the email.'),
  email: z.string().email().describe('The email address to send the OTP to.'),
  otp: z.string().length(6).describe('The 6-digit one-time password.'),
});
export type SendOtpInput = z.infer<typeof SendOtpInputSchema>;

const EmailContentSchema = z.object({
    subject: z.string().describe("The subject line of the email."),
    body: z.string().describe("The HTML body of the email. It should be professional and include the user's name and the OTP clearly.")
});

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
            console.log(`--- OTP Email sent to ${input.to} ---`);
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


const generateEmailPrompt = ai.definePrompt({
    name: 'generateOtpEmailPrompt',
    input: { schema: SendOtpInputSchema },
    output: { schema: EmailContentSchema },
    prompt: `
        You are an AI assistant for an app called "LocalPulse".
        Your task is to generate a professional and friendly email to send a One-Time Password (OTP) to a new user for account verification.

        The email should:
        - Have a clear subject line like "Your LocalPulse Verification Code".
        - Greet the user by their name: {{{name}}}.
        - Clearly state the purpose of the email.
        - Display the OTP prominently: {{{otp}}}.
        - Mention that the code is valid for 10 minutes.
        - Do not include any unsubscribe links or marketing content.
        - The entire email body must be valid HTML.
    `,
});


const sendOtpFlow = ai.defineFlow(
  {
    name: 'sendOtpFlow',
    inputSchema: SendOtpInputSchema,
    outputSchema: z.custom<void>(),
  },
  async (input) => {
    // 1. Generate the email content using the AI prompt.
    const { output } = await generateEmailPrompt(input);
    
    if (!output?.subject || !output?.body) {
      throw new Error('AI failed to generate email content.');
    }

    // 2. Use the sendEmail tool to dispatch the generated email.
    const sendResult = await sendEmail({
        to: input.email,
        subject: output.subject,
        htmlBody: output.body,
    });

    if (!sendResult.success) {
      throw new Error(sendResult.message);
    }
  }
);

// This is the exported function that will be called by our server actions.
export async function sendOtp(input: SendOtpInput): Promise<void> {
  await sendOtpFlow(input);
}
