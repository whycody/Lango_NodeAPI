import cron from "node-cron";
import User from "../models/core/User";
import moment from 'moment-timezone';
import { sendPushNotification } from "../services/notifications/pushNotification";

cron.schedule('* * * * *', async () => {
  try {
    const nowUTC = new Date();
    const users = await User.find({ 'notifications.enabled': true });

    for (const user of users) {
      const userTime = moment(nowUTC).tz(user.timezone || 'Europe/Warsaw');
      const hour = userTime.hour();
      const minute = userTime.minute();

      if (hour === user.notifications.preferredHour && minute === user.notifications.preferredMinute) {
        for (const device of user.notifications.deviceTokens) {
          const lastNotified = device.lastNotifiedAt ? moment(device.lastNotifiedAt).tz(user.timezone) : null;

          if (lastNotified && lastNotified.isSame(userTime, 'day')) {
            continue;
          }

          await sendPushNotification(device.token, {
            title: 'Czas na naukę!',
            body: 'Nie zapomnij o swojej dzisiejszej sesji w Lango 😉'
          });

          device.lastNotifiedAt = nowUTC;
        }

        await user.save();
      }
    }
  } catch (error) {
    console.error('Failed to send notifications:', error);
  }
});