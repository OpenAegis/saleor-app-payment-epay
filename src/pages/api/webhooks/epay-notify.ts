import { NextApiRequest, NextApiResponse } from 'next';
import { epayClient } from '../../../lib/epay/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).send('fail');
  }

  try {
    const params = req.body as Record<string, string>;

    // 验证签名
    if (!epayClient.verifyNotify(params)) {
      console.error('签名验证失败');
      return res.status(200).send('fail');
    }

    // 检查支付状态
    if (params.trade_status === 'TRADE_SUCCESS') {
      // 支付成功，更新 Saleor 订单
      // 这里需要调用 Saleor transactionEventReport mutation
      
      console.log('支付成功:', {
        orderNo: params.out_trade_no,
        tradeNo: params.trade_no,
        amount: params.money,
      });

      return res.status(200).send('success');
    }

    return res.status(200).send('fail');
  } catch (error: any) {
    console.error('Notify handler error:', error);
    return res.status(200).send('fail');
  }
}