import crypto from "crypto";

export interface EpayConfig {
  pid: string;
  key: string;
  apiUrl: string;
}

export interface CreateOrderParams {
  amount: number;
  orderNo: string;
  notifyUrl: string;
  returnUrl: string;
  payType?: string; // 支持自定义支付方式
  productName?: string;
  productDesc?: string;
  clientIp?: string;
}

export interface EpayOrderResult {
  code: number;
  msg: string;
  payUrl?: string;
  tradeNo?: string;
  qrcode?: string;
  type?: string;
}

export interface EpayNotifyParams {
  pid: string;
  trade_no: string;
  out_trade_no: string;
  type: string;
  name: string;
  money: string;
  trade_status: string;
  sign: string;
  sign_type: string;
}

export interface EpayQueryResult {
  status: number;
  msg: string;
  out_trade_no?: string;
  trade_no?: string;
  trade_status?: string;
  money?: string;
  type?: string;
}

interface SubmitResponse {
  code?: number;
  msg?: string;
  payurl?: string;
  trade_no?: string;
  qrcode?: string;
  type?: string;
}

interface QueryResponse {
  status?: number;
  msg?: string;
  out_trade_no?: string;
  trade_no?: string;
  trade_status?: string;
  money?: string;
  type?: string;
}

interface MerchantInfoResponse {
  pid: string;
  key: string;
  name: string;
  money: string;
  type: string;
  rate: string;
  account: string;
  username: string;
  email: string;
  qq: string;
  tel: string;
  lasttime: string;
}

export class EpayClient {
  private config: EpayConfig;

  constructor(config: EpayConfig) {
    this.config = config;
  }

  // 创建支付订单
  async createOrder(params: CreateOrderParams): Promise<EpayOrderResult> {
    const requestData: Record<string, string> = {
      pid: this.config.pid,
      type: params.payType || "alipay",
      out_trade_no: params.orderNo,
      notify_url: params.notifyUrl,
      return_url: params.returnUrl,
      name: params.productName || "虚拟商品",
      money: params.amount.toFixed(2),
    };

    // 添加可选参数
    if (params.productDesc) {
      requestData.desc = params.productDesc;
    }
    if (params.clientIp) {
      requestData.clientip = params.clientIp;
    }

    // 生成签名
    const sign = this.generateSign(requestData);
    requestData.sign = sign;
    requestData.sign_type = "MD5";

    try {
      // 发起请求
      const response = await fetch(`${this.config.apiUrl}/submit.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams(requestData).toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          code: 0,
          msg: `HTTP Error: ${response.status} - ${errorText}`,
        };
      }

      const result = (await response.json()) as SubmitResponse;

      return {
        code: result.code || 0,
        msg: result.msg || "",
        payUrl: result.payurl,
        tradeNo: result.trade_no,
        qrcode: result.qrcode,
        type: result.type,
      };
    } catch (error) {
      // 记录详细的错误信息
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      // const errorStack = error instanceof Error ? error.stack : undefined;

      return {
        code: 0,
        msg: `创建订单失败: ${errorMessage}`,
      };
    }
  }

  // 验证回调签名
  verifyNotify(params: Record<string, string>): boolean {
    // 保存原始签名
    const receivedSign = params.sign;

    // 生成签名并验证
    const calculatedSign = this.generateSign(params);
    return receivedSign === calculatedSign;
  }

  // 生成签名
  private generateSign(params: Record<string, string>): string {
    const sortedParams = Object.keys(params)
      .filter((k) => k !== "sign" && k !== "sign_type" && params[k])
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");

    const signString = sortedParams + this.config.key;
    return crypto.createHash("md5").update(signString).digest("hex");
  }

  // 查询订单状态
  async queryOrder(tradeNoOrOutTradeNo: string, useOutTradeNo = false): Promise<EpayQueryResult> {
    // 参考 v2 demo：查询接口需要 act=order，并支持 trade_no 或 out_trade_no
    const requestData: Record<string, string> = {
      pid: this.config.pid,
      act: "order",
    };
    if (useOutTradeNo) {
      requestData.out_trade_no = tradeNoOrOutTradeNo;
    } else {
      requestData.trade_no = tradeNoOrOutTradeNo;
    }

    const sign = this.generateSign(requestData);
    const params = new URLSearchParams({
      ...requestData,
      sign,
      sign_type: "MD5",
    });

    try {
      const response = await fetch(`${this.config.apiUrl}/api.php?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          status: 0,
          msg: `HTTP Error: ${response.status} - ${errorText}`,
        };
      }

      const result = (await response.json()) as QueryResponse;

      return {
        status: result.status || 0,
        msg: result.msg || "",
        out_trade_no: result.out_trade_no,
        trade_no: result.trade_no,
        trade_status: result.trade_status,
        money: result.money,
        type: result.type,
      };
    } catch (error) {
      // 记录详细的错误信息
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      // const errorStack = error instanceof Error ? error.stack : undefined;

      return {
        status: 0,
        msg: `查询订单失败: ${errorMessage}`,
      };
    }
  }

  // 查询商户信息
  async queryMerchantInfo(): Promise<MerchantInfoResponse> {
    const requestData = {
      pid: this.config.pid,
      act: "query",
    };

    const sign = this.generateSign(requestData);
    const params = new URLSearchParams({
      ...requestData,
      sign,
      sign_type: "MD5",
    });

    try {
      const response = await fetch(`${this.config.apiUrl}/api.php?${params.toString()}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP Error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      // 验证响应数据
      if (!result || typeof result !== "object") {
        throw new Error("无效的响应数据格式");
      }

      return result as MerchantInfoResponse;
    } catch (error) {
      // 记录详细的错误信息
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      // const errorStack = error instanceof Error ? error.stack : undefined;

      throw new Error(`查询商户信息失败: ${errorMessage}`);
    }
  }
}

// 导出单例 - 注意：在实际使用中应该通过配置创建实例而不是使用全局单例
export const createEpayClient = (config: EpayConfig): EpayClient => {
  return new EpayClient(config);
};
