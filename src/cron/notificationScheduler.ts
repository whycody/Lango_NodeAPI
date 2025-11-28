import cron from 'node-cron';
import User from '../models/core/User';
import { Types } from "mongoose";
import { calculateBestTimes } from "../services/notifications/calculateBestTime";

cron.schedule('* * * * *', async () => {
  try {
    console.log('Updating notification times for users...');

    const users = await User.find({ 'notifications.enabled': true }).select('_id');

    for (const user of users) {
      const userId = user._id as Types.ObjectId;
      const bestTimes = await calculateBestTimes(userId.toString());

      if (bestTimes) {
        await User.findByIdAndUpdate(
          userId,
          {
            'notifications.neutralTime.hour': bestTimes.neutralTime.hour,
            'notifications.neutralTime.minute': bestTimes.neutralTime.minute,
            'notifications.endOfDayTime.hour': bestTimes.endOfDayTime.hour,
            'notifications.endOfDayTime.minute': bestTimes.endOfDayTime.minute,
          },
          { new: true }
        );
      }
    }

    console.log('Notification times updated successfully.');
  } catch (error) {
    console.error('Failed to update notification times:', error);
  }
});
