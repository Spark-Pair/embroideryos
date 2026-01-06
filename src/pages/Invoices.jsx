// src/pages/Invoices.jsx
import React, { useState } from 'react';
import Button from '../components/Button';

export default function Invoices() {
  const [invoices, setInvoices] = useState([
    { id: 1, customer: 'Customer A', total: 5000, date: '2025-12-12' },
    { id: 2, customer: 'Customer B', total: 12000, date: '2025-12-15' },
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Invoices</h1>
      <Button className="mb-4">Add Invoice</Button>

      <table className="w-full border">
        <thead>
          <tr>
            <th>ID</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map(i => (
            <tr key={i.id}>
              <td>{i.id}</td>
              <td>{i.customer}</td>
              <td>{i.total}</td>
              <td>{i.date}</td>
              <td>
                <Button>View</Button> <Button>Edit</Button> <Button>Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
