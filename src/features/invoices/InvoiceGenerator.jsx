// src/features/invoices/InvoiceGenerator.jsx
import React, { useState, useRef } from 'react';
import { 
    Plus, Trash2, Save, Printer, Send, 
    User, Calendar, DollarSign, FileText,
    ChevronLeft, CheckCircle, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, collection, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Logo } from '../../components/common/Logo';

// --- INVOICE TEMPLATE (The Printable Part) ---
const InvoiceTemplate = ({ data, contractorProfile }) => {
    const total = data.items.reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0);
    const tax = total * (data.taxRate / 100);
    const grandTotal = total + tax;

    return (
        <div className="bg-white p-8 md:p-12 shadow-lg min-h-[1000px] w-full max-w-4xl mx-auto text-slate-800 printable-invoice" id="invoice-preview">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-8 mb-8">
                <div>
                    <h1 className="text-4xl font-bold text-slate-900 mb-2">INVOICE</h1>
                    <p className="text-slate-500 font-medium">#{data.invoiceNumber || 'DRAFT'}</p>
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-bold text-emerald-600 mb-1">
                        {contractorProfile?.profile?.companyName || 'Contractor Name'}
                    </h2>
                    <p className="text-sm text-slate-500">{contractorProfile?.profile?.email}</p>
                    <p className="text-sm text-slate-500">{contractorProfile?.profile?.phone}</p>
                </div>
            </div>

            {/* Bill To / Details */}
            <div className="flex justify-between mb-12">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Bill To</p>
                    <h3 className="text-lg font-bold text-slate-800">{data.customerName || 'Customer Name'}</h3>
                    <p className="text-slate-500">{data.customerEmail}</p>
                    {data.customerAddress && <p className="text-slate-500 max-w-xs">{data.customerAddress}</p>}
                </div>
                <div className="text-right">
                    <div className="mb-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Date</p>
                        <p className="font-medium">{new Date(data.date).toLocaleDateString()}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Due Date</p>
                        <p className="font-medium">{new Date(data.dueDate).toLocaleDateString()}</p>
                    </div>
                </div>
            </div>

            {/* Line Items */}
            <table className="w-full mb-8">
                <thead>
                    <tr className="border-b-2 border-slate-100 text-left">
                        <th className="py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Item & Description</th>
                        <th className="py-3 text-xs font-bold text-slate-500 uppercase tracking-wide text-right">Cost</th>
                    </tr>
                </thead>
                <tbody>
                    {data.items.map((item, i) => (
                        <tr key={i} className="border-b border-slate-50">
                            <td className="py-4">
                                <p className="font-bold text-slate-800">{item.description}</p>
                                {item.notes && <p className="text-sm text-slate-500 mt-1">{item.notes}</p>}
                            </td>
                            <td className="py-4 text-right font-medium">
                                ${parseFloat(item.cost || 0).toFixed(2)}
                            </td>
                        </tr>
                    ))}
                    {data.items.length === 0 && (
                        <tr>
                            <td colSpan="2" className="py-8 text-center text-slate-400 italic">No items added yet</td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mb-12">
                <div className="w-64 space-y-3">
                    <div className="flex justify-between text-slate-600">
                        <span>Subtotal</span>
                        <span>${total.toFixed(2)}</span>
                    </div>
                    {data.taxRate > 0 && (
                        <div className="flex justify-between text-slate-600">
                            <span>Tax ({data.taxRate}%)</span>
                            <span>${tax.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-lg font-bold text-slate-900 border-t border-slate-200 pt-3">
                        <span>Total</span>
                        <span>${grandTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            {data.notes && (
                <div className="border-t border-slate-100 pt-8">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Notes</p>
                    <p className="text-sm text-slate-600">{data.notes}</p>
                </div>
            )}
            
            <div className="mt-12 text-center text-xs text-slate-400">
                <p>Generated by Krib for Pros</p>
            </div>
        </div>
    );
};

// --- MAIN GENERATOR COMPONENT ---
export const InvoiceGenerator = ({ contractorProfile, customers, onBack }) => {
    const [step, setStep] = useState('edit'); // 'edit' | 'preview'
    const [saving, setSaving] = useState(false);
    
    // Form State
    const [invoiceData, setInvoiceData] = useState({
        invoiceNumber: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
        customerId: '',
        customerName: '',
        customerEmail: '',
        customerAddress: '',
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: [{ id: 1, description: '', cost: '', notes: '' }],
        taxRate: 0,
        notes: 'Thank you for your business!',
        status: 'draft'
    });

    const handleCustomerSelect = (e) => {
        const customerId = e.target.value;
        const customer = customers.find(c => c.id === customerId);
        
        if (customer) {
            setInvoiceData(prev => ({
                ...prev,
                customerId: customer.id,
                customerName: customer.customerName || 'Valued Customer',
                customerEmail: '', // Need to pull from customer record if available
                customerAddress: customer.propertyName || ''
            }));
        }
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...invoiceData.items];
        newItems[index][field] = value;
        setInvoiceData(prev => ({ ...prev, items: newItems }));
    };

    const addItem = () => {
        setInvoiceData(prev => ({
            ...prev,
            items: [...prev.items, { id: Date.now(), description: '', cost: '', notes: '' }]
        }));
    };

    const removeItem = (index) => {
        if (invoiceData.items.length === 1) return;
        setInvoiceData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handlePrint = () => {
        window.print();
    };

    const handleSave = async (status = 'draft') => {
        setSaving(true);
        try {
            // 1. Calculate Totals
            const total = invoiceData.items.reduce((sum, i) => sum + (parseFloat(i.cost) || 0), 0);
            
            // 2. Save Invoice to Firestore
            const invoiceRef = await addDoc(collection(db, `contractors/${contractorProfile.uid}/invoices`), {
                ...invoiceData,
                contractorId: contractorProfile.uid,
                contractorName: contractorProfile.profile.companyName,
                total: total,
                status: status,
                createdAt: serverTimestamp()
            });

            // 3. IMPORTANT: If 'sent', auto-create records for the homeowner
            // Note: In a real app, this would trigger a Cloud Function or complex client logic
            // For MVP, we'll just save the invoice and toast the success
            
            toast.success(`Invoice ${status === 'sent' ? 'sent' : 'saved'} successfully!`);
            if (onBack) onBack();
            
        } catch (error) {
            console.error(error);
            toast.error('Failed to save invoice');
        } finally {
            setSaving(false);
        }
    };

    // --- RENDER ---
    
    if (step === 'preview') {
        return (
            <div className="min-h-screen bg-slate-100 pb-20">
                {/* Preview Header */}
                <div className="bg-slate-900 text-white p-4 sticky top-0 z-50 flex justify-between items-center shadow-lg no-print">
                    <button onClick={() => setStep('edit')} className="text-slate-300 hover:text-white flex items-center gap-2">
                        <ChevronLeft size={20} /> Back to Edit
                    </button>
                    <div className="flex gap-2">
                        <button onClick={() => handleSave('draft')} className="px-4 py-2 text-slate-300 hover:text-white font-medium">
                            Save Draft
                        </button>
                        <button onClick={handlePrint} className="px-4 py-2 bg-white text-slate-900 rounded-lg font-bold hover:bg-slate-100 flex items-center gap-2">
                            <Printer size={18} /> Print / Save PDF
                        </button>
                        <button onClick={() => handleSave('sent')} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 flex items-center gap-2">
                            <Send size={18} /> Finalize & Send
                        </button>
                    </div>
                </div>

                {/* Preview Canvas */}
                <div className="p-8 flex justify-center">
                    <InvoiceTemplate data={invoiceData} contractorProfile={contractorProfile} />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Editor Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-4 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:bg-slate-100 rounded-lg">
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="font-bold text-slate-800 text-xl">New Invoice</h1>
                </div>
                <button 
                    onClick={() => setStep('preview')}
                    className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 flex items-center gap-2"
                >
                    <FileText size={18} /> Preview
                </button>
            </div>

            <div className="max-w-5xl mx-auto p-6 grid lg:grid-cols-3 gap-6">
                
                {/* LEFT: INVOICE SETTINGS */}
                <div className="space-y-6">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <User size={18} className="text-emerald-600"/> Customer Details
                        </h3>
                        
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Customer</label>
                                <select 
                                    className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50"
                                    onChange={handleCustomerSelect}
                                    value={invoiceData.customerId}
                                >
                                    <option value="">-- Choose existing --</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.customerName || c.propertyName}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="relative">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 border border-slate-200 rounded-lg" 
                                    value={invoiceData.customerName}
                                    onChange={e => setInvoiceData({...invoiceData, customerName: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                                <input 
                                    type="email" 
                                    className="w-full p-2 border border-slate-200 rounded-lg"
                                    value={invoiceData.customerEmail}
                                    onChange={e => setInvoiceData({...invoiceData, customerEmail: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Address</label>
                                <textarea 
                                    className="w-full p-2 border border-slate-200 rounded-lg h-20 resize-none"
                                    value={invoiceData.customerAddress}
                                    onChange={e => setInvoiceData({...invoiceData, customerAddress: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Calendar size={18} className="text-emerald-600"/> Dates & Info
                        </h3>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                                    <input 
                                        type="date" 
                                        className="w-full p-2 border border-slate-200 rounded-lg"
                                        value={invoiceData.date}
                                        onChange={e => setInvoiceData({...invoiceData, date: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label>
                                    <input 
                                        type="date" 
                                        className="w-full p-2 border border-slate-200 rounded-lg"
                                        value={invoiceData.dueDate}
                                        onChange={e => setInvoiceData({...invoiceData, dueDate: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Invoice #</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                                    value={invoiceData.invoiceNumber}
                                    onChange={e => setInvoiceData({...invoiceData, invoiceNumber: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: LINE ITEMS */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <DollarSign size={18} className="text-emerald-600"/> Line Items
                        </h3>
                        
                        <div className="space-y-4">
                            {invoiceData.items.map((item, index) => (
                                <div key={item.id} className="flex gap-3 items-start animate-in slide-in-from-bottom-2">
                                    <div className="flex-1 space-y-2">
                                        <input 
                                            type="text" 
                                            placeholder="Item Description (e.g. Service Call)"
                                            className="w-full p-3 border border-slate-200 rounded-xl font-medium"
                                            value={item.description}
                                            onChange={e => handleItemChange(index, 'description', e.target.value)}
                                        />
                                        <input 
                                            type="text" 
                                            placeholder="Notes (optional - e.g. warranty info)"
                                            className="w-full p-2 border border-slate-100 rounded-lg text-sm text-slate-600"
                                            value={item.notes}
                                            onChange={e => handleItemChange(index, 'notes', e.target.value)}
                                        />
                                    </div>
                                    <div className="w-32">
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                            <input 
                                                type="number" 
                                                placeholder="0.00"
                                                className="w-full pl-6 pr-3 py-3 border border-slate-200 rounded-xl font-medium text-right"
                                                value={item.cost}
                                                onChange={e => handleItemChange(index, 'cost', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => removeItem(index)}
                                        className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button 
                            onClick={addItem}
                            className="mt-6 w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-bold hover:border-emerald-500 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus size={20} /> Add Item
                        </button>
                    </div>

                    {/* Footer / Notes */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Footer Notes</label>
                        <textarea 
                            className="w-full p-3 border border-slate-200 rounded-xl h-24 resize-none"
                            value={invoiceData.notes}
                            onChange={e => setInvoiceData({...invoiceData, notes: e.target.value})}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
