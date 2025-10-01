import { GPTReportAttr } from "../../../../types/models/GPTReportAttr";
import GPTReport from "../../../../models/reports/GPTReport";

export async function saveGPTReport(data: GPTReportAttr) {
  try {
    return await GPTReport.create(data);
  } catch (error) {
    console.error('Error logging prompt report:', error);
    throw error;
  }
}