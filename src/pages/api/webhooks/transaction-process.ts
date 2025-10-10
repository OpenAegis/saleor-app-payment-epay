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
    const { action, transaction } = event as any;

    // 查询订单状态
    const result = await epayClient.queryOrder(transaction.id);

    if (result.status === 'success' && result.trade_status === 'TRADE_SUCCESS') {
      return res.status(200).json({
        result: 'CHARGE_SUCCESS',
        amount: action.amount,
        data: {
          epayTradeNo: result.trade_no,
        },
      });
    } else if (result.status === 'fail' || result.trade_status === 'TRADE_CLOSED') {
      return res.status(200).json({
        result: 'CHARGE_FAILURE',
        message: '支付失败或已关闭',
      });
    } else {
      return res.status(200).json({
        result: 'CHARGE_PENDING',
        message: '支付处理中',
      });
    }
  } catch (error: any) {
    console.error('Transaction process error:', error);
    return res.status(200).json({
      result: 'CHARGE_FAILURE',
      message: error.message,
    });
  }
}