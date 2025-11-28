import moment from "moment-timezone";
import {
  getRandomNeutralNotification,
  getRandomEndOfDayNotification
} from "../notificationsHelper";

export const shouldNotify = (
  userTime: moment.Moment,
  notifHour: number,
  notifMinute: number,
  lastSent: moment.Moment | null
) => {
  const notifTime = moment.tz(
    {
      year: userTime.year(),
      month: userTime.month(),
      day: userTime.date(),
      hour: notifHour,
      minute: notifMinute
    },
    userTime.tz() as string
  );

  return !lastSent || lastSent.isBefore(notifTime);
};

export const getNotificationContent = (
  type: "neutral" | "end",
  lang: string
) => {
  if (type === "neutral") return getRandomNeutralNotification(lang);
  return getRandomEndOfDayNotification(lang);
};
