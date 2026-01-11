// Sample script to get all users from MongoDB
async function getAllUsers() {
  console.log('Fetching all users from MongoDB...');
  
  try {
    // Get users collection and find all documents
    const users = await db.collection('users').find({}).toArray();
    
    console.log('=== USERS COLLECTION - COMPLETE DATA ===');
    console.log('Total users found:', users.length);
    console.log('');
    
    if (users.length > 0) {
      console.log('All user records:');
      users.forEach((user, index) => {
        console.log(`User ${index + 1}:`, JSON.stringify(user, null, 2));
      });
    } else {
      console.log('No users found in the collection.');
    }
    
    console.log('');
    console.log('Query completed successfully!');
    
  } catch (error) {
    console.log('Failed to fetch users:', error.message);
  }
}

getAllUsers();
