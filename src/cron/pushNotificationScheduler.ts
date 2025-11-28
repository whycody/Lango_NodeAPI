import cron from 'node-cron';
import moment from 'moment-timezone';

import {
  getNotificationContent,
  loadUsersForNotifications,
  loadUsersLanguages,
  loadUsersWithSessionToday,
  sendNotificationToDevice,
  shouldNotify
} from "../services/notifications/utils";
import Evaluation from "../models/core/Evaluation";
import { Types } from "mongoose";

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
      const lang = usersLanguages[userId] || "en";
      const lastEval = await Evaluation.findOne({ userId: user._id }).sort({ date: -1 });

      let learnedRecently = false;
      if (lastEval) {
        const daysDiff = moment(nowUTC).diff(moment(lastEval.date), "days");
        learnedRecently = daysDiff <= 2;
      }

      for (const device of user.notifications.deviceTokens) {
        const neutralLast = device.neutralTimeLastNotifiedAt
          ? moment(device.neutralTimeLastNotifiedAt).tz(user.timezone)
          : null;

        const endLast = device.endOfDayTimeLastNotifiedAt
          ? moment(device.endOfDayTimeLastNotifiedAt).tz(user.timezone)
          : null;

        const neutralTime = user.notifications.neutralTime;
        const endOfDayTime = user.notifications.endOfDayTime;

        if (shouldNotify(userTime, neutralTime.hour, neutralTime.minute, neutralLast)) {
          const neutralContent = getNotificationContent('neutral', lang);
          await sendNotificationToDevice(device, neutralContent, 'neutral', nowUTC);
        }

        if (learnedRecently && shouldNotify(userTime, endOfDayTime.hour, endOfDayTime.minute, endLast)) {
          const endContent = getNotificationContent('end', lang);
          await sendNotificationToDevice(device, endContent, 'end', nowUTC);
        }
      }

      await user.save();
    }
  } catch (err) {
    console.error("Failed to send notifications:", err);
  }
});