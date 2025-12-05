import User from "../../models/core/User";
import Session from "../../models/core/Session";
import Evaluation from "../../models/core/Evaluation";
import { LanguageCodeValue } from "../../constants/languageCodes";

export async function updateUserData(userId: string) {
  const user = await User.findById(userId).select('-password');
  if (!user) return null;

  const sessions = await Session.find({ userId }).sort({ date: -1 });
  const finishedSessions = sessions.filter(s => s.finished);
  const sessionCount = finishedSessions.length;
  const averageScore = sessionCount > 0
    ? finishedSessions.reduce((sum, s) => sum + s.averageScore, 0) / sessionCount
    : 0;

  const studyDays = Array.from(new Set(sessions.map(s => s.localDay)));
  const evaluationCount = await Evaluation.countDocuments({ userId });

  const mainLang: LanguageCodeValue | null = sessions[0]?.mainLang || null;
  const translationLang: LanguageCodeValue | null = sessions[0]?.translationLang || null;

  user.stats = {
    studyDays,
    sessionCount,
    evaluationCount,
    averageScore
  };
  user.mainLang = mainLang || user.mainLang;
  user.translationLang = translationLang || user.translationLang;

  await user.save();

  return user;
}