import User from "../../../models/core/User";
import moment from "moment-timezone";

export const loadUsersForNotifications = async () => {
  const users = await User.find(
    {
      "notifications.enabled": true,
      "notifications.deviceTokens.0": { $exists: true },
    },
    {
      _id: 1,
      timezone: 1,
      translationLang: 1,
      notifications: 1,
      stats: 1
    }
  );

  const nowUTC = new Date();
  return users.filter(user => {
    const tz = user.timezone || "UTC";
    const today = moment(nowUTC).tz(tz).format("YYYY-MM-DD");
    const studyDays = user.stats?.studyDays || [];
    return !studyDays.includes(today);
  });
};

