import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCheck,
  CreditCard,
  Download,
  Edit3,
  Eye,
  Mail,
  MessageSquare,
  Plus,
  Printer,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest, exportRowsToCsv, formatEtb } from '../utils/api.jsx';
import {
  ConfirmModal,
  IconActionButton,
  ModalFrame,
  SectionHeader,
  StatGrid,
  StatusIndicator,
} from '../components/UiPrimitives.jsx';

export function FinancePanel({ showNotice, activeChildId }) {
  const { user } = useAuth();
  const isStaff = ['Owner', 'Admin'].includes(user.role);
  const [data, setData] = useState({ metrics: {}, fees: [], payments: [], invoices: [], payouts: [], summary: {} });
  const [students, setStudents] = useState([]);
  const [feeForm, setFeeForm] = useState({ studentId: '', title: '', feeType: 'Tuition', amountEtb: 1200, discountEtb: 0, dueDate: '2026-12-15' });
  const [payModalFee, setPayModalFee] = useState(null);
  const [payMethod, setPayMethod] = useState('Telebirr');
  const [payAmount, setPayAmount] = useState('');
  const [viewItem, setViewItem] = useState(null);
  const [editFee, setEditFee] = useState(null);
  const [deleteFee, setDeleteFee] = useState(null);

  async function load() {
    if (user.role === 'Instructor') {
      const d = await apiRequest('/api/finance/instructor-earnings');
      setData(d);
    } else if (isStaff) {
      const [fData, uData] = await Promise.all([
        apiRequest('/api/finance/summary'),
        apiRequest('/api/dashboard/users?role=Student'),
      ]);
      setData(fData);
      setStudents(uData.users || []);
    } else {
      const q = activeChildId ? `?studentId=${activeChildId}` : '';
      const d = await apiRequest(`/api/finance/my${q}`);
      setData(d);
    }
  }
  useEffect(() => {
    load();
  }, [activeChildId, user.role]);

  async function createFee(e) {
    e.preventDefault();
    try {
      await apiRequest('/api/finance/fees', { method: 'POST', body: feeForm });
      showNotice('Fee & invoice created.');
      setFeeForm({ ...feeForm, title: '' });
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function saveEditFee(e) {
    e.preventDefault();
    if (!editFee) return;
    try {
      await apiRequest(`/api/finance/fees/${editFee.id}`, {
        method: 'PUT',
        body: {
          title: editFee.title,
          feeType: editFee.fee_type,
          amountEtb: Number(editFee.amount_etb),
          discountEtb: Number(editFee.discount_etb || 0),
          dueDate: editFee.due_date,
          status: editFee.status,
        },
      });
      showNotice('Fee record updated.');
      setEditFee(null);
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function handlePayFee(e) {
    e.preventDefault();
    if (!payModalFee) return;
    try {
      const res = await apiRequest(`/api/finance/fees/${payModalFee.id}/pay`, {
        method: 'POST',
        body: { amountEtb: payAmount ? Number(payAmount) : undefined, method: payMethod },
      });
      showNotice(res.message);
      setPayModalFee(null);
      setPayAmount('');
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function reviewProRequest(id, status) {
    try {
      const res = await apiRequest(`/api/finance/ezana-pro/requests/${id}`, {
        method: 'PATCH',
        body: { status },
      });
      showNotice(res.message);
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  if (user.role === 'Instructor') {
    return (
      <div className="space-y-6 animate-fade-up">
        <SectionHeader title="Earnings & Payout History" subtitle="Teaching stipends and course royalty statements." />
        <StatGrid
          items={[
            { label: 'Total Earned', value: formatEtb(data.summary?.totalEarned || 0) },
            { label: 'Paid Out', value: formatEtb(data.summary?.totalPaid || 0) },
            { label: 'Pending Settlement', value: formatEtb(data.summary?.totalPending || 0) },
            { label: 'Statements', value: (data.payouts || []).length },
          ]}
        />
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Paid Date</th>
                <th className="py-3 px-4 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data.payouts || []).map((p) => (
                <tr key={p.id}>
                  <td className="py-3 px-4 font-medium">{p.period_label}</td>
                  <td className="py-3 px-4 font-mono text-xs">{p.reference}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">{formatEtb(p.amount_etb)}</td>
                  <td className="py-3 px-4"><StatusIndicator status={p.status} /></td>
                  <td className="py-3 px-4 text-xs font-mono">{p.paid_at || 'Pending'}</td>
                  <td className="py-3 px-4 text-right">
                    <IconActionButton icon={Eye} label="Read payout statement" variant="info" onClick={() => setViewItem({ kind: 'Payout Statement', title: p.period_label, ref: p.reference, amount: p.amount_etb, status: p.status, meta: `Instructor: ${p.instructor_name || user.first_name} · Paid: ${p.paid_at || 'Pending'}` })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ModalFrame open={Boolean(viewItem)} onClose={() => setViewItem(null)} title={viewItem?.kind || 'Details'} maxWidth="max-w-md">
          {viewItem && (
            <div className="space-y-2 text-sm">
              <p className="font-mono text-xs text-blue-700">{viewItem.ref}</p>
              <p className="font-semibold text-slate-900">{viewItem.title}</p>
              <p className="text-slate-600">{viewItem.meta}</p>
              <p className="font-mono font-bold text-slate-900">{formatEtb(viewItem.amount)}</p>
              <StatusIndicator status={viewItem.status} />
            </div>
          )}
        </ModalFrame>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionHeader
        title="Fees, Payments, Invoices & Receipts"
        subtitle={isStaff ? 'Academy-wide tuition ledgers, verified transactions, and financial exports.' : 'Manage tuition balances, complete payments, and download official receipts.'}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => exportRowsToCsv('ezana-payments.csv', data.payments || [])} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-300 bg-white rounded-lg hover:bg-slate-50">
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel/CSV</span>
            </button>
            <button onClick={() => window.print()} className="no-print inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-300 bg-white rounded-lg hover:bg-slate-50">
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        }
      />

      {isStaff && (
        <StatGrid
          items={[
            { label: 'Total Verified Revenue', value: formatEtb(data.metrics?.totalRevenue || 0), hint: `${data.metrics?.pendingProCount || 0} pending Pro approvals` },
            { label: 'Outstanding Balances', value: formatEtb(data.metrics?.outstandingBalance || 0) },
            { label: 'Paid Fees', value: data.metrics?.paidFeesCount || 0 },
            { label: 'Unpaid / Partial Fees', value: data.metrics?.unpaidFeesCount || 0 },
          ]}
        />
      )}

      {isStaff && (data.proRequests || []).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-slate-900">Ezana Pro Upgrade Requests (ETB 218)</h3>
            <span className="text-xs font-medium text-amber-700">{data.metrics?.pendingProCount || 0} Pending</span>
          </div>
          <div className="divide-y divide-slate-100 text-sm">
            {data.proRequests.map((req) => (
              <div key={req.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">
                    {req.student_name} <span className="text-xs font-normal text-slate-500">({req.student_email})</span>
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Course: <strong>{req.course_title}</strong> · {formatEtb(req.amount_etb)} · {req.payment_method || 'Ye-Buna'}
                    {req.payment_reference && <span className="ml-2 font-mono text-slate-500">{req.payment_reference}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusIndicator status={req.status} />
                  <IconActionButton icon={Eye} label="Read Pro request details" variant="info" onClick={() => setViewItem({ kind: 'Ezana Pro Upgrade', title: req.course_title, ref: req.payment_reference || 'PENDING', amount: req.amount_etb, status: req.status, meta: `${req.student_name} (${req.student_email}) · ${req.payment_method || 'Ye-Buna'}` })} />
                  {req.status === 'Pending' && (
                    <>
                      <IconActionButton icon={Check} label="Approve Pro upgrade" variant="success" onClick={() => reviewProRequest(req.id, 'Approved')} />
                      <IconActionButton icon={X} label="Reject Pro upgrade" variant="danger" onClick={() => reviewProRequest(req.id, 'Rejected')} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isStaff && (data.entitlements || []).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h3 className="font-display text-sm font-semibold text-slate-900">Ezana Pro Course Access Requests</h3>
          </div>
          <div className="divide-y divide-slate-100 text-sm">
            {data.entitlements.map((ent) => (
              <div key={ent.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{ent.course_title}</p>
                  <p className="text-xs text-slate-500 font-mono tabular-nums">{ent.plan_name} · {formatEtb(ent.amount_etb)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusIndicator status={ent.status} />
                  <IconActionButton icon={Eye} label="Read entitlement status" variant="info" onClick={() => setViewItem({ kind: 'Ezana Pro Entitlement', title: ent.course_title, ref: ent.plan_name, amount: ent.amount_etb, status: ent.status, meta: `Requested: ${ent.granted_at?.slice(0, 10) || '—'}` })} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isStaff && (
        <form onSubmit={createFee} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-6 gap-3 items-center">
          <select required value={feeForm.studentId} onChange={(e) => setFeeForm({ ...feeForm, studentId: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
            <option value="">Select Student</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
          </select>
          <input required placeholder="Fee Description" value={feeForm.title} onChange={(e) => setFeeForm({ ...feeForm, title: e.target.value })} className="sm:col-span-2 px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <input type="number" required placeholder="ETB Amount" value={feeForm.amountEtb} onChange={(e) => setFeeForm({ ...feeForm, amountEtb: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums" />
          <input type="date" value={feeForm.dueDate} onChange={(e) => setFeeForm({ ...feeForm, dueDate: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <div className="flex justify-end">
            <IconActionButton icon={Plus} label="Create student fee" type="submit" variant="primary" />
          </div>
        </form>
      )}

      {/* Fees Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-slate-200">
          <h3 className="font-display text-sm font-semibold text-slate-900">Student Fee Ledger</h3>
        </div>
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <th className="py-3 px-4">Student</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4 text-right">Net Fee</th>
              <th className="py-3 px-4 text-right">Paid</th>
              <th className="py-3 px-4 text-right">Balance</th>
              <th className="py-3 px-4">Due Date</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">CRUD &amp; Pay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(data.fees || []).map((f) => {
              const net = Math.max(Number(f.amount_etb) - Number(f.discount_etb || 0), 0);
              const bal = Math.max(net - Number(f.paid_etb || 0), 0);
              return (
                <tr key={f.id}>
                  <td className="py-3 px-4 font-medium">{f.student_name}</td>
                  <td className="py-3 px-4 text-xs text-slate-700">{f.title}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">{formatEtb(net)}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">{formatEtb(f.paid_etb)}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">{formatEtb(bal)}</td>
                  <td className="py-3 px-4 text-xs font-mono tabular-nums">{f.due_date}</td>
                  <td className="py-3 px-4"><StatusIndicator status={f.status} /></td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <IconActionButton icon={Eye} label="Read fee breakdown" variant="info" onClick={() => setViewItem({ kind: 'Fee Ledger Entry', title: f.title, ref: f.fee_type, amount: net, status: f.status, meta: `Student: ${f.student_name} · Paid: ${formatEtb(f.paid_etb)} · Balance: ${formatEtb(bal)} · Due ${f.due_date}` })} />
                      {bal > 0 && (
                        <IconActionButton
                          icon={CreditCard}
                          label="Pay remaining balance"
                          variant="primary"
                          onClick={() => {
                            setPayModalFee(f);
                            setPayAmount(String(bal));
                          }}
                        />
                      )}
                      {isStaff && (
                        <>
                          <IconActionButton icon={Edit3} label="Edit fee record" onClick={() => setEditFee({ ...f })} />
                          <IconActionButton icon={Trash2} label="Delete fee record" variant="danger" onClick={() => setDeleteFee(f)} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Transactions & Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h3 className="font-display text-sm font-semibold text-slate-900">Payment Transactions &amp; Receipts</h3>
          </div>
          <div className="divide-y divide-slate-100 text-sm">
            {(data.payments || []).length === 0 ? (
              <p className="p-6 text-xs text-slate-500">No payment transactions recorded yet.</p>
            ) : (
              data.payments.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs font-semibold text-slate-900">{p.reference}</p>
                    <p className="text-xs text-slate-600">{p.payment_type} · {p.method} · {p.student_name || p.payer_name}</p>
                    {p.course_title && <p className="text-xs text-slate-500">{p.course_title}</p>}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="text-right">
                      <p className="font-mono font-semibold text-slate-900 tabular-nums">{formatEtb(p.amount_etb)}</p>
                      <StatusIndicator status={p.status} />
                    </div>
                    <IconActionButton icon={Eye} label="View official payment receipt" variant="info" onClick={() => setViewItem({ kind: 'Official Receipt', title: p.course_title || p.payment_type, ref: p.reference, amount: p.amount_etb, status: p.status, meta: `Payer/Student: ${p.student_name || p.payer_name} · Method: ${p.method} · Date: ${p.paid_at?.slice(0, 16) || 'Pending'}` })} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h3 className="font-display text-sm font-semibold text-slate-900">Invoices</h3>
          </div>
          <div className="divide-y divide-slate-100 text-sm">
            {(data.invoices || []).map((inv) => (
              <div key={inv.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-semibold text-blue-700">{inv.invoice_number}</p>
                  <p className="text-xs text-slate-600">{inv.student_name} · {inv.fee_title || 'Ezana Pro Course Access'}</p>
                  <p className="text-xs text-slate-500">Issued {inv.issue_date} · Due {inv.due_date}</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="text-right">
                    <p className="font-mono font-semibold tabular-nums">{formatEtb(inv.amount_etb)}</p>
                    <StatusIndicator status={inv.status} />
                  </div>
                  <IconActionButton icon={Eye} label="View invoice" variant="info" onClick={() => setViewItem({ kind: 'Academy Invoice', title: inv.fee_title || 'Ezana Pro Course Access', ref: inv.invoice_number, amount: inv.amount_etb, status: inv.status, meta: `Student: ${inv.student_name} (${inv.student_code}) · Issued: ${inv.issue_date} · Due: ${inv.due_date}` })} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ModalFrame open={Boolean(payModalFee)} onClose={() => setPayModalFee(null)} title="Record / Make Fee Payment" maxWidth="max-w-md">
        {payModalFee && (
          <form onSubmit={handlePayFee} className="space-y-4">
            <p className="text-sm text-slate-700">{payModalFee.title} — <span className="font-semibold">{payModalFee.student_name}</span></p>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Amount (ETB)</label>
              <input type="number" step="0.01" required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option>Telebirr</option>
                <option>CBE Birr</option>
                <option>Chapa</option>
                <option>Amole</option>
                <option>Bank Transfer</option>
              </select>
            </div>
            <button type="submit" className="w-full py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg">
              Confirm Verified Payment
            </button>
          </form>
        )}
      </ModalFrame>

      <ModalFrame open={Boolean(viewItem)} onClose={() => setViewItem(null)} title={viewItem?.kind || 'Financial Document'} maxWidth="max-w-md">
        {viewItem && (
          <div className="space-y-3 text-sm">
            <p className="font-mono text-xs text-blue-700">{viewItem.ref}</p>
            <h4 className="font-display text-base font-bold text-slate-900">{viewItem.title}</h4>
            <p className="text-slate-600">{viewItem.meta}</p>
            <p className="font-mono text-lg font-bold text-slate-900">{formatEtb(viewItem.amount)}</p>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <StatusIndicator status={viewItem.status} />
              <button onClick={() => window.print()} className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg">
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>
        )}
      </ModalFrame>

      <ModalFrame open={Boolean(editFee)} onClose={() => setEditFee(null)} title="Edit Fee Record" maxWidth="max-w-md">
        {editFee && (
          <form onSubmit={saveEditFee} className="space-y-3">
            <input required value={editFee.title} onChange={(e) => setEditFee({ ...editFee, title: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" required value={editFee.amount_etb} onChange={(e) => setEditFee({ ...editFee, amount_etb: e.target.value })} placeholder="Amount" className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              <input type="number" value={editFee.discount_etb || 0} onChange={(e) => setEditFee({ ...editFee, discount_etb: e.target.value })} placeholder="Discount" className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={editFee.due_date} onChange={(e) => setEditFee({ ...editFee, due_date: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              <select value={editFee.status} onChange={(e) => setEditFee({ ...editFee, status: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option value="Unpaid">Unpaid</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditFee(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">Save Changes</button>
            </div>
          </form>
        )}
      </ModalFrame>

      <ConfirmModal
        open={Boolean(deleteFee)}
        title="Delete Fee Record"
        message={`Delete fee "${deleteFee?.title}" for ${deleteFee?.student_name}?`}
        confirmLabel="Delete Fee"
        danger
        onConfirm={async () => {
          await apiRequest(`/api/finance/fees/${deleteFee.id}`, { method: 'DELETE' });
          setDeleteFee(null);
          showNotice('Fee deleted.');
          load();
        }}
        onCancel={() => setDeleteFee(null)}
      />
    </div>
  );
}

export function CommunicationPanel({ showNotice, defaultTab = 'messages' }) {
  const { user } = useAuth();
  const [tab, setTab] = useState(defaultTab);
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [discussions, setDiscussions] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [courses, setCourses] = useState([]);

  const [msgForm, setMsgForm] = useState({ recipient_id: '', subject: '', body: '' });
  const [annForm, setAnnForm] = useState({ title: '', content: '', target_role: 'All' });
  const [discForm, setDiscForm] = useState({ course_id: '', title: '', body: '' });
  const [ticketForm, setTicketForm] = useState({ subject: '', category: 'General', description: '' });

  const [viewItem, setViewItem] = useState(null);
  const [editAnn, setEditAnn] = useState(null);
  const [editDisc, setEditDisc] = useState(null);
  const [editTicket, setEditTicket] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  async function load() {
    const [m, a, n, d, s, c] = await Promise.all([
      apiRequest('/api/communication/messages'),
      apiRequest('/api/communication/announcements'),
      apiRequest('/api/communication/notifications'),
      apiRequest('/api/communication/discussions'),
      apiRequest('/api/communication/support'),
      apiRequest('/api/courses?limit=50'),
    ]);
    setMessages(m.messages || []);
    setContacts(m.contacts || []);
    setAnnouncements(a.announcements || []);
    setNotifications(n.notifications || []);
    setDiscussions(d.posts || []);
    setTickets(s.tickets || []);
    setCourses(c.courses || []);
  }
  useEffect(() => {
    load();
  }, []);

  async function sendMessage(e) {
    e.preventDefault();
    await apiRequest('/api/communication/messages', { method: 'POST', body: msgForm });
    showNotice('Message sent.');
    setMsgForm({ recipient_id: '', subject: '', body: '' });
    load();
  }

  async function postAnnouncement(e) {
    e.preventDefault();
    await apiRequest('/api/communication/announcements', { method: 'POST', body: annForm });
    showNotice('Announcement published.');
    setAnnForm({ title: '', content: '', target_role: 'All' });
    load();
  }

  async function saveEditAnn(e) {
    e.preventDefault();
    await apiRequest(`/api/communication/announcements/${editAnn.id}`, { method: 'PUT', body: editAnn });
    showNotice('Announcement updated.');
    setEditAnn(null);
    load();
  }

  async function postDiscussion(e) {
    e.preventDefault();
    await apiRequest('/api/communication/discussions', { method: 'POST', body: discForm });
    showNotice('Discussion post added.');
    setDiscForm({ course_id: '', title: '', body: '' });
    load();
  }

  async function saveEditDisc(e) {
    e.preventDefault();
    await apiRequest(`/api/communication/discussions/${editDisc.id}`, { method: 'PUT', body: editDisc });
    showNotice('Discussion updated.');
    setEditDisc(null);
    load();
  }

  async function submitTicket(e) {
    e.preventDefault();
    await apiRequest('/api/communication/support', { method: 'POST', body: ticketForm });
    showNotice('Support request submitted.');
    setTicketForm({ subject: '', category: 'General', description: '' });
    load();
  }

  async function saveEditTicket(e) {
    e.preventDefault();
    await apiRequest(`/api/communication/support/${editTicket.id}`, {
      method: 'PATCH',
      body: { status: editTicket.status, response_text: editTicket.response_text },
    });
    showNotice('Support ticket updated.');
    setEditTicket(null);
    load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const urlMap = {
      message: `/api/communication/messages/${deleteTarget.id}`,
      announcement: `/api/communication/announcements/${deleteTarget.id}`,
      discussion: `/api/communication/discussions/${deleteTarget.id}`,
      notification: `/api/communication/notifications/${deleteTarget.id}`,
      ticket: `/api/communication/support/${deleteTarget.id}`,
    };
    await apiRequest(urlMap[deleteTarget.kind], { method: 'DELETE' });
    showNotice('Removed.');
    setDeleteTarget(null);
    load();
  }

  const isStaff = ['Owner', 'Admin'].includes(user.role);

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionHeader
        title="Communication Center"
        subtitle="Direct messages, academy announcements, course forums, notifications, and support requests."
        actions={
          <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
            {[
              ['messages', 'Messages'],
              ['announcements', 'Announcements'],
              ['forums', 'Forums'],
              ['notifications', 'Notifications'],
              ['support', 'Support'],
            ].map(([id, lbl]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md ${tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
              >
                {lbl}
              </button>
            ))}
          </div>
        }
      />

      {tab === 'messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={sendMessage} className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-3 h-fit">
            <h3 className="font-display text-base font-semibold flex items-center gap-2"><Mail className="w-4 h-4 text-blue-700" />Compose Message</h3>
            <select required value={msgForm.recipient_id} onChange={(e) => setMsgForm({ ...msgForm, recipient_id: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              <option value="">Select Recipient</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.role})</option>)}
            </select>
            <input required placeholder="Subject" value={msgForm.subject} onChange={(e) => setMsgForm({ ...msgForm, subject: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <textarea required rows={4} placeholder="Write message..." value={msgForm.body} onChange={(e) => setMsgForm({ ...msgForm, body: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <button type="submit" className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg">
              <Send className="w-4 h-4" />
              <span>Send Message</span>
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {messages.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">No conversations yet.</div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>
                        <strong className="text-slate-900">{m.sender_name}</strong> ({m.sender_role}) &rarr; <strong className="text-slate-900">{m.recipient_name}</strong>
                      </span>
                      <span className="font-mono">{m.created_at?.slice(0, 16)}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{m.subject}</p>
                    <p className="text-sm text-slate-600 line-clamp-2">{m.body}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <IconActionButton icon={Eye} label="Read full message" variant="info" onClick={() => setViewItem({ kind: 'Direct Message', title: m.subject, meta: `From ${m.sender_name} (${m.sender_role}) to ${m.recipient_name} · ${m.created_at?.slice(0, 16)}`, body: m.body })} />
                    {!m.is_read && m.recipient_id === user.id && (
                      <IconActionButton
                        icon={Check}
                        label="Mark message as read"
                        variant="success"
                        onClick={async () => {
                          await apiRequest(`/api/communication/messages/${m.id}/read`, { method: 'PATCH' });
                          load();
                        }}
                      />
                    )}
                    <IconActionButton icon={Trash2} label="Archive message" variant="danger" onClick={() => setDeleteTarget({ kind: 'message', id: m.id, label: m.subject })} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'announcements' && (
        <div className="space-y-6">
          {['Owner', 'Admin', 'Instructor'].includes(user.role) && (
            <form onSubmit={postAnnouncement} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-semibold">Publish Announcement</h3>
                <IconActionButton icon={Plus} label="Publish announcement" type="submit" variant="primary" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input required placeholder="Announcement Title" value={annForm.title} onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })} className="sm:col-span-2 px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                <select value={annForm.target_role} onChange={(e) => setAnnForm({ ...annForm, target_role: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                  <option value="All">All Users</option>
                  <option value="Student">Students</option>
                  <option value="Instructor">Instructors</option>
                  <option value="Parent">Parents</option>
                </select>
              </div>
              <textarea required rows={2} placeholder="Notice content..." value={annForm.content} onChange={(e) => setAnnForm({ ...annForm, content: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </form>
          )}
          <div className="space-y-3">
            {announcements.map((a) => {
              const canMutate = isStaff || (user.role === 'Instructor' && a.author_id === user.id);
              return (
                <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>Target: {a.target_role} · By {a.author_name || 'Academy Office'}</span>
                      <span className="font-mono">{a.created_at?.slice(0, 10)}</span>
                    </div>
                    <h4 className="mt-1 font-display text-base font-semibold text-slate-900">{a.title}</h4>
                    <p className="mt-1.5 text-sm text-slate-600">{a.content}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <IconActionButton icon={Eye} label="Read announcement" variant="info" onClick={() => setViewItem({ kind: 'Announcement', title: a.title, meta: `Target: ${a.target_role} · By ${a.author_name || 'Academy Office'}`, body: a.content })} />
                    {canMutate && (
                      <>
                        <IconActionButton icon={Edit3} label="Edit announcement" onClick={() => setEditAnn({ ...a })} />
                        <IconActionButton icon={Trash2} label="Delete announcement" variant="danger" onClick={() => setDeleteTarget({ kind: 'announcement', id: a.id, label: a.title })} />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'forums' && (
        <div className="space-y-6">
          <form onSubmit={postDiscussion} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold flex items-center gap-2"><MessageSquare className="w-4 h-4 text-blue-700" />Start Course Discussion</h3>
              <IconActionButton icon={Plus} label="Publish forum post" type="submit" variant="primary" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select required value={discForm.course_id} onChange={(e) => setDiscForm({ ...discForm, course_id: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option value="">Select Course</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <input required placeholder="Topic Title" value={discForm.title} onChange={(e) => setDiscForm({ ...discForm, title: e.target.value })} className="sm:col-span-2 px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <textarea required rows={2} placeholder="Ask a question or share study insights..." value={discForm.body} onChange={(e) => setDiscForm({ ...discForm, body: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </form>

          <div className="space-y-3">
            {discussions.map((d) => {
              const canMutate = ['Owner', 'Admin', 'Instructor'].includes(user.role) || d.user_id === user.id;
              return (
                <div key={d.id} className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{d.course_title} · {d.author_name} ({d.author_role})</span>
                      <span className="font-mono">{d.created_at?.slice(0, 10)}</span>
                    </div>
                    {d.title && <h4 className="mt-1 font-display text-base font-semibold text-slate-900">{d.title}</h4>}
                    <p className="mt-1 text-sm text-slate-600">{d.body}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <IconActionButton icon={Eye} label="Read discussion post" variant="info" onClick={() => setViewItem({ kind: 'Forum Discussion', title: d.title || d.course_title, meta: `${d.course_title} · ${d.author_name} (${d.author_role})`, body: d.body })} />
                    {canMutate && (
                      <>
                        <IconActionButton icon={Edit3} label="Edit discussion post" onClick={() => setEditDisc({ ...d })} />
                        <IconActionButton icon={Trash2} label="Delete discussion post" variant="danger" onClick={() => setDeleteTarget({ kind: 'discussion', id: d.id, label: d.title || 'Discussion post' })} />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          <div className="px-5 py-3 flex items-center justify-between bg-slate-50">
            <span className="text-xs font-semibold text-slate-600">{notifications.filter((n) => !n.is_read).length} unread notifications</span>
            <IconActionButton
              icon={CheckCheck}
              label="Mark all notifications as read"
              variant="info"
              onClick={async () => {
                await apiRequest('/api/communication/notifications/read-all', { method: 'PATCH' });
                showNotice('All notifications marked read.');
                load();
              }}
            />
          </div>
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">All caught up — no notifications.</div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className={`p-4 flex items-start justify-between gap-4 ${n.is_read ? 'opacity-70' : 'bg-blue-50/30'}`}>
                <div>
                  <p className="text-xs text-slate-500">{n.category} · {n.created_at?.slice(0, 16)}</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{n.title}</p>
                  <p className="text-sm text-slate-600 mt-0.5">{n.body}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <IconActionButton icon={Eye} label="Read notification" variant="info" onClick={() => setViewItem({ kind: 'Notification', title: n.title, meta: `${n.category} · ${n.created_at?.slice(0, 16)}`, body: n.body })} />
                  {!n.is_read && (
                    <IconActionButton
                      icon={Check}
                      label="Mark notification as read"
                      variant="success"
                      onClick={async () => {
                        await apiRequest(`/api/communication/notifications/${n.id}/read`, { method: 'PATCH' });
                        load();
                      }}
                    />
                  )}
                  <IconActionButton icon={Trash2} label="Delete notification" variant="danger" onClick={() => setDeleteTarget({ kind: 'notification', id: n.id, label: n.title })} />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'support' && (
        <div className="space-y-6">
          <form onSubmit={submitTicket} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold">Submit Support Request or Feedback</h3>
              <IconActionButton icon={Plus} label="Submit support ticket" type="submit" variant="primary" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input required placeholder="Subject" value={ticketForm.subject} onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })} className="sm:col-span-2 px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              <select value={ticketForm.category} onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option>General</option>
                <option>Account</option>
                <option>Finance</option>
                <option>Technical</option>
              </select>
            </div>
            <textarea required rows={2} placeholder="Describe your inquiry..." value={ticketForm.description} onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </form>

          <div className="space-y-3">
            {tickets.map((t) => {
              const canDeleteTicket = isStaff || t.user_id === user.id;
              return (
                <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{t.subject}</p>
                    <div className="flex items-center gap-1.5">
                      <StatusIndicator status={t.status} />
                      <IconActionButton icon={Eye} label="Read support ticket" variant="info" onClick={() => setViewItem({ kind: 'Support Ticket', title: t.subject, meta: `${t.category} · ${t.user_name} (${t.user_role}) · ${t.status}`, body: `${t.description}${t.response_text ? `\n\nAdmin Response: ${t.response_text}` : ''}` })} />
                      {isStaff && (
                        <IconActionButton icon={Edit3} label="Respond / update ticket" onClick={() => setEditTicket({ ...t, response_text: t.response_text || '' })} />
                      )}
                      {isStaff && t.status !== 'Resolved' && (
                        <IconActionButton
                          icon={Check}
                          label="Mark ticket resolved"
                          variant="success"
                          onClick={async () => {
                            await apiRequest(`/api/communication/support/${t.id}`, {
                              method: 'PATCH',
                              body: { status: 'Resolved', response_text: 'Reviewed and resolved by Academy Administration.' },
                            });
                            showNotice('Ticket marked Resolved.');
                            load();
                          }}
                        />
                      )}
                      {canDeleteTicket && (
                        <IconActionButton icon={Trash2} label="Delete support ticket" variant="danger" onClick={() => setDeleteTarget({ kind: 'ticket', id: t.id, label: t.subject })} />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">{t.category} · Submitted by {t.user_name} ({t.user_role})</p>
                  <p className="text-sm text-slate-600">{t.description}</p>
                  {t.response_text && (
                    <p className="text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-700">
                      Admin Response: {t.response_text}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ModalFrame open={Boolean(viewItem)} onClose={() => setViewItem(null)} title={viewItem ? `${viewItem.kind}: ${viewItem.title}` : ''} maxWidth="max-w-lg">
        {viewItem && (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-slate-500">{viewItem.meta}</p>
            <p className="text-slate-700 whitespace-pre-wrap">{viewItem.body}</p>
          </div>
        )}
      </ModalFrame>

      <ModalFrame open={Boolean(editAnn)} onClose={() => setEditAnn(null)} title="Edit Announcement" maxWidth="max-w-md">
        {editAnn && (
          <form onSubmit={saveEditAnn} className="space-y-3">
            <input required value={editAnn.title} onChange={(e) => setEditAnn({ ...editAnn, title: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <select value={editAnn.target_role} onChange={(e) => setEditAnn({ ...editAnn, target_role: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              <option value="All">All Users</option>
              <option value="Student">Students</option>
              <option value="Instructor">Instructors</option>
              <option value="Parent">Parents</option>
            </select>
            <textarea required rows={3} value={editAnn.content} onChange={(e) => setEditAnn({ ...editAnn, content: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditAnn(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">Save Changes</button>
            </div>
          </form>
        )}
      </ModalFrame>

      <ModalFrame open={Boolean(editDisc)} onClose={() => setEditDisc(null)} title="Edit Forum Post" maxWidth="max-w-md">
        {editDisc && (
          <form onSubmit={saveEditDisc} className="space-y-3">
            <input value={editDisc.title || ''} onChange={(e) => setEditDisc({ ...editDisc, title: e.target.value })} placeholder="Topic Title" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <textarea required rows={3} value={editDisc.body} onChange={(e) => setEditDisc({ ...editDisc, body: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditDisc(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">Save Changes</button>
            </div>
          </form>
        )}
      </ModalFrame>

      <ModalFrame open={Boolean(editTicket)} onClose={() => setEditTicket(null)} title="Respond to Support Ticket" maxWidth="max-w-md">
        {editTicket && (
          <form onSubmit={saveEditTicket} className="space-y-3">
            <select value={editTicket.status} onChange={(e) => setEditTicket({ ...editTicket, status: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
            </select>
            <textarea required rows={3} placeholder="Official response..." value={editTicket.response_text || ''} onChange={(e) => setEditTicket({ ...editTicket, response_text: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditTicket(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">Save Response</button>
            </div>
          </form>
        )}
      </ModalFrame>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Confirm Delete"
        message={`Remove "${deleteTarget?.label}"?`}
        confirmLabel="Remove"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
