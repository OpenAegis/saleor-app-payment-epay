import crypto from 'crypto';

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
  payType?: 'alipay' | 'wxpay' | 'qqpay';
  productName?: string;
}

export interface EpayOrderResult {
  code: number;
  msg: string;
  payUrl?: string;
  tradeNo?: string;
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
      type: params.payType || 'alipay',
      out_trade_no: params.orderNo,
      notify_url: params.notifyUrl,
      return_url: params.returnUrl,
      name: params.productName || '虚拟商品',
      money: params.amount.toFixed(2),
    };

    // 生成签名
    const sign = this.generateSign(requestData);
    requestData.sign = sign;
    requestData.sign_type = 'MD5';

    // 发起请求
    const response = await fetch(`${this.config.apiUrl}/submit.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(requestData).toString(),
    });

    const result: any = await response.json();

    return {
      code: result.code || 0,
      msg: result.msg || '',
      payUrl: result.payurl,
      tradeNo: result.trade_no,
    };
  }

  // 验证回调签名
  verifyNotify(params: Record<string, string>): boolean {
    const receivedSign = params.sign;
    const calculatedSign = this.generateSign(params);
    return receivedSign === calculatedSign;
  }

  // 生成签名
  private generateSign(params: Record<string, string>): string {
    const sortedParams = Object.keys(params)
      .filter((k) => k !== 'sign' && k !== 'sign_type' && params[k])
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');

    const signString = sortedParams + this.config.key;
    return crypto.createHash('md5').update(signString).digest('hex');
  }

  // 查询订单状态
  async queryOrder(tradeNo: string): Promise<any> {
    const requestData = {
      pid: this.config.pid,
      trade_no: tradeNo,
    };

    const sign = this.generateSign(requestData);
    const params = new URLSearchParams({
      ...requestData,
      sign,
      sign_type: 'MD5',
    });

    const response = await fetch(
      `${this.config.apiUrl}/api.php?${params.toString()}`
    );

    return await response.json();
  }
}

// 导出单例
export const epayClient = new EpayClient({
  pid: process.env.EPAY_PID!,
  key: process.env.EPAY_KEY!,
  apiUrl: process.env.EPAY_API_URL!,
});