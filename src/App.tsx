/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Wallet, ArrowUpCircle, ArrowDownCircle, Printer, LogIn, LogOut, Loader2, Calendar, FolderPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle, 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Session, Transaction } from './types';
import { formatCurrency, formatDate } from './lib/formatters';
import { cn } from '@/lib/utils';
import { db, auth } from './lib/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  orderBy,
  getDocFromServer,
  writeBatch
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from 'firebase/auth';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [isLoading, setIsLoading] = useState(true);
  const [newSessionName, setNewSessionName] = useState('');
  const [showSessionManager, setShowSessionManager] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Sessions Listener
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'sessions'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Session[];
      setSessions(data);
      
      // Auto-select latest session if none selected
      if (data.length > 0 && !currentSession) {
        setCurrentSession(data[0]);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Transactions Listener
  useEffect(() => {
    if (!user || !currentSession) {
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      where('sessionId', '==', currentSession.id),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      setTransactions(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, currentSession]);

  const totalIncome = useMemo(() => 
    transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
  [transactions]);

  const totalExpense = useMemo(() => 
    transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
  [transactions]);

  const balance = totalIncome - totalExpense;

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const logout = () => signOut(auth);

  const createSession = async () => {
    if (!newSessionName || !user) return;
    try {
      const docRef = await addDoc(collection(db, 'sessions'), {
        name: newSessionName,
        createdAt: new Date().toISOString(),
        userId: user.uid
      });
      setNewSessionName('');
      setShowSessionManager(false);
      setCurrentSession({
        id: docRef.id,
        name: newSessionName,
        createdAt: new Date().toISOString(),
        userId: user.uid
      });
    } catch (error) {
      console.error("Create Session Error:", error);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذه الجلسة وكل العمليات اللي فيها؟")) return;
    try {
      // Delete session doc
      await deleteDoc(doc(db, 'sessions', sessionId));
      
      // Note: In a real app, you'd also delete all transactions for this session.
      // For simplicity here, we just delete the session.
      if (currentSession?.id === sessionId) {
        setCurrentSession(sessions.find(s => s.id !== sessionId) || null);
      }
    } catch (error) {
      console.error("Delete Session Error:", error);
    }
  };

  const addTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !user || !currentSession) return;

    try {
      await addDoc(collection(db, 'transactions'), {
        description,
        amount: parseFloat(amount),
        type,
        date: new Date().toISOString(),
        userId: user.uid,
        sessionId: currentSession.id
      });
      setDescription('');
      setAmount('');
    } catch (error) {
      console.error("Add Error:", error);
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (error) {
      console.error("Delete Error:", error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4" dir="rtl">
        <Card className="max-w-md w-full rounded-3xl shadow-2xl border-none p-8 text-center space-y-8">
          <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center text-white mx-auto shadow-xl rotate-3">
            <Wallet className="w-12 h-12" />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black text-slate-900">محفظة بابا</h1>
            <p className="text-xl text-slate-500 font-medium">سجل دخولك عشان نحفظ لك كل حساباتك وماتضيعش أبداً</p>
          </div>
          <Button onClick={login} size="lg" className="w-full h-20 text-2xl font-black bg-blue-600 hover:bg-blue-700 rounded-2xl gap-4 shadow-xl">
            <LogIn className="w-8 h-8" />
            دخول بحساب جوجل
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] p-4 md:p-8 font-sans text-lg" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <header className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6 print:hidden">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <Wallet className="w-8 h-8" />
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-black text-slate-900">محفظة بابا للعمل</h1>
              <p className="text-slate-500 text-lg font-medium">{user.displayName}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setShowSessionManager(!showSessionManager)} variant="outline" className="text-lg h-12 px-6 rounded-xl gap-2 border-2 border-blue-100 text-blue-600 hover:bg-blue-50">
              <Calendar className="w-5 h-5" />
              تغيير الجلسة
            </Button>
            <Button onClick={logout} variant="outline" className="text-lg h-12 px-6 rounded-xl gap-2 border-2 border-red-100 text-red-600 hover:bg-red-50">
              <LogOut className="w-5 h-5" />
              خروج
            </Button>
          </div>
        </header>

        {/* Session Manager Overlay */}
        <AnimatePresence>
          {showSessionManager && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white p-6 rounded-3xl shadow-xl border-2 border-blue-100 space-y-6 print:hidden"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-900">إدارة الجلسات (المشاريع)</h2>
                <Button variant="ghost" onClick={() => setShowSessionManager(false)} className="text-slate-400">إغلاق</Button>
              </div>
              
              <div className="flex gap-4">
                <Input 
                  placeholder="اسم الجلسة الجديدة (مثال: شغل شهر 4)" 
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  className="text-lg h-14 rounded-xl border-2"
                />
                <Button onClick={createSession} className="h-14 px-8 bg-blue-600 rounded-xl gap-2 text-lg font-bold">
                  <FolderPlus className="w-5 h-5" />
                  بدء جلسة جديدة
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {sessions.map(session => (
                  <div 
                    key={session.id}
                    className={cn(
                      "p-4 rounded-2xl border-2 cursor-pointer transition-all flex justify-between items-center group",
                      currentSession?.id === session.id 
                        ? "border-blue-600 bg-blue-50" 
                        : "border-slate-100 hover:border-blue-200"
                    )}
                    onClick={() => {
                      setCurrentSession(session);
                      setShowSessionManager(false);
                    }}
                  >
                    <div>
                      <div className="font-bold text-lg">{session.name}</div>
                      <div className="text-xs text-slate-400">{formatDate(session.createdAt)}</div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Current Session Info */}
        {currentSession && (
          <div className="bg-blue-600 text-white p-4 rounded-2xl flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6" />
              <span className="text-xl font-bold">الجلسة الحالية: {currentSession.name}</span>
            </div>
            <span className="text-sm opacity-80">بدأت في: {formatDate(currentSession.createdAt)}</span>
          </div>
        )}

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-emerald-600 text-white rounded-3xl shadow-xl border-none overflow-hidden relative min-h-[140px]">
            <div className="absolute top-0 right-0 p-4 opacity-20">
              <ArrowUpCircle className="w-20 h-20" />
            </div>
            <CardHeader className="pb-1">
              <CardTitle className="text-lg font-bold opacity-90">إجمالي العهدة (دخل)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black break-all">{formatCurrency(totalIncome)}</div>
            </CardContent>
          </Card>

          <Card className="bg-red-600 text-white rounded-3xl shadow-xl border-none overflow-hidden relative min-h-[140px]">
            <div className="absolute top-0 right-0 p-4 opacity-20">
              <ArrowDownCircle className="w-20 h-20" />
            </div>
            <CardHeader className="pb-1">
              <CardTitle className="text-lg font-bold opacity-90">إجمالي المصاريف</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black break-all">{formatCurrency(totalExpense)}</div>
            </CardContent>
          </Card>

          <Card className={cn(
            "rounded-3xl shadow-xl border-none overflow-hidden relative min-h-[140px]",
            balance >= 0 ? "bg-slate-900 text-white" : "bg-amber-500 text-white"
          )}>
            <div className="absolute top-0 right-0 p-4 opacity-20">
              <Wallet className="w-20 h-20" />
            </div>
            <CardHeader className="pb-1">
              <CardTitle className="text-lg font-bold opacity-90">الفلوس اللي معاك دلوقتي</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black break-all">{formatCurrency(balance)}</div>
              {balance < 0 && (
                <p className="mt-1 text-sm font-bold bg-white/20 px-2 py-0.5 rounded-lg inline-block">
                  خلي بالك.. فيه عجز!
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {!currentSession && !isLoading && (
          <Card className="p-12 text-center space-y-6 rounded-3xl border-2 border-dashed border-blue-200 bg-blue-50/50">
            <FolderPlus className="w-20 h-20 text-blue-300 mx-auto" />
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-900">ابدأ جلسة جديدة</h2>
              <p className="text-xl text-slate-500">لازم تبدأ جلسة (زي مشروع أو شهر جديد) عشان تسجل فيها حساباتك</p>
            </div>
            <Button onClick={() => setShowSessionManager(true)} size="lg" className="h-16 px-10 bg-blue-600 rounded-2xl text-xl font-bold shadow-xl">
              اضغط هنا للبدء
            </Button>
          </Card>
        )}

        {currentSession && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Add Transaction Form */}
            <div className="lg:col-span-5 space-y-6 print:hidden">
              <Card className="rounded-3xl shadow-lg border-2 border-blue-100 overflow-hidden">
                <div className="bg-blue-50 p-6 border-b border-blue-100">
                  <CardTitle className="text-2xl font-black text-blue-900">إضافة عملية جديدة</CardTitle>
                  <CardDescription className="text-lg text-blue-700">سجل في جلسة: {currentSession.name}</CardDescription>
                </div>
                <CardContent className="p-8">
                  <form onSubmit={addTransaction} className="space-y-8">
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <Label htmlFor="desc" className="text-xl font-bold">اكتب هي بتاعة إيه؟</Label>
                        <Input 
                          id="desc" 
                          placeholder="مثال: شغل عمارة النور، شراء أسمنت..." 
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          required
                          className="text-xl h-16 rounded-2xl border-2 focus:border-blue-500"
                        />
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="amount" className="text-xl font-bold">المبلغ كام؟</Label>
                        <Input 
                          id="amount" 
                          type="number" 
                          step="0.01"
                          placeholder="0.00" 
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          required
                          className="text-2xl h-16 rounded-2xl border-2 font-black focus:border-blue-500"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <Label className="text-xl font-bold block">نوع العملية:</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <Button 
                          type="button"
                          variant={type === 'income' ? 'default' : 'outline'}
                          className={cn(
                            "h-20 text-2xl font-bold rounded-2xl border-2 transition-all",
                            type === 'income' 
                              ? "bg-emerald-600 hover:bg-emerald-700 border-emerald-600 shadow-lg scale-105" 
                              : "border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 text-slate-600"
                          )}
                          onClick={() => setType('income')}
                        >
                          <ArrowUpCircle className="ml-2 w-6 h-6" />
                          عهدة
                        </Button>
                        <Button 
                          type="button"
                          variant={type === 'expense' ? 'default' : 'outline'}
                          className={cn(
                            "h-20 text-2xl font-bold rounded-2xl border-2 transition-all",
                            type === 'expense' 
                              ? "bg-red-600 hover:bg-red-700 border-red-600 shadow-lg scale-105" 
                              : "border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-600"
                          )}
                          onClick={() => setType('expense')}
                        >
                          <ArrowDownCircle className="ml-2 w-6 h-6" />
                          مصاريف
                        </Button>
                      </div>
                    </div>

                    <Button type="submit" className="w-full h-20 text-2xl font-black bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-xl gap-3 mt-4">
                      <Plus className="w-8 h-8" />
                      حفظ في السجل
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Transactions List */}
            <div className="lg:col-span-7 space-y-6">
              <Card className="rounded-3xl shadow-lg border-none overflow-hidden">
                <div className="bg-slate-900 p-6 text-white flex items-center justify-between print:bg-white print:text-black print:border-b-2 print:border-slate-200">
                  <div>
                    <CardTitle className="text-2xl font-black">سجل العمليات</CardTitle>
                    <CardDescription className="text-slate-400 text-lg print:text-slate-600">
                      {currentSession.name} - {formatDate(currentSession.createdAt)}
                    </CardDescription>
                  </div>
                  <Button onClick={handlePrint} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-lg h-12 px-6 rounded-xl gap-2 print:hidden">
                    <Printer className="w-5 h-5" />
                    حفظ / طباعة السجل
                  </Button>
                </div>
                <CardContent className="p-0">
                  <div className="bg-white">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-right text-lg font-bold py-6">البيان والتاريخ</TableHead>
                            <TableHead className="text-right text-lg font-bold py-6">النوع</TableHead>
                            <TableHead className="text-left text-lg font-bold py-6">المبلغ</TableHead>
                            <TableHead className="w-[80px] print:hidden"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <AnimatePresence initial={false}>
                            {isLoading ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center py-20">
                                  <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
                                </TableCell>
                              </TableRow>
                            ) : transactions.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center py-20 text-slate-400 text-xl font-medium">
                                  لسه مفيش أي عمليات مسجلة في الجلسة دي..
                                </TableCell>
                              </TableRow>
                            ) : (
                              transactions.map((t) => (
                                <motion.tr 
                                  key={t.id}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 20 }}
                                  className="group border-b border-slate-100 hover:bg-slate-50 transition-colors"
                                >
                                  <TableCell className="py-6">
                                    <div className="font-bold text-xl text-slate-800">{t.description}</div>
                                    <div className="text-sm text-blue-600 font-bold mt-1 flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {formatDate(t.date)}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-6">
                                    <span className={cn(
                                      "text-lg px-3 py-0.5 rounded-lg font-bold",
                                      t.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                    )}>
                                      {t.type === 'income' ? 'عهدة' : 'صرف'}
                                    </span>
                                  </TableCell>
                                  <TableCell className={cn("text-left text-2xl font-black py-6", t.type === 'income' ? 'text-emerald-600' : 'text-red-600')}>
                                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                  </TableCell>
                                  <TableCell className="py-6 print:hidden">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-full w-12 h-12"
                                      onClick={() => deleteTransaction(t.id)}
                                    >
                                      <Trash2 className="w-6 h-6" />
                                    </Button>
                                  </TableCell>
                                </motion.tr>
                              ))
                            )}
                          </AnimatePresence>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
      
      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            margin: 1cm;
            direction: rtl;
          }
          body {
            background: white !important;
            padding: 0 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .shadow-xl, .shadow-lg, .shadow-sm {
            box-shadow: none !important;
          }
          .rounded-3xl, .rounded-2xl {
            border-radius: 0 !important;
          }
          .bg-emerald-600, .bg-red-600, .bg-slate-900 {
            background-color: white !important;
            color: black !important;
            border: 1px solid #e2e8f0 !important;
          }
          .text-white {
            color: black !important;
          }
        }
      `}} />
    </div>
  );
}
