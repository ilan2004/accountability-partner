const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function diagnoseSupabaseConfig() {
  console.log('🔍 Comprehensive Supabase Configuration Diagnosis...\n');
  
  // Test 1: Environment Variables
  console.log('1️⃣ Environment Variables:');
  console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);
  console.log(`   NEXT_PUBLIC_SUPABASE_ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing'}\n`);

  // Test 2: Basic connection
  console.log('2️⃣ Testing Basic Connection:');
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.log(`   ❌ Auth connection failed: ${error.message}`);
    } else {
      console.log('   ✅ Auth connection working');
    }
  } catch (error) {
    console.log(`   ❌ Connection failed: ${error.message}`);
  }

  // Test 3: Database connection
  console.log('\n3️⃣ Testing Database Connection:');
  try {
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

    const { data, error } = await adminSupabase
      .from('User')
      .select('id')
      .limit(1);

    if (error) {
      console.log(`   ❌ Database query failed: ${error.message}`);
    } else {
      console.log(`   ✅ Database connection working (found ${data?.length || 0} users)`);
    }
  } catch (error) {
    console.log(`   ❌ Database connection failed: ${error.message}`);
  }

  // Test 4: Check current users
  console.log('\n4️⃣ Checking Existing Users:');
  try {
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

    // Check if Ilan already exists
    const { data: existingUser } = await adminSupabase
      .from('User')
      .select('*')
      .eq('email', 'ilanusman16@gmail.com')
      .single();

    if (existingUser) {
      console.log('   ✅ User "Ilan Usman" already exists in database!');
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Name: ${existingUser.name}`);
      console.log(`   Notion Connected: ${existingUser.notionId ? 'Yes' : 'No'}`);
      
      // Try to sign in with this user
      console.log('\n5️⃣ Testing Sign In with Existing User:');
      const regularSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      const { data: signInData, error: signInError } = await regularSupabase.auth.signInWithPassword({
        email: 'ilanusman16@gmail.com',
        password: 'Ilanusman1234'
      });

      if (signInError) {
        console.log(`   ❌ Sign in failed: ${signInError.message}`);
        
        if (signInError.message.includes('Invalid login credentials')) {
          console.log('   💡 User exists in database but not in auth - this is the issue!');
          console.log('   🔧 Need to create the auth user separately');
        }
      } else {
        console.log('   ✅ Sign in successful! User is ready to use.');
        await regularSupabase.auth.signOut();
        
        return true; // User is ready
      }
    } else {
      console.log('   ℹ️  User "Ilan Usman" does not exist in database yet');
    }
  } catch (error) {
    console.log(`   ❌ User check failed: ${error.message}`);
  }

  // Test 5: Try creating auth user only (without metadata)
  console.log('\n6️⃣ Testing Minimal Auth User Creation:');
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const testEmail = `minimal${Date.now().toString().slice(-6)}@gmail.com`;
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: 'TestPassword123!'
      // No options.data metadata
    });

    if (error) {
      console.log(`   ❌ Minimal signup failed: ${error.message}`);
      
      if (error.message.includes('Database error saving new user')) {
        console.log('   🚨 DIAGNOSIS: There is a fundamental Supabase auth configuration issue');
        console.log('   🔧 SOLUTIONS:');
        console.log('      1. Check if email confirmation is REALLY disabled in dashboard');
        console.log('      2. Check if RLS policies are interfering with auth.users table');
        console.log('      3. Check if there are custom triggers on auth.users table');
        console.log('      4. Try creating a fresh Supabase project for testing');
      }
    } else {
      console.log('   ✅ Minimal signup works! The issue is with metadata or user profile creation');
      
      // Clean up
      if (data.user) {
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
        
        await adminSupabase.auth.admin.deleteUser(data.user.id);
        console.log('   🧹 Test user cleaned up');
      }
    }
  } catch (error) {
    console.log(`   ❌ Minimal signup test failed: ${error.message}`);
  }

  return false; // User not ready
}

async function manualUserCreation() {
  console.log('\n🛠️  Attempting Manual User Creation via Direct Database Insert...\n');
  
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
    // Create a unique ID for the user
    const userId = crypto.randomUUID();
    
    console.log('📝 Creating user profile directly in database...');
    const { data, error } = await adminSupabase
      .from('User')
      .upsert({
        id: userId,
        email: 'ilanusman16@gmail.com',
        name: 'Ilan Usman',
        emailVerified: new Date(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, {
        onConflict: 'email'
      })
      .select()
      .single();

    if (error) {
      console.log(`❌ Direct database insert failed: ${error.message}`);
      return false;
    }

    console.log('✅ User profile created in database');
    console.log('⚠️  Note: This user exists in database but NOT in Supabase Auth');
    console.log('📝 To sign in, we would need to create the auth user separately');
    
    return true;

  } catch (error) {
    console.log(`❌ Manual creation failed: ${error.message}`);
    return false;
  }
}

if (require.main === module) {
  diagnoseSupabaseConfig()
    .then((userReady) => {
      if (!userReady) {
        console.log('\n🔧 User not ready, trying manual creation...');
        return manualUserCreation();
      }
      return true;
    })
    .then((success) => {
      if (success) {
        console.log('\n✅ Diagnosis complete. Check output above for next steps.');
      } else {
        console.log('\n❌ All creation methods failed. Supabase configuration needs attention.');
      }
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Diagnosis failed:', error);
      process.exit(1);
    });
}

module.exports = { diagnoseSupabaseConfig };
