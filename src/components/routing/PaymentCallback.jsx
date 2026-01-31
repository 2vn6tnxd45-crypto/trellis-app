// src/components/routing/PaymentCallback.jsx
// ============================================
// PAYMENT CALLBACK HANDLER
// ============================================
// Handles Stripe payment success/cancel redirects.
// Reads params, shows toast, then redirects to dashboard.

import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

export const PaymentSuccessCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const type = searchParams.get('type');

    setTimeout(() => {
      const message = type === 'deposit'
        ? 'Deposit paid! Your project is now in Active Projects.'
        : 'Payment successful!';
      toast.success(message, { duration: 5000 });

      // Navigate to dashboard
      navigate('/dashboard', { replace: true });
    }, 500);
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800">Payment Successful!</h2>
        <p className="text-slate-500 mt-2">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
};

export const PaymentCancelledCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    setTimeout(() => {
      toast('Payment cancelled', { icon: 'i' });
      navigate('/dashboard', { replace: true });
    }, 500);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-800">Payment Cancelled</h2>
        <p className="text-slate-500 mt-2">Redirecting back...</p>
      </div>
    </div>
  );
};
