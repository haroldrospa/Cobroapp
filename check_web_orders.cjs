const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://hkzgxdmnvyoviwketxva.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhremd4ZG1udnlvdml3a2V0eHZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMjUzNzUsImV4cCI6MjA2NjgwMTM3NX0.roSANiwzCTmjsDCsVBnHg6c1mr1XKpWXpopFcDaIdrQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function check() {
    console.log('Fetching recent open_orders...');
    const { data, error } = await supabase
        .from('open_orders')
        .select('id, store_id, source, order_status, created_at, customer_name')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Recent Orders:');
        data.forEach(order => {
            console.log(`[${order.created_at}] ID: ${order.id} | Store: ${order.store_id} | Source: "${order.source}" | Status: ${order.order_status} | Customer: ${order.customer_name}`);
        });
    }
}

check();
