
'use server';
/**
 * @fileOverview An AI flow for sending a registration OTP email.
 *
 * - sendOtp - The main function that handles generating and sending the OTP email.
 * - SendOtpInput - The input type for the sendOtp function.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'zod';

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
 * A placeholder tool for sending an email.
 * In a real application, this function's implementation would use a service
 * like Nodemailer, SendGrid, or Mailgun to dispatch the email.
 *
 * The current implementation only logs the email to the console for demonstration.
 *
 * To make this functional:
 * 1. Choose an email sending library (e.g., `npm install nodemailer`).
 * 2. Configure the transporter with your email provider's SMTP details.
 * 3. Replace the `console.log` with the actual email sending call (e.g., `transporter.sendMail(...)`).
 * 4. Ensure you have the necessary environment variables for your email service (e.g., SMTP_HOST, SMTP_USER, SMTP_PASS).
 */
const sendEmail = ai.defineTool(
    {
        name: 'sendEmail',
        description: 'Sends an email to a user.',
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
        console.log('--- SENDING EMAIL (SIMULATED) ---');
        console.log(`To: ${input.to}`);
        console.log(`Subject: ${input.subject}`);
        console.log('Body:');
        console.log(input.htmlBody);
        console.log('-----------------------------------');
        // In a real implementation, you would use a service like Nodemailer here.
        // For example:
        //
        // import nodemailer from 'nodemailer';
        // const transporter = nodemailer.createTransport({ ... });
        // await transporter.sendMail({
        //   from: '"LocalPulse" <no-reply@localpulse.app>',
        //   to: input.to,
        //   subject: input.subject,
        //   html: input.htmlBody
        // });
        
        return { success: true, message: 'Email sent successfully (simulated).' };
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
    await sendEmail({
        to: input.email,
        subject: output.subject,
        htmlBody: output.body,
    });
  }
);

// This is the exported function that will be called by our server actions.
export async function sendOtp(input: SendOtpInput): Promise<void> {
  await sendOtpFlow(input);
}
