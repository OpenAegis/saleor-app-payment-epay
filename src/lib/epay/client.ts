import crypto from "crypto";

export interface EpayConfig {
  pid: string;
  key: string; // MD5 签名使用的密钥
  rsaPrivateKey?: string; // RSA 签名使用的私钥
  apiUrl: string;
  apiVersion?: "v1" | "v2"; // API 版本
  signType?: "MD5" | "RSA"; // 签名类型
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
  
  // v2 API 额外参数
  method?: string; // v2: 接口类型 web/jump/jsapi/app/scan/applet
  device?: string; // v2: 设备类型 pc/mobile/qq/wechat/alipay
  channelId?: number; // v2: 通道ID
  authCode?: string; // v2: 被扫支付授权码
  subOpenid?: string; // v2: 用户Openid
  subAppid?: string; // v2: 公众号AppId
  param?: string; // v2: 业务扩展参数
}

export interface EpayOrderResult {
  code: number;
  msg: string;
  payUrl?: string;
  tradeNo?: string;
  qrcode?: string;
  type?: string;
  
  // v2 API 返回字段
  payType?: string; // v2: 发起支付类型
  payInfo?: string; // v2: 发起支付参数 (JSON字符串)
  timestamp?: string; // v2: 当前时间戳
  sign?: string; // v2: 签名字符串
  signType?: string; // v2: 签名类型
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

interface SubmitV2Response {
  code?: number;
  msg?: string;
  trade_no?: string;
  pay_type?: string;
  pay_info?: string;
  timestamp?: string;
  sign?: string;
  sign_type?: string;
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

  /**
   * 检测设备类型并返回合适的 device 参数
   * @param userAgent 用户代理字符串
   * @returns 设备类型
   */
  static detectDevice(userAgent?: string): string {
    if (!userAgent) return 'pc';
    
    const ua = userAgent.toLowerCase();
    
    // 支付宝客户端
    if (ua.includes('alipayclient') || ua.includes('alipay')) {
      return 'alipay';
    }
    
    // 微信内浏览器
    if (ua.includes('micromessenger')) {
      return 'wechat';
    }
    
    // 手机QQ内浏览器
    if (ua.includes('qq/') && (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone'))) {
      return 'qq';
    }
    
    // 移动设备浏览器
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone') || ua.includes('ipad')) {
      return 'mobile';
    }
    
    // 默认为电脑浏览器
    return 'pc';
  }

  /**
   * 根据设备类型获取推荐的支付方式
   * @param device 设备类型
   * @param paymentType 支付类型 (alipay/wechat/etc.)
   * @returns 推荐的 method 参数
   */
  static getRecommendedMethod(device: string, paymentType: string = 'alipay'): string {
    // 对于 web 通用支付，根据设备和支付类型自动选择最佳方式
    switch (device) {
      case 'alipay':
        // 支付宝客户端内，使用 jsapi 或 app 支付
        return paymentType === 'alipay' ? 'jsapi' : 'web';
      
      case 'wechat':
        // 微信内浏览器，使用 jsapi 支付
        return paymentType === 'wechat' ? 'jsapi' : 'web';
      
      case 'qq':
        // QQ 内浏览器，使用跳转支付
        return 'jump';
      
      case 'mobile':
        // 移动浏览器，优先使用二维码或跳转
        return 'web'; // 让服务器根据具体情况决定
      
      case 'pc':
      default:
        // 电脑浏览器，使用通用网页支付
        return 'web';
    }
  }

  // 创建支付订单
  async createOrder(params: CreateOrderParams): Promise<EpayOrderResult> {
    const apiVersion = this.config.apiVersion || "v1";
    
    if (apiVersion === "v2") {
      return this.createOrderV2(params);
    } else {
      return this.createOrderV1(params);
    }
  }

