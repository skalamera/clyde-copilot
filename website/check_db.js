import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials in .env!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserAndSubscription() {
  const userId = 'b591a4e4-2f96-4c7c-bd2d-74ac13bea786';
  const email = 'pro-user2@test.com';

  console.log(`Checking Supabase User and Subscription for ${email}...`);

  // 1. Check auth.users
  const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(userId);
  if (authErr) {
    console.error("Error fetching auth user:", authErr.message);
  } else {
    console.log("Auth User Found:", {
      id: authUser.user.id,
      email: authUser.user.email,
      created_at: authUser.user.created_at
    });
  }

  // 2. Check public.subscriptions (or the subscription table name)
  // Let's first list what tables we have or query standard names 'subscriptions' or 'subscription'
  const { data: subData, error: subErr } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId);

  if (subErr) {
    console.error("Error fetching subscription from 'subscriptions':", subErr.message);
  } else {
    console.log("Subscription Record from 'subscriptions':", subData);
  }

  const { data: subData2, error: subErr2 } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', userId);

  if (subErr2) {
    console.error("Error fetching subscription by ID:", subErr2.message);
  } else {
    console.log("Subscription Record by ID from 'subscriptions':", subData2);
  }
}

checkUserAndSubscription();
