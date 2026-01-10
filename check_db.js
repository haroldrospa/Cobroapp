const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://hkzgxdmnvyoviwketxva.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhremd4ZG1udnlvdml3a2V0eHZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMjUzNzUsImV4cCI6MjA2NjgwMTM3NX0.roSANiwzCTmjsDCsVBnHg6c1mr1XKpWXpopFcDaIdrQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function check() {
  console.log('Checking cash_movements table...');
  const { data, error } = await supabase.from('cash_movements').select('*').limit(1);
  if (error) {
    console.error('Error:', JSON.stringify(error, null, 2));
  } else {
    console.log('Success. Data:', data);
  }
}

check();