  // v1 API 创建订单
  private async createOrderV1(params: CreateOrderParams): Promise<EpayOrderResult> {
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
    requestData.sign_type = this.config.signType || "MD5";

    try {
      // 确保正确的 URL 拼接，避免双斜杠问题
      const baseUrl = this.config.apiUrl.replace(/\/+$/, ''); // 移除尾部斜杠
      const apiEndpoint = `${baseUrl}/mapi.php`;
      
      console.log('[EpayClient] 使用 v1 API 发起支付请求', {
        endpoint: apiEndpoint,
        pid: this.config.pid,
        amount: params.amount,
        orderNo: params.orderNo,
        payType: params.payType,
        hasClientIp: !!params.clientIp,
        signPreview: sign.substring(0, 8) + '...'
      });

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json, text/plain, */*",
          "User-Agent": "Saleor-Epay-Client/1.0"
        },
        body: new URLSearchParams(requestData).toString(),
      });

      console.log('[EpayClient] v1 API 响应状态', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type')
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          code: 0,
          msg: `HTTP Error: ${response.status} - ${errorText}`,
        };
      }

      const responseText = await response.text();
      console.log('[EpayClient] v1 API 原始响应', {
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 200)
      });

      const result = JSON.parse(responseText) as SubmitResponse;

      return {
        code: result.code || 0,
        msg: result.msg || "",
        payUrl: result.payurl,
        tradeNo: result.trade_no,
        qrcode: result.qrcode,
        type: result.type,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error('[EpayClient] v1 创建订单异常', {
        error: errorMessage
      });

      return {
        code: 0,
        msg: `创建订单失败: ${errorMessage}`,
      };
    }
  }

  // v2 API 创建订单
  private async createOrderV2(params: CreateOrderParams): Promise<EpayOrderResult> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    // 自动检测设备类型和推荐支付方式
    const detectedDevice = params.device || EpayClient.detectDevice(params.clientIp);
    const recommendedMethod = params.method || EpayClient.getRecommendedMethod(detectedDevice, params.payType);
    
    console.log('[EpayClient] v2 API 自动配置', {
      originalDevice: params.device,
      detectedDevice: detectedDevice,
      originalMethod: params.method,
      recommendedMethod: recommendedMethod,
      payType: params.payType
    });
    
    const requestData: Record<string, string> = {
      pid: this.config.pid,
      method: recommendedMethod,
      type: params.payType || "alipay",
      out_trade_no: params.orderNo,
      notify_url: params.notifyUrl,
      return_url: params.returnUrl,
      name: params.productName || "虚拟商品",
      money: params.amount.toFixed(2),
      clientip: params.clientIp || "127.0.0.1",
      timestamp: timestamp,
    };

    // 添加可选参数
    if (params.productDesc) {
      requestData.desc = params.productDesc;
    }
    
    // 使用检测到的设备类型
    requestData.device = detectedDevice;
    if (params.channelId) {
      requestData.channel_id = params.channelId.toString();
    }
    if (params.authCode) {
      requestData.auth_code = params.authCode;
    }
    if (params.subOpenid) {
      requestData.sub_openid = params.subOpenid;
    }
    if (params.subAppid) {
      requestData.sub_appid = params.subAppid;
    }
    if (params.param) {
      requestData.param = params.param;
    }

    // 生成签名
    const sign = this.generateSign(requestData);
    requestData.sign = sign;
    requestData.sign_type = this.config.signType || "RSA";

    try {
      // 确保正确的 URL 拼接，避免双斜杠问题
      const baseUrl = this.config.apiUrl.replace(/\/+$/, ''); // 移除尾部斜杠
      const apiEndpoint = `${baseUrl}/api/pay/create`;
      
      console.log('[EpayClient] 使用 v2 API 发起支付请求', {
        endpoint: apiEndpoint,
        pid: this.config.pid,
        method: params.method,
        amount: params.amount,
        orderNo: params.orderNo,
        payType: params.payType,
        timestamp: timestamp,
        signType: this.config.signType,
        signPreview: sign.substring(0, 8) + '...'
      });

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json, text/plain, */*",
          "User-Agent": "Saleor-Epay-Client/2.0"
        },
        body: new URLSearchParams(requestData).toString(),
      });

