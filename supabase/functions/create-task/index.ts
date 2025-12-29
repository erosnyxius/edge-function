// যে দুইটা Export করলাম তা Import করবো !
import { handleCors, success, error } from '../_shared/cors.ts';
import { getSupabase, getUser } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  // STEP 1: Handle CORS (Browsers Send OPTIONS First)
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  
  try {
    // STEP 2: Check Ff User Is Logged In
    const user = await getUser(req);
    if (!user) {
      return error('Please log in first', 401);
    }

    // STEP 3: Get Data From Frontend
    const { title, useAI } = await req.json();

    if (!title) {
      return error('Title is required');
    }

    // STEP 4: Generate AI Description If Requested
    let description = '';
    let aiGenerated = false;

    if (useAI) {
      const openaiKey = Deno.env.get('OPENAI_API_KEY');
      
      if (!openaiKey) {
        return error('AI feature not configured');
      }

      // Call OpenAI API
      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that writes brief, actionable task descriptions.'
            },
            {
              role: 'user',
              content: `Write a 2-sentence description for this task: "${title}"`
            }
          ],
          max_tokens: 100,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        description = aiData.choices[0].message.content.trim();
        aiGenerated = true;
      }
    }

    // STEP 5: Save To Database
    const supabase = getSupabase(req);
    
    const { data: task, error: dbError } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        title,
        description,
        ai_generated: aiGenerated,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return error('Failed to create task', 500);
    }

    // STEP 6: Send Email Notification (Call Another Function)
    const emailResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.get('Authorization')!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        taskTitle: title,
      }),
    });

    // Don't Fail If Email Fails (It's Not Critical)
    if (!emailResponse.ok) {
      console.error('Email failed, but task was created');
    }

    // STEP 7: Return Success!
    return success({
      message: 'Task created successfully!',
      task,
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return error('Something went wrong', 500);
  }
});