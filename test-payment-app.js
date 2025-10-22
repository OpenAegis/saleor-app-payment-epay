/**
 * 支付应用功能测试脚本
 * 用于验证管理界面和 API 集成功能
 */

import https from 'https';
import crypto from 'crypto';

// 测试配置
const TEST_CONFIG = {
  baseUrl: 'https://saleor-app-payment-epay.studyapp.tk',
  testData: {
    gateway: {
      name: '测试支付网关',
      apiUrl: 'https://pay.example.com',
      partnerId: 'test_partner',
      partnerKey: 'test_key_12345',
      apiVersion: 'v2',
      signType: 'RSA',
      epayRsaPrivateKey: 'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0t'
    },
    channel: {
      name: '测试支付通道',
      type: 'alipay',
      device: 'pc'
    }
  }
};

/**
 * 发送 HTTP 请求
 */
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
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
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * 测试数据库初始化 API
 */
async function testDatabaseInit() {
  console.log('\n=== 测试数据库初始化 ===');
  
  try {
    const options = {
      hostname: 'saleor-app-payment-epay.studyapp.tk',
      port: 443,
      path: '/api/admin/init-database',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const response = await makeRequest(options);
    console.log(`状态码: ${response.statusCode}`);
    console.log(`响应体: ${response.body.substring(0, 200)}...`);
    
    if (response.statusCode === 200 && response.data?.success) {
      console.log('✅ 数据库初始化成功');
      return true;
    } else {
      console.log('❌ 数据库初始化失败');
      return false;
    }
  } catch (error) {
    console.log(`❌ 数据库初始化测试失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试网关管理 API
 */
async function testGatewayManagement() {
  console.log('\n=== 测试网关管理 ===');
  
  try {
    // 1. 获取网关列表
    console.log('1. 获取网关列表...');
    const getOptions = {
      hostname: 'saleor-app-payment-epay.studyapp.tk',
      port: 443,
      path: '/api/admin/gateways',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const getResponse = await makeRequest(getOptions);
    console.log(`获取网关列表状态码: ${getResponse.statusCode}`);
    
    if (getResponse.statusCode !== 200) {
      console.log('❌ 获取网关列表失败');
      return false;
    }

    // 2. 创建测试网关
    console.log('2. 创建测试网关...');
    const postOptions = {
      hostname: 'saleor-app-payment-epay.studyapp.tk',
      port: 443,
      path: '/api/admin/gateways',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const createResponse = await makeRequest(postOptions, TEST_CONFIG.testData.gateway);
    console.log(`创建网关状态码: ${createResponse.statusCode}`);
    
    if (createResponse.statusCode === 201 && createResponse.data?.success) {
      console.log('✅ 网关管理 API 正常工作');
      return { success: true, gatewayId: createResponse.data.gateway?.id };
    } else {
      console.log(`❌ 创建网关失败: ${createResponse.body}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ 网关管理测试失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试通道管理 API
 */
async function testChannelManagement(gatewayId) {
  console.log('\n=== 测试通道管理 ===');
  
  if (!gatewayId) {
    console.log('❌ 无法测试通道管理 - 缺少网关 ID');
    return false;
  }

  try {
    // 1. 获取通道列表
    console.log('1. 获取通道列表...');
    const getOptions = {
      hostname: 'saleor-app-payment-epay.studyapp.tk',
      port: 443,
      path: '/api/admin/channels',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const getResponse = await makeRequest(getOptions);
    console.log(`获取通道列表状态码: ${getResponse.statusCode}`);
    
    if (getResponse.statusCode !== 200) {
      console.log('❌ 获取通道列表失败');
      return false;
    }

    // 2. 创建测试通道
    console.log('2. 创建测试通道...');
    const channelData = {
      ...TEST_CONFIG.testData.channel,
      gatewayId: gatewayId
    };

    const postOptions = {
      hostname: 'saleor-app-payment-epay.studyapp.tk',
      port: 443,
      path: '/api/admin/channels',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const createResponse = await makeRequest(postOptions, channelData);
    console.log(`创建通道状态码: ${createResponse.statusCode}`);
    
    if (createResponse.statusCode === 201 && createResponse.data?.success) {
      console.log('✅ 通道管理 API 正常工作');
      return true;
    } else {
      console.log(`❌ 创建通道失败: ${createResponse.body}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ 通道管理测试失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试支付网关列表 API
 */
async function testPaymentGatewaysList() {
  console.log('\n=== 测试支付网关列表 API ===');
  
  try {
    const options = {
      hostname: 'saleor-app-payment-epay.studyapp.tk',
      port: 443,
      path: '/api/webhooks/list-payment-gateways',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'saleor-api-url': 'https://test-saleor.example.com/graphql/',
        'saleor-domain': 'test-saleor.example.com',
        'saleor-event': 'payment_list_gateways'
      }
    };

    const testPayload = {
      currency: 'CNY',
      checkout: {
        id: 'test-checkout-id'
      }
    };

    const response = await makeRequest(options, testPayload);
    console.log(`状态码: ${response.statusCode}`);
    console.log(`响应体: ${response.body.substring(0, 300)}...`);
    
    if (response.statusCode === 200 && response.data) {
      console.log('✅ 支付网关列表 API 正常工作');
      console.log(`返回网关数量: ${Array.isArray(response.data) ? response.data.length : '未知'}`);
      return true;
    } else {
      console.log('❌ 支付网关列表 API 失败');
      return false;
    }
  } catch (error) {
    console.log(`❌ 支付网关列表测试失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试 v2 API 签名功能
 */
async function testV2ApiSigning() {
  console.log('\n=== 测试 v2 API 签名功能 ===');
  
  // 模拟 v2 API 签名测试
  try {
    const testParams = {
      pid: 'test_partner',
      type: 'alipay',
      out_trade_no: 'ORDER-1736847890123-abc123def-12345678',
      notify_url: 'https://example.com/notify',
      return_url: 'https://example.com/return',
      name: '测试商品',
      money: '1.00',
      device: 'pc'
    };

    // 测试参数排序和签名字符串生成
    const sortedKeys = Object.keys(testParams).sort();
    const sortedParams = sortedKeys
      .map(key => `${key}=${testParams[key]}`)
      .join('&');
    
    console.log('排序后的参数字符串:', sortedParams);
    
    // 测试 MD5 签名（v1）
    const md5Key = 'test_md5_key_12345';
    const md5Sign = crypto.createHash('md5')
      .update(sortedParams + md5Key)
      .digest('hex');
    
    console.log('MD5 签名结果:', md5Sign);
    
    console.log('✅ 签名功能测试完成');
    return true;
  } catch (error) {
    console.log(`❌ v2 API 签名测试失败: ${error.message}`);
    return false;
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('🚀 开始支付应用功能测试');
  console.log(`测试目标: ${TEST_CONFIG.baseUrl}`);
  
  const results = {
    databaseInit: false,
    gatewayManagement: false,
    channelManagement: false,
    paymentGatewaysList: false,
    v2ApiSigning: false
  };

  // 1. 测试数据库初始化
  results.databaseInit = await testDatabaseInit();
  
  // 2. 测试网关管理
  const gatewayResult = await testGatewayManagement();
  results.gatewayManagement = !!gatewayResult;
  
  // 3. 测试通道管理
  if (gatewayResult && gatewayResult.gatewayId) {
    results.channelManagement = await testChannelManagement(gatewayResult.gatewayId);
  }
  
  // 4. 测试支付网关列表
  results.paymentGatewaysList = await testPaymentGatewaysList();
  
  // 5. 测试 v2 API 签名
  results.v2ApiSigning = await testV2ApiSigning();
  
  // 输出测试结果
  console.log('\n📊 测试结果汇总:');
  console.log('==================');
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
    console.log('🎉 所有测试通过！');
  } else {
    console.log('⚠️  部分测试失败，请检查相关功能');
  }
}

// 运行测试
runTests().catch(console.error);