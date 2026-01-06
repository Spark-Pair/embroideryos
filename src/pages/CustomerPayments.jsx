// src/pages/Payments/Receive.jsx
import React, { useState } from 'react';
import Button from '../components/button';

export default function ReceivePayment() {
  const [payments, setPayments] = useState([
    { id: 1, customer: 'Customer A', amount: 5000, date: '2025-12-12' },
    { id: 2, customer: 'Customer B', amount: 12000, date: '2025-12-15' },
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Receive Payments</h1>
      <table className="w-full border">
        <thead>
          <tr>
            <th>ID</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {payments.map(p => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.customer}</td>
              <td>{p.amount}</td>
              <td>{p.date}</td>
              <td>
                <Button>Mark Received</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
