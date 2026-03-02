import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { supabase } from '../lib/supabase';
import { authenticateAdmin } from '../middleware/auth';

const router = Router();

// CSV 字段转义函数
const escapeCSV = (val: any): string => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// 管理员登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 简单验证：用户名和密码匹配
    if (username !== config.admin.username || password !== config.admin.password) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign(
      { username },
      config.jwt.secret + '_admin',
      { expiresIn: config.jwt.adminExpiry }
    );

    res.json({ token });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 获取所有报销记录
router.get('/records', authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reimbursement_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    console.error('Fetch all records error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 修改审批状态
router.put('/records/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    const updates: any = { status };
    if (status === 'rejected') {
      updates.rejection_reason = rejectionReason || '';
    }

    const { data, error } = await supabase
      .from('reimbursement_records')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Update status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 退单
router.post('/records/:id/reject', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { data, error } = await supabase
      .from('reimbursement_records')
      .update({
        status: 'rejected',
        rejection_reason: reason
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Reject error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 导出 CSV
router.get('/export', authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reimbursement_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const headers = ['发票号', '金额', '分类', '提交人', '学号', '电话', '导师', '状态', '老师签字', '支付记录', '当前进度', '退单原因'];
    const rows = (data || []).map((r: any) => [
      r.invoice_number,
      r.amount,
      r.category,
      r.name,
      r.student_id,
      r.phone,
      r.supervisor,
      r.is_paid ? '已付' : '待付',
      r.survey_answers?.hasDoubleSignature ? '是' : '否',
      r.survey_answers?.hasPaymentRecord ? '是' : '否',
      r.status,
      r.rejection_reason || ''
    ].map(escapeCSV));

    const csvContent = '\ufeff' + [headers, ...rows].map(e => e.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=报销清单_${Date.now()}.csv`);
    res.send(csvContent);
  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
