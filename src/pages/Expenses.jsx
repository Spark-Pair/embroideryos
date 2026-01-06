// src/pages/Expenses.jsx
import React, { useState } from 'react';
import Button from '../components/Button';

export default function Expenses() {
  const [expenses, setExpenses] = useState([
    { id: 1, title: 'Electricity', amount: 5000, date: '2025-12-01' },
    { id: 2, title: 'Materials', amount: 12000, date: '2025-12-05' },
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Expenses</h1>
      <Button className="mb-4">Add Expense</Button>

      <table className="w-full border">
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Amount</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map(e => (
            <tr key={e.id}>
              <td>{e.id}</td>
              <td>{e.title}</td>
              <td>{e.amount}</td>
              <td>{e.date}</td>
              <td>
                <Button>Edit</Button> <Button>Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
