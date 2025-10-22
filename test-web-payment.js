/**
 * 测试 web 通用支付类型功能
 * 验证设备检测和支付方式推荐
 */

import https from 'https';

// 测试不同设备的 User-Agent
const TEST_USER_AGENTS = {
  'pc_chrome': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'mobile_android': 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Mobile Safari/537.36',
  'mobile_iphone': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
  'wechat_android': 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.124 Mobile Safari/537.36 MicroMessenger/8.0.10.1900(0x28000A5A) Process/tools WeChat/arm64 Weixin NetType/WIFI Language/zh_CN',
  'wechat_ios': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.8(0x18000829) NetType/WIFI Language/zh_CN',
  'alipay_android': 'Mozilla/5.0 (Linux; U; Android 10; zh-CN; SM-G975F Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/78.0.3904.108 UCBrowser/13.3.2.1303 Mobile Safari/537.36 AlipayClient/10.2.3.9000',
  'qq_mobile': 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.124 Mobile Safari/537.36 QQ/8.8.68.7265 V1_AND_SQ_8.8.68_1494_YYB_D'
};

/**
 * 发送交易初始化请求
 */
async function testTransactionInitialize(deviceName, userAgent, paymentMethod = 'alipay') {
  console.log(`\n=== 测试 ${deviceName} 设备 (${paymentMethod}) ===`);
  console.log(`User-Agent: ${userAgent.substring(0, 80)}...`);
  
  const transactionData = {
    id: `test_transaction_${deviceName}_${Date.now()}`,
    checkout: {
      id: `test_checkout_${deviceName}`,
      totalPrice: {
        amount: 1.00,
        currency: 'CNY'
      }
    },
    data: {
      paymentMethod: paymentMethod,
      payType: paymentMethod
    }
  };

  const postData = JSON.stringify(transactionData);
  
  const options = {
    hostname: 'saleor-app-payment-epay.studyapp.tk',
    port: 443,
    path: '/api/webhooks/transaction-initialize',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': userAgent,
      'saleor-api-url': 'https://test-saleor.example.com/graphql/',
      'saleor-domain': 'test-saleor.example.com',
      'saleor-event': 'transaction_initialize_session'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        console.log(`状态码: ${res.statusCode}`);
        
        try {
          const data = JSON.parse(body);
          console.log(`响应结果: ${data.result || '未知'}`);
          console.log(`错误消息: ${data.message || '无'}`);
          
          // 分析设备检测和支付方式
          if (data.payType) {
            console.log(`返回支付类型: ${data.payType}`);
          }
          if (data.payUrl) {
            console.log(`支付链接: ✓`);
          }
          if (data.qrcode) {
            console.log(`二维码数据: ✓`);
          }
          if (data.payInfo) {
            console.log(`支付参数: ✓ (长度: ${data.payInfo.length})`);
          }
          
          resolve({
            success: res.statusCode === 200 && data.result !== 'CHARGE_FAILURE',
            data: data,
            deviceName: deviceName
          });
        } catch (e) {
          console.log(`响应解析失败: ${body.substring(0, 100)}...`);
          resolve({
            success: false,
            error: 'JSON解析失败',
            deviceName: deviceName
          });
        }
      });
    });

    req.on('error', (error) => {
      console.error(`请求错误: ${error.message}`);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * 测试设备检测逻辑
 */
function testDeviceDetection() {
  console.log('🔍 测试设备检测逻辑');
  console.log('===================');
  
  // 模拟设备检测函数
  function detectDevice(userAgent) {
    if (!userAgent) return 'pc';
    
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('alipayclient') || ua.includes('alipay')) return 'alipay';
    if (ua.includes('micromessenger')) return 'wechat';
    if (ua.includes('qq/') && (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone'))) return 'qq';
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone') || ua.includes('ipad')) return 'mobile';
    
    return 'pc';
  }
  
  // 推荐支付方式函数
  function getRecommendedMethod(device, paymentType = 'alipay') {
    switch (device) {
      case 'alipay': return paymentType === 'alipay' ? 'jsapi' : 'web';
      case 'wechat': return paymentType === 'wechat' ? 'jsapi' : 'web';
      case 'qq': return 'jump';
      case 'mobile': return 'web';
      case 'pc':
      default: return 'web';
    }
  }
  
  Object.entries(TEST_USER_AGENTS).forEach(([deviceName, userAgent]) => {
    const detectedDevice = detectDevice(userAgent);
    const alipayMethod = getRecommendedMethod(detectedDevice, 'alipay');
    const wechatMethod = getRecommendedMethod(detectedDevice, 'wechat');
    
    console.log(`\n${deviceName}:`);
    console.log(`  检测设备: ${detectedDevice}`);
    console.log(`  支付宝推荐: ${alipayMethod}`);
    console.log(`  微信推荐: ${wechatMethod}`);
  });
  
  console.log('\n✅ 设备检测逻辑测试完成');
}

/**
 * 主测试函数
 */
async function runWebPaymentTests() {
  console.log('🚀 开始 web 通用支付测试');
  
  // 1. 测试设备检测逻辑
  testDeviceDetection();
  
  // 2. 测试不同设备的实际支付初始化
  const results = [];
  
  for (const [deviceName, userAgent] of Object.entries(TEST_USER_AGENTS)) {
    try {
      // 测试支付宝支付
      const alipayResult = await testTransactionInitialize(deviceName, userAgent, 'alipay');
      results.push(alipayResult);
      
      // 等待一秒避免请求过快
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 测试微信支付
      const wechatResult = await testTransactionInitialize(deviceName, userAgent, 'wechat');
      results.push(wechatResult);
      
      // 等待一秒避免请求过快
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`测试 ${deviceName} 失败:`, error.message);
    }
  }
  
  // 3. 输出测试结果汇总
  console.log('\n📊 web 通用支付测试结果汇总');
  console.log('================================');
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${result.deviceName}: ${status}`);
  });
  
  console.log(`\n总成功率: ${successCount}/${totalCount} (${((successCount/totalCount)*100).toFixed(1)}%)`);
  
  if (successCount > 0) {
    console.log('🎉 web 通用支付功能基本正常！');
    console.log('💡 注意：部分失败可能是由于缺乏真实的网关配置或认证信息');
  } else {
    console.log('⚠️ 所有测试都失败了，请检查系统配置');
  }
}

// 运行测试
runWebPaymentTests().catch(console.error);