// src/pages/StaffRecords.jsx
import React, { useState } from 'react';
import Button from '../components/Button';

export default function StaffRecords() {
  const [records, setRecords] = useState([
    { id: 1, staff: 'Hasan', salary: 30000, month: 'Dec 2025', status: 'Paid' },
    { id: 2, staff: 'Ali', salary: 25000, month: 'Dec 2025', status: 'Pending' },
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Staff Records / Salary</h1>
      <table className="w-full border">
        <thead>
          <tr>
            <th>ID</th>
            <th>Staff</th>
            <th>Salary</th>
            <th>Month</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.staff}</td>
              <td>{r.salary}</td>
              <td>{r.month}</td>
              <td>{r.status}</td>
              <td>
                <Button>Pay</Button> <Button>Edit</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
