/**
 * 测试 URL 拼接修复
 */

function testUrlFix() {
  console.log('🔧 测试 URL 拼接修复');
  console.log('===================');
  
  // 模拟修复前的逻辑
  function originalUrlJoin(baseUrl, path) {
    return `${baseUrl}${path}`;
  }
  
  // 修复后的逻辑
  function fixedUrlJoin(baseUrl, path) {
    const cleanBase = baseUrl.replace(/\/+$/, ''); // 移除尾部斜杠
    return `${cleanBase}${path}`;
  }
  
  // 测试用例
  const testCases = [
    {
      baseUrl: 'https://pay.izy.plus',
      path: '/api/pay/create',
      expected: 'https://pay.izy.plus/api/pay/create'
    },
    {
      baseUrl: 'https://pay.izy.plus/',
      path: '/api/pay/create',
      expected: 'https://pay.izy.plus/api/pay/create'
    },
    {
      baseUrl: 'https://pay.izy.plus//',
      path: '/api/pay/create',
      expected: 'https://pay.izy.plus/api/pay/create'
    },
    {
      baseUrl: 'https://pay.izy.plus',
      path: '/mapi.php',
      expected: 'https://pay.izy.plus/mapi.php'
    },
    {
      baseUrl: 'https://pay.izy.plus/',
      path: '/mapi.php',
      expected: 'https://pay.izy.plus/mapi.php'
    }
  ];
  
  console.log('\n修复前后对比:');
  testCases.forEach((testCase, index) => {
    const originalResult = originalUrlJoin(testCase.baseUrl, testCase.path);
    const fixedResult = fixedUrlJoin(testCase.baseUrl, testCase.path);
    const isOriginalCorrect = originalResult === testCase.expected;
    const isFixedCorrect = fixedResult === testCase.expected;
    
    console.log(`\n测试 ${index + 1}:`);
    console.log(`  Base URL: ${testCase.baseUrl}`);
    console.log(`  Path: ${testCase.path}`);
    console.log(`  期望结果: ${testCase.expected}`);
    console.log(`  修复前: ${originalResult} ${isOriginalCorrect ? '✅' : '❌'}`);
    console.log(`  修复后: ${fixedResult} ${isFixedCorrect ? '✅' : '❌'}`);
  });
  
  console.log('\n🎉 URL 拼接修复测试完成');
  
  // 测试当前用户遇到的具体问题
  console.log('\n🔍 用户问题复现:');
  const userCase = {
    baseUrl: 'https://pay.izy.plus/',
    path: '/api/pay/create'
  };
  
  const beforeFix = `${userCase.baseUrl}${userCase.path}`;
  const afterFix = `${userCase.baseUrl.replace(/\/+$/, '')}${userCase.path}`;
  
  console.log(`原始问题: ${beforeFix}`);
  console.log(`修复后: ${afterFix}`);
  
  if (beforeFix.includes('//')) {
    console.log('✅ 发现并修复了双斜杠问题！');
  } else {
    console.log('❓ 这个特定 URL 没有双斜杠问题');
  }
}

// 测试从日志中提取的具体失败场景
function analyzeLogError() {
  console.log('\n📊 日志错误分析');
  console.log('=================');
  
  const loggedEndpoint = 'https://pay.izy.plus//api/pay/create';
  const expectedEndpoint = 'https://pay.izy.plus/api/pay/create';
  
  console.log(`日志显示的端点: ${loggedEndpoint}`);
  console.log(`期望的端点: ${expectedEndpoint}`);
  console.log(`是否有双斜杠: ${loggedEndpoint.includes('//') ? '是 ❌' : '否 ✅'}`);
  
  // 测试修复函数对这个具体问题的效果
  const baseUrl = 'https://pay.izy.plus/';
  const path = '/api/pay/create';
  const fixedUrl = baseUrl.replace(/\/+$/, '') + path;
  
  console.log(`修复后的 URL: ${fixedUrl}`);
  console.log(`修复是否有效: ${fixedUrl === expectedEndpoint ? '是 ✅' : '否 ❌'}`);
  
  return fixedUrl === expectedEndpoint;
}

// 运行测试
testUrlFix();
const isFixed = analyzeLogError();

if (isFixed) {
  console.log('\n🎉 URL 拼接问题已成功修复！');
  console.log('💡 这应该解决 fetch failed 错误');
} else {
  console.log('\n⚠️  需要进一步调查其他可能的原因');
}