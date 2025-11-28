import cron from 'node-cron';
import moment from 'moment-timezone';
import User from "../models/core/User";
import Session from "../models/core/Session";
import Evaluation from "../models/core/Evaluation";
import Word from "../models/core/Word";
import { sendPushNotification } from "../services/notifications/pushNotification";
import {
  getRandomEndOfDayNotification,
  getRandomNeutralNotification
} from "../services/notifications/notificationsHelper";

cron.schedule('* * * * *', async () => {
  try {
    const nowUTC = new Date();
    const users = await User.find({ 'notifications.enabled': true });

    for (const user of users) {
      const userTime = moment(nowUTC).tz(user.timezone || 'Europe/Warsaw');
      const todayStr = userTime.format('YYYY-MM-DD');

      const hasTodaySession = await Session.exists({
        userId: user._id,
        finished: true,
        localDay: todayStr
      });

      if (hasTodaySession) continue;

      const lastEval = await Evaluation.findOne({ userId: user._id }).sort({ date: -1 });
      let lang = 'en';
      if (lastEval) {
        const word = await Word.findById(lastEval.wordId);
        if (word?.translationLang) lang = word.translationLang;
      }

      for (const device of user.notifications.deviceTokens) {
        const lastNotified = device.lastNotifiedAt
          ? moment(device.lastNotifiedAt).tz(user.timezone)
          : null;

        const shouldNotify = (notifHour: number, notifMinute: number) => {
          const notifTime = moment.tz({
            year: userTime.year(),
            month: userTime.month(),
            day: userTime.date(),
            hour: notifHour,
            minute: notifMinute
          }, user.timezone);

          return (!lastNotified || lastNotified.isBefore(notifTime));
        };

        if (shouldNotify(user.notifications.neutralTime.hour, user.notifications.neutralTime.minute)) {
          const { title, body } = getRandomNeutralNotification(lang);
          await sendPushNotification(device.token, { title, body });
          device.lastNotifiedAt = nowUTC;
        }

        if (shouldNotify(user.notifications.endOfDayTime.hour, user.notifications.endOfDayTime.minute)) {
          const { title, body } = getRandomEndOfDayNotification(lang);
          await sendPushNotification(device.token, { title, body });
          device.lastNotifiedAt = nowUTC;
        }
      }

      await user.save();
    }
  } catch (error) {
    console.error('Failed to send notifications:', error);
  }
});