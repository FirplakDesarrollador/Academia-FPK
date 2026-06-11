const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jdtjtkncptwqdhlxmzds.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdGp0a25jcHR3cWRobHhtemRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5MTE4NDAwMCwiZXhwIjoyMDA2NzYwMDAwfQ.J2bzUNcYqvG_l79m3ITwwWC3HLcVlCsrbOFnndHt2yU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadVideos() {
  const bucketName = 'videos';
  
  console.log('Checking if bucket exists...');
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) {
    console.error('Error listing buckets:', bucketError);
    return;
  }
  
  const bucketExists = buckets.find(b => b.name === bucketName);
  if (!bucketExists) {
    console.log(`Creating bucket ${bucketName}...`);
    const { data, error } = await supabase.storage.createBucket(bucketName, {
      public: true,
      allowedMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime']
    });
    if (error) {
      console.error('Error creating bucket:', error);
      return;
    }
    console.log(`Bucket ${bucketName} created.`);
  } else {
    // Ensure bucket is public
    await supabase.storage.updateBucket(bucketName, { public: true });
    console.log(`Bucket ${bucketName} already exists and is public.`);
  }

  const videosDir = path.join(__dirname, '../public/videos');
  const files = fs.readdirSync(videosDir);
  
  for (const file of files) {
    if (!file.endsWith('.mp4')) continue;
    
    console.log(`Uploading ${file}...`);
    const filePath = path.join(videosDir, file);
    
    // Read the file as a buffer to upload to supabase
    const fileBuffer = fs.readFileSync(filePath);
    
    const { data, error } = await supabase.storage.from(bucketName).upload(file, fileBuffer, {
      upsert: true,
      contentType: 'video/mp4'
    });
    
    if (error) {
      console.error(`Error uploading ${file}:`, error.message);
    } else {
      console.log(`Successfully uploaded ${file}`);
    }
  }
  
  console.log('All videos uploaded successfully.');
}

uploadVideos();
