// server-superbase.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://skokhwfjyqkmewdswrcb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrb2tod2ZqeXFrbWV3ZHN3cmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyMzE1MjEsImV4cCI6MjA3MDgwNzUyMX0.nmR3jqo3nermij5i4oRpfgUOKrKmBp9JcBqRRdPxPCQ';
export const supabase = createClient(supabaseUrl, supabaseKey);

// وظائف Authentication
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
  });
  return { data, error };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

export async function resetPassword(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email);
  return { data, error };
}

// مراقبة حالة المستخدم
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

export async function createOrder(order) {
  // order: {product_id, product_name, product_image, full_name, phone_number, address, state_id, state_name, shipping_type, color, color_hex, size, quantity, offer_label, product_price, shipping_price, total_price, status}
  return await supabase.from('orders').insert([order]);
}
