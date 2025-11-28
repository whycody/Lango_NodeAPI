import Session from "../../../models/core/Session";
import moment from "moment-timezone";

export const loadUsersWithSessionToday = async (nowUTC: Date, userIds: any[]) => {
  const today = moment(nowUTC).format("YYYY-MM-DD");

  const sessions = await Session.find(
    { userId: { $in: userIds }, localDay: today },
    { userId: 1 }
  );

  return new Set(sessions.map(s => s.userId.toString()));
};
