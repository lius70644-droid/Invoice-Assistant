
import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as api from './services/api';
import { SubmissionRecord, ProcessingFile, InvoiceData, UserProfile, ReimbursementStatus } from './types';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// 设置pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const SCHOOL_NAME = "江南大学";

const INVOICE_CATEGORIES = [
  '实验室用品',
  '高通量测序',
  '测试费',
  '专利费/菌种保藏',
  '版面费/快递费',
  '市内交通费',
  '设备/设备维修',
  '其他'
];

type SurveyType = 'double_signature' | 'payment_record';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoginView, setIsLoginView] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAdminLoginView, setIsAdminLoginView] = useState(false);
  const [shareText, setShareText] = useState('分享助手');

  const [files, setFiles] = useState<ProcessingFile[]>([]);
  const [records, setRecords] = useState<SubmissionRecord[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(INVOICE_CATEGORIES[0]);
  const [isLoading, setIsLoading] = useState(false);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsCurrentPage, setRecordsCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;
  const RECORDS_PER_PAGE = 3;

  // 搜索状态
  const [searchQuery, setSearchQuery] = useState('');

  // 选中记录状态（用于查看大图）
  const [selectedRecord, setSelectedRecord] = useState<SubmissionRecord | null>(null);

  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [surveyQueue, setSurveyQueue] = useState<SurveyType[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 缓存当前用户的记录，避免重复过滤
  const userRecords = useMemo(() => {
    if (!user) return [];
    return records.filter(r => r.studentId === user.studentId);
  }, [records, user?.studentId]);

  // 分页计算
  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return files.slice(start, start + ITEMS_PER_PAGE);
  }, [files, currentPage]);

  const totalPages = Math.ceil(files.length / ITEMS_PER_PAGE);

  // 当文件列表变化时，重置到第一页
  useEffect(() => {
    if (files.length > 0 && (currentPage - 1) * ITEMS_PER_PAGE >= files.length) {
      setCurrentPage(1);
    }
  }, [files.length]);

  // 管理端名称搜索过滤
  const displayRecords = useMemo(() => {
    let recordsToShow = isAdminMode ? records : userRecords;

    // 管理端名称搜索
    if (isAdminMode && searchQuery.trim()) {
      recordsToShow = recordsToShow.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return recordsToShow;
  }, [records, userRecords, isAdminMode, searchQuery]);

  // 记录列表分页计算
  const paginatedRecords = useMemo(() => {
    const start = (recordsCurrentPage - 1) * RECORDS_PER_PAGE;
    return displayRecords.slice(start, start + RECORDS_PER_PAGE);
  }, [displayRecords, recordsCurrentPage]);

  const recordsTotalPages = Math.ceil(displayRecords.length / RECORDS_PER_PAGE);

  // 当记录列表变化时，重置到第一页
  useEffect(() => {
    if (displayRecords.length > 0 && (recordsCurrentPage - 1) * RECORDS_PER_PAGE >= displayRecords.length) {
      setRecordsCurrentPage(1);
    }
  }, [displayRecords.length]);

  const mapRecordFromApi = (record: any): SubmissionRecord => ({
    id: record.id,
    invoiceNumber: record.invoice_number,
    sellerName: record.seller_name,
    buyerName: record.buyer_name,
    sellerTaxId: record.seller_tax_id,
    buyerTaxId: record.buyer_tax_id,
    sellerBankAccount: record.seller_bank_account,
    category: record.category,
    amount: record.amount,
    name: record.name,
    studentId: record.student_id,
    supervisor: record.supervisor,
    phone: record.phone,
    isPaid: record.is_paid,
    paidEditCount: record.paid_edit_count || 0,
    surveyAnswers: record.survey_answers,
    status: record.status,
    rejectionReason: record.rejection_reason,
    timestamp: new Date(record.created_at).getTime(),
  });

  useEffect(() => {
    const savedUser = localStorage.getItem('invoice_user_profile');
    const savedAdminToken = localStorage.getItem('admin_token');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    } else {
      setIsLoginView(true);
    }
    if (savedAdminToken) {
      setIsAdminMode(true);
    }
  }, []);

  useEffect(() => {
    if (user || isAdminMode) {
      fetchRecords();
    }
  }, [user, isAdminMode]);

  // 自动清除状态消息
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const fetchRecords = async () => {
    try {
      let data;
      if (isAdminMode) {
        data = await api.getAllRecords();
      } else if (user) {
        data = await api.getRecords();
      } else {
        return;
      }
      setRecords(data.map(mapRecordFromApi));
      setDbError(null);
    } catch (error: any) {
      console.error('Error fetching records:', error);
      setDbError(error.message);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const profile: UserProfile = {
      name: formData.get('name') as string,
      studentId: formData.get('studentId') as string,
      supervisor: formData.get('supervisor') as string,
      phone: formData.get('phone') as string,
    };
    if (!profile.name || !profile.studentId) return alert("请补全必要信息");

    // 验证输入
    if (profile.studentId.length < 4) {
      return alert("学号格式不正确");
    }
    if (profile.phone && !/^\d{11}$/.test(profile.phone)) {
      return alert("请输入正确的11位手机号");
    }

    try {
      const result = await api.login(profile);
      localStorage.setItem('token', result.token);
      localStorage.setItem('invoice_user_profile', JSON.stringify(profile));
      setUser(profile);
      setIsLoginView(false);
    } catch (error) {
      alert('登录失败，请检查网络连接后重试');
    }
  };

  const handleAdminLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    try {
      const result = await api.adminLogin({ username, password });
      localStorage.setItem('admin_token', result.token);
      setIsAdminMode(true);
      setIsAdminLoginView(false);
    } catch (error: any) {
      alert('管理员登录失败: ' + error.message);
    }
  };

  const handleEditProfile = () => setIsLoginView(true);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setShareText('已复制链接！');
      setTimeout(() => setShareText('分享助手'), 2000);
    }).catch(() => alert("复制失败，请手动复制地址栏链接"));
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  // PDF转图片函数
  const convertPdfToImage = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1); // 只取第一页

    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context!, viewport, canvas }).promise;
    return canvas.toDataURL('image/png');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    const selectedFiles = Array.from(fileList) as File[];

    // 过滤超出大小限制的文件
    const validFiles = selectedFiles.filter(f => {
      if (f.size > MAX_FILE_SIZE) {
        alert(`文件 ${f.name} 超过大小限制 (10MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    for (const file of validFiles) {
      let previewUrl: string;

      if (file.type === 'application/pdf') {
        // PDF文件需要转换为图片预览
        try {
          previewUrl = await convertPdfToImage(file);
        } catch (error) {
          alert('PDF预览生成失败');
          continue;
        }
      } else {
        previewUrl = URL.createObjectURL(file);
      }

      const newFile: ProcessingFile = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        previewUrl,
        status: 'pending' as const
      };
      setFiles(prev => [...prev, newFile]);
      processFile(newFile, selectedCategory);
    }
  };

  const processFile = async (item: ProcessingFile, category?: string) => {
    setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'processing' } : f));

    // 如果是PDF文件，使用已转换的图片base64；否则读取原始文件
    let base64: string;
    if (item.file.type === 'application/pdf') {
      // PDF已转换为图片，直接使用previewUrl
      base64 = item.previewUrl;
    } else {
      // 图片文件，使用FileReader读取
      base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(item.file);
      });
    }

    try {
      const data = await api.extractInvoice(base64, category);
      const isBuyerValid = data.isBuyerValid;
      const isDuplicate = records.some(r => r.invoiceNumber.trim().toUpperCase() === data.invoiceNumber.trim().toUpperCase());
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'completed', extractedData: data, isBuyerValid, isDuplicate } : f));
    } catch {
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error', error: '识别失败' } : f));
    }
  };

  const handleRemoveFile = (id: string) => {
    setFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove) URL.revokeObjectURL(fileToRemove.previewUrl);
      return prev.filter(f => f.id !== id);
    });
  };

  const handleAddRecord = async (extracted: InvoiceData, fileId: string, isValid: boolean, isDuplicate: boolean) => {
    if (!isValid) return setStatusMessage({ type: 'error', text: `发票抬头错误！购买方必须是：${SCHOOL_NAME}` });
    if (isDuplicate) return setStatusMessage({ type: 'error', text: `发票号码 ${extracted.invoiceNumber} 已存在，不可重复报销！` });
    if (!user) return setStatusMessage({ type: 'error', text: "用户信息丢失，请重新登录" });

    setIsLoading(true);
    try {
      const newRecord = await api.createRecord({ ...extracted, isPaid, surveyAnswers: {} });
      setRecords(prev => [mapRecordFromApi(newRecord), ...prev]);
      setFiles(prev => {
        const fileToRemove = prev.find(f => f.id === fileId);
        if (fileToRemove) URL.revokeObjectURL(fileToRemove.previewUrl);
        return prev.filter(f => f.id !== fileId);
      });
      setStatusMessage({ type: 'success', text: '提交成功！请完成下面的合规性确认' });
      setActiveWorkflowId(newRecord.id);
      setSurveyQueue(isPaid ? ['double_signature', 'payment_record'] : ['double_signature']);
    } catch (error: any) {
      setStatusMessage({ type: 'error', text: '提交失败: ' + error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRecordPaidStatus = async (recordId: string) => {
    const record = records.find(r => r.id === recordId);
    if (!record) return;
    if (record.paidEditCount >= 1 && !isAdminMode) return setStatusMessage({ type: 'error', text: "支付状态提交后仅可修改一次。" });

    const becomingPaid = !record.isPaid;
    try {
      await api.updatePaidStatus(recordId, becomingPaid);
      if (becomingPaid) { setActiveWorkflowId(recordId); setSurveyQueue(['payment_record']); setStatusMessage({ type: 'success', text: '请完成合规性确认' }); }
      setRecords(prev => prev.map(r => r.id === recordId ? { ...r, isPaid: becomingPaid, paidEditCount: r.paidEditCount + 1 } : r));
    } catch (error: any) { setStatusMessage({ type: 'error', text: '更新失败: ' + error.message }); }
  };

  const handleDeleteRecord = async (recordId: string) => {
    const confirmDelete = window.confirm("确定要删除这条报销记录吗？此操作不可恢复。");
    if (!confirmDelete) return;

    setIsLoading(true);
    try {
      await api.deleteRecord(recordId, isAdminMode);
      setRecords(prev => prev.filter(r => r.id !== recordId));
      setStatusMessage({ type: 'success', text: isAdminMode ? '管理员删除了该报销单' : '删除成功' });
    } catch (error: any) {
      setStatusMessage({ type: 'error', text: '删除失败: ' + error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSurveyAnswer = async (answer: boolean) => {
    if (!activeWorkflowId || surveyQueue.length === 0) return;
    const currentSurvey = surveyQueue[0];

    setIsLoading(true);
    try {
      const data = await api.submitSurvey(activeWorkflowId, {
        hasDoubleSignature: currentSurvey === 'double_signature' ? answer : undefined,
        hasPaymentRecord: currentSurvey === 'payment_record' ? answer : undefined,
      });
      setRecords(prev => prev.map(r => r.id === activeWorkflowId ? { ...r, surveyAnswers: data.survey_answers } : r));
      const nextQueue = surveyQueue.slice(1);
      setSurveyQueue(nextQueue);
      if (nextQueue.length === 0) {
        setActiveWorkflowId(null);
        setStatusMessage({ type: 'success', text: '提交成功！报销单已提交' });
      }
    } catch (error: any) { setStatusMessage({ type: 'error', text: '保存答案失败: ' + error.message }); }
    finally {
      setIsLoading(false);
    }
  };

  const adminUpdateStatus = async (id: string, status: ReimbursementStatus, reason?: string) => {
    try {
      await api.updateStatus(id, status, reason);
      setRecords(prev => prev.map(r => r.id === id ? { ...r, status, rejectionReason: reason } : r));
      setStatusMessage({ type: 'success', text: status === 'rejected' ? '已退单' : `已更新状态为: ${status}` });
    } catch (error: any) { setStatusMessage({ type: 'error', text: '更新状态失败: ' + error.message }); }
  };

  const handleLogout = () => { localStorage.removeItem('admin_token'); setIsAdminMode(false); };

  const ProgressSteps = ({ status, reason }: { status: ReimbursementStatus, reason?: string }) => {
    const steps = [
      { key: 'box', label: '发票盒', icon: '📦' },
      { key: 'han', label: '韩老师', icon: '👩‍🦰' },
      { key: 'assistant', label: '财务助管', icon: '👧' },
      { key: 'office', label: '财务处', icon: '🏛️' },
    ];
    const currentIndex = steps.findIndex(s => s.key === status);
    const isFinished = status === 'success', isRejected = status === 'rejected';
    return (
      <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-2xl border border-slate-100 shadow-inner">
        <div className="flex items-center justify-between px-2">
          {steps.map((s, i) => (
            <div key={s.key} className="flex flex-col items-center relative group">
              <div className={`w-9 h-9 flex items-center justify-center rounded-full text-lg z-10 border-2 transition-all duration-300 ${i <= currentIndex && !isRejected ? 'bg-blue-100 border-blue-500 shadow-md scale-110' : 'bg-white border-gray-200 grayscale'}`}>{s.icon}</div>
              <span className={`text-[9px] mt-1.5 font-black uppercase tracking-widest ${i <= currentIndex && !isRejected ? 'text-blue-600' : 'text-gray-400'}`}>{s.label}</span>
              {i < steps.length - 1 && <div className={`absolute left-[50%] top-4 w-full h-0.5 -z-0 ${i < currentIndex && !isRejected ? 'bg-blue-400' : 'bg-gray-100'}`} style={{ width: 'calc(100% + 20px)' }}></div>}
            </div>
          ))}
          <div className="flex flex-col items-center ml-2">
            <div className={`w-9 h-9 flex items-center justify-center rounded-full text-xl border-2 font-black transition-all duration-500 ${isFinished ? 'bg-green-100 border-green-500 text-green-600 shadow-lg shadow-green-200' : isRejected ? 'bg-red-100 border-red-500 text-red-600 shadow-lg shadow-red-200 animate-pulse' : 'bg-white border-gray-200 text-gray-300'}`}>
              {isFinished ? '✅' : isRejected ? '×' : '⌛'}
            </div>
            <span className={`text-[9px] mt-1.5 font-black uppercase tracking-widest ${isFinished ? 'text-green-600' : isRejected ? 'text-red-600' : 'text-gray-400'}`}>{isFinished ? '报销成功' : isRejected ? '报销失败' : '最终状态'}</span>
          </div>
        </div>
        {isRejected && reason && <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded-xl text-[10px] text-red-700 font-bold flex items-start gap-2"><span className="text-sm">⚠️</span><span>退单原因：{reason}</span></div>}
      </div>
    );
  };

  if (isAdminLoginView) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-slate-200">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-red-600 rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-xl shadow-red-200">🔐</div>
          <h1 className="text-3xl font-black mt-6 tracking-tight">管理员登录</h1>
          <p className="text-slate-400 mt-2 text-sm">请输入管理员账号密码</p>
        </div>
        <form onSubmit={handleAdminLogin} className="space-y-5">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">用户名</label>
            <input name="username" placeholder="请输入用户名" className="w-full border-2 p-4 rounded-2xl outline-none focus:border-red-500 transition-all bg-slate-50 focus:bg-white" required />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">密码</label>
            <input name="password" type="password" placeholder="请输入密码" className="w-full border-2 p-4 rounded-2xl outline-none focus:border-red-500 transition-all bg-slate-50 focus:bg-white" required />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setIsAdminLoginView(false)} className="flex-1 bg-slate-100 text-slate-500 p-4 rounded-2xl font-black text-lg hover:bg-slate-200 transition-colors">取消</button>
            <button type="submit" className="flex-[2] bg-red-600 text-white p-4 rounded-2xl font-black text-lg shadow-lg shadow-red-100 hover:bg-red-700 active:scale-95 transition-all">登录</button>
          </div>
        </form>
      </div>
    </div>
  );

  if (isLoginView || !user) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-slate-200 scale-in-center">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-xl shadow-blue-200">📋</div>
          <h1 className="text-3xl font-black mt-6 tracking-tight">{user ? '修改个人信息' : '报销身份认证'}</h1>
          <p className="text-slate-400 mt-2 text-sm">请确认为风味组在籍学生或教工</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">姓名</label>
            <input name="name" defaultValue={user?.name} placeholder="请输入姓名" className="w-full border-2 p-4 rounded-2xl outline-none focus:border-blue-500 transition-all bg-slate-50 focus:bg-white" required />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">学号/工号</label>
            <input name="studentId" defaultValue={user?.studentId} placeholder="请输入学号/工号" className="w-full border-2 p-4 rounded-2xl outline-none focus:border-blue-500 transition-all bg-slate-50 focus:bg-white" required />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">指导老师</label>
            <input name="supervisor" defaultValue={user?.supervisor} placeholder="请输入导师姓名" className="w-full border-2 p-4 rounded-2xl outline-none focus:border-blue-500 transition-all bg-slate-50 focus:bg-white" required />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">联系电话</label>
            <input name="phone" defaultValue={user?.phone} placeholder="请输入联系方式" className="w-full border-2 p-4 rounded-2xl outline-none focus:border-blue-500 transition-all bg-slate-50 focus:bg-white" required />
          </div>
          <div className="flex gap-3 pt-4">
            {user && <button type="button" onClick={() => setIsLoginView(false)} className="flex-1 bg-slate-100 text-slate-500 p-4 rounded-2xl font-black text-lg hover:bg-slate-200 transition-colors">取消</button>}
            <button type="submit" className="flex-[2] bg-blue-600 text-white p-4 rounded-2xl font-black text-lg shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all">保存并进入</button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-600">
      {activeWorkflowId && surveyQueue.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl scale-in-center border border-slate-100">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">🛡️</div>
            <h2 className="text-2xl font-black mb-4 text-center">合规性确认</h2>
            <div className="space-y-6">
              <p className="text-lg font-bold text-center leading-relaxed text-slate-600">{surveyQueue[0] === 'double_signature' ? "发票是否由2名以上的老师签字？" : "已付发票是否附上支付记录？"}</p>
              <div className="flex gap-4">
                <button onClick={() => handleSurveyAnswer(true)} disabled={isLoading} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50">{isLoading ? '处理中...' : '是'}</button>
                <button onClick={() => handleSurveyAnswer(false)} disabled={isLoading} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black shadow-inner hover:bg-slate-200 active:scale-95 transition-all disabled:opacity-50">{isLoading ? '处理中...' : '否'}</button>
              </div>
            </div>
            {surveyQueue.length > 1 && <div className="mt-8 flex justify-center gap-2"><div className="w-8 h-1.5 bg-blue-600 rounded-full"></div><div className="w-8 h-1.5 bg-slate-100 rounded-full"></div></div>}
          </div>
        </div>
      )}

      <header className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-20 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 text-white p-2.5 rounded-2xl text-xl font-black shadow-blue-200 shadow-xl">AI</div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-tighter leading-none">风味组报销助手</h1>
            <span className="text-[10px] font-bold text-blue-500 tracking-widest uppercase">Smart Reimbursement</span>
          </div>
          <button onClick={handleEditProfile} className="hidden md:flex items-center text-[11px] text-slate-500 gap-3 ml-6 bg-slate-50 hover:bg-white hover:shadow-md px-4 py-2 rounded-2xl border border-slate-100 transition-all group">
            <div className="flex flex-col items-start">
              <span>用户: <b className="text-slate-800 font-black">{user.name}</b></span>
              <span>学号: <b className="text-slate-800 font-black">{user.studentId}</b></span>
            </div>
            <span className="text-blue-500 font-black bg-blue-50 px-2 py-1 rounded-lg opacity-80 group-hover:opacity-100 transition-opacity">✎ 修改</span>
          </button>
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={handleShare} className="bg-blue-50 text-blue-600 px-5 py-2.5 rounded-2xl text-[11px] font-black border border-blue-100 shadow-sm hover:bg-blue-100 transition-all flex items-center gap-2">
            <span className="text-lg leading-none">🔗</span>{shareText}
          </button>
          {isAdminMode ? (
            <button onClick={handleLogout} className="px-5 py-2.5 rounded-2xl text-[11px] font-black border-2 transition-all bg-red-600 text-white border-red-600">退出管理</button>
          ) : (
            <button onClick={() => setIsAdminLoginView(true)} className="px-5 py-2.5 rounded-2xl text-[11px] font-black border-2 transition-all text-slate-600 border-slate-200 hover:border-red-400 hover:text-red-600">管理入口</button>
          )}
          {isAdminMode ? (
            <button onClick={() => api.exportAllCSV()} className="bg-green-600 text-white px-5 py-2.5 rounded-2xl text-[11px] font-black shadow-green-100 shadow-xl hover:bg-green-700 transition-colors">导出全部数据</button>
          ) : (
            <button onClick={() => api.exportCSV()} className="bg-green-600 text-white px-5 py-2.5 rounded-2xl text-[11px] font-black shadow-green-100 shadow-xl hover:bg-green-700 transition-colors">我的导出</button>
          )}
        </div>
      </header>

      {/* 状态提示居中弹窗 */}
      {statusMessage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setStatusMessage(null)}
        >
          <div
            className={`bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 ${
              statusMessage.type === 'success' ? 'border-2 border-green-100' :
              statusMessage.type === 'error' ? 'border-2 border-red-100' :
              'border-2 border-blue-100'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 ${
                statusMessage.type === 'success' ? 'bg-green-100 text-green-600' :
                statusMessage.type === 'error' ? 'bg-red-100 text-red-600' :
                'bg-blue-100 text-blue-600'
              }`}>
                {statusMessage.type === 'success' ? '✓' :
                 statusMessage.type === 'error' ? '✕' : 'ℹ'}
              </div>
              <p className={`text-lg font-bold ${
                statusMessage.type === 'success' ? 'text-green-700' :
                statusMessage.type === 'error' ? 'text-red-700' :
                'text-blue-700'
              }`}>
                {statusMessage.text}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 发票大图预览Modal */}
      {selectedRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="bg-white rounded-[2rem] p-8 max-w-2xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black">发票详情</h2>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-2xl text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center"
              >
                ×
              </button>
            </div>

            {/* 发票预览占位图 */}
            <div className="bg-slate-100 rounded-2xl p-8 mb-6 flex items-center justify-center min-h-[200px]">
              <div className="text-center text-slate-400">
                <span className="text-6xl block">🧾</span>
                <p className="text-sm mt-2">发票图片预览</p>
              </div>
            </div>

            {/* 发票信息 */}
            <div className="space-y-3">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">发票号</span>
                <span className="font-bold">{selectedRecord.invoiceNumber}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">金额</span>
                <span className="font-bold text-blue-600">¥{selectedRecord.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">类别</span>
                <span className="font-bold">{selectedRecord.category}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">销售方</span>
                <span className="font-bold">{selectedRecord.sellerName || '-'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">状态</span>
                <span className="font-bold">{selectedRecord.status}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {!isAdminMode && (
          <div className="lg:col-span-5 space-y-6 animate-in fade-in slide-in-from-left duration-700">
            <section className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-2xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-8">
                <div className="flex flex-col">
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Smart Scanning</h2>
                  <p className="text-xl font-black text-slate-800">发票识别区</p>
                </div>
                <div className="flex items-center gap-3">
                  {files.filter(f => f.status === 'completed' && !f.isDuplicate).length > 1 && (
                    <button onClick={async () => {
                      const readyFiles = files.filter(f => f.status === 'completed' && !f.isDuplicate);
                      const validFiles = readyFiles.filter(f => f.isBuyerValid);
                      if (validFiles.length === 0) return setStatusMessage({ type: 'error', text: "没有符合抬头要求的发票可提交" });
                      for (const f of validFiles) await handleAddRecord(f.extractedData!, f.id, true, false);
                      if (readyFiles.length > validFiles.length) setStatusMessage({ type: 'info', text: `已提交 ${validFiles.length} 张合规发票，其余 ${readyFiles.length - validFiles.length} 张发票抬头有误` });
                    }} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all">
                      全部提交 ({files.filter(f => f.status === 'completed' && !f.isDuplicate).length})
                    </button>
                  )}
                  <label className="flex items-center gap-3 px-5 py-3 bg-blue-50 border-2 border-blue-100 rounded-2xl cursor-pointer select-none shadow-lg active:scale-95 transition-all group">
                    <input type="checkbox" checked={isPaid} onChange={e => setIsPaid(e.target.checked)} className="w-5 h-5 rounded-lg text-blue-600 focus:ring-0 cursor-pointer" />
                    <span className={`text-lg font-black transition-colors ${isPaid ? 'text-blue-700' : 'text-slate-300'}`}>已付发票</span>
                  </label>
                </div>
              </div>

              <div className="mb-6">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-2">发票类别</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full border-2 p-3 rounded-2xl outline-none focus:border-blue-500 bg-slate-50"
                >
                  {INVOICE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed border-slate-100 rounded-[2rem] p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all group relative overflow-hidden">
                <div className="absolute inset-0 bg-blue-50 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                <span className="text-7xl block mb-6 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500">📸</span>
                <p className="text-xl font-black text-slate-800">点击上传发票</p>
                <p className="text-sm text-slate-400 mt-2">支持 PDF 或 图片，系统将自动极速提取</p>
                <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} />
              </div>

              <div className="mt-10 space-y-5">
                {files.length === 0 && <div className="py-12 border-2 border-dashed border-slate-50 rounded-3xl text-center text-slate-300 font-bold text-sm">暂未上传任何文件</div>}
                {paginatedFiles.map(item => (
                  <div key={item.id} className={`p-6 rounded-[2rem] border-2 flex gap-5 transition-all animate-in slide-in-from-bottom-4 duration-300 ${item.isDuplicate ? 'bg-amber-50 border-amber-200' : item.isBuyerValid === false ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100 hover:shadow-2xl hover:border-blue-100'}`}>
                    <div className="relative">
                      {item.file.type.includes('image') ? <img src={item.previewUrl} className="w-28 h-28 object-cover rounded-3xl shadow-md border-2 border-white bg-slate-50" alt="preview" /> : <div className="w-28 h-28 bg-red-50 rounded-3xl flex flex-col items-center justify-center shadow-md border-2 border-white"><span className="text-4xl">📄</span><span className="text-[10px] font-black text-red-500 mt-1 uppercase">PDF Document</span></div>}
                      {item.isBuyerValid === false && <div className="absolute -top-2 -right-2 bg-red-500 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-lg border-2 border-white" title="抬头有误">!</div>}
                    </div>
                    <div className="flex-grow min-w-0 flex flex-col justify-center">
                      {item.status === 'processing' ? (
                        <div className="space-y-3">
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div className="bg-blue-600 h-full animate-progress-indefinite shadow-sm"></div></div>
                          <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest">AI Deep Parsing...</p>
                        </div>
                      ) : item.status === 'completed' && item.extractedData ? (
                        <div className="flex flex-col h-full justify-between">
                          <div>
                            <div className="flex justify-between items-start">
                              <span className="text-2xl font-black text-slate-800">¥{item.extractedData.amount.toFixed(2)}</span>
                              <select
                                value={item.extractedData.category}
                                onChange={(e) => {
                                  const newCategory = e.target.value;
                                  setFiles(prev => prev.map(f => f.id === item.id ? {
                                    ...f,
                                    extractedData: { ...f.extractedData, category: newCategory }
                                  } : f));
                                }}
                                className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-tighter border-none cursor-pointer"
                              >
                                {INVOICE_CATEGORIES.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 truncate">No. {item.extractedData.invoiceNumber}</p>
                          </div>
                          <div className="mt-4 flex gap-2">
                            <button onClick={() => handleAddRecord(item.extractedData!, item.id, item.isBuyerValid || false, item.isDuplicate || false)} disabled={isLoading} className="flex-grow py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-70">{isLoading ? '提交中...' : '提交报销单'}</button>
                            <button onClick={() => handleRemoveFile(item.id)} className="px-4 py-3 bg-slate-100 text-slate-400 rounded-2xl text-[11px] font-black hover:bg-slate-200 transition-colors">删除</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full">
                          <span className="text-2xl mb-1">⚠️</span>
                          <p className="text-[11px] font-black text-red-500 uppercase">{item.error || '识别异常'}</p>
                          <button onClick={() => handleRemoveFile(item.id)} className="mt-2 text-[10px] font-bold text-slate-400 underline">移除重试</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* 分页组件 */}
                {files.length > ITEMS_PER_PAGE && (
                  <div className="flex justify-center items-center gap-2 mt-6">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-slate-200 transition-colors"
                    >
                      上一页
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-10 h-10 rounded-xl text-sm font-bold transition-colors ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-slate-200 transition-colors"
                    >
                      下一页
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        <div className={`${isAdminMode ? 'lg:col-span-12' : 'lg:col-span-7'} space-y-6 transition-all duration-700 animate-in fade-in slide-in-from-right duration-700`}>
          <div className="bg-white rounded-[2.5rem] border shadow-2xl flex flex-col min-h-[85vh] overflow-hidden relative border-slate-100">
            <div className="px-10 py-8 border-b flex justify-between items-center bg-slate-50/30 backdrop-blur-sm">
              <div className="flex flex-col">
                <h2 className="text-2xl font-black text-slate-800">{isAdminMode ? "全部用户报销单" : "我的报销流水"}</h2>
                <p className="text-slate-400 text-xs mt-1">{isAdminMode ? "管理员模式：点击状态快速流转发票进度" : "点击发票卡片查看详细信息与审批原因"}</p>
              </div>
              <div className="flex items-center gap-4">
                {/* 管理端搜索框 */}
                {isAdminMode && (
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索用户名称..."
                      className="border-2 px-4 py-2 rounded-xl text-sm focus:border-blue-500 outline-none w-48"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                )}
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-slate-300 uppercase">Records Found</span>
                  <span className="text-xl font-black text-blue-600">
                    {displayRecords.length > RECORDS_PER_PAGE
                      ? `${(recordsCurrentPage - 1) * RECORDS_PER_PAGE + 1}-${Math.min(recordsCurrentPage * RECORDS_PER_PAGE, displayRecords.length)} / ${displayRecords.length}`
                      : displayRecords.length}
                  </span>
                </div>
              </div>
            </div>

            <div className={`flex-grow overflow-auto p-8 ${isAdminMode ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 justify-items-center' : 'space-y-6'}`}>
              {dbError && <div className="col-span-full p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold flex items-center gap-3 animate-pulse"><span>⚠️ 数据库连接失败: {dbError}。请检查环境变量配置。</span></div>}
              {displayRecords.length === 0 && !dbError && <div className="col-span-full flex flex-col items-center justify-center h-[50vh] opacity-30 grayscale"><span className="text-9xl mb-4">📥</span><p className="text-2xl font-black text-slate-400">尚无报销记录</p></div>}
              {paginatedRecords.map(r => (
                <div
                  key={r.id}
                  onClick={() => !isAdminMode && setSelectedRecord(r)}
                  className={`bg-white border-2 rounded-[2rem] p-8 transition-all group hover:shadow-2xl relative overflow-hidden flex flex-col cursor-pointer ${r.status === 'rejected' ? 'border-red-100 bg-red-50/10 shadow-red-50/20' : 'border-slate-50'}`}
                >
                  {r.status === 'rejected' && <div className="absolute top-6 right-6 z-0 pointer-events-none opacity-20 rotate-12"><span className="text-9xl font-black text-red-500 select-none">×</span></div>}
                  {r.status === 'success' && <div className="absolute top-6 right-6 z-0 pointer-events-none opacity-10"><span className="text-9xl font-black text-green-500 select-none">✓</span></div>}
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="flex gap-5 items-center">
                      <div className="bg-slate-50 w-16 h-16 rounded-3xl flex items-center justify-center text-3xl shadow-inner group-hover:bg-blue-50 transition-colors">🧾</div>
                      <div>
                        <h3 className="text-lg font-black text-slate-800 tracking-tight">{r.category}</h3>
                        <p className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">ID: {r.invoiceNumber}</p>
                        {isAdminMode && <div className="mt-1 flex items-center gap-2"><div className="w-2 h-2 bg-blue-500 rounded-full"></div><span className="text-[11px] font-black text-blue-600">{r.name} · {r.studentId}</span></div>}
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="text-right">
                        <div className="text-2xl font-black text-blue-600">¥{r.amount.toFixed(2)}</div>
                        <button onClick={(e) => { e.stopPropagation(); toggleRecordPaidStatus(r.id); }} className={`mt-2 px-4 py-1.5 rounded-xl text-[10px] font-black transition-all active:scale-95 shadow-sm ${r.isPaid ? 'bg-blue-500 text-white shadow-blue-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{r.isPaid ? '已付发票' : '待付发票'}</button>
                      </div>
                      {/* 用户只能删除自己创建的、状态为 box 的记录；管理员可以删除任意记录 */}
                      {(isAdminMode || (r.status === 'box' && r.studentId === user?.studentId)) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteRecord(r.id); }}
                          disabled={isLoading}
                          className={`p-2 rounded-xl transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : 'text-slate-400 hover:bg-red-50 hover:text-red-500'}`}
                          title={isAdminMode ? "删除报销单" : "仅可删除待提交的报销单"}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="relative z-10 flex-grow"><ProgressSteps status={r.status} reason={r.rejectionReason} /></div>
                  {isAdminMode && (
                    <div className="mt-6 pt-6 border-t border-slate-100 flex flex-wrap gap-2 relative z-10">
                      {(['box', 'han', 'assistant', 'office', 'success'] as ReimbursementStatus[]).map(s => (
                        <button key={s} onClick={() => adminUpdateStatus(r.id, s)} className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all ${r.status === s ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50 text-slate-500 hover:bg-slate-200'}`}>{s}</button>
                      ))}
                      <button onClick={() => { const reason = prompt("请输入退单原因："); if (reason) adminUpdateStatus(r.id, 'rejected', reason); }} className={`px-4 py-1.5 flex items-center gap-1.5 text-[9px] font-black uppercase rounded-xl transition-all ${r.status === 'rejected' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}><span>退单</span><span className="text-base font-black leading-none">×</span></button>
                    </div>
                  )}
                </div>
              ))}

              {/* 记录列表分页组件 */}
              {displayRecords.length > RECORDS_PER_PAGE && (
                <div className={`flex justify-center items-center gap-2 mt-6 pb-6 ${isAdminMode ? 'col-span-full sticky bottom-0 bg-white/90 backdrop-blur-sm py-4 border-t -mx-8' : ''}`}>
                  <button
                    onClick={() => setRecordsCurrentPage(p => Math.max(1, p - 1))}
                    disabled={recordsCurrentPage === 1}
                    className="px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-slate-200 transition-colors"
                  >
                    上一页
                  </button>
                  {Array.from({ length: recordsTotalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setRecordsCurrentPage(page)}
                      className={`w-10 h-10 rounded-xl text-sm font-bold transition-colors ${
                        recordsCurrentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setRecordsCurrentPage(p => Math.min(recordsTotalPages, p + 1))}
                    disabled={recordsCurrentPage === recordsTotalPages}
                    className="px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-slate-200 transition-colors"
                  >
                    下一页
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto p-12 text-center text-slate-300 font-black text-[10px] uppercase tracking-[0.2em]">风味组 · Smart Financial AI Assistant · Built with Aliyun OCR</footer>

      <style>{`
        .scale-in-center { animation: scale-in-center 0.4s cubic-bezier(0.250, 0.460, 0.450, 0.940) both; }
        @keyframes scale-in-center { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes progress-indefinite { 0% { width: 0; margin-left: 0; } 50% { width: 40%; margin-left: 60%; } 100% { width: 0; margin-left: 100%; } }
        .animate-progress-indefinite { animation: progress-indefinite 1.5s infinite linear; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 20px; border: 2px solid white; }
        ::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
      `}</style>
    </div>
  );
};

export default App;
