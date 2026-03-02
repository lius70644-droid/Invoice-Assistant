import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase';
import { authenticateUser, UserPayload, AdminPayload } from '../middleware/auth';
import { config } from '../config';

const router = Router();

interface RecordBody {
  invoiceNumber: string;
  sellerName: string;
  buyerName: string;
  sellerTaxId: string;
  buyerTaxId: string;
  sellerBankAccount: string;
  category: string;
  amount: number;
  isPaid: boolean;
  surveyAnswers?: {
    hasDoubleSignature?: boolean;
    hasPaymentRecord?: boolean;
  };
}

// 获取当前用户的报销记录
router.get('/', authenticateUser, async (req: any, res) => {
  try {
    const user = req.user as UserPayload;
    const { data, error } = await supabase
      .from('reimbursement_records')
      .select('*')
      .eq('student_id', user.studentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    console.error('Fetch records error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 提交新的报销记录
router.post('/', authenticateUser, async (req: any, res) => {
  try {
    const user = req.user as UserPayload;
    const body = req.body as RecordBody;

    // 校验购买方
    const buyerValid = body.buyerName.includes(config.school.name) &&
                       body.buyerTaxId.includes(config.school.taxId);
    if (!buyerValid) {
      return res.status(400).json({
        error: `发票抬头错误！购买方必须是：${config.school.name}`
      });
    }

    // 检查重复
    const { data: existing } = await supabase
      .from('reimbursement_records')
      .select('id')
      .eq('invoice_number', body.invoiceNumber)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(400).json({
        error: `发票号码 ${body.invoiceNumber} 已存在，不可重复报销`
      });
    }

    const { data, error } = await supabase
      .from('reimbursement_records')
      .insert([{
        name: user.name,
        student_id: user.studentId,
        phone: user.phone,
        supervisor: user.supervisor,
        invoice_number: body.invoiceNumber,
        seller_name: body.sellerName,
        buyer_name: body.buyerName,
        seller_tax_id: body.sellerTaxId,
        buyer_tax_id: body.buyerTaxId,
        seller_bank_account: body.sellerBankAccount,
        category: body.category,
        amount: body.amount,
        is_paid: body.isPaid,
        status: 'box',
        survey_answers: body.surveyAnswers || {},
      }])
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Create record error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 修改支付状态
router.put('/:id/paid', authenticateUser, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { isPaid } = req.body;
    const user = req.user as UserPayload;

    // 检查记录是否存在且属于当前用户
    const { data: record } = await supabase
      .from('reimbursement_records')
      .select('*')
      .eq('id', id)
      .single();

    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }

    if (record.student_id !== user.studentId) {
      return res.status(403).json({ error: '无权限操作' });
    }

    const newCount = (record.paid_edit_count || 0) + 1;
    if (newCount > 1) {
      return res.status(400).json({ error: '支付状态仅可修改一次' });
    }

    const { data, error } = await supabase
      .from('reimbursement_records')
      .update({
        is_paid: isPaid,
        paid_edit_count: newCount
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Update paid error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 提交问卷答案
router.put('/:id/survey', authenticateUser, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { hasDoubleSignature, hasPaymentRecord } = req.body;
    const user = req.user as UserPayload;

    const { data: record } = await supabase
      .from('reimbursement_records')
      .select('*')
      .eq('id', id)
      .single();

    if (!record || record.student_id !== user.studentId) {
      return res.status(403).json({ error: '无权限操作' });
    }

    const newAnswers = {
      ...(record.survey_answers || {}),
      ...(hasDoubleSignature !== undefined && { hasDoubleSignature }),
      ...(hasPaymentRecord !== undefined && { hasPaymentRecord }),
    };

    const { data, error } = await supabase
      .from('reimbursement_records')
      .update({ survey_answers: newAnswers })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Survey answer error:', error);
    res.status(500).json({ error: error.message });
  }
});

// CSV 字段转义函数
const escapeCSV = (val: any): string => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  // 如果包含逗号、引号或换行符，需要用双引号包裹并转义内部双引号
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// 用户导出自己的报销记录
router.get('/export', authenticateUser, async (req: any, res) => {
  try {
    const user = req.user as UserPayload;

    const { data, error } = await supabase
      .from('reimbursement_records')
      .select('*')
      .eq('student_id', user.studentId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const headers = ['发票号', '金额', '分类', '状态', '是否已付', '老师签字', '支付记录', '提交时间'];
    const rows = (data || []).map((r: any) => [
      r.invoice_number,
      r.amount,
      r.category,
      r.status,
      r.is_paid ? '已付' : '待付',
      r.survey_answers?.hasDoubleSignature ? '是' : '否',
      r.survey_answers?.hasPaymentRecord ? '是' : '否',
      new Date(r.created_at).toLocaleString('zh-CN')
    ].map(escapeCSV));

    const timestamp = Date.now();
    const csvContent = '\ufeff' + [headers, ...rows].map(e => e.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=my_export_${timestamp}.csv`);
    res.send(csvContent);
  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 删除报销记录
router.delete('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    const isAdminMode = req.headers['x-admin-mode'] === 'true';

    // 验证 token 并确定用户身份
    let user: UserPayload | null = null;
    let isAdmin = isAdminMode;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      // 优先检查是否是管理员 token
      try {
        const adminPayload = jwt.verify(token, config.jwt.secret + '_admin') as AdminPayload;
        isAdmin = true;
        (req as any).admin = adminPayload;
      } catch {
        // 如果不是管理员 token，验证用户 token
        try {
          user = jwt.verify(token, config.jwt.secret) as UserPayload;
          (req as any).user = user;
        } catch {
          return res.status(401).json({ error: '登录已过期' });
        }
      }
    } else {
      return res.status(401).json({ error: '未登录' });
    }

    // 管理员直接删除，无需检查记录存在性
    if (isAdmin) {
      const { error: deleteError } = await supabase
        .from('reimbursement_records')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      return res.json({ success: true });
    }

    // 检查记录是否存在
    const { data: record, error: fetchError } = await supabase
      .from('reimbursement_records')
      .select('student_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !record) {
      return res.status(404).json({ error: '记录不存在' });
    }

    // 检查权限
    if (user && record.student_id !== user.studentId) {
      return res.status(403).json({ error: '无权限删除此记录' });
    }

    // 普通用户只能删除状态为 box 的记录
    if (record.status !== 'box') {
      return res.status(403).json({ error: '只能删除待提交的记录' });
    }

    const { error: deleteError } = await supabase
      .from('reimbursement_records')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete record error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
