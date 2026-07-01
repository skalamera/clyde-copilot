import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', 'website', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check(userId, email) {
  console.log(`--- Checking ${email} (${userId}) ---`);
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

  const { data: subData, error: subErr } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId);

  if (subErr) {
    console.error("Error fetching subscription:", subErr.message);
  } else {
    console.log("Subscription Record:", subData);
  }
}

async function run() {
  await check('b591a4e4-2f96-4c7c-bd2d-74ac13bea786', 'pro-user2@test.com');
  await check('5e721f05-4e07-4457-8384-41d17d7e545b', 'pro-user@test.com');
}

run();
