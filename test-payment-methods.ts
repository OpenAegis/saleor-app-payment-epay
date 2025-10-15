// 模拟支付通道数据用于测试
const mockChannels = [
  {
    id: "alipay-channel-1",
    name: "支付宝支付",
    type: "alipay",
  },
  {
    id: "wxpay-channel-1",
    name: "微信支付",
    type: "wxpay",
  },
];

console.log("Mock enabled channels:", mockChannels);

const paymentMethods = mockChannels.map((channel) => ({
  id: channel.id,
  name: channel.name,
  currencies: ["CNY"],
  config: [],
}));

console.log("Payment methods to return:", paymentMethods);

const responseData = {
  paymentMethodsResponse: {
    paymentMethods,
  },
  clientKey: "epay-client-key",
  environment: "LIVE",
};

const response = {
  data: responseData,
};

console.log("Response to send:", JSON.stringify(response, null, 2));
