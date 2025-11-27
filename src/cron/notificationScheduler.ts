import cron from 'node-cron';
import User from '../models/core/User';
import { calculateBestTime } from '../services/notifications/calculateBestTime';
import { Types } from "mongoose";

cron.schedule('0 3 * * *', async () => {
  try {
    console.log('Updating notification times for users...');

    const users = await User.find({ 'notifications.enabled': true }).select('_id');

    for (const user of users) {
      const userId = user._id as Types.ObjectId;
      const bestTime = await calculateBestTime(userId.toString());

      if (bestTime) {
        await User.findByIdAndUpdate(user._id, {
          'notifications.preferredHour': bestTime.hour,
          'notifications.preferredMinute': bestTime.minute
        });
      }
    }

    console.log('Notification times updated successfully.');
  } catch (error) {
    console.error('Failed to update notification times:', error);
  }
});
