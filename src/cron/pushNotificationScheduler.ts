import cron from 'node-cron';
import moment from 'moment-timezone';

import {
  getNotificationContent,
  loadUsersForNotifications,
  shouldNotify
} from "../services/notifications/utils";
import { LanguageCode } from "../constants/languageCodes";
import { sendPushNotification } from "../services/notifications/pushNotification";

cron.schedule("* * * * *", async () => {
  try {
    const nowUTC = new Date();
    const users = await loadUsersForNotifications();

    for (const user of users) {
      const userTime = moment(nowUTC).tz(user.timezone || "Europe/Warsaw");
      const today = moment(nowUTC).tz(user.timezone).startOf("day");

      const learnedRecently = user.stats.studyDays.some(dayStr => {
        const day = moment(dayStr, "YYYY-MM-DD");
        return today.diff(day, "days") <= 2;
      });

      const neutralLast = user.notifications.neutralTimeLastNotifiedAt
        ? moment(user.notifications.neutralTimeLastNotifiedAt).tz(user.timezone)
        : null;

      const endLast = user.notifications.endOfDayTimeLastNotifiedAt
        ? moment(user.notifications.endOfDayTimeLastNotifiedAt).tz(user.timezone)
        : null;

      for (const device of user.notifications.deviceTokens) {
        const neutralTime = user.notifications.neutralTime;
        const endOfDayTime = user.notifications.endOfDayTime;

        if (shouldNotify(userTime, neutralTime.hour, neutralTime.minute, neutralLast)) {
          const neutralContent = getNotificationContent('neutral', user.translationLang || LanguageCode.En);
          await sendPushNotification(device.token, neutralContent);
          user.notifications.neutralTimeLastNotifiedAt = nowUTC;
        }

        if (learnedRecently && shouldNotify(userTime, endOfDayTime.hour, endOfDayTime.minute, endLast)) {
          const endContent = getNotificationContent('end', user.translationLang || LanguageCode.En);
          await sendPushNotification(device.token, endContent);
          user.notifications.endOfDayTimeLastNotifiedAt = nowUTC;
        }
      }

      await user.save();
    }
  } catch (err) {
    console.error("Failed to send notifications:", err);
  }
});