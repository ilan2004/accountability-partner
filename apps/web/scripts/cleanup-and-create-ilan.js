const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function cleanupAndCreateIlan() {
  console.log('🧹 Cleaning up and creating Ilan Usman...');
  
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

  const regularSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const email = 'ilanusman16@gmail.com';
  const password = 'Ilanusman1234';

  try {
    // Step 1: Check if auth user already exists
    console.log('1️⃣ Checking for existing auth user...');
    
    // Try to sign in to see if auth user exists
    const { data: existingAuth, error: signInError } = await regularSupabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (!signInError && existingAuth.user) {
      console.log('✅ Auth user already exists! Using existing user.');
      console.log(`   User ID: ${existingAuth.user.id}`);
      
      // Update database profile with correct auth ID
      console.log('2️⃣ Updating database profile...');
      
      const { error: updateError } = await adminSupabase
        .from('User')
        .upsert({
          id: existingAuth.user.id,
          email: email,
          name: 'Ilan Usman',
          emailVerified: existingAuth.user.email_confirmed_at ? new Date(existingAuth.user.email_confirmed_at) : new Date(),
          updatedAt: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (updateError) {
        console.error('❌ Profile update failed:', updateError.message);
      } else {
        console.log('✅ Profile updated successfully!');
      }

      await regularSupabase.auth.signOut();
      
      console.log('\n🎉 SUCCESS! User is ready to use.');
      console.log('\n📝 Next Steps:');
      console.log('1. Go to: http://localhost:3000/auth/signin');
      console.log(`2. Sign in with: ${email}`);
      console.log(`3. Password: ${password}`);
      
      return true;
    }

    // Step 2: Auth user doesn't exist or wrong password, try to create with different email first
    console.log('2️⃣ Auth user not found or wrong credentials. Creating new user...');
    
    // Try with a temporary different email first to test if creation works
    const tempEmail = `temp${Date.now().toString().slice(-6)}@gmail.com`;
    console.log(`🧪 Testing with temporary email: ${tempEmail}`);
    
    const { data: tempData, error: tempError } = await regularSupabase.auth.signUp({
      email: tempEmail,
      password: 'TempPassword123!'
    });

    if (tempError) {
      console.error('❌ Even temp user creation failed:', tempError.message);
      console.log('🚨 There is a fundamental Supabase configuration issue');
      console.log('💡 Possible solutions:');
      console.log('   1. Check Supabase dashboard > Authentication > Settings');
      console.log('   2. Ensure "Enable email confirmations" is OFF');
      console.log('   3. Check for any custom auth triggers or policies');
      console.log('   4. Try creating a user manually in Supabase dashboard');
      return false;
    } else {
      console.log('✅ Temp user creation works! Cleaning up...');
      await adminSupabase.auth.admin.deleteUser(tempData.user.id);
    }

    // Step 3: Try to create the real user using admin method
    console.log('3️⃣ Trying admin user creation method...');
    
    const { data: adminUserData, error: adminError } = await adminSupabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {}
    });

    if (adminError) {
      console.error('❌ Admin user creation failed:', adminError.message);
      
      if (adminError.message.includes('already registered')) {
        console.log('💡 User already exists in auth but with different password');
        console.log('🔧 Try signing in with a different password or reset password in Supabase dashboard');
        return false;
      }
    } else {
      console.log('✅ Admin user creation successful!');
      console.log(`   User ID: ${adminUserData.user.id}`);
      
      // Create/update profile
      console.log('4️⃣ Creating user profile...');
      
      const { error: profileError } = await adminSupabase
        .from('User')
        .upsert({
          id: adminUserData.user.id,
          email: email,
          name: 'Ilan Usman',
          emailVerified: adminUserData.user.email_confirmed_at ? new Date(adminUserData.user.email_confirmed_at) : new Date(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        console.error('❌ Profile creation failed:', profileError.message);
        return false;
      }

      console.log('✅ Profile created successfully!');
      
      // Test sign in
      const { data: testSignIn, error: testError } = await regularSupabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (testError) {
        console.error('❌ Sign in test failed:', testError.message);
        return false;
      }

      console.log('✅ Sign in test successful!');
      await regularSupabase.auth.signOut();
      
      console.log('\n🎉 SUCCESS! User "Ilan Usman" is ready!');
      console.log('\n📝 Next Steps:');
      console.log('1. Go to: http://localhost:3000/auth/signin');
      console.log(`2. Sign in with: ${email}`);
      console.log(`3. Password: ${password}`);
      
      return true;
    }

  } catch (error) {
    console.error('💥 Process failed:', error);
    return false;
  }
}

if (require.main === module) {
  cleanupAndCreateIlan()
    .then((success) => {
      if (success) {
        console.log('\n🏁 All done! User is ready to sign in.');
      } else {
        console.log('\n❌ Process failed. Check output above for debugging info.');
      }
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupAndCreateIlan };
