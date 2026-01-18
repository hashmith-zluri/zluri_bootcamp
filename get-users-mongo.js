// MongoDB Atlas script to get all users from the users collection
async function getAllUsers() {
  console.log('Testing MongoDB Atlas connection...');
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
      
      console.log('');
      console.log('=== USER SUMMARY ===');
      console.log('Active users:', users.filter(u => u.status === 'active').length);
      console.log('Inactive users:', users.filter(u => u.status === 'inactive').length);
      
      // Show unique email domains
      const domains = [...new Set(users.map(u => u.email?.split('@')[1]).filter(Boolean))];
      console.log('Email domains:', domains.join(', '));
      
    } else {
      console.log('No users found in the collection.');
    }
    
    console.log('');
    console.log('MongoDB script executed successfully!');
    
  } catch (error) {
    console.log('Error:', error.message);
  }
}

await getAllUsers();
