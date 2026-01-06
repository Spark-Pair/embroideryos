// src/pages/Payments/Pay.jsx
import React, { useState } from 'react';
import Button from '../components/Button';

export default function PaySupplier() {
  const [payments, setPayments] = useState([
    { id: 1, supplier: 'Supplier X', amount: 5000, date: '2025-12-12' },
    { id: 2, supplier: 'Supplier Y', amount: 12000, date: '2025-12-15' },
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Pay Suppliers</h1>
      <table className="w-full border">
        <thead>
          <tr>
            <th>ID</th>
            <th>Supplier</th>
            <th>Amount</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {payments.map(p => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.supplier}</td>
              <td>{p.amount}</td>
              <td>{p.date}</td>
              <td>
                <Button>Pay</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
