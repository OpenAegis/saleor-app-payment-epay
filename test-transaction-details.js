/**
 * 详细测试交易初始化 API
 * 获取具体错误信息
 */

import https from 'https';

// 测试交易初始化的详细错误信息
async function testTransactionDetails() {
  console.log('🔍 测试交易初始化详细错误信息');
  
  const transactionData = {
    id: 'test_transaction_' + Date.now(),
    checkout: {
      id: 'test_checkout_id',
      totalPrice: {
        amount: 1.00,
        currency: 'CNY'
      }
    },
    data: {
      paymentMethod: 'alipay',
      device: 'pc'
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
        console.log(`响应头:`, res.headers);
        console.log(`完整响应体:`, body);
        
        try {
          const data = JSON.parse(body);
          console.log(`解析后的数据:`, JSON.stringify(data, null, 2));
        } catch (e) {
          console.log('响应不是有效的 JSON');
        }
        
        resolve({ statusCode: res.statusCode, body, headers: res.headers });
      });
    });

    req.on('error', (error) => {
      console.error('请求错误:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// 测试回调处理的详细错误信息
async function testNotifyDetails() {
  console.log('\n🔍 测试回调处理详细错误信息');
  
  const notifyData = {
    pid: 'test_partner',
    trade_no: 'EPAY' + Date.now(),
    out_trade_no: 'ORDER-' + Date.now() + '-test123-12345678',
    type: 'alipay',
    name: '测试商品',
    money: '1.00',
    trade_status: 'TRADE_SUCCESS',
    sign: 'test_signature'
  };

  const formData = Object.keys(notifyData)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(notifyData[key])}`)
    .join('&');
  
  const options = {
    hostname: 'saleor-app-payment-epay.studyapp.tk',
    port: 443,
    path: '/api/webhooks/epay-notify',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(formData)
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
        console.log(`响应头:`, res.headers);
        console.log(`完整响应体:`, body);
        
        resolve({ statusCode: res.statusCode, body, headers: res.headers });
      });
    });

    req.on('error', (error) => {
      console.error('请求错误:', error);
      reject(error);
    });

    req.write(formData);
    req.end();
  });
}

// 运行详细测试
async function runDetailedTests() {
  try {
    await testTransactionDetails();
    await testNotifyDetails();
  } catch (error) {
    console.error('测试失败:', error);
  }
}

runDetailedTests();