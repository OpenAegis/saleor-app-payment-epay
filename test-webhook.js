/**
 * 测试 transaction-initialize webhook 的请求体格式
 */

const WEBHOOK_URL = 'https://saleor-app-payment-epay.studyapp.tk/api/webhooks/transaction-initialize';

// 模拟不同格式的请求体
const testCases = [
  {
    name: "标准格式 - 包含 event 属性",
    body: {
      event: {
        action: {
          amount: "100.00",
          paymentMethodType: "alipay"
        },
        transaction: {
          id: "test-transaction-123"
        },
        sourceObject: {
          number: "ORDER-001",
          lines: [
            {
              productName: "测试商品"
            }
          ]
        },
        data: {
          channelId: "test-channel",
          payType: "alipay"
        }
      }
    }
  },
  {
    name: "直接格式 - 不包含 event 包装",
    body: {
      action: {
        amount: "100.00",
        paymentMethodType: "alipay"
      },
      transaction: {
        id: "test-transaction-456"
      },
      sourceObject: {
        number: "ORDER-002",
        lines: [
          {
            productName: "测试商品2"
          }
        ]
      },
      data: {
        channelId: "test-channel",
        payType: "alipay"
      }
    }
  },
  {
    name: "无效格式 - 缺少必要属性",
    body: {
      invalid: "data"
    }
  },
  {
    name: "空请求体",
    body: null
  }
];

async function testWebhook(testCase) {
  console.log(`\n=== 测试: ${testCase.name} ===`);
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'saleor-api-url': 'https://api.lzsm.shop/graphql/',
        'authorization': 'Bearer test-token',
        'user-agent': 'Saleor/3.22'
      },
      body: testCase.body ? JSON.stringify(testCase.body) : undefined
    });

    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    console.log(`状态码: ${response.status}`);
    console.log(`响应:`, responseData);

    // 检查响应格式
    if (responseData && typeof responseData === 'object') {
      console.log(`结果: ${responseData.result || '未知'}`);
      console.log(`金额: ${responseData.amount || '未知'}`);
      console.log(`消息: ${responseData.message || '无消息'}`);
    }

  } catch (error) {
    console.log(`请求失败: ${error.message}`);
  }
}

async function runTests() {
  console.log('开始测试 transaction-initialize webhook...');
  console.log(`Webhook URL: ${WEBHOOK_URL}`);
  
  for (const testCase of testCases) {
    await testWebhook(testCase);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
  }
  
  console.log('\n=== 测试完成 ===');
  console.log('请检查支付应用的日志输出，确认:');
  console.log('1. 请求体被正确解析');
  console.log('2. 错误处理按预期工作');
  console.log('3. 日志包含完整的请求信息');
}

// 在 Node.js 中运行
if (typeof window === 'undefined') {
  runTests().catch(console.error);
} else {
  // 在浏览器中运行
  window.testWebhook = runTests;
  console.log('测试函数已加载，运行 testWebhook() 开始测试');
}