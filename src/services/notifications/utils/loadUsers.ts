import User from "../../../models/core/User";

export const loadUsersForNotifications = async () => {
  return User.find(
    { "notifications.enabled": true },
    {
      timezone: 1,
      notifications: 1
    }
  );
};
