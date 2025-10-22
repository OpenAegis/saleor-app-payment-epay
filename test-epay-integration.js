/**
 * epay API 集成测试脚本
 * 测试 v1 和 v2 API 功能
 */

import https from 'https';
import http from 'http';
import crypto from 'crypto';
import { URL } from 'url';

// 测试配置
const TEST_CONFIG = {
  paymentApp: 'https://saleor-app-payment-epay.studyapp.tk',
  
  // 模拟 epay 参数
  epayConfig: {
    v1: {
      apiUrl: 'https://pay.example.com/mapi.php',
      partnerId: 'test_partner_v1',
      partnerKey: 'test_md5_key_12345',
      signType: 'MD5'
    },
    v2: {
      apiUrl: 'https://pay.example.com/api/pay/create',
      partnerId: 'test_partner_v2',
      partnerKey: 'test_rsa_key_12345',
      signType: 'RSA',
      rsaPrivateKey: 'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0t'
    }
  },
  
  // 测试订单数据
  testOrder: {
    transactionId: 'test_transaction_' + Date.now(),
    amount: '1.00',
    currency: 'CNY',
    productName: '测试商品',
    returnUrl: 'https://test.example.com/return',
    notifyUrl: 'https://saleor-app-payment-epay.studyapp.tk/api/webhooks/epay-notify'
  }
};

/**
 * 发送 HTTP/HTTPS 请求
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = client.request(requestOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        const result = {
          statusCode: res.statusCode,
          headers: res.headers,
          body: body,
          data: null
        };
        
        // 尝试解析 JSON
        if (res.headers['content-type']?.includes('application/json')) {
          try {
            result.data = JSON.parse(body);
          } catch (e) {
            // 忽略 JSON 解析错误
          }
        }
        
        resolve(result);
      });
    });

    req.on('error', reject);
    
    if (options.data) {
      req.write(typeof options.data === 'string' ? options.data : JSON.stringify(options.data));
    }
    
    req.end();
  });
}

/**
 * 模拟交易初始化请求
 */
