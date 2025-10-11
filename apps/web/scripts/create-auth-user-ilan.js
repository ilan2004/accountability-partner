const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function createAuthUserForIlan() {
  console.log('🔐 Creating Supabase Auth user for Ilan Usman...');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  try {
    const email = 'ilanusman16@gmail.com';
    const password = 'Ilanusman1234';

    // Step 1: Create auth user WITHOUT metadata (this works)
    console.log('1️⃣ Creating minimal auth user...');
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password
      // NO options.data - this is what breaks it!
    });

    if (error) {
      console.error('❌ Auth user creation failed:', error.message);
      return false;
    }

    console.log('✅ Auth user created successfully!');
    console.log(`   User ID: ${data.user.id}`);
    console.log(`   Email: ${data.user.email}`);
    console.log(`   Confirmed: ${!!data.user.email_confirmed_at}`);

    // Step 2: Update the existing database profile with the new auth ID
    console.log('\n2️⃣ Linking auth user to existing database profile...');
    
    const { error: updateError } = await adminSupabase
      .from('User')
      .update({
        id: data.user.id, // Update with the auth user ID
        emailVerified: data.user.email_confirmed_at ? new Date(data.user.email_confirmed_at) : new Date(),
        updatedAt: new Date().toISOString()
      })
      .eq('email', email);

    if (updateError) {
      console.error('❌ Profile linking failed:', updateError.message);
      
      // If update failed, try to delete the old profile and create a new one
      console.log('🔄 Trying to create fresh profile...');
      
      await adminSupabase
        .from('User')
        .delete()
        .eq('email', email);

      const { error: createError } = await adminSupabase
        .from('User')
        .insert({
          id: data.user.id,
          email: email,
          name: 'Ilan Usman',
          emailVerified: data.user.email_confirmed_at ? new Date(data.user.email_confirmed_at) : new Date(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

      if (createError) {
        console.error('❌ Fresh profile creation failed:', createError.message);
        return false;
      } else {
        console.log('✅ Fresh profile created successfully!');
      }
    } else {
      console.log('✅ Profile linked successfully!');
    }

    // Step 3: Test the complete flow
    console.log('\n3️⃣ Testing complete sign-in flow...');
    
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (signInError) {
      console.error('❌ Sign in test failed:', signInError.message);
      return false;
    }

    console.log('✅ Sign in test successful!');
    console.log('🎉 User "Ilan Usman" is now ready to use!');

    // Clean up the test session
    await supabase.auth.signOut();

    console.log('\n📝 Next Steps:');
    console.log('1. Go to: http://localhost:3000/auth/signin');
    console.log(`2. Sign in with: ${email}`);
    console.log(`3. Password: ${password}`);
    console.log('4. You should be redirected to Notion connect page');
    console.log('5. Connect your Notion account to complete setup');

    return true;

  } catch (error) {
    console.error('💥 Auth user creation failed:', error);
    return false;
  }
}

if (require.main === module) {
  createAuthUserForIlan()
    .then((success) => {
      if (success) {
        console.log('\n🏁 SUCCESS! Ilan Usman can now sign in to the web app.');
      } else {
        console.log('\n❌ Failed to create auth user. Check errors above.');
      }
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { createAuthUserForIlan };
