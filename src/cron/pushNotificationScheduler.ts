import cron from 'node-cron';
import moment from 'moment-timezone';

import {
  getNotificationContent,
  loadUsersForNotifications,
  loadUsersLanguages,
  loadUsersWithSessionToday,
  shouldNotify
} from "../services/notifications/utils";
import Evaluation from "../models/core/Evaluation";
import { Types } from "mongoose";
import { LanguageCode } from "../constants/languageCodes";
import { sendPushNotification } from "../services/notifications/pushNotification";

cron.schedule("* * * * *", async () => {
  try {
    const nowUTC = new Date();
    const users = await loadUsersForNotifications();
    const usersWithSessionToday = await loadUsersWithSessionToday(nowUTC, users);
    const usersLanguages = await loadUsersLanguages(users);

    for (const user of users) {
      const userId = (user._id as Types.ObjectId).toString();

      if (usersWithSessionToday.has(userId)) continue;

      const userTime = moment(nowUTC).tz(user.timezone || "Europe/Warsaw");
      const lang = usersLanguages[userId] || LanguageCode.En;
      const lastEval = await Evaluation.findOne({ userId: user._id }).sort({ date: -1 });

      let learnedRecently = false;
      if (lastEval) {
        const daysDiff = moment(nowUTC).diff(moment(lastEval.date), "days");
        learnedRecently = daysDiff <= 2;
      }

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
          const neutralContent = getNotificationContent('neutral', lang);
          await sendPushNotification(device.token, neutralContent);
          user.notifications.neutralTimeLastNotifiedAt = nowUTC;
        }

        if (learnedRecently && shouldNotify(userTime, endOfDayTime.hour, endOfDayTime.minute, endLast)) {
          const endContent = getNotificationContent('end', lang);
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