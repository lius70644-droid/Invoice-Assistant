import { Router } from 'express';
import { extractInvoiceData, setUserCategory } from '../services/ocr';
import { config } from '../config';

const router = Router();

// 识别发票
router.post('/extract', async (req, res) => {
  try {
    const { image, category } = req.body;

    // 设置用户勾选的分类
    if (category) {
      setUserCategory(category);
      console.log('Setting user category:', category);
    }

    if (!image) {
      return res.status(400).json({ error: '请提供图片' });
    }

    // 检测文件类型并提取base64数据
    let base64Data = image;

    if (image.startsWith('data:image/png;base64,') ||
        image.startsWith('data:image/jpeg;base64,') ||
        image.startsWith('data:image/jpg;base64,') ||
        image.startsWith('data:image/gif;base64,') ||
        image.startsWith('data:image/webp;base64,')) {
      // 图片文件 - 移除前缀
      const match = image.match(/^data:image\/\w+;base64,(.+)$/);
      if (match) {
        base64Data = match[1];
      }
      console.log('Processing image file');
    } else if (image.startsWith('data:application/pdf;base64,')) {
      // PDF文件 - 移除前缀（PDF已在前端转换为图片）
      base64Data = image.replace(/^data:application\/pdf;base64,/, '');
      console.log('Processing PDF file');
    }

    const data = await extractInvoiceData(base64Data);

    // 校验购买方
    const isBuyerValid = data.buyerName.includes(config.school.name) &&
                         data.buyerTaxId.includes(config.school.taxId);

    res.json({
      ...data,
      isBuyerValid,
    });
  } catch (error: any) {
    console.error('OCR error:', error);
    res.status(500).json({ error: '发票识别失败' });
  }
});

export default router;
