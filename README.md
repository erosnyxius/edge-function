# PROJECT: AI-Powered Task Manager with Email Notifications

**What you'll build:**

- Create tasks with AI-generated descriptions
- Send email notifications when tasks are created
- Authentication with Supabase
- Perfect CORS setup
- Third-party API integration (OpenAI)

**Tech Stack:**

- Frontend: Vite + React + DaisyUI
- Backend: Supabase Edge Functions
- APIs: OpenAI for AI features, Resend for emails

---

## 📁 Project Structure

```
my-task-app/
├── supabase/
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── cors.ts          ← CORS helper (copy-paste ready)
│   │   │   └── supabase.ts      ← Auth helper (copy-paste ready)
│   │   ├── create-task/
│   │   │   └── index.ts         ← Main function
│   │   └── send-notification/
│   │       └── index.ts         ← Email function
│   └── .env.local               ← Your API keys (LOCAL ONLY)
├── src/
│   ├── App.jsx                  ← React app
│   └── main.jsx
└── package.json
```

---

## STEP 1: Setup (15 minutes)

### A. Install Supabase CLI

```bash
# macOS/Linux
brew install supabase/tap/supabase

# Windows
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Verify
supabase --version
```

### B. Create Project Folders

```bash
# Create React app
npm create vite@latest ai-powered-task-manager -- --template react
cd ai-powered-task-manager
npm install

npm install @supabase/supabase-js daisyui
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p

# Initialize Supabase
supabase init

# Login to Supabase 
supabase login

# Link existing project
supabase link --project-ref <PROJECT_ID>
```

### C. Configure Tailwind + DaisyUI

Edit `frontend/tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["light", "corporate"],
  },
}
```

### D. Create Database Table

Go to your Supabase Dashboard → SQL Editor → New Query:

```sql
-- Create tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  ai_generated BOOLEAN DEFAULT false,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tasks
CREATE POLICY "Users view own tasks"
  ON tasks FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own tasks
CREATE POLICY "Users create own tasks"
  ON tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own tasks
CREATE POLICY "Users update own tasks"
  ON tasks FOR UPDATE
  USING (auth.uid() = user_id);
```

---

## STEP 2: The CORS Helper 

Create `supabase/functions/_shared/cors.ts`:

```typescript
// এই File টা সব CORS Problem Solve করবে So Important!

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  
  // OPTIONS Requests এর জন্য Use করবো 
  export function handleCors() {
    return new Response('ok', { headers: corsHeaders });
  }
  
  // Successful Responses এর জন্য Use করবো
  export function success(data: any) {
    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  }
  
  // Errors এর জন্য Use করবো
  export function error(message: string, status = 400) {
    return new Response(
      JSON.stringify({ error: message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status 
      }
    );
  }
```

**Remember:** Every response MUST include CORS headers or your browser will block it!

---

## STEP 3: The Auth Helper 

Create `supabase/functions/_shared/supabase.ts`:

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2';

// Supabase Client Creates করবো Logged-In User এর জন্য !
export function getSupabase(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { 
          Authorization: req.headers.get('Authorization')! 
        },
      },
    }
  );
}

// Gets The Current User From The Request
export async function getUser(req: Request) {
  const supabase = getSupabase(req);
  const { data: { user }, error } = await supabase.auth.getUser();
  return user;
}
```

**What this does:** The `Authorization` header contains the user's JWT token. By passing it to Supabase, all database queries automatically respect Row Level Security (RLS).

---

## STEP 4: Create Task Function (WITH AI!)

Create Supabase Edge Function Using Supabase CLI

```bash
supabase functions new <FUNCTION_NAME>
```

Create `supabase/functions/create-task/index.ts`:

```typescript
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
```

Deploy Supabase Edge Function Using Supabase CLI

```bash
supabase functions deploy <FUNCTION_NAME>
```


**Key Concepts:**

1. **CORS First**: Always handle OPTIONS before anything else
2. **Auth Second**: Check if user is logged in
3. **Validate Third**: Make sure required data exists
4. **Process Fourth**: Do your business logic (AI, database, etc.)
5. **Respond Last**: Always use `success()` or `error()` helpers

---

## STEP 5: Email Notification Function

Create `supabase/functions/send-notification/index.ts`:

```typescript
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
```

---

## STEP 6: Setup Environment Variables

### A. Local Development

Create `supabase/.env.local`:

```bash
# Get these from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-openai-key-here

# Get this from https://resend.com/api-keys (it's free!)
RESEND_API_KEY=re_your-resend-key-here
```

**IMPORTANT:** Add to `.gitignore`:

```bash
echo "supabase/.env.local" >> .gitignore
```

### B. Production Deployment

```bash
# Set secrets in production (these are encrypted!)
supabase secrets set OPENAI_API_KEY=sk-your-real-key
supabase secrets set RESEND_API_KEY=re-your-real-key