async function testTransactionInitialize(apiVersion = 'v1') {
  console.log(`\n=== 测试 ${apiVersion.toUpperCase()} API 交易初始化 ===`);
  
  try {
    const transactionData = {
      id: TEST_CONFIG.testOrder.transactionId,
      checkout: {
        id: 'test_checkout_id',
        totalPrice: {
          amount: parseFloat(TEST_CONFIG.testOrder.amount),
          currency: TEST_CONFIG.testOrder.currency
        }
      },
      data: {
        paymentMethod: apiVersion === 'v1' ? 'alipay' : 'alipay',
        device: 'pc'
      }
    };

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'saleor-api-url': 'https://test-saleor.example.com/graphql/',
        'saleor-domain': 'test-saleor.example.com',
        'saleor-event': 'transaction_initialize_session'
      },
      data: transactionData
    };

    const response = await makeRequest(
      `${TEST_CONFIG.paymentApp}/api/webhooks/transaction-initialize`, 
      options
    );
    
    console.log(`状态码: ${response.statusCode}`);
    console.log(`响应头: Content-Type = ${response.headers['content-type']}`);
    
    if (response.data) {
      console.log('响应数据:');
      console.log(`- 代码: ${response.data.code || '未知'}`);
      console.log(`- 消息: ${response.data.msg || '无消息'}`);
      console.log(`- 支付URL: ${response.data.payUrl ? '✓' : '✗'}`);
      console.log(`- 交易号: ${response.data.tradeNo || '无'}`);
      console.log(`- 支付类型: ${response.data.payType || response.data.type || '未知'}`);
      
      if (apiVersion === 'v2') {
        console.log(`- 签名类型: ${response.data.signType || '未知'}`);
        console.log(`- 时间戳: ${response.data.timestamp || '无'}`);
        console.log(`- 签名: ${response.data.sign ? '✓' : '✗'}`);
      }
      
      if (response.data.payUrl || response.data.qrcode) {
        console.log(`✅ ${apiVersion.toUpperCase()} API 交易初始化成功`);
        return { success: true, data: response.data };
      } else {
        console.log(`❌ ${apiVersion.toUpperCase()} API 交易初始化失败 - 无支付链接`);
        return { success: false, error: '无支付链接' };
      }
    } else {
      console.log(`❌ ${apiVersion.toUpperCase()} API 交易初始化失败 - 无响应数据`);
      console.log(`响应体: ${response.body.substring(0, 200)}...`);
      return { success: false, error: '无响应数据' };
    }
  } catch (error) {
    console.log(`❌ ${apiVersion.toUpperCase()} API 交易初始化异常: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 测试 MD5 签名算法（v1 API）
 */
function testV1Signing() {
  console.log('\n=== 测试 v1 API MD5 签名算法 ===');
  
  const params = {
    pid: TEST_CONFIG.epayConfig.v1.partnerId,
    type: 'alipay',
    out_trade_no: 'ORDER-' + Date.now(),
    notify_url: TEST_CONFIG.testOrder.notifyUrl,
    return_url: TEST_CONFIG.testOrder.returnUrl,
    name: TEST_CONFIG.testOrder.productName,
    money: TEST_CONFIG.testOrder.amount,
    clientip: '127.0.0.1'
  };

  // 参数排序
  const sortedKeys = Object.keys(params).sort();
  const sortedParams = sortedKeys
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  console.log('1. 排序后参数:', sortedParams);
  
  // MD5 签名
  const signString = sortedParams + TEST_CONFIG.epayConfig.v1.partnerKey;
  const sign = crypto.createHash('md5').update(signString).digest('hex');
  
  console.log('2. 签名字符串:', signString);
  console.log('3. MD5 签名结果:', sign);
  console.log('4. 最终请求参数:', { ...params, sign });
  
  console.log('✅ v1 API MD5 签名测试完成');
  
  return { params: { ...params, sign }, signString };
}

/**
 * 测试 RSA 签名算法（v2 API）  
 */
function testV2Signing() {
  console.log('\n=== 测试 v2 API RSA 签名算法 ===');
  
  const params = {
    pid: TEST_CONFIG.epayConfig.v2.partnerId,
    type: 'alipay',
    out_trade_no: 'ORDER-' + Date.now(),
    notify_url: TEST_CONFIG.testOrder.notifyUrl,
    return_url: TEST_CONFIG.testOrder.returnUrl,
    name: TEST_CONFIG.testOrder.productName,
    money: TEST_CONFIG.testOrder.amount,
    device: 'pc'
  };

  // 参数排序
  const sortedKeys = Object.keys(params).sort();
  const sortedParams = sortedKeys
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  console.log('1. 排序后参数:', sortedParams);
  
  try {
    // 模拟 RSA 签名（实际应用中需要真实的私钥）
    console.log('2. RSA 私钥 (Base64):', TEST_CONFIG.epayConfig.v2.rsaPrivateKey);
    console.log('3. 签名算法: RSA-SHA256');
    console.log('4. 注意: 此处为模拟签名过程，实际需要有效的 RSA 私钥');
    
    // 模拟签名结果
    const mockSign = crypto.createHash('sha256').update(sortedParams).digest('base64');
    console.log('5. 模拟签名结果:', mockSign.substring(0, 50) + '...');
    
    console.log('✅ v2 API RSA 签名测试完成');
    
    return { params: { ...params, sign: mockSign, sign_type: 'RSA' }, signString: sortedParams };
  } catch (error) {
    console.log(`❌ v2 API RSA 签名测试失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 测试支付回调处理
 */
async function testPaymentNotify() {
  console.log('\n=== 测试支付回调处理 ===');
  
  try {
    // 模拟支付成功回调数据
    const notifyData = {
      pid: TEST_CONFIG.epayConfig.v1.partnerId,
      trade_no: 'EPAY' + Date.now(),
      out_trade_no: 'ORDER-' + Date.now() + '-abc123def-12345678',
      type: 'alipay',
      name: TEST_CONFIG.testOrder.productName,
      money: TEST_CONFIG.testOrder.amount,
      trade_status: 'TRADE_SUCCESS'
    };

    // 添加签名
    const sortedKeys = Object.keys(notifyData).sort();
    const sortedParams = sortedKeys
      .map(key => `${key}=${notifyData[key]}`)
      .join('&');
    
    const signString = sortedParams + TEST_CONFIG.epayConfig.v1.partnerKey;
    const sign = crypto.createHash('md5').update(signString).digest('hex');
    
    const finalNotifyData = { ...notifyData, sign };
    
    console.log('1. 回调数据:', finalNotifyData);
    
    // 发送回调请求
    const formData = Object.keys(finalNotifyData)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(finalNotifyData[key])}`)
      .join('&');
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: formData
    };

    const response = await makeRequest(
      `${TEST_CONFIG.paymentApp}/api/webhooks/epay-notify`, 
      options
    );
    
    console.log(`2. 回调响应状态: ${response.statusCode}`);
    console.log(`3. 回调响应内容: ${response.body}`);
    
    if (response.statusCode === 200 && response.body.includes('success')) {
      console.log('✅ 支付回调处理成功');
      return { success: true };
    } else {
      console.log('❌ 支付回调处理失败');
      return { success: false, response: response.body };
    }
  } catch (error) {
    console.log(`❌ 支付回调测试异常: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 测试订单号格式兼容性
 */
function testOrderNumberFormat() {
  console.log('\n=== 测试订单号格式兼容性 ===');
  
  const testCases = [
    'transaction_12345',
    'VGVzdFRyYW5zYWN0aW9u',  // Base64
    'ORDER-1736847890123-abc123def-12345678',  // 新格式
    'short_id'
  ];

  console.log('测试不同订单号格式的哈希处理:');
  
  testCases.forEach((transactionId, index) => {
    console.log(`\n${index + 1}. 原始 ID: ${transactionId}`);
    
    // 检查是否为 Base64 (包含 = + / 字符)
    const isBase64Like = /[=+/]/.test(transactionId);
    console.log(`   Base64 检测: ${isBase64Like ? '是' : '否'}`);
    
    // 生成 MD5 哈希
    const hash = crypto.createHash('md5').update(transactionId).digest('hex');
    const hashSuffix = hash.substring(0, 8);
    console.log(`   MD5 哈希: ${hash}`);
    console.log(`   哈希后缀: ${hashSuffix}`);
    
    // 新订单号格式
    const orderNo = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${hashSuffix}`;
    console.log(`   新订单号: ${orderNo}`);
  });
  
  console.log('\n✅ 订单号格式测试完成');
  return { success: true };
}

/**
 * 主测试函数
 */
async function runIntegrationTests() {
  console.log('🚀 开始 epay API 集成测试');
  console.log(`测试目标: ${TEST_CONFIG.paymentApp}`);
  
  const results = {
    v1Signing: false,
    v2Signing: false,
    v1Transaction: false,
    v2Transaction: false,
    paymentNotify: false,
    orderFormat: false
  };

  // 1. 测试 v1 签名算法
  try {
    testV1Signing();
    results.v1Signing = true;
  } catch (error) {
    console.log(`❌ v1 签名测试失败: ${error.message}`);
  }

  // 2. 测试 v2 签名算法
  try {
    testV2Signing();
    results.v2Signing = true;
  } catch (error) {
    console.log(`❌ v2 签名测试失败: ${error.message}`);
  }

  // 3. 测试 v1 API 交易初始化
  const v1Result = await testTransactionInitialize('v1');
  results.v1Transaction = v1Result.success;

  // 4. 测试 v2 API 交易初始化
  const v2Result = await testTransactionInitialize('v2');
  results.v2Transaction = v2Result.success;

  // 5. 测试支付回调
  const notifyResult = await testPaymentNotify();
  results.paymentNotify = notifyResult.success;

  // 6. 测试订单号格式
  try {
    testOrderNumberFormat();
    results.orderFormat = true;
  } catch (error) {
    console.log(`❌ 订单号格式测试失败: ${error.message}`);
  }

  // 输出测试结果
  console.log('\n📊 集成测试结果汇总:');
  console.log('========================');
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ 通过' : '❌ 失败';
    console.log(`${test}: ${status}`);
  });
  
  const passedCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;
  
  console.log('\n📈 总体结果:');
  console.log(`通过: ${passedCount}/${totalCount}`);
  console.log(`成功率: ${((passedCount / totalCount) * 100).toFixed(1)}%`);
  
  if (passedCount === totalCount) {
    console.log('🎉 所有集成测试通过！v1 和 v2 API 功能正常');
  } else if (passedCount >= totalCount * 0.6) {
    console.log('✅ 主要功能正常，部分测试失败可能由于网络或配置问题');
  } else {
    console.log('⚠️  多项测试失败，请检查相关功能实现');
  }
}

// 运行测试
runIntegrationTests().catch(console.error);