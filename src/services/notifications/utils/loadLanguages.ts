import Evaluation from "../../../models/core/Evaluation";
import Word from "../../../models/core/Word";
import { Types } from "mongoose";

export const loadUsersLanguages = async (userIds: any[]) => {
  const lastEvals = await Evaluation.aggregate([
    { $match: { userId: { $in: userIds } } },
    { $sort: { date: -1 } },
    {
      $group: {
        _id: "$userId",
        wordId: { $first: "$wordId" }
      }
    }
  ]);

  const wordIds = lastEvals.map(e => e.wordId);

  const words = await Word.find(
    { _id: { $in: wordIds } },
    { translationLang: 1 }
  );

  const langByUser: Record<string, string> = {};

  for (const evalItem of lastEvals) {
    const word = words.find(w => (w._id as Types.ObjectId)?.equals?.(evalItem.wordId));
    langByUser[evalItem._id.toString()] = word?.translationLang || "en";
  }

  return langByUser;
};