# Verify they're set
supabase secrets list
```

---

## STEP 7: The React Frontend

### Terminal 3 - Start React App:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser!

---

## STEP 8: Test Everything

### Test 1: Sign Up

1. Enter email: `test@example.com`
2. Enter password: `password123`
3. Click "Sign Up"
4. Go to Supabase Dashboard → Authentication → Users
5. Click the user → Click "..." → "Confirm User"

### Test 2: Sign In

1. Use same credentials
2. You should see the task manager

### Test 3: Create Regular Task

1. Enter title: "Buy groceries"
2. Don't check AI box
3. Click "Create Task"
4. You should see {"code":401,"message":"Invalid JWT"} 

```toml
[functions.create-task]
enabled = true
verify_jwt = false # Make This False!
```

5. After that task will be created! 

### Test 4: Create AI Task

1. Enter title: "Learn edge functions"
2. Check "✨ Generate description with AI"
3. Click "Create Task"
4. Wait ~2 seconds
5. Task appears with AI-generated description!

### Test 5: Check Email

1. Look at your email inbox
2. You should have received an email notification

---

## 🎓 What You Just Learned

### ✅ CORS

- Handle OPTIONS requests with `handleCors()`
- Include CORS headers in every response
- Use helper functions (`success()`, `error()`) to never forget

### ✅ Authentication

- Get user from request with `getUser()`
- Pass Authorization header to Supabase
- RLS automatically protects your data

### ✅ Third-Party APIs

- Call OpenAI for AI features
- Call Resend for emails
- Store API keys in environment variables

### ✅ Error Handling

- Always use try-catch
- Return meaningful error messages
- Don't expose internal errors to users

### ✅ Project Structure

- `_shared/` folder for reusable code
- One function = one job
- Functions can call other functions

---

## 🐛 Common Problems & Solutions

### Problem: "CORS error" in browser

**Solution:** Check Network tab:

- If OPTIONS is red → You forgot `handleCors()`
- If POST is red → Your function has a bug

### Problem: "Unauthorized" error

**Solution:**

```typescript
// Make sure you're getting the user correctly
const user = await getUser(req);
if (!user) {
  return error('Please log in', 401);
}
```

### Problem: Can't see tasks from other users

**Solution:** That's RLS working! It's supposed to do that. Each user only sees their own tasks.

### Problem: AI not working

**Check:**

1. Is `OPENAI_API_KEY` set in `.env.local`?
2. Did you set it in production with `supabase secrets set`?
3. Do you have credits in OpenAI account?

### Problem: Emails not sending

**Check:**

1. Is `RESEND_API_KEY` set correctly?
2. Did you verify your domain in Resend? (or use their test email)
3. Check spam folder

---
## 🎯 Key Takeaways (Remember These!)

1. **Always handle CORS first:**
    
    ```typescript
    if (req.method === 'OPTIONS') return handleCors();
    ```
    
2. **Always check authentication:**
    
    ```typescript
    const user = await getUser(req);
    if (!user) return error('Unauthorized', 401);
    ```
    
3. **Always validate input:**
    
    ```typescript
    if (!title) return error('Title is required');
    ```
    
4. **Always use try-catch:**
    
    ```typescript
    try {
      // your code
    } catch (err) {
      return error('Something went wrong', 500);
    }
    ```
    
5. **Always return CORS headers:**
    
    ```typescript
    return success(data);  // ✅ Good
    return new Response(); // ❌ Bad - browser will block!
    ```
    
##  Your Action Plan

**Day 1-2: Build the project** (4 hours total)

- Follow the steps exactly as written
- Don't skip the testing parts
- Make it work locally first

**Day 3: Break it, then fix it** (2 hours)

- Remove the CORS handler → see the error → understand why it's needed
- Remove auth check → try to access another user's tasks → understand RLS
- Remove try-catch → see what happens when things fail

**Day 4: Extend it** (2 hours)

- Add one new feature (delete tasks, search, filters, etc.)
- You'll realize you already know how to do it


## 📝 The Only 3 Files You Need to Remember

```typescript
// 1. cors.ts - handles all CORS
export function handleCors() { ... }
export function success(data) { ... }
export function error(msg) { ... }

// 2. supabase.ts - handles all auth
export function getSupabase(req) { ... }
export function getUser(req) { ... }

// 3. Your function - follows this pattern ALWAYS:
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors();
  
  try {
    const user = await getUser(req);
    if (!user) return error('Unauthorized', 401);
    
    // Your logic here
    
    return success(result);
  } catch (err) {
    return error('Something went wrong', 500);
  }
});
```

That's it. **Every Edge Function you'll ever write follows this exact pattern.**

