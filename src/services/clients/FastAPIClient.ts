import axios, { AxiosInstance } from "axios";

export class FastAPIClient {
  private client: AxiosInstance;

  constructor(baseURL: string = process.env.FASTAPI_URI || "http://fastapi:8000") {
    this.client = axios.create({
      baseURL,
    });
  }

  async get<T = any>(url: string, params?: any): Promise<T> {
    const res = await this.client.get<T>(url, { params });
    return res.data;
  }

  async post<T = any>(url: string, body: any): Promise<T> {
    const res = await this.client.post<T>(url, body);
    return res.data;
  }

  async put<T = any>(url: string, body: any): Promise<T> {
    const res = await this.client.put<T>(url, body);
    return res.data;
  }

  async delete<T = any>(url: string): Promise<T> {
    const res = await this.client.delete<T>(url);
    return res.data;
  }
}
