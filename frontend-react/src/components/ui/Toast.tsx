import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './Toast.css';

interface ToastItem {
  id: number;
  message: string;
  type: 'error' | 'success' | 'info';
}

let toastId = 0;
let listeners: Array<(toast: ToastItem) => void> = [];

export function showToast(message: string, type: 'error' | 'success' | 'info' = 'info') {
  const toast: ToastItem = { id: ++toastId, message, type };
  listeners.forEach((fn) => fn(toast));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((toast: ToastItem) => {
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 4000);
  }, []);

  useEffect(() => {
    listeners.push(addToast);
    return () => {
      listeners = listeners.filter((fn) => fn !== addToast);
    };
  }, [addToast]);

  return createPortal(
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.message}
        </div>
      ))}
    </div>,
    document.body
  );
}
