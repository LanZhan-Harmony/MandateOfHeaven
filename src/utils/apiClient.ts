import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { archiveType } from "../types/archiveType";
import type { briefArchiveType } from "../types/briefArchiveType";

/**
 * 处理动态cookie的API客户端
 */
class APIClient {
  private baseUrl: string =
    import.meta.env.DEV && !(window as any).__TAURI_INTERNALS__ ? "" : "https://prod.beifa.shyingyou.cn";

  private sessionCookie: string | null;
  private headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Language": "zh-cmn-Hans, zh-cmn-Hans;q=0.1",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    Locale: "zh_CN",
    "User-Agent":
      "BeifaClientFull/1.1.16 (packaged:release) Electron/37.10.3 Chromium/138.0.7204.251 Node/22.21.1 win32/10.0.26200 (Windows_NT; x64; Windows 11 Pro for Workstations)",
    "Sec-CH-UA": '"Not)A;Brand";v="8", "Chromium";v="138"',
    "Sec-CH-UA-Mobile": "?0",
    "Sec-CH-UA-Platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
  };

  private static _instance: APIClient;
  public static get instance(): APIClient {
    if (!this._instance) {
      this._instance = new APIClient();
    }
    return this._instance;
  }

  private constructor() {
    let foundCookie = null;
    if (typeof document !== "undefined") {
      const match = document.cookie.match(/_session=([^;]+)/);
      if (match) {
        foundCookie = match[1];
      }
    }

    this.sessionCookie =
      foundCookie ||
      "rhVH54%2FcMxT3OStH%2B8mPbaO2mrZL8lLQw1p7MKwtRXmHYComn3Y0h%2BByq8WbcyGUt5ZVsMWwVc%2BmA3kP9eySzjTJfTNtpmkxdn0wCpsOjjg2JHffVdWWOqtJMylZxIZWxHzqvvOR9VGPneDVMwOUJazherpz%2Fb81yfmQkOnvWb8KjejSgk3ppvcs9QBDCdTR2A9uGtRtZaQ7AS4uDJMNb3wnW1CPGDianQI%3D--He4qG2rEreLyaBdH--TttKxwdX%2FaUQ4XRAF4dQxA%3D%3D";
  }

  /**
   * 获取当前环境下的 fetch 函数
   */
  private async getFetch() {
    // 检查是否在 Tauri 环境中
    if ((window as any).__TAURI_INTERNALS__) {
      return tauriFetch;
    }
    return window.fetch.bind(window);
  }

  /**
   * 从响应中提取并更新cookie
   * @param response HTTP响应对象
   */
  private updateCookieFromResponse(response: any) {
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      // 解析set-cookie头
      const match = setCookie.match(/_session=([^;]+)/);
      if (match) {
        const newCookie = match[1];
        if (newCookie !== this.sessionCookie) {
          this.sessionCookie = newCookie!;
          // 同步回document.cookie
          if (typeof document !== "undefined") {
            document.cookie = `_session=${this.sessionCookie}; path=/; SameSite=Lax`;
          }
        }
      }
    }
  }

  /**
   * 执行HTTP请求
   */
  private async request(method: string, path: string, body: any = null) {
    const isTauri = !!(window as any).__TAURI_INTERNALS__;
    const isDev = import.meta.env.DEV && !isTauri;

    // 基础头部信息
    const headers: Record<string, string> = { ...this.headers };

    // 浏览器环境下，移除那些会被浏览器拦截或由 Vite Proxy 注入的受限头部
    if (isDev) {
      delete headers["User-Agent"];
      delete headers["Sec-CH-UA"];
      delete headers["Sec-CH-UA-Mobile"];
      delete headers["Sec-CH-UA-Platform"];
      delete headers["Sec-Fetch-Dest"];
      delete headers["Sec-Fetch-Mode"];
      delete headers["Sec-Fetch-Site"];
    } else {
      // 在 Tauri 或生产环境下，手动补上 Cookie
      headers["Cookie"] = `_session=${this.sessionCookie}`;
    }

    const options: any = {
      method,
      headers,
    };

    if (body) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const activeFetch = await this.getFetch();
    const response = await activeFetch(`${this.baseUrl}${path}`, options);

    // 关键：从响应中更新cookie！
    this.updateCookieFromResponse(response);

    if (response.status === 401) {
      console.log("401 Unauthorized - Cookie已过期或无效");
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Tauri fetch 返回的对象同样支持 .json()
    return await response.json();
  }

  /**
   * 获取存档列表
   */
  public async getAllArchives(): Promise<briefArchiveType[]> {
    return (await this.request("GET", "/api/games")).games as briefArchiveType[];
  }

  /**
   * 获取指定存档
   * @param gameId
   * @returns
   */
  public async getArchive(gameId: number): Promise<archiveType> {
    return (await this.request("GET", `/api/games/${gameId}`)).game as archiveType;
  }

  /**
   * 创建新存档
   */
  public async createArchive() {
    return await this.request("POST", `/api/games`);
  }

  /**
   * 复制存档
   * @param gameId 要复制的存档ID
   * @returns 新存档信息
   */
  public async copyArchive(gameId: number) {
    return await this.request("POST", `/api/games/${gameId}/copy`);
  }

  /**
   * 在游戏中执行动作
   * @param gameId 存档ID
   * @param actionId 动作ID
   */
  public async actInGame(gameId: number, actionId: number | string): Promise<archiveType> {
    return (await this.request("POST", `/api/games/${gameId}/act/${actionId}`)).game as archiveType;
  }

  /**
   * 在游戏中执行跳转
   * @param gameId 存档ID
   * @param jumpId 跳转ID
   */
  public async jumpInGame(gameId: number, jumpId: string): Promise<archiveType> {
    return (await this.request("POST", `/api/games/${gameId}/jump/${jumpId}`)).game as archiveType;
  }

  /**
   * 导出当前有效的cookie
   * @return 当前session cookie字符串
   */
  public getCookie(): string | null {
    return this.sessionCookie;
  }
}

export const apiClient = APIClient.instance;
