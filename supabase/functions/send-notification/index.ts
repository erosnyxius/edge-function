import { handleCors, success, error } from '../_shared/cors.ts';
import { getUser } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  try {
    // Verify User Is Authenticated
    const user = await getUser(req);
    if (!user) {
      return error('Unauthorized', 401);
    }

    const { email, taskTitle } = await req.json();

    // Get Resend API key (You'll Set This Later)
    const resendKey = Deno.env.get('RESEND_API_KEY');
    
    if (!resendKey) {
      console.error('RESEND_API_KEY not set');
      return error('Email service not configured', 500);
    }

    // Send Email Via Resend API
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Task Manager <onboarding@resend.dev>',
        to: email,
        subject: 'New Task Created!',
        html: `
          <h2>You created a new task!</h2>
          <p><strong>${taskTitle}</strong></p>
          <p>Don't forget to complete it! 🎯</p>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error('Resend error:', errorData);
      return error('Failed to send email', 500);
    }

    return success({ message: 'Email sent successfully' });

  } catch (err) {
    console.error('Error:', err);
    return error('Failed to send notification', 500);
  }
});