"use server";

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const AUDIENCE_ID = 'c062a18b-e07a-4426-89b1-c4945d1ae371';

export async function subscribeAction(formData: FormData) {
  const email = formData.get('email')?.toString();

  if (!email) {
    return { error: "Email is required" };
  }

  try {
    await resend.contacts.create({
      email,
      audienceId: AUDIENCE_ID,
      unsubscribed: false
    });

    return { success: "Thanks for subscribing! We'll keep you updated." };
  } catch (error) {
    console.error('Subscription error:', error);
    return { error: "Failed to subscribe. Please try again later." };
  }
} 