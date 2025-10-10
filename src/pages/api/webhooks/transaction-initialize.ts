import { NextApiRequest, NextApiResponse } from 'next';
import { epayClient } from '../../../lib/epay/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { event } = req.body;
    const { action } = event as any;

    // 创建彩虹易支付订单
    const orderNo = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await epayClient.createOrder({
      amount: parseFloat(action.amount),
      orderNo,
      notifyUrl: `${process.env.APP_URL}/api/webhooks/epay-notify`,
      returnUrl: `${process.env.STOREFRONT_URL}/checkout/success`,
      payType: 'alipay', // 或从前端传入
      productName: '订单支付',
    });

    if (result.code === 1 && result.payUrl) {
      // 返回支付链接
      return res.status(200).json({
        result: 'CHARGE_ACTION_REQUIRED',
        amount: action.amount,
        data: {
          paymentUrl: result.payUrl,
          epayOrderNo: result.tradeNo,
          saleorOrderNo: orderNo,
        },
      });
    }

    return res.status(200).json({
      result: 'CHARGE_FAILURE',
      message: result.msg || '创建支付订单失败',
    });
  } catch (error: any) {
    console.error('Transaction initialize error:', error);
    return res.status(200).json({
      result: 'CHARGE_FAILURE',
      message: error.message,
    });
  }
}