      console.log('[EpayClient] v2 API 响应状态', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type')
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          code: 0,
          msg: `HTTP Error: ${response.status} - ${errorText}`,
        };
      }

      const responseText = await response.text();
      console.log('[EpayClient] v2 API 原始响应', {
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 200)
      });

      const result = JSON.parse(responseText) as SubmitV2Response;

      console.log('[EpayClient] v2 解析后的响应', {
        code: result.code,
        msg: result.msg,
        payType: result.pay_type,
        hasPayInfo: !!result.pay_info,
        tradeNo: result.trade_no
      });

      // 根据 pay_type 处理不同的支付方式
      let payUrl: string | undefined;
      let qrcode: string | undefined;

      if (result.pay_info) {
        // 根据 pay_type 决定如何处理 pay_info 数据
        switch (result.pay_type) {
          case "jump":
            // 跳转支付: pay_info 直接是 URL 字符串
            payUrl = result.pay_info;
            console.log('[EpayClient] v2 跳转支付', {
              payType: result.pay_type,
              payUrl: payUrl
            });
            break;
            
          case "html":
            // HTML 代码支付: pay_info 是 HTML 代码字符串
            console.log('[EpayClient] v2 HTML 支付页面', {
              payType: result.pay_type,
              htmlLength: result.pay_info?.length || 0
            });
            // HTML 代码保存在 payInfo 中，前端可以直接渲染
            break;
            
          case "qrcode":
            // 二维码支付: pay_info 直接是二维码数据或URL
            qrcode = result.pay_info;
            console.log('[EpayClient] v2 二维码支付', {
              payType: result.pay_type,
              qrcode: qrcode
            });
            break;
            
          case "urlscheme":
            // URL Scheme 跳转: pay_info 直接是 scheme URL
            payUrl = result.pay_info;
            console.log('[EpayClient] v2 URL Scheme 跳转', {
              payType: result.pay_type,
              scheme: payUrl
            });
            break;
            
          case "jsapi":
          case "app":
          case "scan":
          case "wxplugin":
          case "wxapp":
            // 这些类型: pay_info 是 JSON 字符串，需要解析
            try {
              const payInfo = JSON.parse(result.pay_info);
              console.log('[EpayClient] v2 JSON 参数支付类型', {
                payType: result.pay_type,
                payInfo: payInfo
              });
              // 这些类型的参数保存在 payInfo 中，前端根据类型处理
            } catch (parseError) {
              console.warn('[EpayClient] v2 JSON 支付信息解析失败', {
                payType: result.pay_type,
                payInfo: result.pay_info,
                error: parseError
              });
            }
            break;
            
          default:
            console.warn('[EpayClient] v2 未知支付类型', {
              payType: result.pay_type,
              payInfo: result.pay_info
            });
            // 对于未知类型，尝试作为字符串处理
            if (result.pay_info && typeof result.pay_info === 'string') {
              if (result.pay_info.startsWith('http')) {
                payUrl = result.pay_info;
              } else if (result.pay_info.includes('://')) {
                payUrl = result.pay_info; // 可能是 scheme URL
              }
            }
        }
      }

      return {
        code: result.code || 0,
        msg: result.msg || "",
        payUrl: payUrl,
        tradeNo: result.trade_no,
        qrcode: qrcode,
        type: result.pay_type,
        
        // v2 特有字段
        payType: result.pay_type,
        payInfo: result.pay_info,
        timestamp: result.timestamp,
        sign: result.sign,
        signType: result.sign_type,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error('[EpayClient] v2 创建订单异常', {
        error: errorMessage
      });

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

    const signType = this.config.signType || "MD5";
    let sign: string;

    if (signType === "RSA") {
      // RSA 签名：对于 v2 API，通常使用 RSA-SHA256
      try {
        if (!this.config.rsaPrivateKey) {
          throw new Error("RSA 私钥未配置");
        }

        // 将易支付的 Base64 私钥转换为 PEM 格式
        let privateKeyPem = this.config.rsaPrivateKey.trim();
        
        // 如果不是 PEM 格式，则转换为 PEM 格式
        if (!privateKeyPem.startsWith('-----BEGIN')) {
          // 移除所有空白字符和换行符
          const base64Key = privateKeyPem.replace(/\s/g, '');
          // 转换为 PEM 格式
          privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${base64Key.match(/.{1,64}/g)?.join('\n') || base64Key}\n-----END PRIVATE KEY-----`;
        }

        // 对于 RSA 签名，不需要在最后添加 key，直接对 sortedParams 签名
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(sortedParams);
        sign = signer.sign(privateKeyPem, 'base64');
      } catch (error) {
        console.error('[EpayClient] RSA 签名失败:', error);
        // 如果 RSA 签名失败，抛出错误而不是降级
        throw new Error(`RSA 签名失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    } else {
      // MD5 签名：用于 v1 API
      const signString = sortedParams + this.config.key;
      sign = crypto.createHash("md5").update(signString).digest("hex");
    }
    
    // 调试日志
    console.log('[EpayClient] 签名生成详情', {
      filteredParams: Object.keys(params).filter((k) => k !== "sign" && k !== "sign_type" && params[k]),
      sortedParams,
      signType,
      keyLength: signType === "MD5" ? this.config.key.length : (this.config.rsaPrivateKey?.length || 0),
      signString: signType === "MD5" ? (sortedParams + this.config.key).substring(0, 50) + '...' : sortedParams,
      generatedSign: sign
    });
    
    return sign;
  }

  // 添加签名验证测试方法（用于调试）
  testSignGeneration(params: Record<string, string>): {
    params: Record<string, string>;
    sortedParams: string;
    signString: string;
    sign: string;
  } {
    const filteredParams: Record<string, string> = Object.keys(params)
      .filter((k) => k !== "sign" && k !== "sign_type" && params[k])
      .reduce((acc, k) => ({ ...acc, [k]: params[k] }), {} as Record<string, string>);
    
    const sortedParams = Object.keys(filteredParams)
      .sort()
      .map((k) => `${k}=${filteredParams[k]}`)
      .join("&");

    const signString = sortedParams + this.config.key;
    const sign = crypto.createHash("md5").update(signString).digest("hex");
    
    return {
      params: filteredParams,
      sortedParams,
      signString,
      sign
    };
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
    const signType = this.config.signType || "MD5";
    const params = new URLSearchParams({
      ...requestData,
      sign,
      sign_type: signType,
    });

    try {
      // 确保正确的 URL 拼接，避免双斜杠问题
      const baseUrl = this.config.apiUrl.replace(/\/+$/, ''); // 移除尾部斜杠
      const queryEndpoint = `${baseUrl}/api.php`;
      
      console.log('[EpayClient] 查询订单请求', {
        endpoint: queryEndpoint,
        pid: this.config.pid,
        act: requestData.act,
        useOutTradeNo,
        tradeNoOrOutTradeNo,
        signType,
        signPreview: sign.substring(0, 20) + '...'
      });
      
      const response = await fetch(`${queryEndpoint}?${params.toString()}`, {
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
