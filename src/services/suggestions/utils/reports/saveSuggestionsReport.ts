import SuggestionsReport from "../../../../models/reports/SuggestionsReport";
import { SuggestionsReportAttr } from "../../../../types/models/SuggestionsReportAttr";

export async function saveSuggestionsReport(data: SuggestionsReportAttr) {
  try {
    return await SuggestionsReport.create(data);
  } catch (error) {
    console.error('Error logging prompt report:', error);
    throw error;
  }
}