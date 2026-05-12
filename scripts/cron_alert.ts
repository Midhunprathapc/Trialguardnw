
import { db } from '../src/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

/**
 * This script is intended to be run in a server-side environment (like a GitHub Action or Firebase Function).
 * It checks for trials expiring in exactly 48 hours and triggers notifications.
 */

async function checkExpiringTrials() {
  const trialsRef = collection(db, 'trials');
  const q = query(trialsRef, where('status', '==', 'active'));
  
  const snapshot = await getDocs(q);
  const now = new Date();
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const start = new Date(data.startDate);
    const expiry = new Date(start.getTime() + data.durationDays * 24 * 60 * 60 * 1000);
    
    const diff = expiry.getTime() - now.getTime();
    const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (daysLeft === 2) {
      console.log(`ALERT: ${data.serviceName} for user ${data.userId} expires in 2 days!`);
      // Here you would call your Telegram API or Email API
      // fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${data.telegramId}&text=...`)
    }
  });
}

// execute if needed
// checkExpiringTrials();
