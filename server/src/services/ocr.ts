import { config } from '../config';
import crypto from 'crypto';

export interface InvoiceData {
  invoiceNumber: string;
  sellerName: string;
  buyerName: string;
  sellerTaxId: string;
  buyerTaxId: string;
  sellerBankAccount: string;
  category: string;
  amount: number;
}

// 用户勾选的分类
let userSelectedCategory: string = '通用';

export const setUserCategory = (category: string) => {
  userSelectedCategory = category;
};

export const getUserCategory = () => userSelectedCategory;

const OCR_TIMEOUT = 30000; // 30秒超时

// 直接调用阿里云REST API - OCR统一识别服务
const callAliyunAPI = async (imageBase64: string): Promise<any> => {
  const { accessKeyId, accessKeySecret } = config.aliyun;

  // 生成签名
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const signatureNonce = crypto.randomUUID();

  // 公共参数 - Type使用 Invoice（增值税发票）
  const commonParams = {
    AccessKeyId: accessKeyId,
    Action: 'RecognizeAllText',
    Format: 'JSON',
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: signatureNonce,
    SignatureVersion: '1.0',
    Timestamp: timestamp,
    Type: 'Invoice',  // 增值税发票
    Version: '2021-07-07',
  };

  // 按字母顺序排序并构建签名串
  const sortedParams = Object.entries(commonParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const stringToSign = `POST&%2F&${encodeURIComponent(sortedParams)}`;
  const signature = crypto
    .createHmac('sha1', accessKeySecret + '&')
    .update(stringToSign)
    .digest('base64');

  // 构建最终URL
  const url = `https://ocr-api.cn-hangzhou.aliyuncs.com/?Signature=${encodeURIComponent(signature)}&${sortedParams}`;

  // 解码base64为Buffer，使用body参数传图片或PDF
  const fileBuffer = Buffer.from(imageBase64, 'base64');

  // 添加超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OCR_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Accept': 'application/json',
      },
      body: fileBuffer,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`API调用失败: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('发票识别超时，请重试');
    }
    throw error;
  }
};

export const extractInvoiceData = async (imageBase64: string): Promise<InvoiceData> => {
  try {
    const result = await callAliyunAPI(imageBase64);

    const data = result.Data;
    if (!data || !data.SubImages || data.SubImages.length === 0) {
      throw new Error('未能识别到发票内容');
    }

    const subImage = data.SubImages[0];

    // KV信息可能是字符串，需要解析
    let kvInfo: any = subImage.KvInfo?.Data || {};
    if (typeof kvInfo === 'string') {
      try {
        kvInfo = JSON.parse(kvInfo);
      } catch (e) {
        kvInfo = {};
      }
    }

    // 提取各字段
    const invoiceNumber = kvInfo.invoiceNumber || kvInfo.invoiceCode || kvInfo.invoiceNumber || '';
    const sellerName = kvInfo.sellerName || kvInfo.salesName || '';
    const buyerName = kvInfo.purchaserName || kvInfo.buyerName || '';
    const sellerTaxId = kvInfo.sellerTaxNumber || kvInfo.sellerRegisterNo || '';
    const buyerTaxId = kvInfo.purchaserTaxNumber || kvInfo.buyerTaxId || '';
    const sellerBankAccount = kvInfo.sellerBankAccountInfo || kvInfo.sellerBankAccount || '';

    // 金额处理
    let amount = 0;
    if (kvInfo.totalAmount) {
      amount = parseFloat(kvInfo.totalAmount) || 0;
    } else if (kvInfo.invoiceAmountPreTax) {
      amount = parseFloat(kvInfo.invoiceAmountPreTax) || 0;
    }

    return {
      invoiceNumber,
      sellerName,
      buyerName,
      sellerTaxId,
      buyerTaxId,
      sellerBankAccount,
      category: userSelectedCategory,
      amount,
    };
  } catch (error: any) {
    console.error('OCR API Error:', error);
    throw new Error('发票识别失败: ' + (error.message || '未知错误'));
  }
};
